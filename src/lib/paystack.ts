import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_API = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

function headers() {
  return {
    Authorization: `Bearer ${getSecretKey()}`,
    "Content-Type": "application/json",
  };
}

/* ---------- Initialize Transaction ---------- */
export interface InitializeTransactionParams {
  email: string;
  amount: number; // in pesewas (amount * 100)
  reference: string;
  currency: string;
  metadata?: Record<string, unknown>;
  callback_url?: string;
}

export interface PaystackTransactionResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export async function initializeTransaction(
  params: InitializeTransactionParams
): Promise<PaystackTransactionResponse> {
  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email: params.email,
      amount: params.amount,
      reference: params.reference,
      currency: params.currency,
      metadata: params.metadata,
      callback_url: params.callback_url,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.message || `Paystack API error: ${res.status}`);
  }

  return res.json();
}

/* ---------- Verify Transaction ---------- */
export interface PaystackVerificationData {
  id: number;
  domain: string;
  amount: number;
  currency: string;
  transaction_date: string;
  status: string;
  reference: string;
  metadata: Record<string, unknown>;
  customer: {
    id: number;
    email: string;
  };
}

export interface PaystackVerificationResponse {
  status: boolean;
  message: string;
  data: PaystackVerificationData;
}

export async function verifyTransaction(
  reference: string
): Promise<PaystackVerificationResponse> {
  const res = await fetch(`${PAYSTACK_API}/transaction/verify/${reference}`, {
    method: "GET",
    headers: headers(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new Error(error?.message || `Paystack API error: ${res.status}`);
  }

  return res.json();
}

/* ---------- Webhook Signature Verification ---------- */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!secret) return false;

  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const hashBuf = Buffer.from(hash, "hex");

  if (sigBuf.length !== hashBuf.length) return false;
  return timingSafeEqual(sigBuf, hashBuf);
}
