"use client"

import { LazorkitProvider } from '@lazorkit/wallet'
import { ThemeProvider } from './theme-provider'
import type React from 'react'

const CONFIG = {
  RPC_URL: "https://api.devnet.solana.com",
  PORTAL_URL: "https://portal.lazor.sh",
  PAYMASTER: { 
    paymasterUrl: "https://kora.devnet.lazorkit.com" 
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <LazorkitProvider
        rpcUrl={CONFIG.RPC_URL}
        portalUrl={CONFIG.PORTAL_URL}
        paymasterConfig={CONFIG.PAYMASTER}
      >
        {children}
      </LazorkitProvider>
    </ThemeProvider>
  )
}
