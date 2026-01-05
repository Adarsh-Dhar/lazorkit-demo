"use client"

import { LazorkitProvider } from '@lazorkit/wallet'
import { ThemeProvider } from './theme-provider'
import type React from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <LazorkitProvider
        rpcUrl={process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com"}
        portalUrl="https://portal.lazorkit.com" // This is usually static
        paymasterConfig={{ 
          // 💡 FIXED: Now actually uses the environment variable
          paymasterUrl: process.env.NEXT_PUBLIC_PAYMASTER_URL || "https://kora.devnet.lazorkit.com" 
        }}
      >
        {children}
      </LazorkitProvider>
    </ThemeProvider>
  )
}
