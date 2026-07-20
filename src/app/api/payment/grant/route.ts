import { NextRequest, NextResponse } from "next/server";
import { createPaymentToken, PAYMENT_TOKEN_COOKIE, paymentCookieOptions } from "@/lib/auth";
import { Tier, TIER_META } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tier } = body;

    if (!tier || !(tier in TIER_META)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const response = NextResponse.json({ success: true, tier });
    response.cookies.set(
      PAYMENT_TOKEN_COOKIE,
      createPaymentToken(tier as Tier),
      paymentCookieOptions
    );
    return response;
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
