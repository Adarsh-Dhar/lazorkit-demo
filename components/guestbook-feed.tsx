"use client"

import { Card } from "@/components/ui/card"

interface Message {
  id: string
  text: string
  address: string
  timestamp: string
}

interface GuestbookFeedProps {
  messages: Message[]
}

export default function GuestbookFeed({ messages }: GuestbookFeedProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">Recent Signatures</h3>

      {messages.length === 0 ? (
        <Card className="border border-dashed border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No messages yet. Be the first to sign the guestbook!</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <Card key={msg.id} className="border border-border bg-card p-4 hover:bg-card/80 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent/50 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-accent-foreground">
                    {msg.address.charAt(0).toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-foreground break-words">{msg.text}</p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-mono text-muted-foreground">{msg.address}</p>
                  <p className="text-xs text-muted-foreground">{msg.timestamp}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
