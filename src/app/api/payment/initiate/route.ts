import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { Tier, TIER_META } from "@/lib/types";
import { getTierAmount } from "@/lib/pricing";
import {
  COLLECTION_CHANNELS,
  CODE_OTP_REQUIRED,
  CODE_PAYMENT_REQUESTED,
  MoolreNetwork,
  normalizeGhanaPhone,
  transactPayment,
} from "@/lib/moolre";

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

    const { tier, phone, network } = await req.json();

    if (!tier || !(tier in TIER_META)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }
    if (!network || !(network in COLLECTION_CHANNELS)) {
      return NextResponse.json({ error: "Select a mobile network" }, { status: 400 });
    }
    const payer = normalizeGhanaPhone(String(phone ?? ""));
    if (!payer) {
      return NextResponse.json(
        { error: "Enter a valid Ghana mobile money number (e.g. 0541234567)" },
        { status: 400 }
      );
    }

    const meta = TIER_META[tier as Tier];
    const amount = await getTierAmount(tier as Tier);
    const channel = COLLECTION_CHANNELS[network as MoolreNetwork];
    const externalRef = `ENK-${Date.now()}-${randomBytes(4).toString("hex")}`;

    await prisma.payment.create({
      data: {
        externalRef,
        tier,
        amount,
        currency: "GHS",
        phone: payer,
        channel,
        status: "pending",
      },
    });

    const response = await transactPayment({
      channel,
      payer,
      amount,
      externalRef,
      reference: `Enokay69 ${meta.label}`,
    });

    if (response.code === CODE_OTP_REQUIRED) {
      return NextResponse.json({ step: "otp", externalRef });
    }
    if (response.code === CODE_PAYMENT_REQUESTED) {
      return NextResponse.json({ step: "prompt", externalRef });
    }
    if (response.status === 1) {
      // Accepted but in an unexpected phase — let the client poll status.
      return NextResponse.json({ step: "prompt", externalRef });
    }

    await prisma.payment.update({
      where: { externalRef },
      data: { status: "failed" },
    });
    return NextResponse.json(
      { error: response.message || "Payment could not be started. Try again." },
      { status: 502 }
    );
  } catch (error) {
    console.error("payment/initiate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
