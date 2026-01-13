import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import fs from "fs";
import {
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SOLANA_CONFIG, LAZORKIT_CONFIG } from "@/lib/config";
import { getMerchantUsdcAta } from "@/lib/utils";
import { subscriptions } from "../create/route";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { subscriptionId } = body;

    if (!subscriptionId) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const sub = subscriptions.get(subscriptionId);
    if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });

    if (sub.monthsPrepaid <= 0) return NextResponse.json({ error: "Subscription expired" }, { status: 400 });

    // 1. Reconstruct Session Key
    const sessionKey = Keypair.fromSecretKey(new Uint8Array(sub.sessionKeySecret));

    // 2. Setup Connection
    const connection = new Connection(LAZORKIT_CONFIG.rpc, "confirmed");
    const userUsdcAccount = new PublicKey(sub.userUsdcAccount);
    const merchantUsdcAccount = await getMerchantUsdcAta();

    const usdcAmount = BigInt(Math.round(sub.monthlyRate * Math.pow(10, SOLANA_CONFIG.USDC_DECIMALS)));

    // [NEW] Load merchant keypair as fee payer
    let merchantKeypair;
    try {
      const keypairPath = __dirname + "/merchant-keypair.json";
      const secret = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
      merchantKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));
    } catch (e) {
      return NextResponse.json({ error: "Merchant keypair not found or invalid. Please set up merchant-keypair.json." }, { status: 500 });
    }

    // 3. Create Transfer Instruction
    const transferIx = createTransferCheckedInstruction(
      userUsdcAccount,
      SOLANA_CONFIG.USDC_MINT,
      merchantUsdcAccount,
      sessionKey.publicKey, // Authority: Session Key
      usdcAmount,
      SOLANA_CONFIG.USDC_DECIMALS,
      [],
      TOKEN_PROGRAM_ID
    );

    const tx = new Transaction().add(transferIx);
    tx.feePayer = merchantKeypair.publicKey;

    // 4. Sign & Send
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.partialSign(sessionKey);
    tx.partialSign(merchantKeypair);

    const signature = await sendAndConfirmTransaction(connection, tx, [sessionKey, merchantKeypair], {
      commitment: "confirmed",
    });

    console.log(`✅ Charged ${sub.monthlyRate} USDC. Sig: ${signature}`);

    sub.monthsPrepaid -= 1;
    sub.nextChargeDate = Date.now() + 30 * 24 * 60 * 60 * 1000;

    return NextResponse.json({
      ok: true,
      signature,
      amountCharged: sub.monthlyRate,
      monthsRemaining: sub.monthsPrepaid
    });

  } catch (error: any) {
    console.error("Charge Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}