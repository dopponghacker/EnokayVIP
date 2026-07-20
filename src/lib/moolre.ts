/**
 * Moolre API helpers (server-side only).
 * Docs: https://docs.moolre.com
 *
 * Auth headers:
 *  - Transact (payment):  X-API-USER + X-API-KEY (private key)
 *  - Status lookups:      X-API-USER + X-API-PUBKEY (public key)
 */

const BASE_URL = process.env.MOOLRE_API_BASE_URL ?? "https://api.moolre.com";

export type MoolreNetwork = "mtn" | "telecel" | "airteltigo";

/** Ghana mobile-money COLLECTION channels (transfers use different ids). */
export const COLLECTION_CHANNELS: Record<MoolreNetwork, number> = {
  mtn: 13,
  telecel: 6,
  airteltigo: 7,
};

/** Moolre transact response codes */
export const CODE_OTP_REQUIRED = "TP14";
export const CODE_OTP_VERIFIED = "TP17";
export const CODE_PAYMENT_REQUESTED = "TR099";

export interface MoolreResponse {
  status: number; // 1 = ok
  code: string;
  message: string;
  data: unknown;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function accountNumber() {
  return requiredEnv("MOOLRE_ACCOUNT_NUMBER");
}

function privateHeaders() {
  return {
    "Content-Type": "application/json",
    "X-API-USER": requiredEnv("MOOLRE_USERNAME"),
    "X-API-KEY": requiredEnv("MOOLRE_PRIVATE_API_KEY"),
  };
}

function publicHeaders() {
  return {
    "Content-Type": "application/json",
    "X-API-USER": requiredEnv("MOOLRE_USERNAME"),
    "X-API-PUBKEY": requiredEnv("MOOLRE_PUBLIC_API_KEY"),
  };
}

async function post(
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string>
): Promise<MoolreResponse> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as MoolreResponse;
  } catch {
    throw new Error(`Moolre returned an invalid response (HTTP ${res.status})`);
  }
}

/** Normalize a Ghana phone number to local format (0XXXXXXXXX). */
export function normalizeGhanaPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith("0") && digits.length === 10 && /^0[235]/.test(digits)) {
    return digits;
  }
  return null;
}

interface PaymentParams {
  channel: number;
  payer: string; // local format, e.g. 0541234567
  amount: number; // major units (GHS)
  externalRef: string;
  reference?: string; // message shown to payer
  otpCode?: string;
}

/**
 * Initiate (or continue) a mobile-money collection.
 * TP14 = OTP sent to payer, call again with otpCode.
 * TP17 = OTP verified, call again WITHOUT otpCode to trigger the debit prompt.
 * TR099 = payment prompt sent to the payer's phone.
 */
export function transactPayment(params: PaymentParams): Promise<MoolreResponse> {
  return post(
    "/open/transact/payment",
    {
      type: 1,
      channel: String(params.channel),
      currency: "GHS",
      payer: params.payer,
      amount: params.amount.toFixed(2),
      externalref: params.externalRef,
      accountnumber: accountNumber(),
      ...(params.reference ? { reference: params.reference } : {}),
      ...(params.otpCode ? { otpcode: params.otpCode } : {}),
    },
    privateHeaders()
  );
}

export const TX_PENDING = 0;
export const TX_SUCCESS = 1;
export const TX_FAILED = 2;

export interface MoolreTxStatus {
  txstatus?: number;
  [key: string]: unknown;
}

/** Look up a transaction by our external reference. */
export async function transactStatus(externalRef: string): Promise<MoolreTxStatus> {
  const response = await post(
    "/open/transact/status",
    {
      type: 1,
      idtype: "1",
      id: externalRef,
      accountnumber: accountNumber(),
    },
    publicHeaders()
  );
  return (response.data ?? {}) as MoolreTxStatus;
}
