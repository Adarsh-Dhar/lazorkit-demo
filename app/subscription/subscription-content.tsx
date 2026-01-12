"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@lazorkit/wallet" 
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
  const { connect, isConnected, signAndSendTransaction, wallet } = useWallet()
  const [status, setStatus] = useState<"idle" | "authorizing" | "active">("idle")
  const [balance, setBalance] = useState<number | null>(null)
  const [sessionKey, setSessionKey] = useState<Keypair | null>(null)
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null) // 👈 Added: To store real ID
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [subscriptionMonths, setSubscriptionMonths] = useState(1)
  const [remainingMonths, setRemainingMonths] = useState(0)
  const [billingHistory, setBillingHistory] = useState<Array<{ id: string; amount: string; date: string; status: string }>>([])

  // Helper to check for MetaMask
  const isMetaMaskAvailable = typeof window !== "undefined" && (window as any).ethereum && (window as any).ethereum.isMetaMask

  // Wrap connect to check for MetaMask
  const handleConnect = async () => {
    setErrorMessage(null)
    if (!isMetaMaskAvailable) {
      setErrorMessage("MetaMask extension not found. Please install MetaMask and refresh the page.")
      return
    }
    try {
      await connect()
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to connect to wallet.")
    }
  }

  // Fetch real USDC balance
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
          setBalance(0)
        }
      }
    } catch (err) {
      console.error("Failed to fetch USDC balance:", err)
    }
  }

  useEffect(() => {
    if (isConnected && wallet) fetchBalance()
  }, [isConnected, wallet])

  // 1. THE SETUP: User delegates authority
  const handleSubscribe = async () => {
    if (!isConnected || !wallet) {
      setErrorMessage("Please connect your wallet first.");
      return;
    }

    setStatus("authorizing");
    setErrorMessage(null);

    try {
      // A. Generate Session Key
      const newSessionKey = Keypair.generate();
      
      const smartWalletStr = (wallet as any).smartWallet;
      // Use smartWallet string as the public key
      const payerPubkey = new PublicKey(smartWalletStr);
      
      // B. Get User's USDC Token Account
      const userUsdcAccount = await getUserUsdcAta(payerPubkey);

      // C. Calculate Totals
      const totalAmountToApprove = SOLANA_CONFIG.getUsdcAmountForMonths(subscriptionMonths);
      
      // D. SAVE SESSION KEY TO BACKEND FIRST
      console.log("⏳ Saving session key to backend...");
      const saveRes = await fetch("/api/subscription/create", {
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
      });

      if (!saveRes.ok) throw new Error("Failed to save session key");
      const saveData = await saveRes.json();
      setSubscriptionId(saveData.subscriptionId); // 👈 Store the ID!

      // E. Create Instructions
      
      // 1. Fund the Session Key (So it can pay gas fees later)
      // NOTE: Your Smart Wallet MUST have SOL for this to work!
      const fundIx = SystemProgram.transfer({
        fromPubkey: payerPubkey,
        toPubkey: newSessionKey.publicKey,
        lamports: 0.01 * 1_000_000_000, // 0.01 SOL
      });

      // 2. Approve USDC Spending
      const approveIx = createApproveInstruction(
        userUsdcAccount,
        newSessionKey.publicKey,
        payerPubkey,
        BigInt(totalAmountToApprove),
        [],
        TOKEN_PROGRAM_ID
      );

      console.log("⏳ Signing setup transaction...");
      const signature = await signAndSendTransaction({
        instructions: [fundIx, approveIx],
      });

      console.log("✅ Setup Successful:", signature);
      setSessionKey(newSessionKey);
      setRemainingMonths(subscriptionMonths);
      setStatus("active");
      await fetchBalance();

    } catch (err: any) {
      console.error("Subscription error:", err);
      setErrorMessage(err.message || "Failed to authorize subscription. Ensure you have SOL.");
      setStatus("idle");
    }
  };

  // 2. THE EXECUTION: Real Auto-Charge via API
  const handleAutomatedCharge = async () => {
    if (!subscriptionId) {
      setErrorMessage("No active subscription ID found. Please subscribe first.");
      return;
    }

    const newId = Math.random().toString(36).substr(2, 9)
    setBillingHistory(prev => [{ id: newId, amount: "Processing...", date: "Now", status: "Pending" }, ...prev])

    try {
      console.log(`⏳ Calling Backend API for Sub ID: ${subscriptionId}`);
      
      // 👈 REAL API CALL
      const res = await fetch("/api/subscription/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Charge failed");
      
      console.log(`✅ Auto-charge successful: ${data.signature}`);
      
      setBillingHistory(prev => prev.map(item => 
        item.id === newId ? { ...item, amount: `${data.amountCharged} USDC`, status: "Success" } : item
      ));
      setRemainingMonths(data.monthsRemaining);
      await fetchBalance();

      if (data.monthsRemaining === 0) {
        setStatus("idle");
        setErrorMessage("Subscription ended.");
      }

    } catch (err: any) {
      console.error("Auto-charge failed:", err)
      setBillingHistory(prev => prev.map(item => item.id === newId ? { ...item, status: "Failed" } : item))
      setErrorMessage(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Header />
      <main className="pt-24 max-w-4xl mx-auto p-6 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Smart Subscriptions</h1>
          <p className="text-lg text-slate-500">Sign once. Auto-pay monthly.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          <Card className="border-2 border-slate-200 shadow-lg dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Pro Plan</span>
                <Badge variant={status === "active" ? "default" : "secondary"}>{status === "active" ? "Active" : "Inactive"}</Badge>
              </CardTitle>
              {errorMessage && (
                <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {errorMessage}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {status === "idle" ? (
                <>
                  <div className="space-y-4">
                    <label className="text-sm font-medium">Duration</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 3, 6, 12].map(months => (
                        <button key={months} onClick={() => setSubscriptionMonths(months)}
                          className={`p-3 rounded border text-sm font-medium ${subscriptionMonths === months ? "bg-blue-500 text-white" : "hover:bg-slate-50"}`}>
                          {months}mo
                        </button>
                      ))}
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                       <p className="text-sm">Total Approval</p>
                       <p className="text-2xl font-bold text-blue-600">{SOLANA_CONFIG.getTotalUsdcForMonths(subscriptionMonths).toFixed(2)} USDC</p>
                    </div>
                  </div>
                  <Button onClick={handleSubscribe} className="w-full h-12 text-lg">Subscribe with Passkey</Button>
                </>
              ) : status === "authorizing" ? (
                <Button disabled className="w-full h-12 text-lg"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Authorizing...</Button>
              ) : (
                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-green-700 font-medium flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> Active ✅</p>
                  <p className="text-2xl font-bold text-green-700 mt-2">{remainingMonths} months left</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
             <h3 className="font-semibold">History <span className="text-sm text-slate-500 font-normal ml-2">Bal: {balance?.toFixed(2) ?? '...'} USDC</span></h3>
             <div className="space-y-3">
                {billingHistory.map((tx) => (
                    <div key={tx.id} className="flex justify-between p-4 bg-white rounded-lg border shadow-sm">
                        <div className="flex items-center gap-3">
                            {tx.status === "Pending" ? <RefreshCw className="w-4 h-4 animate-spin"/> : tx.status === "Success" ? <Zap className="w-4 h-4 text-green-600"/> : <AlertCircle className="w-4 h-4 text-red-600"/>}
                            <p className="font-medium text-sm">Charge</p>
                        </div>
                        <div className="text-right"><p className="font-mono font-bold">{tx.amount}</p><p className="text-xs">{tx.status}</p></div>
                    </div>
                ))}
             </div>
          </div>
        </div>

        {status === "active" && (
          <div className="mt-12 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
              <div className="flex items-center gap-4">
                <Button onClick={handleAutomatedCharge} className="gap-2"><RefreshCw className="w-4 h-4" /> Trigger Auto-Charge (Backend)</Button>
                <p className="text-sm text-blue-700">This simulates the monthly Cron Job running on the server.</p>
              </div>
          </div>
        )}
      </main>
    </div>
  )
}