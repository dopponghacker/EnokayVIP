import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const results: Record<string, unknown> = {};

  // Test env vars
  results.apiKeySet = !!process.env.RUSHPAY_API_KEY;
  results.webhookSecretSet = !!process.env.RUSHPAY_WEBHOOK_SECRET;
  results.apiKeyPrefix = process.env.RUSHPAY_API_KEY?.substring(0, 8) || "MISSING";

  // Test RushPay API connectivity
  try {
    const res = await fetch("https://core.rushpay.cash/api/v1/merchant/payments/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.RUSHPAY_API_KEY || "",
      },
      body: JSON.stringify({
        amount: "1.00",
        description: "Enokay69 connectivity test",
        callback_url: "https://enokayvvip.com/api/webhooks/rushpay",
        metadata: { test: true },
      }),
    });
    const body = await res.text();
    results.rushpayStatus = res.status;
    try {
      results.rushpayBody = JSON.parse(body);
    } catch {
      results.rushpayBody = body.substring(0, 500);
    }
  } catch (e) {
    results.rushpayError = String(e);
  }

  // Test DB connectivity
  try {
    const count = await prisma.payment.count();
    results.dbPaymentCount = count;
  } catch (e) {
    results.dbError = String(e);
  }

  return NextResponse.json(results, { status: 200 });
}
