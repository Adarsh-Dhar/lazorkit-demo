"use client"

import { Fingerprint } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface HeroSectionProps {
  onConnect: () => void
}

export default function HeroSection({ onConnect }: HeroSectionProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-8">
      <Card className="max-w-xl w-full border border-border bg-card p-8 md:p-12 text-center space-y-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Experience Gasless Solana</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            This demo proves how to write data to the blockchain without owning SOL. Authenticated via Passkeys.
          </p>
        </div>

        <div className="space-y-3 pt-4">
          <Button
            onClick={onConnect}
            size="lg"
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 gap-2 transition-all duration-200 font-medium shadow-lg hover:shadow-2xl hover:scale-[1.02]"
          >
            <Fingerprint className="w-5 h-5" />
            Login with Passkey
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full bg-transparent border-2 border-border hover:bg-muted/50 transition-all duration-200 font-medium"
            asChild
          >
            <a href="#" className="gap-2">
              View Source Code
            </a>
          </Button>
        </div>
      </Card>
    </div>
  )
}
