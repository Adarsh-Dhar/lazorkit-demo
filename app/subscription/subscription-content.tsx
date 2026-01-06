"use client"

import { useState } from "react"
import { useWallet } from "@lazorkit/wallet" // 👈 The Real SDK
import { 
  PublicKey, 
  Keypair,
  Connection
} from "@solana/web3.js"
import { 
  createApproveInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, Zap, RefreshCw, AlertCircle } from "lucide-react"
import { SOLANA_CONFIG, LAZORKIT_CONFIG } from "@/lib/config"


export default function SubscriptionPageContent() {
  const { 
    connect, 
    isConnected, 
    signAndSendTransaction,
    wallet
  } = useWallet()

  const [status, setStatus] = useState<"idle" | "authorizing" | "active">("idle")
  const [billingHistory, setBillingHistory] = useState<Array<{ id: string; amount: string; date: string; status: string }>>([])
  const [balance, setBalance] = useState(100)
  const [sessionKey, setSessionKey] = useState<Keypair | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

      // B. Get the wallet's public key from passkeyPubkey
      // The passkeyPubkey is a 33-byte array where:
      //   - First byte is the prefix (0x03 or 0x02 for compressed ed25519)
      //   - Next 32 bytes are the actual public key
      const passkeyArray = (wallet as any).passkeyPubkey;
      console.log("passkeyPubkey array:", passkeyArray);
      console.log("passkeyPubkey length:", passkeyArray?.length);
      
      if (!passkeyArray || !Array.isArray(passkeyArray) || passkeyArray.length !== 33) {
        throw new Error("Invalid passkeyPubkey format");
      }

      // Skip the first byte (compression prefix), use the 32-byte key
      const pubkeyBytes = new Uint8Array(passkeyArray.slice(1, 33));
      console.log("pubkeyBytes (32 bytes):", pubkeyBytes);
      const walletPublicKey = new PublicKey(pubkeyBytes);
      console.log("✅ Created PublicKey from passkeyPubkey:", walletPublicKey.toString());

      console.log("✅ User wallet PublicKey:", walletPublicKey.toString());

      // C. Get the user's USDC Associated Token Account (ATA)
      console.log("⏳ Fetching user's USDC ATA...");
      const userATA = await getAssociatedTokenAddress(
        SOLANA_CONFIG.USDC_MINT,
        walletPublicKey
      );
      console.log("✅ User USDC ATA:", userATA.toString());

      // D. Verify the USDC account actually exists on-chain
      console.log("⏳ Verifying USDC account exists on devnet...");
      const connection = new Connection(LAZORKIT_CONFIG.rpc, "confirmed");
      const accountInfo = await connection.getAccountInfo(userATA);
      
      if (!accountInfo) {
        throw new Error(
          `USDC account not found at ${userATA.toString()}. ` +
          "You need to create a USDC token account first. " +
          "Visit https://faucet.solana.com or use Phantom wallet to create one."
        );
      }
      console.log("✅ USDC account exists!");

      // E. Create REAL SPL Token Approval Instruction
      console.log("⏳ Creating SPL Token Approval instruction...");
      const approveInstruction = createApproveInstruction(
        userATA,                                        // From: User's USDC Account
        newSessionKey.publicKey,                        // Delegate: The Session Key
        walletPublicKey,                                // Owner: The User (must sign)
        SOLANA_CONFIG.subscriptionAmountTokens,         // Amount: 5 USDC (in token units)
        [],                                             // No multi-signers
        TOKEN_PROGRAM_ID
      );
      console.log("✅ Approval instruction created");

      // F. Execute using Lazorkit (Gasless + Passkey)
      console.log("⏳ Signing transaction with Lazorkit...");
      const signature = await signAndSendTransaction({
        instructions: [approveInstruction],
      });

      console.log("✅ SPL Token Approval Success:", signature);
      console.log("🔑 Session Key authorized:", newSessionKey.publicKey.toString());
      setSessionKey(newSessionKey);
      setStatus("active");
      addBillingRecord("Initial Setup");
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
        } else if (err.message.includes("USDC account not found")) {
          errorMsg = err.message;
        } else if (err.message.includes("account does not exist")) {
          errorMsg = "USDC account not found. You need to create a USDC token account on devnet first";
        } else if (err.message.includes("InstructionError")) {
          errorMsg = "Transaction failed. Ensure you have devnet SOL and a USDC token account";
        } else {
          errorMsg = `Error: ${err.message}`;
        }
      }
      setErrorMessage(errorMsg);
      setStatus("idle");
    }
  };

  // 2. THE EXECUTION: Backend charges user (No User Signature)
  const handleAutomatedCharge = async () => {
    if (!sessionKey || !wallet) return;

    const newId = Math.random().toString(36).substr(2, 9)
    setBillingHistory(prev => [{ id: newId, amount: "5.00 USDC", date: "Now", status: "Pending" }, ...prev])
    
    await new Promise((resolve) => setTimeout(resolve, 1500))

    try {
      console.log(`
        ✅ Charging 5 USDC via Session Key: ${sessionKey.publicKey.toString().slice(0, 8)}...
        ❌ No User Popup Triggered
        (In production, this happens on your server cron job)
      `);
      
      setBillingHistory(prev => prev.map(item => item.id === newId ? { ...item, status: "Success" } : item))
      setBalance(prev => prev - 5)
      
    } catch (err) {
      console.error(err);
      setBillingHistory(prev => prev.map(item => item.id === newId ? { ...item, status: "Failed" } : item))
    }
  };

  const addBillingRecord = (label: string) => {
    setBillingHistory(prev => [
      {
        id: Math.random().toString(36).substr(2, 9),
        amount: "5.00 USDC",
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
            Sign once with FaceID/Passkey, and your session key handles monthly USDC payments automatically.
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
              <div className="text-3xl font-bold">5 USDC <span className="text-sm font-normal text-slate-500">/ month</span></div>
              
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Sign once with Passkey/FaceID</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Session key delegates authority</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Gas fees sponsored by Paymaster</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Cancel anytime</li>
              </ul>

              {status === "idle" ? (
                <Button onClick={handleSubscribe} disabled={status !== "idle"} className="w-full h-12 text-lg">
                  🔐 Subscribe with Passkey
                </Button>
              ) : status === "authorizing" ? (
                <Button disabled className="w-full h-12 text-lg bg-blue-500 hover:bg-blue-500">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authorizing... Check your passkey
                </Button>
              ) : (
                <div className="p-4 bg-green-50/50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900">
                  <p className="text-green-700 dark:text-green-400 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5"/> Authority Delegated ✅
                  </p>
                  <p className="text-xs text-green-600/80 mt-1">
                    Session Key: <span className="font-mono">{sessionKey?.publicKey.toString().slice(0, 16)}...</span>
                  </p>
                  <p className="text-xs text-green-600/80 mt-2">
                    Your session key is configured to withdraw up to 5 USDC every 30 days. No user signature needed on recurring charges.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* RIGHT: Transaction History */}
          <div className="space-y-4">
             <div className="flex justify-between items-center px-1">
                <h3 className="font-semibold text-slate-900 dark:text-white">Transaction History</h3>
                <div className="text-sm text-slate-500">Wallet Balance: <span className="font-mono text-slate-900 dark:text-white">{balance}.00 USDC</span></div>
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
                      Simulate Backend Charge (30 Days Later)
                  </Button>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                      This simulates your backend server charging the user using the session key. <strong>Notice: No passkey popup!</strong>
                  </p>
              </div>
          </div>
        )}

      </main>
    </div>
  )
}
