"use client"

import dynamic from "next/dynamic"

// Dynamically import to avoid prerender errors with PublicKey initialization
const SubscriptionPageContent = dynamic(() => import("./subscription-content"), { 
  ssr: false 
})

export default function SubscriptionPage() {
  return <SubscriptionPageContent />
}
