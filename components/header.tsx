"use client"

import { Moon, Sun, Zap, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@lazorkit/wallet"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export default function Header() {
  const { connect, disconnect, isConnected, isConnecting, wallet } = useWallet()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  const handleToggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  if (!mounted) return null

  return (
    <header className="fixed top-0 left-0 right-0 border-b border-border bg-background/80 backdrop-blur-sm z-50">
      <div className="px-8 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-accent" />
          <h1 className="text-lg font-mono font-semibold tracking-tight">Lazorkit Starter // Gasless Guestbook</h1>
        </div>

        <div className="flex items-center gap-4">
          {isConnected && wallet ? (
            <Button
              onClick={() => disconnect()}
              size="sm"
              className="bg-destructive/10 text-destructive hover:bg-destructive/20 gap-2 border border-destructive/30 transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </Button>
          ) : (
            <Button
              onClick={() => connect()}
              disabled={isConnecting}
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
            >
              {isConnecting ? "Connecting..." : "Login with Passkey"}
            </Button>
          )}

          <div className="flex items-center gap-3 pl-4 border-l border-border">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm text-muted-foreground font-mono">Devnet</span>
            </div>

            <button
              onClick={handleToggleTheme}
              className="p-2 hover:bg-muted rounded-md transition-colors duration-200"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
