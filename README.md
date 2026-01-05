# Lazorkit Starter: Subscription & Gasless Examples

This repo demonstrates how to integrate **Lazorkit SDK** into a Next.js 15 app. It focuses on advanced "Smart Wallet" features like **Passkey Authentication**, **Gasless Transactions**, and **Automated Recurring Payments** (Session Keys).

## 🚀 Features Demonstrated
1.  **Gasless Guestbook:** A simple "Hello World" for sponsored transactions.
2.  **Smart Subscriptions:** A real-world example of **Delegated Authority**. Users sign *once* with FaceID, and the app allows monthly USDC withdrawals (simulated backend) without further user interaction.

## 🛠️ Prerequisites
* Node.js 18+
* A Lazorkit API Key (Get one at [dashboard.lazorkit.com](https://dashboard.lazorkit.com))

## ⚡ Quick Start

1.  **Clone & Install**
    ```bash
    git clone https://github.com/your-username/lazorkit-demo.git
    cd lazorkit-demo
    npm install
    ```

2.  **Environment Setup**
    Create a `.env.local` file in the root:
    ```bash
    NEXT_PUBLIC_RPC_URL="https://api.devnet.solana.com"
    NEXT_PUBLIC_PAYMASTER_URL="<YOUR_LAZORKIT_API_KEY>"
    ```

3.  **Run the App**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to view the demo.

---

## 📚 Tutorial 1: Enabling Gasless Passkeys

This project uses the `LazorkitProvider` to wrap the entire application. This handles the complexity of Passkey generation and Paymaster connection.

**Key File:** `components/providers.tsx`

```tsx
// We configure the provider at the root level
<LazorkitProvider
    rpcUrl="https://api.devnet.solana.com"
    paymasterConfig={{ 
        // This URL enables the "Gasless" magic
        paymasterUrl: process.env.NEXT_PUBLIC_PAYMASTER_URL 
    }}
>
    {children}
</LazorkitProvider>

```

**How it works:**

1. When a user clicks "Connect", Lazorkit prompts for Biometrics (FaceID/TouchID).
2. A fresh keypair is generated and stored in the device's Secure Enclave.
3. Any transaction sent via `signAndSendTransaction` is automatically routed through the Paymaster URL to sponsor gas fees.

---

## 📚 Tutorial 2: Automated Subscriptions (Session Keys)

The "Subscription" page demonstrates how to charge a user periodically **without** asking them to sign a wallet popup every month. This uses **Delegated Authority** (SPL Token Approve).

**Key File:** `app/subscription/subscription-content.tsx`

### Step A: The User Setup (One-Time Sign)

The user signs an `approveInstruction` that allows a specific **Session Key** to spend a limited amount of USDC.

```typescript
// 1. Generate a disposable Session Key
const sessionKey = Keypair.generate();

// 2. Create an SPL Approve instruction
const approveIx = createApproveInstruction(
    userUSDCAccount,      // User's Wallet
    sessionKey.publicKey, // The Delegate (Session Key)
    userPublicKey,        // The Owner
    5_000_000             // Limit: 5 USDC
);

// 3. User authorizes this policy with FaceID
await signAndSendTransaction({ instructions: [approveIx] });

```

### Step B: The "Backend" Charge (No User Interaction)

Once Step A is complete, your backend can use the `sessionKey` to sign transfer transactions on behalf of the user.

```typescript
// This runs on your server (Simulated in browser for this demo)
const transferIx = createTransferInstruction(
    userUSDCAccount,
    merchantAccount,
    sessionKey.publicKey, // Signed by Session Key, NOT User
    5_000_000
);

// Success! No popup needed.

```

## 📂 Project Structure

* `app/subscription/`: Contains the Smart Wallet logic for automated billing.
* `components/providers.tsx`: Global Lazorkit configuration.
* `components/ui/`: Reusable UI components (Shadcn UI).

## 📄 License

MIT
