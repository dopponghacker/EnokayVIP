import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { Tier, TIER_META } from "@/lib/types";
import { getTierAmount } from "@/lib/pricing";
import {
  initializeTransaction,
  toPublicError,
  PaystackError,
} from "@/lib/paystack";

const CURRENCY = "GHS";
const DEFAULT_PAYMENT_EMAIL = "enokay69@enokay69.com";

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

function publicCallbackUrl(req: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  return `${base.replace(/\/$/, "")}/payment/{{tier}}?paid=1`;
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

    const body: unknown = await req.json().catch(() => null);
    const payload =
      typeof body === "object" && body !== null
        ? (body as { tier?: unknown; email?: unknown })
        : {};

    if (typeof payload.tier !== "string" || !(payload.tier in TIER_META)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const tier = payload.tier as Tier;
    const email =
      typeof payload.email === "string" && payload.email.includes("@")
        ? payload.email.slice(0, 200)
        : DEFAULT_PAYMENT_EMAIL;

    const amount = await getTierAmount(tier);
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`payment/initiate: invalid configured price for ${tier}: ${amount}`);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    const paymentCode = generatePaymentCode();

    try {
      await prisma.payment.create({
        data: {
          paymentCode,
          email,
          tier: tier as string,
          amount,
          currency: CURRENCY,
          status: "pending",
          paystackRef: paymentCode,
        },
      });
    } catch (dbError) {
      console.error("DB create error:", dbError);
      return NextResponse.json(
        { error: "Could not record your payment. Please try again." },
        { status: 500 }
      );
    }

    const callbackUrl = publicCallbackUrl(req).replace("{{tier}}", tier);
    let initResult;
    try {
      initResult = await initializeTransaction(
        email,
        Math.round(amount * 100),
        paymentCode,
        { payment_code: paymentCode, tier },
        callbackUrl
      );
    } catch (err) {
      const publicError = toPublicError(err);
      console.error(
        `payment/initiate: Paystack initialize failed for ${paymentCode}:`,
        err instanceof PaystackError ? err.message : err
      );
      return NextResponse.json(
        {
          error: publicError.message,
          message: publicError.message,
          code: publicError.code,
        },
        { status: 502 }
      );
    }

    const authorizeUrl = initResult?.data?.authorization_url;
    if (!authorizeUrl) {
      console.error(
        `payment/initiate: Paystack returned no authorization_url for ${paymentCode}:`,
        JSON.stringify(initResult)
      );
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      paymentCode,
      amount,
      tier,
      tierLabel: TIER_META[tier].label,
      paystackReference: paymentCode,
      authorizeUrl,
    });
  } catch (error) {
    console.error("payment/initiate error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}