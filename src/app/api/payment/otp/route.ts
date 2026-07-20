import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  CODE_OTP_VERIFIED,
  CODE_PAYMENT_REQUESTED,
  transactPayment,
} from "@/lib/moolre";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = checkRateLimit(`pay-otp:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const { externalRef, otp } = await req.json();
    const otpCode = String(otp ?? "").trim();

    if (!externalRef || !/^\d{4,8}$/.test(otpCode)) {
      return NextResponse.json({ error: "Enter the OTP sent to your phone" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({ where: { externalRef } });
    if (!payment || payment.status !== "pending") {
      return NextResponse.json({ error: "Payment session not found" }, { status: 404 });
    }

    let response = await transactPayment({
      channel: payment.channel,
      payer: payment.phone,
      amount: payment.amount,
      externalRef: payment.externalRef,
      otpCode,
    });

    // TP17 = OTP verified; call again without the OTP to trigger the debit prompt.
    if (response.code === CODE_OTP_VERIFIED) {
      response = await transactPayment({
        channel: payment.channel,
        payer: payment.phone,
        amount: payment.amount,
        externalRef: payment.externalRef,
      });
    }

    if (response.code === CODE_PAYMENT_REQUESTED || response.status === 1) {
      return NextResponse.json({ step: "prompt", externalRef });
    }

    return NextResponse.json(
      { error: response.message || "OTP verification failed. Try again." },
      { status: 400 }
    );
  } catch (error) {
    console.error("payment/otp error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
