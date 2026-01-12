import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { SOLANA_CONFIG, LAZORKIT_CONFIG } from "@/lib/config";
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

    // Reconstruct session key from stored secret
    const sessionKey = Keypair.fromSecretKey(new Uint8Array(sub.sessionKeySecret));
    const userWallet = new PublicKey(sub.userAddress);
    const merchantWallet = SOLANA_CONFIG.MERCHANT_WALLET;

    console.log(`⏳ Processing charge for subscription ${subscriptionId}...`);
    console.log(`   Session Key Account: ${sessionKey.publicKey.toString()}`);
    console.log(`   Merchant: ${merchantWallet.toString()}`);
    console.log(`   Amount: ${sub.monthlyRate} SOL`);

    // Create the transfer instruction: from session key to merchant
    const connection = new Connection(LAZORKIT_CONFIG.rpc, "confirmed");
    const lamports = Math.round(sub.monthlyRate * Math.pow(10, 9));

    const transferIx = SystemProgram.transfer({
      fromPubkey: sessionKey.publicKey, // Transfer FROM session key account
      toPubkey: merchantWallet, // Transfer TO merchant
      lamports,
    });

    const tx = new Transaction().add(transferIx);
    tx.feePayer = sessionKey.publicKey; // Session key pays the gas fee

    // Get fresh blockhash immediately before signing (prevents "Transaction is too old" error)
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    // Sign with session key (no user interaction needed!)
    tx.sign(sessionKey);

    // Send and confirm with fresh blockhash
    const signature = await sendAndConfirmTransaction(connection, tx, [sessionKey], {
      commitment: "confirmed",
      maxRetries: 3,
    });

    console.log(`✅ Charge successful! Signature: ${signature}`);

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
