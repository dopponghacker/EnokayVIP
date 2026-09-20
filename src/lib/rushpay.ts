import { createHmac, timingSafeEqual } from "node:crypto";

export const RUSHPAY_API_BASE = "https://core.rushpay.cash";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

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

/** Public URL of this site, used for the per-payment webhook callback. */
function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://enokayvvip.com").replace(/\/+$/, "");
}

/** A failed RushPay call. `status` is the HTTP status, or 0 for network errors. */
export class RushPayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "RushPayError";
  }
}

/** Message that is safe to show a customer; details stay in the server log. */
export function toPublicMessage(err: unknown): string {
  if (err instanceof RushPayError && err.status === 429) {
    return "The payment service is busy right now. Please try again in a moment.";
  }
  return "The payment service is temporarily unavailable. Please try again in a moment.";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter, per RushPay's guidance for 429s. */
function backoffMs(attempt: number) {
  const base = BASE_BACKOFF_MS * 2 ** attempt;
  return base + Math.random() * (base / 2);
}

interface RushPayRequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  /**
   * Whether a request that may already have been processed (5xx, timeout,
   * dropped connection) can be sent again. Leave false for anything that
   * moves money. A rejected request (429) is always safe to retry.
   */
  retryUnsafeFailures?: boolean;
}

async function rushpayFetch(path: string, opts: RushPayRequestOptions = {}) {
  const method = opts.method ?? "GET";
  const canRetryUnsafe = method === "GET" || opts.retryUnsafeFailures === true;
  const apiKey = getApiKey();

  for (let attempt = 0; ; attempt++) {
    let error: RushPayError;

    try {
      const res = await fetch(`${RUSHPAY_API_BASE}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "User-Agent": "Enokay69-Payment-Server/1.0",
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const body = await res.json().catch(() => null);
      if (res.ok) return body;

      console.error(`RushPay ${res.status} on ${path}:`, JSON.stringify(body));
      error = new RushPayError(
        body?.message || body?.error || `RushPay API error: ${res.status}`,
        res.status,
        body?.code
      );
    } catch (err) {
      // Timeout or dropped connection: the request may have been processed.
      console.error(`RushPay network error on ${path}:`, err);
      error = new RushPayError(
        err instanceof Error ? err.message : "RushPay request failed",
        0
      );
    }

    const retryable =
      error.status === 429 ||
      ((error.status >= 500 || error.status === 0) && canRetryUnsafe);
    if (!retryable || attempt >= MAX_ATTEMPTS - 1) throw error;

    await sleep(backoffMs(attempt));
  }
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
    expires_in?: number;
  };
}

export interface RushPayPaymentStatusResponse {
  success: boolean;
  data: {
    payment_reference: string;
    status: string;
    payment_status?: string;
    amount?: string;
    currency?: string;
    paid?: boolean;
    verified?: boolean;
    paid_at?: string | null;
    completed_at?: string | null;
  };
}

export async function createRushPayPayment(
  amount: number,
  description: string,
  paymentCode: string
): Promise<RushPayCreatePaymentResponse> {
  // Creates an unpaid pending checkout, so a duplicate from a retry is harmless.
  const result = await rushpayFetch("/api/v1/merchant/payments/create", {
    method: "POST",
    retryUnsafeFailures: true,
    body: {
      amount: amount.toFixed(2),
      description,
      callback_url: `${getSiteUrl()}/api/webhooks/rushpay`,
      metadata: {
        payment_code: paymentCode,
      },
    },
  });

  return result as RushPayCreatePaymentResponse;
}

export async function createRushPayWidgetSession(
  paymentReference: string
): Promise<RushPayWidgetSessionResponse> {
  const result = await rushpayFetch("/api/v1/merchant/payments/widget-session", {
    method: "POST",
    retryUnsafeFailures: true,
    body: { payment_reference: paymentReference },
  });

  return result as RushPayWidgetSessionResponse;
}

/** Server-side status lookup, the source of truth before granting access. */
export async function getRushPayPaymentStatus(
  paymentReference: string
): Promise<RushPayPaymentStatusResponse> {
  const result = await rushpayFetch(
    `/api/v1/merchant/payments/status?payment_reference=${encodeURIComponent(paymentReference)}`
  );
  return result as RushPayPaymentStatusResponse;
}

/** X-RushPay-Signature is hex(HMAC-SHA256(raw body, webhook_secret)). */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", getWebhookSecret())
    .update(rawBody)
    .digest();
  // Invalid hex decodes short, so it fails the length check below.
  const provided = Buffer.from(signature.trim(), "hex");

  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export interface RushPayWebhookEvent {
  event: string;
  timestamp?: string;
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
