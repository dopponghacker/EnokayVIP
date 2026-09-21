import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { PaystackError, verifyTransaction } from "@/lib/paystack";

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
      PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY
        ? `set (${process.env.PAYSTACK_SECRET_KEY.length} chars)`
        : "MISSING",
      PAYSTACK_WEBHOOK_SECRET: process.env.PAYSTACK_WEBHOOK_SECRET
        ? `set (${process.env.PAYSTACK_WEBHOOK_SECRET.length} chars)`
        : "MISSING",
      AUTH_SECRET: process.env.AUTH_SECRET ? "set" : "MISSING",
      DATABASE_URL: process.env.DATABASE_URL ? "set" : "MISSING",
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "unset (defaults to https://enokayvvip.com)",
    },
  };

  try {
    await verifyTransaction("API_DIAGNOSTIC_CHECK");
    results.paystack = { ok: true };
  } catch (e) {
    if (e instanceof PaystackError) {
      const keyAccepted = e.status === 400 || e.status === 404;
      results.paystack = {
        ok: keyAccepted,
        status: e.status,
        message: e.message,
        verdict: keyAccepted
          ? "API key accepted and Paystack reachable"
          : e.status === 401 || e.status === 403
            ? "Paystack rejected the key or blocked this server"
            : "Paystack unreachable or erroring",
      };
    } else {
      results.paystack = { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }

  try {
    results.dbPaymentCount = await prisma.payment.count();
  } catch (e) {
    results.dbError = String(e);
  }

  return NextResponse.json(results, { status: 200 });
}
