import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createTransferCheckedInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { LAZORKIT_CONFIG, SOLANA_CONFIG } from "@/lib/config";
import { getMerchantUsdcAta } from "@/lib/utils";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { subscriptionId } = body;
    const sub = db.get(subscriptionId);

    if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    if (sub.monthsPrepaid <= 0) return NextResponse.json({ error: "Subscription expired" }, { status: 400 });

    // 1. Setup Keys & Connection
    const sessionKey = Keypair.fromSecretKey(new Uint8Array(sub.sessionKeySecret));
    
    // Load Merchant Key from Env (Handles Array format or Base58)
    const merchantSecret = process.env.MERCHANT_PRIVATE_KEY!;
    if (!merchantSecret) throw new Error("MERCHANT_PRIVATE_KEY not set");
    
    let merchantKeypair;
    if (merchantSecret.startsWith("[")) {
        merchantKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(merchantSecret)));
    } else {
        // Fallback if you use bs58 string
        const bs58 = require('bs58');
        merchantKeypair = Keypair.fromSecretKey(bs58.decode(merchantSecret));
    }

    if(!process.env.NEXT_PUBLIC_RPC_URL) {
      throw new Error("NEXT_PUBLIC_RPC_URL not set");
    }

    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
    
    // 2. Prepare Addresses
    const userUsdcAccount = new PublicKey(sub.userUsdcAccount);
    const merchantUsdcAccount = await getMerchantUsdcAta(); // Ensure this exists on-chain!
    const usdcAmount = BigInt(Math.round(sub.monthlyRate * Math.pow(10, SOLANA_CONFIG.USDC_DECIMALS)));

    // 3. Build Transaction
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
    
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    // 4. Sign (Session Key + Merchant pays gas)
    tx.partialSign(sessionKey);
    tx.partialSign(merchantKeypair);

    // 5. Send
    const signature = await sendAndConfirmTransaction(connection, tx, [sessionKey, merchantKeypair]);
    console.log(`✅ Charged ${sub.monthlyRate} USDC. Sig: ${signature}`);

    // 6. Update DB
    db.update(sub.id, {
        monthsPrepaid: sub.monthsPrepaid - 1,
        nextChargeDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        chargeHistory: [...sub.chargeHistory, {
            date: Date.now(),
            amount: sub.monthlyRate,
            status: "Success",
            signature
        }]
    });

    return NextResponse.json({ 
        ok: true, 
        signature, 
        amountCharged: sub.monthlyRate, 
        monthsRemaining: sub.monthsPrepaid - 1 
    });

  } catch (error: any) {
    console.error("Charge Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}