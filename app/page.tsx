"use client"

import dynamic from "next/dynamic"

// Render subscription experience directly on the homepage
const SubscriptionPageContent = dynamic(() => import("../components/subscription-content"), {
  ssr: false,
})

export default function Home() {
  return <SubscriptionPageContent />
}
