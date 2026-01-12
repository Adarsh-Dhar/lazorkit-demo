# USDC Subscription Delegation Fix

## What Was Fixed

The subscription system was incorrectly using the **session key as the owner** in `createTransferCheckedInstruction`. This is wrong because:

- The **user's wallet** owns the USDC token account
- The **session key** is the **delegate** that has approval to spend on behalf of the user

## The Problem

```typescript
// ❌ WRONG - Session key cannot be owner
createTransferCheckedInstruction(
  userUsdcAccount,
  SOLANA_CONFIG.USDC_MINT,
  merchantUsdcAccount,
  sessionKey.publicKey,  // ❌ Wrong: Session key is not the owner
  usdcAmount,
  SOLANA_CONFIG.USDC_DECIMALS,
  [],
  TOKEN_PROGRAM_ID
);
```

## The Solution

```typescript
// ✅ CORRECT - User is owner, session key signs as delegate
createTransferCheckedInstruction(
  userUsdcAccount,
  SOLANA_CONFIG.USDC_MINT,
  merchantUsdcAccount,
  userWallet,            // ✅ Correct: User owns the account
  usdcAmount,
  SOLANA_CONFIG.USDC_DECIMALS,
  [sessionKey],          // ✅ Session key signs as delegate
  TOKEN_PROGRAM_ID
);
```

## How It Works

### 1. Initial Setup (Frontend - One-Time User Signature)

```typescript
// User approves the session key to spend USDC on their behalf
const approveIx = createApproveInstruction(
  userUsdcAccount,          // User's USDC account
  sessionKey.publicKey,     // Delegate (session key)
  userWallet,               // Owner (user)
  totalAmountToApprove,     // Max amount delegate can spend
  [],
  TOKEN_PROGRAM_ID
);

// User signs this once with their passkey
await signAndSendTransaction({ instructions: [approveIx] });
```

### 2. Monthly Charges (Backend - No User Interaction)

```typescript
// Backend uses session key to transfer USDC from user to merchant
const transferIx = createTransferCheckedInstruction(
  userUsdcAccount,          // Source: User's USDC account
  SOLANA_CONFIG.USDC_MINT,
  merchantUsdcAccount,      // Destination: Merchant's account
  userWallet,               // Owner: User (who owns the source account)
  usdcAmount,
  SOLANA_CONFIG.USDC_DECIMALS,
  [sessionKey],             // Signer: Session key (as delegate)
  TOKEN_PROGRAM_ID
);

// Session key signs (no user interaction!)
tx.sign(sessionKey);
await sendAndConfirmTransaction(connection, tx, [sessionKey]);
```

## Key Concepts

1. **Approval/Allowance**: User gives permission to session key to spend up to X USDC
2. **Owner vs Delegate**: 
   - Owner = User (owns the token account)
   - Delegate = Session key (has permission to spend)
3. **Gasless for User**: After initial approval, all charges happen without user signatures

## Files Updated

- `app/api/subscription/charge/route.ts` - Fixed charge API endpoint
- `scripts/process-subscriptions.ts` - Fixed batch processor script

## Testing Checklist

- [ ] User has devnet USDC in their wallet
- [ ] User's USDC token account exists (get from https://faucet.circle.com/)
- [ ] Merchant wallet has a USDC token account created
- [ ] Session key has small SOL balance for transaction fees
- [ ] USDC_MINT is set to correct devnet address: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

## Why This Pattern?

**Native SOL** doesn't support allowances/approvals. You can only transfer immediately.

**USDC (SPL Token)** supports the ERC-20-like approval pattern:
1. User approves a delegate
2. Delegate can spend up to the approved amount
3. Perfect for subscriptions, recurring payments, etc.

This is the standard pattern for subscriptions on Solana!
