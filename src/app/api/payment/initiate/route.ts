import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { Tier, TIER_META } from "@/lib/types";
import { getTierAmount } from "@/lib/pricing";
import {
  createRushPayPayment,
  createRushPayWidgetSession,
} from "@/lib/rushpay";

function generatePaymentCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const len = chars.length;
  const bytes = randomBytes(12);
  let code = "ENK-";
  for (let i = 0; i < 6; i++) {
    const b = bytes[i];
    if (b < 256 - (256 % len)) {
      code += chars[b % len];
    } else {
      code += chars[bytes[i + 6] % len];
    }
  }
  return code;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = checkRateLimit(`pay-init:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const { tier } = await req.json();

    if (!tier || !(tier in TIER_META)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const meta = TIER_META[tier as Tier];
    const amount = await getTierAmount(tier as Tier);
    const paymentCode = generatePaymentCode();

    let rushpayRef: string | null = null;
    let widgetSessionToken: string | null = null;
    let rushpayPaymentRef: string | null = null;

    try {
      const rushpayPayment = await createRushPayPayment(
        amount,
        `Enokay69 - ${meta.label}`,
        paymentCode
      );
      rushpayRef = rushpayPayment.data.payment_reference;
      rushpayPaymentRef = rushpayPayment.data.payment_reference;

      const widgetSession = await createRushPayWidgetSession(rushpayRef);
      widgetSessionToken = widgetSession.data.widget_session_token;
    } catch (rushpayError) {
      console.error("RushPay API error:", rushpayError);
      const msg = rushpayError instanceof Error ? rushpayError.message : "RushPay API unavailable";
      return NextResponse.json(
        { error: `Payment gateway error: ${msg}. Please try again in a moment.` },
        { status: 502 }
      );
    }

    // Must succeed: verify and the webhook both look the payment up here.
    try {
      await prisma.payment.create({
        data: {
          paymentCode,
          tier,
          amount,
          currency: "GHS",
          status: "pending",
          rushpayRef: rushpayRef,
        },
      });
    } catch (dbError) {
      console.error("DB create error:", dbError);
      return NextResponse.json(
        { error: "Could not record your payment. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      paymentCode,
      amount,
      tier,
      tierLabel: meta.label,
      widgetSessionToken,
      paymentReference: rushpayPaymentRef,
    });
  } catch (error) {
    console.error("payment/initiate error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
