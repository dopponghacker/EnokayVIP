import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  PAYMENT_TOKEN_COOKIE,
  PAYMENT_TTL_SECONDS,
  createPaymentToken,
  paymentCookieOptions,
} from "@/lib/auth";
import { getRushPayPaymentStatus } from "@/lib/rushpay";
import { fulfillPayment } from "@/lib/payment-fulfillment";

const PAYMENT_CODE_RE = /^ENK-[A-Z0-9]{6}$/;

/**
 * Confirms a payment with RushPay from the server and, once it is paid,
 * issues the signed access cookie for the purchased tier. The browser polls
 * this after starting checkout; the webhook may already have approved it.
 */
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = checkRateLimit(`pay-verify:${ip}`, 200, 5 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const paymentCode = typeof body?.paymentCode === "string" ? body.paymentCode : "";
    if (!PAYMENT_CODE_RE.test(paymentCode)) {
      return NextResponse.json({ error: "Invalid payment code" }, { status: 400 });
    }

    let payment = await prisma.payment.findUnique({ where: { paymentCode } });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    let paid = payment.status === "approved";

    if (!paid && payment.rushpayRef) {
      try {
        const result = await getRushPayPaymentStatus(payment.rushpayRef);
        const paidAmount = parseFloat(result.data?.amount ?? "");
        const completed =
          result.data?.status === "completed" &&
          Number.isFinite(paidAmount) &&
          paidAmount >= payment.amount - 0.01;

        if (completed) {
          await fulfillPayment(payment.id, { rushpayRef: payment.rushpayRef });
          paid = true;
        }
      } catch (err) {
        // RushPay hiccup: report "not paid yet" so the client keeps polling.
        console.error("payment/verify: status lookup failed:", err);
      }
    }

    if (!paid) {
      return NextResponse.json({ paid: false });
    }

    payment = await prisma.payment.findUnique({ where: { paymentCode } });
    const approvedAt = payment?.approvedAt;
    if (!payment || !approvedAt) {
      return NextResponse.json({ paid: false });
    }

    const expiresAt = approvedAt.getTime() + PAYMENT_TTL_SECONDS * 1000;
    const remainingSeconds = Math.floor((expiresAt - Date.now()) / 1000);
    if (remainingSeconds <= 0) {
      return NextResponse.json(
        { paid: true, expired: true, error: "Access has expired. Please purchase again." },
        { status: 410 }
      );
    }

    const response = NextResponse.json({ paid: true, tier: payment.tier });
    response.cookies.set(
      PAYMENT_TOKEN_COOKIE,
      createPaymentToken(payment.tier, expiresAt),
      { ...paymentCookieOptions, maxAge: remainingSeconds }
    );
    return response;
  } catch (error) {
    console.error("payment/verify error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
