import { createHmac, timingSafeEqual } from "node:crypto";

export const PAYSTACK_API_BASE = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

function getWebhookSecret(): string {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!secret) throw new Error("PAYSTACK_WEBHOOK_SECRET is not configured");
  return secret;
}

export class PaystackError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "PaystackError";
  }
}

export function toPublicError(err: unknown): { message: string; code: string } {
  if (err instanceof PaystackError) {
    if (err.status === 429) {
      return {
        message: "The payment service is busy right now. Please try again in a moment.",
        code: "busy",
      };
    }
    const code =
      err.status === 0 ? "network"
      : err.status === 401 ? "auth"
      : err.status === 403 ? "blocked"
      : err.status === 502 ? "bad_response"
      : err.status >= 500 ? "upstream"
      : `rejected_${err.status}`;
    return {
      message: "The payment service is temporarily unavailable. Please try again in a moment.",
      code,
    };
  }
  return {
    message: "The payment service is temporarily unavailable. Please try again in a moment.",
    code: "config",
  };
}

async function paystackFetch(path: string, opts: { method?: string; body?: unknown } = {}) {
  const method = opts.method ?? "GET";
  const secretKey = getSecretKey();

  const res = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  const body = await res.json().catch(() => null);
  if (res.ok) return body;

  console.error(`Paystack ${res.status} on ${path}:`, JSON.stringify(body));
  throw new PaystackError(
    body?.message || body?.error || `Paystack API error: ${res.status}`,
    res.status,
    body?.code
  );
}

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    metadata: Record<string, unknown>;
    authorization?: Record<string, unknown>;
    customer?: Record<string, unknown>;
  };
}

export async function initializeTransaction(
  email: string,
  amountInKobo: number,
  reference: string,
  metadata?: Record<string, unknown>
): Promise<PaystackInitializeResponse> {
  const result = await paystackFetch("/transaction/initialize", {
    method: "POST",
    body: {
      email,
      amount: amountInKobo,
      reference,
      metadata: metadata ?? {},
    },
  });
  return result;
}

export async function verifyTransaction(
  reference: string
): Promise<PaystackVerifyResponse> {
  const result = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
  return result;
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const secret = getWebhookSecret();
  const expected = createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");
  
  return timingSafeEqual(
    Buffer.from(signature.trim()),
    Buffer.from(expected)
  );
}

export interface PaystackWebhookEvent {
  event: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    status: string;
    gateway_response: string;
    paid_at: string;
    currency: string;
    metadata: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export function parseWebhookEvent(raw: unknown): PaystackWebhookEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.event !== "string") return null;
  if (typeof obj.data !== "object" || obj.data === null) return null;
  const data = obj.data as Record<string, unknown>;
  if (typeof data.reference !== "string") return null;

  return {
    event: obj.event,
    data: {
      id: typeof data.id === "number" ? data.id : 0,
      reference: data.reference,
      amount: typeof data.amount === "number" ? data.amount : 0,
      status: typeof data.status === "string" ? data.status : "",
      gateway_response: typeof data.gateway_response === "string" ? data.gateway_response : "",
      paid_at: typeof data.paid_at === "string" ? data.paid_at : "",
      currency: typeof data.currency === "string" ? data.currency : "",
      metadata: typeof data.metadata === "object" && data.metadata !== null
        ? data.metadata as Record<string, unknown>
        : {},
    },
  };
}
