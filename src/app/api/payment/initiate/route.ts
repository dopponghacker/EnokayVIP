import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { Tier, TIER_META } from "@/lib/types";
import { getTierAmount } from "@/lib/pricing";
import { initializeTransaction } from "@/lib/paystack";

function generatePaymentCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(6);
  let code = "ENK-";
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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

    const host = req.headers.get("host") || "enokayvvp.com";
    const protocol = req.headers.get("x-forwarded-proto") || "https";
    const baseUrl = `${protocol}://${host}`;

    const tierKey = tier as Tier;
    const meta = TIER_META[tierKey];
    const amount = await getTierAmount(tierKey);
    const paymentCode = generatePaymentCode();

    const payment = await prisma.payment.create({
      data: {
        paymentCode,
        email: "pending@enokay69.com",
        tier: tierKey,
        amount,
        currency: "GHS",
        status: "pending",
      },
    });

    const reference = paymentCode;
    const amountInPesewas = Math.round(amount * 100);

    const paystackResponse = await initializeTransaction({
      email: "pending@enokay69.com",
      amount: amountInPesewas,
      reference,
      currency: "GHS",
      callback_url: `${baseUrl}/payment/success`,
      metadata: {
        paymentId: payment.id,
        tier: tierKey,
        paymentCode,
      },
    });

    return NextResponse.json({
      authorizationUrl: paystackResponse.data.authorization_url,
      reference,
      paymentCode,
      amount,
      tierLabel: meta.label,
    });
  } catch (error) {
    console.error("payment/initiate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
