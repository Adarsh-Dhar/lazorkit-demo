import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Connection, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { SOLANA_CONFIG } from './config'

import type { Transaction } from '@solana/web3.js'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the USDC Associated Token Account address for a given owner
 * @param ownerPublicKey The public key of the ATA owner (should be session key for subscriptions)
 * @returns The ATA address for USDC
 */
export async function getUserUsdcAta(ownerPublicKey: PublicKey): Promise<PublicKey> {
  return getAssociatedTokenAddress(
    SOLANA_CONFIG.USDC_MINT,
    ownerPublicKey,
    true, // allowOwnerOffCurve - session keys may be off-curve
    TOKEN_PROGRAM_ID
  );
}

/**
 * Get the merchant's USDC Associated Token Account address
 * @returns The ATA address for merchant's USDC
 */
export async function getMerchantUsdcAta(): Promise<PublicKey> {
  return getAssociatedTokenAddress(
    SOLANA_CONFIG.USDC_MINT,
    SOLANA_CONFIG.MERCHANT_WALLET,
    true, // allowOwnerOffCurve
    TOKEN_PROGRAM_ID
  )
}

/**
 * Check if a token account exists and is initialized
 * @param connection Solana connection
 * @param tokenAccount The token account address to check
 * @returns true if account exists and is initialized
 */
export async function checkTokenAccountExists(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<boolean> {
  try {
    await getAccount(connection, tokenAccount, 'confirmed', TOKEN_PROGRAM_ID)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Fetches the latest blockhash and sets it on the transaction.
 * Call this before signing and sending to avoid TransactionTooOld errors.
 * @param connection Solana connection
 * @param transaction The transaction to update
 */
export async function setLatestBlockhash(connection: Connection, transaction: Transaction): Promise<void> {
  const { blockhash } = await connection.getLatestBlockhash('finalized');
  transaction.recentBlockhash = blockhash;
}
