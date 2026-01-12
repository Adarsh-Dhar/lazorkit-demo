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
  getAccount,
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
    console.log(`[SPL LOG] Calculated USDC amount for transfer:`, usdcAmount.toString());


    // Fetch user's USDC balance before transfer
    let userAccountInfoBefore;
    try {
      userAccountInfoBefore = await getAccount(connection, userUsdcAccount, "confirmed", TOKEN_PROGRAM_ID);
    } catch (e) {
      return NextResponse.json({ error: "User USDC account not found or not initialized." }, { status: 400 });
    }
    const balanceBefore = userAccountInfoBefore.amount;
    console.log(`[WALLET LOG] Before USDC balance:`, balanceBefore.toString());
    console.log(`[WALLET LOG] USDC transfer amount:`, usdcAmount.toString());


    // Log transfer instruction details
    console.log(`[SPL LOG] Creating transferCheckedInstruction with:`);
    console.log(`  Source: ${userUsdcAccount.toString()}`);
    console.log(`  Mint: ${SOLANA_CONFIG.USDC_MINT.toString()}`);
    console.log(`  Destination: ${merchantUsdcAccount.toString()}`);
    console.log(`  Authority (Session Key): ${sessionKey.publicKey.toString()}`);
    console.log(`  Amount: ${usdcAmount.toString()}`);
    console.log(`  Decimals: ${SOLANA_CONFIG.USDC_DECIMALS}`);

    // Create the transfer instruction: from USER's USDC account to merchant
    const transferIx = createTransferCheckedInstruction(
      userUsdcAccount,          // Source (User's USDC ATA)
      SOLANA_CONFIG.USDC_MINT,  // Mint address
      merchantUsdcAccount,      // Destination (Merchant's USDC ATA)
      sessionKey.publicKey,     // Authority: The Delegate (Session Key)
      usdcAmount,               // Amount in smallest units
      SOLANA_CONFIG.USDC_DECIMALS, // Decimals
      [],                       // No multisigners - session key is the sole authority
      TOKEN_PROGRAM_ID
    );

    const tx = new Transaction().add(transferIx);
    tx.feePayer = sessionKey.publicKey; // Session key pays the gas fee

    // Get fresh blockhash immediately before signing
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    // Sign with session key
    tx.sign(sessionKey);

    // Send and confirm with fresh blockhash
    let signature;
    try {
      signature = await sendAndConfirmTransaction(connection, tx, [sessionKey], {
        commitment: "confirmed",
        maxRetries: 3,
      });
    } catch (err) {
      console.error("❌ Error sending transaction:", err.message);
      return NextResponse.json({ error: err.message || "Failed to process charge" }, { status: 500 });
    }


    // Fetch user's USDC balance after transfer
    let userAccountInfoAfter;
    try {
      userAccountInfoAfter = await getAccount(connection, userUsdcAccount, "confirmed", TOKEN_PROGRAM_ID);
    } catch (e) {
      return NextResponse.json({ error: "User USDC account not found after transfer." }, { status: 500 });
    }
    const balanceAfter = userAccountInfoAfter.amount;
    console.log(`[WALLET LOG] After USDC balance:`, balanceAfter.toString());

    // Only update chargeHistory and return success if balance decreased by at least usdcAmount
    if (balanceBefore - balanceAfter < usdcAmount) {
      console.error("❌ USDC transfer did not complete: balance did not decrease as expected.");
      return NextResponse.json({ error: "USDC transfer failed or insufficient funds." }, { status: 400 });
    }

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
