"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useWallet } from "@lazorkit/wallet" // 👈 1. Import Real SDK
import { TransactionInstruction, PublicKey } from "@solana/web3.js" // 👈 2. Import Solana Utils
import Header from "@/components/header"
import GuestbookForm from "@/components/guestbook-form"
import GuestbookFeed from "@/components/guestbook-feed"
import { useTheme } from "@/hooks/use-theme"

export default function GuestbookPage() {
  const { isDark, toggleTheme } = useTheme()
  // 3. Get the wallet hooks
  const { connect, isConnected, signAndSendTransaction, wallet } = useWallet()
  
  const [messages, setMessages] = useState<Array<{ id: string; text: string; address: string; timestamp: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleDisconnect = () => {
    // Simple redirect for demo
    router.push("/")
  }

  const handleConnect = async () => {
    await connect()
  }

  const handleSignMessage = async (text: string) => {
    // 4. Ensure wallet is connected before signing
    if (!wallet || !wallet.publicKey) {
      await connect();
      return;
    }

    setIsLoading(true)

    try {
      // 5. Create a REAL Transaction (Solana Memo Program)
      // This is the standard "Memo" program ID on Solana
      const memoProgramId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcQb");
      
      const instruction = new TransactionInstruction({
        keys: [{ 
            pubkey: new PublicKey(wallet.publicKey), 
            isSigner: true, 
            isWritable: true 
        }],
        programId: memoProgramId,
        data: Buffer.from(text, "utf-8"), // Encodes your text onto the blockchain
      });

      console.log("⏳ Sending Gasless Transaction...");

      // 6. Send via Lazorkit (The Paymaster will sponsor the SOL fee)
      const signature = await signAndSendTransaction({
        instructions: [instruction],
      });

      console.log("✅ Lazorkit Gasless Tx Success:", signature);

      // 7. Update UI with the real result
      const newMessage = {
        id: signature.slice(0, 8), // Use partial signature as ID
        text,
        address: wallet.publicKey.toString().slice(0, 6) + "...",
        timestamp: "just now",
      }

      setMessages([newMessage, ...messages])
    } catch (error) {
      console.error("Tx Failed:", error);
      alert("Transaction failed. Check the console for details.");
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={`min-h-screen bg-background text-foreground transition-colors duration-200 ${isDark ? "dark" : ""}`}
    >
      <Header
        isConnected={!!wallet}
        onConnect={handleConnect}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onDisconnect={handleDisconnect}
      />

      <main className="pt-16">
        <div className="space-y-8 p-8 max-w-4xl mx-auto">
          {/* Title to explain the feature */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Gasless Guestbook</h1>
            <p className="text-muted-foreground">
              Write a note on-chain. <span className="text-primary font-medium">Lazorkit pays the gas.</span>
            </p>
          </div>
          
          <GuestbookForm onSubmit={handleSignMessage} isLoading={isLoading} />
          <GuestbookFeed messages={messages} />
        </div>
      </main>
    </div>
  )
}
