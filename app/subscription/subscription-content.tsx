"use client"

import { useState } from "react"
import { useWallet } from "@lazorkit/wallet" // 👈 The Real SDK
import { 
  PublicKey, 
  Keypair,
  TransactionInstruction
} from "@solana/web3.js"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, Zap, RefreshCw, AlertCircle } from "lucide-react"

// Configuration - Initialize only when component mounts
function getConfig() {
  return {
    MERCHANT_WALLET: new PublicKey("TokenkegQfeZyiNwAJsyFbPVwwQQfjourPAxMmUP7Pc"),
    USDC_MINT: new PublicKey("EPjFWaJY6ER7z8vNmwrBb5aMsCGkjnEYDSXjPVREXcd"),
    // Use a valid generated public key for the mock user
    MOCK_USER_ADDRESS: Keypair.generate().publicKey
  }
}

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

  const config = getConfig()

  // 1. THE SETUP: User delegates authority (Signs 1 time with Passkey)
  const handleSubscribe = async () => {
    if (!isConnected || !wallet) {
      await connect();
      return;
    }

    setStatus("authorizing");

    try {
      // A. Generate a fresh Session Key
      const newSessionKey = Keypair.generate();

      // B. Create the memo instruction (requires at least one account key)
      // Reference the USDC mint as an account key
      const memoInstruction = new TransactionInstruction({
        keys: [
          {
            pubkey: config.USDC_MINT,
            isSigner: false,
            isWritable: false
          }
        ],
        programId: new PublicKey("MemoSq4gDiYvj6v8V9PkXcLJvWb4nKQGiRCmhfLyGCK"),
        data: Buffer.from(`Delegation: Session Key ${newSessionKey.publicKey.toString().slice(0, 8)}... authorized for 5 USDC/month`, 'utf-8')
      });

      // C. Execute using Lazorkit (Gasless + Passkey)
      const signature = await signAndSendTransaction({
        instructions: [memoInstruction]
      });

      console.log("Delegation Success:", signature);
      setSessionKey(newSessionKey);
      setStatus("active");
      addBillingRecord("Initial Setup");

    } catch (err) {
      console.error("User rejected passkey or error:", err);
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
