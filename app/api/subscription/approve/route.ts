import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { createApproveInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SOLANA_CONFIG, LAZORKIT_CONFIG } from "@/lib/config";
import { subscriptions } from "../create/route";
// No fs needed, use process.env

export async function POST(req: Request) {
  try {
    const { subscriptionId } = await req.json();
    const sub = subscriptions.get(subscriptionId);
    if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });

    const sessionKey = Keypair.fromSecretKey(new Uint8Array(sub.sessionKeySecret));
    const userUsdcAccount = new PublicKey(sub.userUsdcAccount);

    // Load smart wallet keypair (owner of the USDC account)
    const smartWalletSecretString = process.env.SMART_WALLET_PRIVATE_KEY;
    if (!smartWalletSecretString) {
      return NextResponse.json({ error: "SMART_WALLET_PRIVATE_KEY not set in environment." }, { status: 500 });
    }
    let smartWalletKeypair;
    try {
      if (smartWalletSecretString.trim().startsWith("[")) {
        const secret = JSON.parse(smartWalletSecretString);
        smartWalletKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));
      } else {
        smartWalletKeypair = Keypair.fromSecretKey(bs58.decode(smartWalletSecretString.trim()));
      }
    } catch (e) {
      return NextResponse.json({ error: "Invalid SMART_WALLET_PRIVATE_KEY format. Must be a base58 string or JSON array." }, { status: 500 });
    }

    // Load merchant keypair from .env (supports base58 or JSON array)
    const secretString = process.env.MERCHANT_PRIVATE_KEY;
    if (!secretString) {
      return NextResponse.json({ error: "MERCHANT_PRIVATE_KEY not set in environment." }, { status: 500 });
    }
    let merchantKeypair;
    try {
      if (secretString.trim().startsWith("[")) {
        // JSON array
        const secret = JSON.parse(secretString);
        merchantKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));
      } else {
        // Assume base58
        merchantKeypair = Keypair.fromSecretKey(bs58.decode(secretString.trim()));
      }
    } catch (e) {
      return NextResponse.json({ error: "Invalid MERCHANT_PRIVATE_KEY format. Must be a base58 string or JSON array." }, { status: 500 });
    }

    const connection = new Connection(LAZORKIT_CONFIG.rpc, "confirmed");

    // The smart wallet is the owner of the USDC account, sessionKey is the delegate
    const approveIx = createApproveInstruction(
      userUsdcAccount,
      sessionKey.publicKey, // delegate
      smartWalletKeypair.publicKey, // owner (signer)
      BigInt(sub.approvedAmount),
      [],
      TOKEN_PROGRAM_ID
    );

    const tx = new Transaction().add(approveIx);
    tx.feePayer = merchantKeypair.publicKey;
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.partialSign(smartWalletKeypair);
    tx.partialSign(sessionKey);
    tx.partialSign(merchantKeypair);

    const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    return NextResponse.json({ ok: true, signature });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
