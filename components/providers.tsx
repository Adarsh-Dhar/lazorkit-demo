"use client"

import { LazorkitProvider } from '@lazorkit/wallet'
import { ThemeProvider } from './theme-provider'
import type React from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <LazorkitProvider
        rpcUrl={process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com"}
        portalUrl="https://portal.lazor.sh"
        paymasterConfig={{ 
          paymasterUrl: process.env.NEXT_PUBLIC_PAYMASTER_URL || "https://kora.devnet.lazorkit.com" 
        }}
      >
        {children}
      </LazorkitProvider>
    </ThemeProvider>
  )
}
