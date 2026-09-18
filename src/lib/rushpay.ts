import { createHmac, timingSafeEqual } from "node:crypto";

const RUSHPAY_API_BASE = "https://core.rushpay.cash";

function getApiKey(): string {
  const key = process.env.RUSHPAY_API_KEY;
  if (!key) throw new Error("RUSHPAY_API_KEY is not configured");
  return key;
}

function getWebhookSecret(): string {
  const secret = process.env.RUSHPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RUSHPAY_WEBHOOK_SECRET is not configured");
  return secret;
}

async function rushpayFetch(path: string, options: RequestInit = {}) {
  const url = `${RUSHPAY_API_BASE}${path}`;
  const apiKey = getApiKey();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body?.message || body?.error || `RushPay API error: ${res.status}`;
    console.error(`RushPay ${res.status} on ${path}:`, JSON.stringify(body));
    throw new Error(message);
  }
  return body;
}

export interface RushPayCreatePaymentResponse {
  success: boolean;
  data: {
    payment_reference: string;
    status: string;
    expires_at: string;
    amount: string;
    currency: string;
    description: string;
  };
}

export interface RushPayWidgetSessionResponse {
  success: boolean;
  data: {
    widget_session_token: string;
    payment_reference: string;
  };
}

export async function createRushPayPayment(
  amount: number,
  description: string,
  paymentCode: string
): Promise<RushPayCreatePaymentResponse> {
  const result = await rushpayFetch("/api/v1/merchant/payments/create", {
    method: "POST",
    body: JSON.stringify({
      amount: amount.toFixed(2),
      description,
      callback_url: `https://enokayvvip.com/api/webhooks/rushpay`,
      metadata: {
        payment_code: paymentCode,
      },
    }),
  });

  return result as RushPayCreatePaymentResponse;
}

export async function createRushPayWidgetSession(
  paymentReference: string
): Promise<RushPayWidgetSessionResponse> {
  const result = await rushpayFetch(
    "/api/v1/merchant/payments/widget-session",
    {
      method: "POST",
      body: JSON.stringify({
        payment_reference: paymentReference,
      }),
    }
  );

  return result as RushPayWidgetSessionResponse;
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const secret = getWebhookSecret();
  const expectedSignature = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const sigBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expectedSignature, "utf8");

  if (sigBuf.length !== expectedBuf.length) {
    const fake = Buffer.alloc(sigBuf.length, 0);
    timingSafeEqual(fake, expectedBuf);
    return false;
  }

  return timingSafeEqual(sigBuf, expectedBuf);
}

export interface RushPayWebhookEvent {
  event: string;
  data: {
    payment_reference: string;
    amount: string;
    currency: string;
    status: string;
    email?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
  event_id?: string;
}
