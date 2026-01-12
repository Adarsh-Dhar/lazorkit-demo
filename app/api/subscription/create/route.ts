import { NextResponse } from "next/server";

// In-memory demo storage; replace with a real database (Prisma, MongoDB, etc.)
const subscriptions = new Map<
  string,
  {
    id: string;
    userAddress: string;
    userUsdcAccount: string;
    sessionKeySecret: number[];
    monthsPrepaid: number;
    monthlyRate: number;
    approvedAmount: number;
    createdAt: number;
    nextChargeDate: number;
    chargeHistory: Array<{ date: number; amount: number; signature?: string; status: string }>;
  }
>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userAddress, userUsdcAccount, sessionKeySecret, monthsPrepaid, monthlyRate, approvedAmount } = body;

    // Validate input
    if (!userAddress || !userUsdcAccount || !sessionKeySecret || !Array.isArray(sessionKeySecret)) {
      return NextResponse.json(
        { error: "Invalid request: userAddress, userUsdcAccount, and sessionKeySecret required" },
        { status: 400 }
      );
    }

    if (!monthsPrepaid || !monthlyRate || !approvedAmount) {
      return NextResponse.json(
        { error: "Invalid request: monthsPrepaid, monthlyRate, and approvedAmount required" },
        { status: 400 }
      );
    }

    // Create subscription ID
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store subscription with session key secret and USDC details
    subscriptions.set(subscriptionId, {
      id: subscriptionId,
      userAddress,
      userUsdcAccount,
      sessionKeySecret,
      monthsPrepaid,
      monthlyRate,
      approvedAmount,
      createdAt: Date.now(),
      nextChargeDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
      chargeHistory: [
        {
          date: Date.now(),
          amount: monthsPrepaid * monthlyRate,
          status: "initial_payment",
        },
      ],
    });

    console.log(
      `✅ Subscription created: ${subscriptionId} for ${userAddress} (${monthsPrepaid} months)`
    );

    return NextResponse.json({
      ok: true,
      subscriptionId,
      userAddress,
      monthsPrepaid,
      monthlyRate,
    });
  } catch (error: any) {
    console.error("❌ Error creating subscription:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to create subscription" },
      { status: 500 }
    );
  }
}

// GET: Retrieve subscription details (for debugging/demo)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const subscriptionId = url.searchParams.get("subscriptionId");

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId query param required" },
        { status: 400 }
      );
    }

    const sub = subscriptions.get(subscriptionId);
    if (!sub) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Don't return the secret key in response
    return NextResponse.json({
      id: sub.id,
      userAddress: sub.userAddress,
      monthsPrepaid: sub.monthsPrepaid,
      monthlyRate: sub.monthlyRate,
      createdAt: sub.createdAt,
      nextChargeDate: sub.nextChargeDate,
      chargeHistory: sub.chargeHistory,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to retrieve subscription" },
      { status: 500 }
    );
  }
}

// Export subscriptions map for use by the charge endpoint and cron script
export { subscriptions };
