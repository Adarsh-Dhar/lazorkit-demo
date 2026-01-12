import { Connection, PublicKey } from "@solana/web3.js";

// [CHANGE 1] Use a reliable RPC. Public ones lag and cause "TransactionTooOld".
const RPC_URL = process.env.RPC_URL; // Free tier key, or use your own

export const SOLANA_CONFIG = {
  RPC_URL,
  USDC_MINT: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"), // Devnet USDC
  USDC_DECIMALS: 6,
  SUBSCRIPTION_MONTHLY_RATE_USDC: 0.01,
  MERCHANT_WALLET: new PublicKey("29btcGViz61Db5c1HTeEyw9p5rpDQG87VYNe1WupQnDL"),
  
  getUsdcAmountForMonths: (months: number) => {
    return (SOLANA_CONFIG.SUBSCRIPTION_MONTHLY_RATE_USDC * months * 1_000_000);
  },
  
  getTotalUsdcForMonths: (months: number) => {
    return SOLANA_CONFIG.SUBSCRIPTION_MONTHLY_RATE_USDC * months;
  }
};

export const LAZORKIT_CONFIG = {
  rpc: RPC_URL, // [CHANGE 2] Ensure LazorKit uses the same fast RPC
  appName: "LazorSubscription",
  projectId: process.env.PROJECT_ID, // Keep your project ID
  chains: ["solana:devnet"],
};