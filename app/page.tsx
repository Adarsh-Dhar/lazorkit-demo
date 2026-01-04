"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import HeroSection from "@/components/hero-section"
import { useTheme } from "@/hooks/use-theme"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, RefreshCw, Zap } from "lucide-react"

export default function Home() {
  const { isDark, toggleTheme } = useTheme()
  const [isConnected, setIsConnected] = useState(false)
  const [activeTab, setActiveTab] = useState<"home" | "subscription">("home")
  const router = useRouter()

  // Subscription state
  const [subscriptionStatus, setSubscriptionStatus] = useState<"inactive" | "active" | "processing">("inactive")
  const [billingHistory, setBillingHistory] = useState<
    Array<{ id: string; amount: string; date: string; status: string }>
  >([])
  const [balance, setBalance] = useState(100)

  const handleConnect = () => {
    setIsConnected(true)
    console.log("Lazorkit: Wallet Connected")
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    setSubscriptionStatus("inactive")
    setActiveTab("home")
  }

  const handleSubscribe = async () => {
    setSubscriptionStatus("processing")
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setSubscriptionStatus("active")
    addBillingRecord("Initial Charge")
  }

  const handleSimulateRecurringCharge = async () => {
    if (subscriptionStatus !== "active") return

    const newId = Math.random().toString(36).substr(2, 9)
    setBillingHistory((prev) => [{ id: newId, amount: "5.00 USDC", date: "Now", status: "Pending" }, ...prev])

    await new Promise((resolve) => setTimeout(resolve, 1500))

    setBillingHistory((prev) => prev.map((item) => (item.id === newId ? { ...item, status: "Success" } : item)))
    setBalance((prev) => prev - 5)
  }

  const addBillingRecord = (statusLabel: string) => {
    setBalance((prev) => prev - 5)
    setBillingHistory((prev) => [
      {
        id: Math.random().toString(36).substr(2, 9),
        amount: "5.00 USDC",
        date: new Date().toLocaleDateString(),
        status: "Success",
      },
      ...prev,
    ])
  }

  return (
    <div
      className={`min-h-screen bg-background text-foreground transition-colors duration-200 ${isDark ? "dark" : ""}`}
    >
      <Header
        isConnected={isConnected}
        onConnect={handleConnect}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onDisconnect={handleDisconnect}
      />

      <main className="pt-16">
        {isConnected && (
          <div className="border-b border-border sticky top-16 bg-background/95 backdrop-blur z-40">
            <div className="max-w-6xl mx-auto px-6 flex gap-8">
              <button
                onClick={() => setActiveTab("home")}
                className={`py-4 px-1 font-medium text-sm transition-colors border-b-2 ${
                  activeTab === "home"
                    ? "border-blue-500 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Guestbook
              </button>
              <button
                onClick={() => setActiveTab("subscription")}
                className={`py-4 px-1 font-medium text-sm transition-colors border-b-2 ${
                  activeTab === "subscription"
                    ? "border-blue-500 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Subscriptions
              </button>
            </div>
          </div>
        )}

        {/* Home Tab */}
        {activeTab === "home" && <HeroSection onConnect={handleConnect} isConnected={isConnected} />}

        {/* Subscription Tab */}
        {activeTab === "subscription" && isConnected && (
          <div className="pt-24 max-w-5xl mx-auto p-6 space-y-12">
            {/* HERO SECTION */}
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold tracking-tight">Smart Subscriptions</h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Demonstrating <strong>Delegated Authority</strong> using Lazorkit. Sign once, and the smart wallet
                handles monthly USDC payments automatically.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-start">
              {/* LEFT: User View (The Plan) */}
              <Card className="border border-border shadow-md hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>Pro Plan</span>
                    <Badge variant={subscriptionStatus === "active" ? "default" : "secondary"}>
                      {subscriptionStatus === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Automated monthly billing via Smart Wallet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-3xl font-bold">
                    5 USDC <span className="text-sm font-normal text-muted-foreground">/month</span>
                  </div>

                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> No monthly popups
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> Gas fees sponsored
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> Cancel anytime
                    </li>
                  </ul>

                  {subscriptionStatus === "inactive" ? (
                    <Button
                      onClick={handleSubscribe}
                      disabled={subscriptionStatus === "processing"}
                      className="w-full h-11 text-base font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg"
                    >
                      {subscriptionStatus === "processing" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authorizing...
                        </>
                      ) : (
                        "Subscribe with Passkey"
                      )}
                    </Button>
                  ) : (
                    <div className="p-4 bg-green-50/50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900">
                      <p className="text-green-700 dark:text-green-400 font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" /> Authority Delegated
                      </p>
                      <p className="text-xs text-green-600/80 dark:text-green-400/70 mt-1">
                        Your smart wallet is configured to allow withdrawals of 5 USDC every 30 days.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* RIGHT: Live Ledger */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="font-semibold text-foreground">Transaction History</h3>
                  <div className="text-sm text-muted-foreground">
                    Balance: <span className="font-mono text-foreground">{balance}.00 USDC</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {billingHistory.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-muted-foreground border border-border rounded-lg">
                      <p className="text-sm">No transactions yet</p>
                    </div>
                  ) : (
                    billingHistory.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-4 bg-card rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-full ${tx.status === "Pending" ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400" : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"}`}
                          >
                            {tx.status === "Pending" ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Zap className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">Monthly Subscription</p>
                            <p className="text-xs text-muted-foreground">{tx.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold">- {tx.amount}</p>
                          <p className="text-xs text-muted-foreground">{tx.status}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* DEMO CONTROLLER */}
            <div className="p-6 bg-muted/50 rounded-lg border border-border border-dashed space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-muted-foreground">
                    Demo Controller
                  </Badge>
                  <span className="text-sm text-muted-foreground">Simulate backend automation</span>
                </div>
              </div>

              <Button
                variant="secondary"
                onClick={handleSimulateRecurringCharge}
                disabled={subscriptionStatus !== "active"}
                className="gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                Simulate Monthly Charge
              </Button>
              <p className="text-sm text-muted-foreground">
                Click to prove the Smart Wallet processes payments <strong>without</strong> user confirmation.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
