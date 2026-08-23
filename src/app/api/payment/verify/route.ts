import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTransaction } from "@/lib/paystack";
import { createPaymentToken, paymentCookieOptions } from "@/lib/auth";
import { Tier } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get("reference");

    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }

    const paystackResult = await verifyTransaction(reference);

    if (!paystackResult.status || paystackResult.data.status !== "success") {
      return NextResponse.json({ verified: false, error: "Payment not successful" }, { status: 400 });
    }

    const paystackEmail = paystackResult.data.customer.email;

    const payment = await prisma.payment.findFirst({
      where: { paymentCode: reference },
    });

    if (!payment) {
      return NextResponse.json({ verified: false, error: "Payment record not found" }, { status: 404 });
    }

    if (payment.status !== "approved") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "approved",
          approvedAt: new Date(),
          email: paystackEmail || payment.email,
        },
      });
    }

    const tier = payment.tier as Tier;
    const paymentToken = createPaymentToken(tier);

    return NextResponse.json({
      verified: true,
      tier,
      paymentToken,
      cookieOptions: paymentCookieOptions,
    });
  } catch (error) {
    console.error("payment/verify error:", error);
    return NextResponse.json({ verified: false, error: "Verification failed" }, { status: 500 });
  }
}
