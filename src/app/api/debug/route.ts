import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { RushPayError, getRushPayPaymentStatus } from "@/lib/rushpay";

/**
 * Admin-only production diagnostics. Uses the same client as real payments,
 * but only reads (no test payments are created) and never prints secrets.
 */
export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const results: Record<string, unknown> = {
    deployment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    env: {
      RUSHPAY_API_KEY: process.env.RUSHPAY_API_KEY
        ? `set (${process.env.RUSHPAY_API_KEY.length} chars)`
        : "MISSING",
      RUSHPAY_WEBHOOK_SECRET: process.env.RUSHPAY_WEBHOOK_SECRET
        ? `set (${process.env.RUSHPAY_WEBHOOK_SECRET.length} chars)`
        : "MISSING",
      AUTH_SECRET: process.env.AUTH_SECRET ? "set" : "MISSING",
      DATABASE_URL: process.env.DATABASE_URL ? "set" : "MISSING",
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "unset (defaults to https://enokayvvip.com)",
    },
  };

  // Looking up a payment that doesn't exist answers "Payment not found" when the
  // key is valid and reachable, and 401/403 when it is wrong or blocked.
  try {
    await getRushPayPaymentStatus("API_DIAGNOSTIC_CHECK");
    results.rushpay = { ok: true };
  } catch (e) {
    if (e instanceof RushPayError) {
      const keyAccepted = e.status === 400 || e.status === 404;
      results.rushpay = {
        ok: keyAccepted,
        status: e.status,
        message: e.message,
        verdict: keyAccepted
          ? "API key accepted and RushPay reachable"
          : e.status === 401 || e.status === 403
            ? "RushPay rejected the key or blocked this server"
            : "RushPay unreachable or erroring",
      };
    } else {
      results.rushpay = { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }

  try {
    results.dbPaymentCount = await prisma.payment.count();
  } catch (e) {
    results.dbError = String(e);
  }

  return NextResponse.json(results, { status: 200 });
}
