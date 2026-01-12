import { PublicKey } from "@solana/web3.js";

/**
 * Solana devnet configuration for the gasless guestbook subscription system
 */
export const SOLANA_CONFIG = {
  // USDC mint on devnet (official devnet USDC) - keeping for potential future use
  USDC_MINT: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),

  // Merchant/receiver wallet for subscription approvals (set to a real address)
  MERCHANT_WALLET: new PublicKey("29btcGViz61Db5c1HTeEyw9p5rpDQG87VYNe1WupQnDL"), // Smart wallet receives the subscription payment

  // Subscription tier: monthly rate in SOL
  SUBSCRIPTION_MONTHLY_RATE_SOL: 0.01,
  SOL_DECIMALS: 9,

  // Helper: calculate total SOL for N months
  getTotalForMonths(months: number) {
    return this.SUBSCRIPTION_MONTHLY_RATE_SOL * months;
  },

  // Helper: calculate lamports for N months
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
