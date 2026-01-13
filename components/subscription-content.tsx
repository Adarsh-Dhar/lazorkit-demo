// app/subscription/subscription-content.tsx
"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, Zap, RefreshCw, AlertCircle } from "lucide-react"
import { SOLANA_CONFIG } from "@/lib/config"


export default function SubscriptionPageContent() {
  const [status, setStatus] = useState<"idle" | "authorizing" | "active">("idle")
  const [balance, setBalance] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [subscriptionMonths, setSubscriptionMonths] = useState(1)
  const [remainingMonths, setRemainingMonths] = useState(0)
  const [billingHistory, setBillingHistory] = useState<Array<{ id: string; amount: string; date: string; status: string }>>([])


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
                  <Button className="w-full h-12 text-lg">Subscribe with Passkey</Button>
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
                <Button className="gap-2"><RefreshCw className="w-4 h-4" /> Trigger Auto-Charge (Backend)</Button>
                <p className="text-sm text-blue-700">This simulates the monthly Cron Job running on the server.</p>
              </div>
          </div>
        )}
      </main>
    </div>
  )
}