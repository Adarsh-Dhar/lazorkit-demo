import { NextResponse } from "next/server";
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
import { SOLANA_CONFIG, LAZORKIT_CONFIG } from "@/lib/config";
import { getUserUsdcAta, getMerchantUsdcAta } from "@/lib/utils";
import { subscriptions } from "../create/route";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId required" },
        { status: 400 }
      );
    }

    const sub = subscriptions.get(subscriptionId);
    if (!sub) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Check if next charge date has arrived
    if (Date.now() < sub.nextChargeDate) {
      return NextResponse.json(
        {
          ok: false,
          message: "Next charge date not reached yet",
          nextChargeDate: sub.nextChargeDate,
        },
        { status: 400 }
      );
    }

    // Reconstruct session key from stored secret (acts as delegate)
    const sessionKey = Keypair.fromSecretKey(new Uint8Array(sub.sessionKeySecret));
    const userWallet = new PublicKey(sub.userAddress);
    const merchantWallet = SOLANA_CONFIG.MERCHANT_WALLET;

    console.log(`⏳ Processing USDC charge for subscription ${subscriptionId}...`);
    console.log(`   Session Key (Delegate): ${sessionKey.publicKey.toString()}`);
    console.log(`   User Wallet: ${userWallet.toString()}`);
    console.log(`   Merchant: ${merchantWallet.toString()}`);
    console.log(`   Amount: ${sub.monthlyRate} USDC`);

    // Get USDC token accounts
    const connection = new Connection(LAZORKIT_CONFIG.rpc, "confirmed");
    const userUsdcAccount = new PublicKey(sub.userUsdcAccount);
    const merchantUsdcAccount = await getMerchantUsdcAta();

    console.log(`   User USDC ATA: ${userUsdcAccount.toString()}`);
    console.log(`   Merchant USDC ATA: ${merchantUsdcAccount.toString()}`);

    // Calculate USDC amount in smallest units (microUSDC with 6 decimals)
    const usdcAmount = BigInt(Math.round(sub.monthlyRate * Math.pow(10, SOLANA_CONFIG.USDC_DECIMALS)));

    // Create the transfer instruction: from USER's USDC account to merchant
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
    // Note: For SPL token transfers, we still need someone to pay the SOL fee
    // The session key can pay if it has a small SOL balance, or use a service wallet
    tx.feePayer = sessionKey.publicKey; // Session key pays the gas fee

    // Get fresh blockhash immediately before signing (prevents "Transaction is too old" error)
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    // Sign with session key (no user interaction needed!)
    // The session key is authorized via the prior approval
    tx.sign(sessionKey);

    // Send and confirm with fresh blockhash
    const signature = await sendAndConfirmTransaction(connection, tx, [sessionKey], {
      commitment: "confirmed",
      maxRetries: 3,
    });

    console.log(`✅ USDC charge successful! Signature: ${signature}`);

    // Update subscription record
    sub.chargeHistory.push({
      date: Date.now(),
      amount: sub.monthlyRate,
      signature,
      status: "success",
    });

    sub.monthsPrepaid -= 1;
    sub.nextChargeDate = Date.now() + 30 * 24 * 60 * 60 * 1000; // Next month

    // If no months left, mark subscription as expired
    if (sub.monthsPrepaid <= 0) {
      console.log(`⚠️ Subscription ${subscriptionId} has expired (0 months remaining)`);
    }

    return NextResponse.json({
      ok: true,
      subscriptionId,
      signature,
      amountCharged: sub.monthlyRate,
      monthsRemaining: sub.monthsPrepaid,
      nextChargeDate: sub.nextChargeDate,
    });
  } catch (error: any) {
    console.error("❌ Error processing charge:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to process charge" },
      { status: 500 }
    );
  }
}
