// scripts/setup-merchant.ts
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import bs58 from "bs58";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

// 1. Load Environment
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // Devnet USDC

async function main() {
    console.log("🏪 Setting up Merchant Wallet...");

    // 2. Load Private Key
    const privateKeyString = process.env.MERCHANT_PRIVATE_KEY;
    if (!privateKeyString) {
        console.error("❌ Error: MERCHANT_PRIVATE_KEY not found in .env.local");
        process.exit(1);
    }

    let merchantKeypair: Keypair;
    try {
        if (privateKeyString.trim().startsWith("[")) {
            merchantKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(privateKeyString)));
        } else {
            merchantKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyString));
        }
    } catch (e: any) {
        console.error("❌ Error parsing Private Key:", e.message);
        process.exit(1);
    }

    console.log(`✅ Loaded Wallet: ${merchantKeypair.publicKey.toString()}`);
    const connection = new Connection(RPC_URL, "confirmed");

    // 3. Check SOL Balance
    const balance = await connection.getBalance(merchantKeypair.publicKey);
    console.log(`💰 SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.005 * LAMPORTS_PER_SOL) {
        console.log("⚠️  Low Balance! Attempting Airdrop...");
        try {
            const sig = await connection.requestAirdrop(merchantKeypair.publicKey, 1 * LAMPORTS_PER_SOL);
            await connection.confirmTransaction(sig);
            console.log("✅ Airdrop successful");
        } catch (e) {
            console.log("❌ Airdrop failed. Please manually send SOL to:", merchantKeypair.publicKey.toString());
        }
    }

    // 4. Create/Get USDC Account (The Robust Way)
    console.log("🔄 Ensuring USDC Account exists...");
    
    try {
        const account = await getOrCreateAssociatedTokenAccount(
            connection,
            merchantKeypair,      // Payer
            USDC_MINT,            // Mint
            merchantKeypair.publicKey, // Owner
            false,                // allowOwnerOffCurve (False for standard wallets)
            "confirmed",
            undefined,            // confirmOptions
            undefined             // programId (Defaults to Token Program)
        );
        
        console.log("✅ Merchant USDC Account Ready!");
        console.log(`Address: ${account.address.toString()}`);
        
        console.log("\n---------------------------------------------------");
        console.log("✅ SETUP COMPLETE.");
        console.log("Ensure this matches your lib/config.ts:");
        console.log(`MERCHANT_WALLET: new PublicKey("${merchantKeypair.publicKey.toString()}")`);
        
    } catch (e: any) {
        console.error("❌ Critical Error creating USDC Account:", e);
        console.log("\nPossible Fixes:");
        console.log("1. Ensure you are on Devnet (USDC Mint 4zMMC... only exists there)");
        console.log("2. Manually create the ATA using a wallet app (Phantom/Solflare) by adding the USDC token.");
    }
}

main();