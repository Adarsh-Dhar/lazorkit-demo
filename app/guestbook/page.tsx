"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import GuestbookForm from "@/components/guestbook-form"
import GuestbookFeed from "@/components/guestbook-feed"
import { useTheme } from "@/hooks/use-theme"

export default function GuestbookPage() {
  const { isDark, toggleTheme } = useTheme()
  const [isConnected, setIsConnected] = useState(true)
  const [messages, setMessages] = useState<Array<{ id: string; text: string; address: string; timestamp: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleDisconnect = () => {
    setIsConnected(false)
    router.push("/")
  }

  const handleConnect = () => {
    setIsConnected(true)
  }

  const handleSignMessage = async (text: string) => {
    setIsLoading(true)

    await new Promise((resolve) => setTimeout(resolve, 2000))

    const newMessage = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      address: "lzor...9x2",
      timestamp: "just now",
    }

    setMessages([newMessage, ...messages])
    console.log("Lazorkit: Transaction Sponsored")
    setIsLoading(false)
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
        <div className="space-y-8 p-8 max-w-4xl mx-auto">
          <GuestbookForm onSubmit={handleSignMessage} isLoading={isLoading} />
          <GuestbookFeed messages={messages} />
        </div>
      </main>
    </div>
  )
}
