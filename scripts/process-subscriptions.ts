/**
 * Subscription Processor Script
 *
 * This script processes monthly subscription charges using stored session keys.
 * Run via: node scripts/process-subscriptions.ts
 * Or schedule as a Cron Job to run daily/monthly.
 *
 * In production:
 * - Use a real database (Prisma, MongoDB) instead of in-memory Map
 * - Encrypt/decrypt session key secrets using KMS or Vault
 * - Use a proper job queue (Bull, RabbitMQ) for reliability
 * - Add retry logic, error notifications, etc.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SOLANA_CONFIG, LAZORKIT_CONFIG } from "../lib/config";
import { getMerchantUsdcAta } from "../lib/utils";

// Demo: In-memory subscription store (replace with real DB in production)
interface Subscription {
  id: string;
  userAddress: string;
  userUsdcAccount: string;
  sessionKeySecret: number[];
  monthsPrepaid: number;
  monthlyRate: number;
  approvedAmount: number;
  createdAt: number;
  nextChargeDate: number;
  chargeHistory: Array<{
    date: number;
    amount: number;
    signature?: string;
    status: string;
  }>;
}

const subscriptions = new Map<string, Subscription>();

// Example subscriptions for testing
function initDemoSubscriptions() {
  // In production, load from database
  // For demo, you can add test subscriptions here
}

async function processSubscriptions() {
  console.log("🔄 Starting subscription processor...");
  console.log(`⏰ Current time: ${new Date().toISOString()}`);

  const connection = new Connection(LAZORKIT_CONFIG.rpc, "confirmed");
  let processedCount = 0;
  let errorCount = 0;

  for (const [subId, sub] of subscriptions.entries()) {
    try {
      // Skip if next charge date hasn't arrived
      if (Date.now() < sub.nextChargeDate) {
        console.log(
          `⏭️  Subscription ${subId} not due yet. Next charge: ${new Date(sub.nextChargeDate).toISOString()}`
        );
        continue;
      }

      // Skip if no months left
      if (sub.monthsPrepaid <= 0) {
        console.log(`⚠️  Subscription ${subId} has expired. Skipping.`);
        continue;
      }

      console.log(`\n📝 Processing subscription: ${subId}`);
      console.log(`   User: ${sub.userAddress}`);
      console.log(`   Amount: ${sub.monthlyRate} USDC`);
      console.log(`   Months Remaining: ${sub.monthsPrepaid}`);

      // Reconstruct session key (acts as delegate)
      const sessionKey = Keypair.fromSecretKey(new Uint8Array(sub.sessionKeySecret));
      const userWallet = new PublicKey(sub.userAddress);
      const userUsdcAccount = new PublicKey(sub.userUsdcAccount);
      const merchantWallet = SOLANA_CONFIG.MERCHANT_WALLET;

      // Get merchant's USDC ATA (pre-computed from MERCHANT_WALLET + USDC_MINT)
      // In production, you might want to compute this dynamically
      const merchantUsdcAccount = await getMerchantUsdcAta();

      console.log(`   User USDC ATA: ${userUsdcAccount.toString()}`);
      console.log(`   Merchant USDC ATA: ${merchantUsdcAccount.toString()}`);

      // Calculate USDC amount in smallest units (microUSDC with 6 decimals)
      const usdcAmount = BigInt(Math.round(sub.monthlyRate * Math.pow(10, SOLANA_CONFIG.USDC_DECIMALS)));

      // Create transfer instruction: from USER's USDC account to merchant
      // The session key acts as a DELEGATE (signs for the user)
      const transferIx = createTransferCheckedInstruction(
        userUsdcAccount,          // Source (User's USDC ATA)
        SOLANA_CONFIG.USDC_MINT,  // Mint address
        merchantUsdcAccount,      // Destination (Merchant's USDC ATA)
        sessionKey.publicKey,     // Owner/Delegate (Session key signs)
        usdcAmount,               // Amount in smallest units
        SOLANA_CONFIG.USDC_DECIMALS, // Decimals
        [],                       // Multi-signers
        TOKEN_PROGRAM_ID
      );

      const tx = new Transaction().add(transferIx);
      // Note: Session key needs a small SOL balance to pay transaction fees
      // Alternatively, use a service wallet as fee payer
      tx.feePayer = sessionKey.publicKey; // Session key pays gas fee

      // Get fresh blockhash immediately before signing
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;

      // Sign with session key (no user interaction!)
      tx.sign(sessionKey);

      // Send and confirm with retries
      console.log(`⏳ Sending USDC transfer transaction...`);
      const signature = await sendAndConfirmTransaction(connection, tx, [sessionKey], {
        commitment: "confirmed",
        maxRetries: 3,
      });

      console.log(`✅ USDC charge successful!`);
      console.log(`   Signature: ${signature}`);

      // Update subscription
      sub.chargeHistory.push({
        date: Date.now(),
        amount: sub.monthlyRate,
        signature,
        status: "success",
      });

      sub.monthsPrepaid -= 1;
      sub.nextChargeDate = Date.now() + 30 * 24 * 60 * 60 * 1000;

      processedCount++;

      if (sub.monthsPrepaid === 0) {
        console.log(`⚠️  Subscription ${subId} has now expired.`);
      } else {
        console.log(`   Next charge scheduled: ${new Date(sub.nextChargeDate).toISOString()}`);
      }
    } catch (error: any) {
      errorCount++;
      console.error(`❌ Error processing subscription ${subId}:`, error.message);

      // Record failed charge attempt
      sub.chargeHistory.push({
        date: Date.now(),
        amount: sub.monthlyRate,
        status: "failed",
      });

      // In production, send alert to ops/monitoring
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total subscriptions: ${subscriptions.size}`);
  console.log(`   Processed: ${processedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`✅ Subscription processor (USDC delegation) completed at ${new Date().toISOString()}`);
}

// Main entry point
async function main() {
  try {
    initDemoSubscriptions();

    // In production, fetch subscriptions from your database
    // const subs = await db.subscription.findMany({ nextChargeDate: { $lte: now } });

    await processSubscriptions();
  } catch (error: any) {
    console.error("Fatal error in subscription processor:", error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { processSubscriptions };
