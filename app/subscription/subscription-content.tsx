// app/subscription/subscription-content.tsx
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
} from "@solana/spl-token"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, Zap, RefreshCw, AlertCircle } from "lucide-react"
import { SOLANA_CONFIG, LAZORKIT_CONFIG } from "@/lib/config"
import { getUserUsdcAta } from "@/lib/utils"

export default function SubscriptionPageContent() {
  const { isConnected, signAndSendTransaction, wallet } = useWallet()
  const [status, setStatus] = useState<"idle" | "authorizing" | "active">("idle")
  const [balance, setBalance] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [subscriptionMonths, setSubscriptionMonths] = useState(1)
  const [remainingMonths, setRemainingMonths] = useState(0)
  const [billingHistory, setBillingHistory] = useState<Array<{ id: string; amount: string; date: string; status: string }>>([])

  // Helper to fetch balance
  const fetchBalance = async () => {
    setBalanceLoading(true)
    setBalanceError(null)
    setBalance(null)
    if (!wallet) {
      setBalanceLoading(false)
      return
    }
    try {
      if(!LAZORKIT_CONFIG.rpc) throw new Error("RPC URL not configured")
      const connection = new Connection(LAZORKIT_CONFIG.rpc, "confirmed")
      const smartWalletStr = (wallet as any).smartWallet
      if (smartWalletStr) {
        const smartWalletPubkey = new PublicKey(smartWalletStr)
        const userUsdcAccount = await getUserUsdcAta(smartWalletPubkey)
        try {
          const accountInfo = await connection.getTokenAccountBalance(userUsdcAccount, "confirmed")
          setBalance(accountInfo.value.uiAmount)
        } catch(e) {
          setBalance(0)
        }
      } else {
        setBalanceError("No smart wallet address found.")
      }
    } catch (err: any) {
      setBalanceError(err?.message || "Balance fetch error")
    } finally {
      setBalanceLoading(false)
    }
  }

  useEffect(() => {
    if (isConnected && wallet) fetchBalance()
    else {
      setBalance(null)
      setBalanceError(null)
    }
  }, [isConnected, wallet])

  const handleSubscribe = async () => {
    if (!isConnected || !wallet) {
      setErrorMessage("Please connect your wallet first.");
      return;
    }

    setStatus("authorizing");
    setErrorMessage(null);

    try {
      const newSessionKey = Keypair.generate();
      const smartWalletStr = (wallet as any).smartWallet;
      // Use smart wallet as payer/owner
      const payerPubkey = new PublicKey(smartWalletStr);

      // Debug: Print smart wallet address and SOL balance
      if (LAZORKIT_CONFIG.rpc) {
        const connection = new Connection(LAZORKIT_CONFIG.rpc, "confirmed");
        const solBalance = await connection.getBalance(payerPubkey, "confirmed");
        console.log("Smart Wallet Address:", payerPubkey.toString());
        console.log("Smart Wallet SOL Balance:", solBalance / 1_000_000_000, "SOL");
      }


      const userUsdcAccount = await getUserUsdcAta(payerPubkey);
      const totalAmountToApprove = SOLANA_CONFIG.getUsdcAmountForMonths(subscriptionMonths);

      // Debug: Print USDC token account address and balance
      if (LAZORKIT_CONFIG.rpc) {
        const connection = new Connection(LAZORKIT_CONFIG.rpc, "confirmed");
        try {
          const usdcBalance = await connection.getTokenAccountBalance(userUsdcAccount, "confirmed");
          console.log("USDC Token Account:", userUsdcAccount.toString());
          console.log("USDC Token Balance:", usdcBalance.value.uiAmount, "USDC");
        } catch (e) {
          console.log("USDC Token Account does not exist or is not initialized:", userUsdcAccount.toString());
        }
      }

      // Only create SPL token approval instruction (no SOL transfer)
      const approveIx = createApproveInstruction(
        userUsdcAccount,
        newSessionKey.publicKey,
        payerPubkey, // Smart Wallet authorizes
        BigInt(totalAmountToApprove),
      );

      console.log("⏳ Saving session key...");

      // Save to Backend
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
      setSubscriptionId(saveData.subscriptionId);

      console.log("⏳ Requesting Signature...");

      // Only send SPL token approval instruction
      const signature = await signAndSendTransaction({
        instructions: [approveIx],
      });

      console.log("✅ Setup Successful:", signature);
      setRemainingMonths(subscriptionMonths);
      setStatus("active");
      await fetchBalance();

    } catch (err: any) {
      console.error("Subscription error:", err);
      // Nice error message handling
      let msg = err.message;
      if (msg.includes("0x1783") || msg.includes("Transaction is too old")) {
        msg = "Network Lag Error: Please sync your computer clock and try again.";
      } else if (msg.includes("0x2")) {
        msg = "Initialization Error: Ensure you have at least 0.01 SOL in your Smart Wallet.";
      }
      setErrorMessage(msg);
      setStatus("idle");
    }
  };

  const handleAutomatedCharge = async () => {
    if (!subscriptionId) {
        setErrorMessage("No active subscription found.");
        return;
    }
    const newId = Math.random().toString(36).substr(2, 9)
    setBillingHistory(prev => [{ id: newId, amount: "Processing...", date: "Now", status: "Pending" }, ...prev])

    try {
      const res = await fetch("/api/subscription/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Charge failed");
      
      setBillingHistory(prev => prev.map(item => 
        item.id === newId ? { ...item, amount: `${data.amountCharged} USDC`, status: "Success" } : item
      ));
      setRemainingMonths(data.monthsRemaining);
      await fetchBalance();
    } catch (err: any) {
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
             <h3 className="font-semibold">History <span className="text-sm text-slate-500 font-normal ml-2">
               Bal: {balanceLoading ? <Loader2 className="inline w-4 h-4 animate-spin align-middle" /> : balanceError ? <span className="text-red-500">Err</span> : balance !== null ? balance.toFixed(2) : '...'} USDC
             </span></h3>
             {balanceError && <div className="text-xs text-red-500">Balance error: {balanceError}</div>}
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