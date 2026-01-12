"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@lazorkit/wallet" // 👈 The Real SDK
import { 
  PublicKey, 
  Keypair,
  Connection,
  SystemProgram,
} from "@solana/web3.js"
import {
  createApproveInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, Zap, RefreshCw, AlertCircle } from "lucide-react"
import { SOLANA_CONFIG, LAZORKIT_CONFIG } from "@/lib/config"
import { getUserUsdcAta, checkTokenAccountExists } from "@/lib/utils"


export default function SubscriptionPageContent() {
  const { 
    connect, 
    isConnected, 
    signAndSendTransaction,
    wallet
  } = useWallet()

  const [status, setStatus] = useState<"idle" | "authorizing" | "active">("idle")

  // Fetch real USDC balance when wallet connects
  const fetchBalance = async () => {
    if (!wallet) return
    try {
      const connection = new Connection(LAZORKIT_CONFIG.rpc, "confirmed")
      const smartWalletStr = (wallet as any).smartWallet
      if (smartWalletStr) {
        const smartWalletPubkey = new PublicKey(smartWalletStr)
        const userUsdcAccount = await getUserUsdcAta(smartWalletPubkey)
        try {
          const accountInfo = await connection.getTokenAccountBalance(userUsdcAccount, "confirmed")
          const usdcBalance = parseFloat(accountInfo.value.amount) / Math.pow(10, SOLANA_CONFIG.USDC_DECIMALS)
          setBalance(usdcBalance)
        } catch (err) {
          // Account may not exist or no USDC yet
          console.log("USDC account not found or empty", err)
          setBalance(0)
        }
      }
    } catch (err) {
      console.error("Failed to fetch USDC balance:", err)
    }
  }

  // Update balance when wallet connects
  useEffect(() => {
    if (isConnected && wallet) {
      if (wallet.smartWallet) {
        console.log(`[WALLET LOG] Connected wallet public key:`, wallet.smartWallet);
      }
      fetchBalance()
    }
  }, [isConnected, wallet])

  const [billingHistory, setBillingHistory] = useState<Array<{ id: string; amount: string; date: string; status: string }>>([])
  const [balance, setBalance] = useState<number | null>(null)
  const [sessionKey, setSessionKey] = useState<Keypair | null>(null)
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [subscriptionMonths, setSubscriptionMonths] = useState(1)
  const [remainingMonths, setRemainingMonths] = useState(0)

  // Optional: configure API base URL (useful when tunneling via ngrok)
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ""

  // Simple fetch with retry for transient 502/503/504 errors from tunnels or edge
  const fetchWithRetry = async (
    path: string,
    init: RequestInit,
    retries = 3,
    backoffMs = 700
  ): Promise<Response> => {
    const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`
    let lastErr: any
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, init)
        // Retry on transient upstream errors
        if ([502, 503, 504].includes(res.status)) {
          throw new Error(`Upstream error ${res.status} ${res.statusText}`)
        }
        return res
      } catch (err) {
        lastErr = err
        if (attempt === retries) break
        await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)))
      }
    }
    throw lastErr
  }

  // 1. THE SETUP: User delegates authority (Signs 1 time with Passkey)
  const handleSubscribe = async () => {
    console.log("🔵 handleSubscribe called");
    console.log("isConnected:", isConnected);
    console.log("wallet:", wallet);

    if (!isConnected || !wallet) {
      console.log("❌ Wallet not connected. Please connect using the button in the header.");
      setErrorMessage("Please connect your wallet first using the Connect button.");
      return;
    }

    setStatus("authorizing");
    setErrorMessage(null);
    console.log("✅ Starting subscription flow...");

    try {
      // A. Generate a fresh Session Key
      const newSessionKey = Keypair.generate();
      console.log("✅ Generated Session Key:", newSessionKey.publicKey.toString());

      // B. Resolve payer (must be a signer) and merchant
      const smartWalletStr = (wallet as any).smartWallet;
      const userPubkeyStr = wallet.publicKey || smartWalletStr;
      
      if (!userPubkeyStr) {
        throw new Error("User wallet public key unavailable");
      }
      
      const payerPubkey = new PublicKey(userPubkeyStr); // Sign with actual wallet
      const merchantPubkey = new PublicKey(SOLANA_CONFIG.MERCHANT_WALLET);
      
      console.log("✅ Payer PublicKey (Signer):", payerPubkey.toString());
      console.log("✅ Merchant PublicKey:", merchantPubkey.toString());

      // Get the User's USDC Token Account (ATA)
      console.log("⏳ Getting user USDC token account...");
      const connection = new Connection(LAZORKIT_CONFIG.rpc, "confirmed");
      const userUsdcAccount = await getUserUsdcAta(payerPubkey);
      console.log("✅ User USDC ATA:", userUsdcAccount.toString());

      // Check if the user's USDC account exists
      const accountExists = await checkTokenAccountExists(connection, userUsdcAccount);
      if (!accountExists) {
        throw new Error(
          "Your USDC token account doesn't exist. Please create it first by receiving some devnet USDC. " +
          "Visit https://faucet.circle.com/ or use a Solana faucet to get devnet USDC."
        );
      }
      console.log("✅ USDC token account verified");

      // Calculate Total Allowance (Approval Limit)
      // We approve the TOTAL amount for all months upfront.
      // The backend will only pull 1 month at a time.
      const totalAmountToApprove = SOLANA_CONFIG.getUsdcAmountForMonths(subscriptionMonths);
      const totalUSDC = SOLANA_CONFIG.getTotalUsdcForMonths(subscriptionMonths);
      console.log(`⏳ Approving delegation for ${totalUSDC} USDC (${subscriptionMonths} months)...`);

      // SAVE SESSION KEY TO BACKEND BEFORE APPROVAL
      console.log("⏳ Saving session key to backend...");
      const saveRes = await fetchWithRetry("/api/subscription/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: payerPubkey.toString(),
          userUsdcAccount: userUsdcAccount.toString(),
          sessionKeySecret: Array.from(newSessionKey.secretKey),
          monthsPrepaid: subscriptionMonths,
          monthlyRate: SOLANA_CONFIG.SUBSCRIPTION_MONTHLY_RATE_USDC,
          approvedAmount: totalAmountToApprove,
        }),
      }, 3, 700);
      if (!saveRes.ok) {
        let extra = ""
        try {
          const t = await saveRes.text()
          extra = t ? ` | ${t}` : ""
        } catch {}
        throw new Error(`Failed to save session key: ${saveRes.status} ${saveRes.statusText}${extra}`)
      }
      const saveData = await saveRes.json();
      console.log("✅ Session key saved:", saveData.subscriptionId);
      setSubscriptionId(saveData.subscriptionId); // Store ID for later API calls

      // Fund the Session Key with 0.01 SOL so it can pay gas fees for future transactions
      console.log("⏳ Creating session key funding instruction...");
      const fundIx = SystemProgram.transfer({
        fromPubkey: payerPubkey,
        toPubkey: newSessionKey.publicKey,
        lamports: 0.01 * 1_000_000_000, // 0.01 SOL for gas fees
      });

      // Create the "Access" Instruction (Approve)
      // This does NOT move funds. It just gives permission.
      // The session key can now spend up to totalAmountToApprove from the user's USDC account.
      console.log("⏳ Creating approval instruction...");
      const approveIx = createApproveInstruction(
        userUsdcAccount,          // Account to spend from (User's USDC ATA)
        newSessionKey.publicKey,  // Delegate who can spend (The Session Key)
        payerPubkey,              // Owner (The User)
        BigInt(totalAmountToApprove),     // Max amount they can take (as BigInt for SPL token)
        [],                       // Multi-signers (none)
        TOKEN_PROGRAM_ID
      );

      console.log(`⏳ Signing transaction with Lazorkit... Funding session key + Delegating ${totalUSDC} USDC`);
      const signature = await signAndSendTransaction({
        instructions: [fundIx, approveIx], // Both in one transaction
      });

      console.log("✅ Approval Successful. Access Delegated:", signature);
      console.log("🔑 Session Key PublicKey (Delegate):", newSessionKey.publicKey.toString());
      setSessionKey(newSessionKey);
      setRemainingMonths(subscriptionMonths);
      setStatus("active");
      addBillingRecord(`Subscribed for ${subscriptionMonths} month${subscriptionMonths > 1 ? 's' : ''} - ${totalUSDC} USDC approved`);
      // Refresh balance after successful transaction
      await fetchBalance();
      setErrorMessage(null);

    } catch (err) {
      console.error("❌ Subscription error:", err);
      
      let errorMsg = "Failed to authorize subscription";
      if (err instanceof Error) {
        console.error("Error message:", err.message);
        if (err.message.includes("rejected")) {
          errorMsg = "You rejected the passkey signature";
        } else if (err.message.includes("WebAuthn") || err.message.includes("TLS")) {
          errorMsg = "Passkey signing requires HTTPS. Use a deployed version or ngrok with valid HTTPS";
        } else if (err.message.includes("InstructionError")) {
          errorMsg = "Transaction failed. Ensure you have devnet SOL and a valid destination";
        } else if (err.message.includes("Transaction too large")) {
          errorMsg = "Transaction too large. This shouldn't happen with optimized instructions";
        } else {
          errorMsg = `Error: ${err.message}`;
        }
      }
      setErrorMessage(errorMsg);
      setStatus("idle");
    }
  };

  // 2. THE EXECUTION: Monthly auto-charge (no signature after initial delegation)
  const handleAutomatedCharge = async () => {
    if (!subscriptionId) {
      setErrorMessage("Error: No Subscription ID found. Please subscribe first.");
      return;
    }

    if (remainingMonths <= 0) {
      setErrorMessage("No active subscription. Please subscribe first.");
      return;
    }

    const newId = Math.random().toString(36).substr(2, 9)
    const monthlyAmount = SOLANA_CONFIG.SUBSCRIPTION_MONTHLY_RATE_USDC.toFixed(2);
    setBillingHistory(prev => [{ id: newId, amount: "Processing...", date: "Now", status: "Pending" }, ...prev])

    try {
      console.log(`⏳ Calling Backend API to Charge ${monthlyAmount} USDC...`);
      
      // Real API call to backend - session key signs without user interaction
      const res = await fetchWithRetry("/api/subscription/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId }),
      }, 3, 700);

      const data = await res.json();

      if (!res.ok) {
        // Show backend error message to user
        setErrorMessage(data.error || "Charge failed");
        setStatus("idle");
        return;
      }

      console.log("✅ Charge Successful! Transaction:", data.signature);
      console.log(`✅ Charged ${data.amountCharged} USDC. Months remaining: ${data.monthsRemaining}`);
      
      setBillingHistory(prev => prev.map(item => 
        item.id === newId ? { ...item, amount: `${data.amountCharged} USDC`, status: "Success" } : item
      ));
      setRemainingMonths(data.monthsRemaining);
      await fetchBalance();
      
      if (data.monthsRemaining === 0) {
        setStatus("idle");
        setErrorMessage("Subscription expired. Please renew to continue.");
      }
    } catch (err) {
      console.error("❌ Charge Failed:", err);
      setBillingHistory(prev => prev.map(item => 
        item.id === newId ? { ...item, amount: `${monthlyAmount} USDC`, status: "Failed" } : item
      ));
      setErrorMessage(err instanceof Error ? err.message : "Auto-charge failed");
    }
  }

  const addBillingRecord = (label: string) => {
    setBillingHistory(prev => [
      {
        id: Math.random().toString(36).substr(2, 9),
        amount: `${SOLANA_CONFIG.SUBSCRIPTION_MONTHLY_RATE_USDC} USDC`,
        date: new Date().toLocaleDateString(),
        status: "Success"
      },
      ...prev
    ])
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Header />

      <main className="pt-24 max-w-4xl mx-auto p-6 space-y-12">
        
        {/* HERO SECTION */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Smart Subscriptions with Lazorkit</h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Real passkey-based gasless subscriptions using <strong>Delegated Authority</strong>. 
            Sign once with FaceID/Passkey to approve USDC spending, and your session key handles monthly payments automatically.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          
          {/* LEFT: User View (The Plan) */}
          <Card className="border-2 border-slate-200 shadow-lg dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Pro Plan</span>
                <Badge variant={status === "active" ? "default" : "secondary"}>
                  {status === "active" ? "Active" : "Inactive"}
                </Badge>
              </CardTitle>
              <CardDescription>Automated monthly billing via Smart Wallet + Session Key</CardDescription>
              {errorMessage && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {errorMessage}
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {status === "idle" ? (
                <>
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-slate-900 dark:text-white">Select Subscription Duration</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 3, 6, 12].map(months => (
                        <button
                          key={months}
                          onClick={() => setSubscriptionMonths(months)}
                          className={`p-3 rounded border text-sm font-medium transition-all ${
                            subscriptionMonths === months
                              ? "bg-blue-500 text-white border-blue-500"
                              : "border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          {months}mo
                        </button>
                      ))}
                    </div>
                    
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-slate-600 dark:text-slate-400">Upfront Approval Limit</p>
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{SOLANA_CONFIG.getTotalUsdcForMonths(subscriptionMonths).toFixed(2)} USDC</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Approve spending limit for {subscriptionMonths} month{subscriptionMonths > 1 ? 's' : ''}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Monthly charge: {SOLANA_CONFIG.SUBSCRIPTION_MONTHLY_RATE_USDC} USDC (automated, no signature)</p>
                    </div>
                  </div>

                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Sign once with Passkey/FaceID</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Approve USDC spending limit (funds stay in your wallet)</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Auto-charge {SOLANA_CONFIG.SUBSCRIPTION_MONTHLY_RATE_USDC} USDC monthly (no signature)</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Cancel anytime</li>
                  </ul>

                  <Button onClick={handleSubscribe} disabled={status !== "idle"} className="w-full h-12 text-lg">
                    🔐 Subscribe with Passkey
                  </Button>
                </>
              ) : status === "authorizing" ? (
                <Button disabled className="w-full h-12 text-lg bg-blue-500 hover:bg-blue-500">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authorizing... Check your passkey
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50/50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900">
                    <p className="text-green-700 dark:text-green-400 font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5"/> Active Subscription ✅
                    </p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-2">{remainingMonths} months remaining</p>
                    <p className="text-xs text-green-600/80 mt-2">
                      Next auto-charge: {SOLANA_CONFIG.SUBSCRIPTION_MONTHLY_RATE_USDC} USDC <br/>
                      Session Key: <span className="font-mono">{sessionKey?.publicKey.toString().slice(0, 16)}...</span>
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* RIGHT: Transaction History */}
          <div className="space-y-4">
             <div className="flex justify-between items-center px-1">
                <h3 className="font-semibold text-slate-900 dark:text-white">Transaction History</h3>
                <div className="text-sm text-slate-500">USDC Balance: <span className="font-mono text-slate-900 dark:text-white">{balance !== null ? `${balance.toFixed(2)} USDC` : 'Loading...'}</span></div>
                <div className="text-xs text-slate-500 mt-1">Approval costs a small SOL network fee; no USDC moves until monthly charge.</div>
             </div>
             
             <div className="space-y-3">
                {billingHistory.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed rounded-xl">
                        <p>No transactions yet</p>
                    </div>
                ) : (
                    billingHistory.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-lg border shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${tx.status === "Pending" ? "bg-yellow-100 text-yellow-600" : tx.status === "Success" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                                    {tx.status === "Pending" ? <RefreshCw className="w-4 h-4 animate-spin"/> : tx.status === "Success" ? <Zap className="w-4 h-4"/> : <AlertCircle className="w-4 h-4"/>}
                                </div>
                                <div>
                                    <p className="font-medium text-sm">Monthly Subscription</p>
                                    <p className="text-xs text-slate-500">{tx.date}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-mono font-bold">- {tx.amount}</p>
                                <p className={`text-xs ${tx.status === "Success" ? "text-green-600" : tx.status === "Pending" ? "text-yellow-600" : "text-red-600"}`}>{tx.status}</p>
                            </div>
                        </div>
                    ))
                )}
             </div>
          </div>
        </div>

        {/* --- DEMO CONTROLLER --- */}
        {status === "active" && (
          <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-700">Demo Controller</Badge>
                      <span className="text-sm text-blue-600 dark:text-blue-400">Simulate backend auto-charge (no signature popup)</span>
                  </div>
              </div>
              
                <div className="flex items-center gap-4">
                  <Button 
                    variant="secondary" 
                    onClick={handleAutomatedCharge}
                    disabled={status !== "active"}
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Run Real Auto-Charge (Demo)
                  </Button>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    This triggers a real SOL transfer from your wallet to the merchant to mimic a backend charge. You will confirm the transaction.
                  </p>
                </div>
          </div>
        )}

      </main>
    </div>
  )
}
