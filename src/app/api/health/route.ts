import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.RUSHPAY_API_KEY || "MISSING";
  const secret = process.env.RUSHPAY_WEBHOOK_SECRET || "MISSING";

  let rushpayResult: unknown = null;
  try {
    const res = await fetch("https://core.rushpay.cash/api/v1/merchant/payments/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": key,
        "User-Agent": "Enokay69-Payment-Server/1.0",
      },
      body: JSON.stringify({
        amount: "1.00",
        description: "Health check",
        callback_url: "https://enokayvvip.com/api/webhooks/rushpay",
        metadata: { health_check: true },
      }),
    });
    rushpayResult = { status: res.status, body: await res.json().catch(() => null) };
  } catch (e) {
    rushpayResult = { error: String(e) };
  }

  return NextResponse.json({
    keyPrefix: key.substring(0, 8),
    keyLength: key.length,
    secretPrefix: secret.substring(0, 8),
    rushpayResult,
  });
}
