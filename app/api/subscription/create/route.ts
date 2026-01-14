import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userAddress, userUsdcAccount, sessionKeySecret, monthsPrepaid, monthlyRate, approvedAmount } = body;

    // Basic Validation
    if (!userAddress || !sessionKeySecret) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    db.create({
      id: subscriptionId,
      userAddress,
      userUsdcAccount,
      sessionKeySecret, // Storing secret here for the demo. In prod, use a KMS/Vault.
      monthsPrepaid,
      monthlyRate,
      approvedAmount,
      createdAt: Date.now(),
      nextChargeDate: Date.now(), // Chargeable immediately for demo purposes
      status: 'active',
      chargeHistory: [],
    });

    console.log(`✅ Subscription persisted: ${subscriptionId}`);

    return NextResponse.json({
      ok: true,
      subscriptionId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}