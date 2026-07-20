import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  PAYMENT_TOKEN_COOKIE,
  verifySessionToken,
  verifyPaymentToken,
} from "@/lib/auth";

export function requireAdmin(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return verifySessionToken(token)
    ? null
    : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function requireAdminOrPayment(request: NextRequest, requiredTier?: string) {
  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (verifySessionToken(sessionToken)) return null;

  if (requiredTier) {
    const paymentToken = request.cookies.get(PAYMENT_TOKEN_COOKIE)?.value;
    const payload = verifyPaymentToken(paymentToken);
    if (payload && payload.tier === requiredTier) return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
