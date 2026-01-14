import { NextResponse } from 'next/server';


export const runtime = 'nodejs'; 

// We are just simulating a DB here for the demo
declare global {
  var _subscriptions: any[];
}
global._subscriptions = global._subscriptions || [];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userAddress, sessionKeySecret, months, amount } = body;

    // Save subscription details to your DB
    const subscription = {
      id: crypto.randomUUID(),
      userAddress,
      sessionKeySecret, // Store securely!
      monthsPrepaid: months,
      monthlyRate: amount,
      createdAt: Date.now(),
      nextChargeDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
      chargeHistory: []
    };

    global._subscriptions.push(subscription);
    
    // Log for the demo script to potentially pick up if it shared state (it doesn't in this demo setup, 
    // but this is where you'd write to the DB that process-subscriptions.ts reads from)
    console.log("✅ New Subscription Created:", subscription.id);

    return NextResponse.json({ success: true, id: subscription.id });
  } catch (error) {
    console.error("Failed to create subscription:", error);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}