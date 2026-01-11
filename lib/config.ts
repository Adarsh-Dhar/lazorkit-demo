import { PublicKey } from "@solana/web3.js";

/**
 * Solana devnet configuration for the gasless guestbook subscription system
 */
export const SOLANA_CONFIG = {
  // USDC mint on devnet (official devnet USDC)
  USDC_MINT: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),

  // Merchant/receiver wallet for subscription approvals (placeholder - update with your wallet)
  MERCHANT_WALLET: new PublicKey("11111111111111111111111111111111"),

  // Subscription tier amount (5 USDC with 6 decimals)
  SUBSCRIPTION_AMOUNT_USDC: 5,
  USDC_DECIMALS: 6,

  // Derived amount in smallest units (lamports/tokens)
  get subscriptionAmountTokens() {
    return this.SUBSCRIPTION_AMOUNT_USDC * Math.pow(10, this.USDC_DECIMALS);
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
