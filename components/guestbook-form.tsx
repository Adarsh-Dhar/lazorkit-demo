"use client"

import type React from "react"

import { useState } from "react"
import { Send, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface GuestbookFormProps {
  onSubmit: (text: string) => void
  isLoading: boolean
}

export default function GuestbookForm({ onSubmit, isLoading }: GuestbookFormProps) {
  const [message, setMessage] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      onSubmit(message)
      setMessage("")
    }
  }

  return (
    <Card className="border border-border bg-card p-6 space-y-4">
      <h3 className="text-xl font-bold">Write Message</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Leave your mark on-chain..."
          className="w-full px-4 py-3 rounded-lg bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none font-sans transition-all duration-200"
          rows={4}
          disabled={isLoading}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background border border-border">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm font-mono text-muted-foreground">Gas Fee: Sponsored (0 SOL)</span>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !message.trim()}
            className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:shadow-none disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin" />
                Signing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Sign & Send
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}
