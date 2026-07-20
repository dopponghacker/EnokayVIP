import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createPaymentToken,
  PAYMENT_TOKEN_COOKIE,
  paymentCookieOptions,
} from "@/lib/auth";
import { transactStatus, TX_FAILED, TX_SUCCESS } from "@/lib/moolre";

/**
 * Polled by the payment page. Access is granted ONLY after Moolre
 * confirms the transaction as successful (txstatus = 1).
 */
export async function POST(req: NextRequest) {
  try {
    const { externalRef } = await req.json();
    if (!externalRef || typeof externalRef !== "string") {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({ where: { externalRef } });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Already confirmed (e.g. via webhook or a previous poll) — re-issue cookie.
    if (payment.status === "success") {
      return grantAccess(payment.tier);
    }
    if (payment.status === "failed") {
      return NextResponse.json({ granted: false, failed: true });
    }

    const status = await transactStatus(externalRef);

    if (status.txstatus === TX_SUCCESS) {
      await prisma.payment.update({
        where: { externalRef },
        data: { status: "success" },
      });
      return grantAccess(payment.tier);
    }

    if (status.txstatus === TX_FAILED) {
      await prisma.payment.update({
        where: { externalRef },
        data: { status: "failed" },
      });
      return NextResponse.json({ granted: false, failed: true });
    }

    return NextResponse.json({ granted: false, failed: false });
  } catch (error) {
    console.error("payment/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function grantAccess(tier: string) {
  const response = NextResponse.json({ granted: true, tier });
  response.cookies.set(PAYMENT_TOKEN_COOKIE, createPaymentToken(tier), paymentCookieOptions);
  return response;
}
