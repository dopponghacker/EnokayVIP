import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { Tier, TIER_META } from "@/lib/types";
import { getTierAmount } from "@/lib/pricing";
import { paymentCookieOptions } from "@/lib/auth";

const CURRENCY = "GHS";
const PAYMENT_CODE_RE = /^ENK-[A-Z0-9]{6}$/;

const CHECKOUT_COOKIE = "enokay_checkout";
const REUSE_WINDOW_SECONDS = 45 * 60;

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

function reply(
  body: Record<string, unknown>,
  status: number,
  paymentCode?: string
) {
  const response = NextResponse.json(body, { status });
  if (paymentCode) {
    response.cookies.set(CHECKOUT_COOKIE, paymentCode, {
      ...paymentCookieOptions,
      maxAge: REUSE_WINDOW_SECONDS,
    });
  }
  return response;
}

async function findReusablePayment(
  req: NextRequest,
  tier: Tier,
  amount: number
) {
  const code = req.cookies.get(CHECKOUT_COOKIE)?.value;
  if (!code || !PAYMENT_CODE_RE.test(code)) return null;

  const payment = await prisma.payment.findUnique({ where: { paymentCode: code } });
  if (
    !payment ||
    payment.tier !== tier ||
    payment.status !== "pending" ||
    !payment.paystackRef ||
    payment.currency !== CURRENCY ||
    payment.amount !== amount ||
    Date.now() - payment.createdAt.getTime() > REUSE_WINDOW_SECONDS * 1000
  ) {
    return null;
  }
  return payment;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = checkRateLimit(`pay-init:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return reply({ error: "Too many attempts. Please try again later." }, 429);
    }

    const body: unknown = await req.json().catch(() => null);
    const tier =
      typeof body === "object" && body !== null && "tier" in body
        ? (body as { tier: unknown }).tier
        : undefined;

    if (typeof tier !== "string" || !(tier in TIER_META)) {
      return reply({ error: "Invalid tier" }, 400);
    }

    const meta = TIER_META[tier as Tier];
    const amount = await getTierAmount(tier as Tier);
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`payment/initiate: invalid configured price for ${tier}: ${amount}`);
      return reply({ error: "Something went wrong. Please try again." }, 500);
    }

    let payment = await findReusablePayment(req, tier as Tier, amount);

    if (!payment) {
      const paymentCode = generatePaymentCode();

      try {
        payment = await prisma.payment.create({
          data: {
            paymentCode,
            tier,
            amount,
            currency: CURRENCY,
            status: "pending",
            paystackRef: paymentCode,
          },
        });
      } catch (dbError) {
        console.error("DB create error:", dbError);
        return reply({ error: "Could not record your payment. Please try again." }, 500);
      }
    }

    if (!payment || !payment.paystackRef) {
      return reply({ error: "Something went wrong. Please try again." }, 500);
    }

    return reply(
      {
        paymentCode: payment.paymentCode,
        amount: payment.amount,
        tier,
        tierLabel: meta.label,
        paystackReference: payment.paystackRef,
        publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      },
      200,
      payment.paymentCode
    );
  } catch (error) {
    console.error("payment/initiate error:", error);
    return reply({ error: "Something went wrong. Please try again." }, 500);
  }
}
