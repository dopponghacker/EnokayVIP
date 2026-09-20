import { createHmac, timingSafeEqual } from "node:crypto";

export const RUSHPAY_API_BASE = "https://core.rushpay.cash";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

/** Server-side API base. Override with RUSHPAY_BASE_URL; must be https. */
function getApiBase(): string {
  const override = process.env.RUSHPAY_BASE_URL?.trim();
  if (!override) return RUSHPAY_API_BASE;
  if (!override.startsWith("https://")) {
    throw new Error("RUSHPAY_BASE_URL must start with https://");
  }
  return override.replace(/\/+$/, "");
}

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

/**
 * What a customer may see: a generic message plus a short reference code that
 * tells the site owner which kind of failure it was. No secrets or upstream
 * text are included; the full details stay in the server log.
 */
export function toPublicError(err: unknown): { message: string; code: string } {
  if (err instanceof RushPayError) {
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
  // Not a RushPay response at all: our own configuration (e.g. a missing key).
  return {
    message: "The payment service is temporarily unavailable. Please try again in a moment.",
    code: "config",
  };
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
      const res = await fetch(`${getApiBase()}${path}`, {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** RushPay sends money as a string, but accept a number rather than fail. */
function asAmountString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(2);
  return asString(value);
}

function malformedResponse(what: string): RushPayError {
  console.error(`RushPay returned an unexpected ${what} response`);
  return new RushPayError("Unexpected response from RushPay", 502);
}

function successData(raw: unknown, what: string): Record<string, unknown> {
  if (!isRecord(raw) || raw.success !== true || !isRecord(raw.data)) {
    throw malformedResponse(what);
  }
  return raw.data;
}

function parseCreateResponse(raw: unknown): RushPayCreatePaymentResponse {
  const data = successData(raw, "create-payment");
  const reference = asString(data.payment_reference);
  if (!reference) throw malformedResponse("create-payment");
  return {
    success: true,
    data: {
      payment_reference: reference,
      status: asString(data.status) ?? "pending",
      expires_at: asString(data.expires_at) ?? "",
      amount: asAmountString(data.amount) ?? "",
      currency: asString(data.currency) ?? "",
      description: asString(data.description) ?? "",
    },
  };
}

function parseWidgetSessionResponse(raw: unknown): RushPayWidgetSessionResponse {
  const data = successData(raw, "widget-session");
  const token = asString(data.widget_session_token);
  if (!token) throw malformedResponse("widget-session");
  return {
    success: true,
    data: {
      widget_session_token: token,
      payment_reference: asString(data.payment_reference) ?? "",
      expires_in: typeof data.expires_in === "number" ? data.expires_in : undefined,
    },
  };
}

function parseStatusResponse(raw: unknown): RushPayPaymentStatusResponse {
  const data = successData(raw, "payment-status");
  const status = asString(data.status);
  if (!status) throw malformedResponse("payment-status");
  return {
    success: true,
    data: {
      payment_reference: asString(data.payment_reference) ?? "",
      status,
      payment_status: asString(data.payment_status),
      amount: asAmountString(data.amount),
      currency: asString(data.currency),
      paid: typeof data.paid === "boolean" ? data.paid : undefined,
      verified: typeof data.verified === "boolean" ? data.verified : undefined,
      paid_at: asString(data.paid_at) ?? null,
      completed_at: asString(data.completed_at) ?? null,
    },
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

  return parseCreateResponse(result);
}

export async function createRushPayWidgetSession(
  paymentReference: string
): Promise<RushPayWidgetSessionResponse> {
  const result = await rushpayFetch("/api/v1/merchant/payments/widget-session", {
    method: "POST",
    retryUnsafeFailures: true,
    body: { payment_reference: paymentReference },
  });

  return parseWidgetSessionResponse(result);
}

/** Server-side status lookup, the source of truth before granting access. */
export async function getRushPayPaymentStatus(
  paymentReference: string
): Promise<RushPayPaymentStatusResponse> {
  const result = await rushpayFetch(
    `/api/v1/merchant/payments/status?payment_reference=${encodeURIComponent(paymentReference)}`
  );
  return parseStatusResponse(result);
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

/** Narrows an untrusted, already signature-verified body to a usable event. */
export function parseWebhookEvent(raw: unknown): RushPayWebhookEvent | null {
  if (!isRecord(raw) || typeof raw.event !== "string" || !isRecord(raw.data)) {
    return null;
  }
  const data = raw.data;
  const paymentReference = asString(data.payment_reference);
  if (!paymentReference) return null;

  return {
    event: raw.event,
    timestamp: asString(raw.timestamp),
    event_id: asString(raw.event_id),
    data: {
      ...data,
      payment_reference: paymentReference,
      amount: asAmountString(data.amount) ?? "",
      currency: asString(data.currency) ?? "",
      status: asString(data.status) ?? "",
      metadata: isRecord(data.metadata) ? data.metadata : undefined,
    },
  };
}
