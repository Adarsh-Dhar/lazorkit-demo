# USDC Approval/Delegation Model Migration ✅

## Overview

Successfully migrated the subscription system from **SOL native transfers** to **USDC token approvals with delegated authority**. This allows funds to remain in the user's wallet until monthly charges occur, avoiding upfront wallet funding.

---

## Architecture Changes

### Before (SOL Transfer Model)
```
User → [signs] → Transfer SOL to Session Key → Session Key Account → Backend charges Session Key
```
- **Problem**: Funds moved immediately to session key account.
- **Security**: Session key holds all prepaid funds.

### After (USDC Approval/Delegation Model)
```
User → [signs approve] → User's USDC ATA ← [Session Key Delegate] ← Backend pulls monthly
```
- **Solution**: User approves spending limit; session key gets delegate permission.
- **Security**: Funds stay in user's wallet; session key can only pull monthly amount.

---

## Files Modified

### 1. **lib/config.ts** – USDC Configuration
✅ Added:
- `USDC_DECIMALS: 6`
- `SUBSCRIPTION_MONTHLY_RATE_USDC: 1.0` (1 USDC/month)
- `MERCHANT_USDC_ATA` (pre-derived ATA for merchant)
- `getTotalUsdcForMonths(months)` – Calculate total USDC for N months
- `getUsdcAmountForMonths(months)` – Calculate USDC in microUnits (6 decimals)

Legacy SOL helpers kept for backward compatibility.

---

### 2. **lib/utils.ts** – ATA Utilities
✅ Added SPL Token helpers:
- `getUserUsdcAta(userPublicKey)` – Get user's USDC ATA address
- `getMerchantUsdcAta()` – Get merchant's USDC ATA address
- `checkTokenAccountExists(connection, tokenAccount)` – Verify ATA exists

---

### 3. **app/subscription/subscription-content.tsx** – Frontend
✅ Updated `handleSubscribe()`:
- Replaced `SystemProgram.transfer` with **`createApproveInstruction`**
- Added SPL Token imports: `getAssociatedTokenAddress`, `createApproveInstruction`, `TOKEN_PROGRAM_ID`
- Get user's USDC ATA and verify it exists
- Calculate approval limit using `getUsdcAmountForMonths()`
- Create approval instruction with session key as **delegate**
- Send approval transaction (0 SOL cost, just permission)
- Save USDC context to backend: `userUsdcAccount`, `approvedAmount`, `monthlyRate` (USDC)

✅ Updated UI displays:
- Show "Upfront Approval Limit" instead of "Prepayment"
- Display USDC amounts throughout
- Update feature list to mention "approval" and "funds stay in wallet"
- Show monthly charge as USDC

---

### 4. **app/api/subscription/create/route.ts** – Backend Storage
✅ Updated subscription storage interface:
- Added `userUsdcAccount: string`
- Added `approvedAmount: number`
- Updated `monthlyRate` to reflect USDC (not SOL)
- Validate all USDC-related fields in POST request

---

### 5. **app/api/subscription/charge/route.ts** – Charge API
✅ Converted charge mechanism:
- Replaced `SystemProgram.transfer` with **`createTransferCheckedInstruction`**
- Added SPL Token imports: `createTransferCheckedInstruction`, `TOKEN_PROGRAM_ID`
- Source: User's USDC ATA (not merchant wallet)
- Delegate: Session key (signs as delegate, doesn't hold funds)
- Destination: Merchant's USDC ATA
- Amount: Calculated using USDC decimals (6) instead of lamports (9)
- Session key still pays transaction fees (needs small SOL balance)

---

### 6. **scripts/process-subscriptions.ts** – Scheduled Processing
✅ Converted to USDC delegation:
- Updated `Subscription` interface to include `userUsdcAccount` and `approvedAmount`
- Replaced `SystemProgram.transfer` with **`createTransferCheckedInstruction`**
- Changed transfer source from session key account to user's USDC ATA
- Session key acts as delegate (authorized via approval)
- Calculate amount with USDC decimals (6)
- Console messages updated to reflect USDC charges

---

## Key Differences

| Aspect | SOL Transfer | USDC Approval |
|--------|-----------|-----------------|
| **Funding** | Immediate transfer to session key | Approval limit (no funds move) |
| **Funds Location** | Session key account | User's wallet (USDC ATA) |
| **Monthly Charge** | From session key account | From user's USDC ATA via delegation |
| **Session Key Role** | Holds funds | Delegate (permission only) |
| **Amount Type** | Lamports (9 decimals) | microUSDC (6 decimals) |
| **User Experience** | Pre-funding required | Approval signature only |

---

## Testing Checklist

- [ ] **User has devnet USDC** – Visit https://faucet.circle.com/ or use Solana faucet
- [ ] **Session Key Generation** – Verify new session key is created
- [ ] **User USDC ATA Check** – Confirm account exists before approval
- [ ] **Approval Transaction** – Sign approval with passkey (check for 0 SOL cost)
- [ ] **Backend Storage** – Verify `userUsdcAccount` and `approvedAmount` saved
- [ ] **Monthly Charge** – Simulate charge via `/api/subscription/charge`
- [ ] **Process Script** – Run `scripts/process-subscriptions.ts` for scheduled processing
- [ ] **Merchant USDC ATA** – Verify merchant's USDC ATA matches config

---

## Important Notes

⚠️ **Merchant USDC ATA Derivation**
- Update `SOLANA_CONFIG.MERCHANT_USDC_ATA` with the correct pre-derived ATA for the merchant wallet
- Derive it using: `getAssociatedTokenAddress(USDC_MINT, MERCHANT_WALLET)`
- On devnet: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (USDC mint)

⚠️ **Session Key SOL Balance**
- Session key needs a small amount of SOL (~0.001) to pay transaction fees for monthly charges
- Consider using a service wallet as fee payer in production

⚠️ **Production Considerations**
- Replace in-memory `Map` with a real database (Prisma, MongoDB)
- Encrypt session key secrets using KMS or Vault
- Add proper error handling, logging, and monitoring
- Set up automated job queue for reliable monthly processing
- Consider using Solana Web3.js v2 for improved error handling

---

## Dependencies

All required packages already installed:
- ✅ `@solana/web3.js` (^1.98.4)
- ✅ `@solana/spl-token` (^0.4.14)

No new dependencies needed.

---

## Migration Complete ✅

The subscription system now uses USDC approvals with delegated authority. Users sign once to approve a spending limit, and the backend pulls monthly charges using the session key as a delegate, keeping funds secure in the user's wallet.
