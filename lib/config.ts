import { PublicKey } from "@solana/web3.js";

/**
 * Solana devnet configuration for the gasless guestbook subscription system
 */
export const SOLANA_CONFIG = {
  // USDC mint (override via NEXT_PUBLIC_USDC_MINT, default to Circle devnet USDC)
  USDC_MINT: new PublicKey(
    (process.env.NEXT_PUBLIC_USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU").trim()
  ),

  // Merchant/receiver wallet for subscription approvals (set to a real address)
  MERCHANT_WALLET: new PublicKey("29btcGViz61Db5c1HTeEyw9p5rpDQG87VYNe1WupQnDL"), // Smart wallet receives the subscription payment
  
  // Merchant USDC token account: derive dynamically in runtime via getAssociatedTokenAddress

  // Subscription tier: monthly rate in USDC
  SUBSCRIPTION_MONTHLY_RATE_USDC: 0.01, // 0.01 USDC per month
  USDC_DECIMALS: 6,
  
  // Legacy SOL config (kept for reference/migration)
  SUBSCRIPTION_MONTHLY_RATE_SOL: 0.01,
  SOL_DECIMALS: 9,

  // Helper: calculate total USDC for N months (human-readable)
  getTotalUsdcForMonths(months: number) {
    return this.SUBSCRIPTION_MONTHLY_RATE_USDC * months;
  },

  // Helper: calculate USDC amount in smallest units (microUSDC) for N months
  getUsdcAmountForMonths(months: number) {
    return Math.round(this.getTotalUsdcForMonths(months) * Math.pow(10, this.USDC_DECIMALS));
  },
  
  // Legacy SOL helpers (kept for reference)
  getTotalForMonths(months: number) {
    return this.SUBSCRIPTION_MONTHLY_RATE_SOL * months;
  },

  getLamportsForMonths(months: number) {
    return Math.round(this.getTotalForMonths(months) * Math.pow(10, this.SOL_DECIMALS));
  },

  // Backward compatibility
  get subscriptionAmountLamports() {
    return this.getLamportsForMonths(1);
  },
  get SUBSCRIPTION_AMOUNT_SOL() {
    return this.SUBSCRIPTION_MONTHLY_RATE_SOL;
  },
} as const;

/**
 * Lazorkit paymaster config (gasless transactions)
 */
export const LAZORKIT_CONFIG = {
  paymaster: "https://kora.devnet.lazorkit.com",
  rpc: "https://api.devnet.solana.com",
  network: "devnet",
} as const;
