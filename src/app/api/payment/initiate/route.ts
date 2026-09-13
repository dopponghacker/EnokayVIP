import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { Tier, TIER_META } from "@/lib/types";
import { getTierAmount } from "@/lib/pricing";

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

    const { tier, email } = await req.json();

    if (!tier || !(tier in TIER_META)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    const meta = TIER_META[tier as Tier];
    const amount = await getTierAmount(tier as Tier);
    const paymentCode = generatePaymentCode();

    await prisma.payment.create({
      data: {
        paymentCode,
        email: email.toLowerCase().trim(),
        tier,
        amount,
        currency: "GHS",
        status: "pending",
      },
    });

    return NextResponse.json({
      paymentCode,
      amount,
      tier,
      tierLabel: meta.label,
      paymentNumber: process.env.PAYMENT_PHONE || "0500964516",
      paymentName: process.env.PAYMENT_NAME || "George Yankah",
      instructions: `Send GH₵${amount} to ${process.env.PAYMENT_NAME || "George Yankah"} (${process.env.PAYMENT_PHONE || "0500964516"}) via Mobile Money. Use your payment code as reference.`,
    });
  } catch (error) {
    console.error("payment/initiate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
