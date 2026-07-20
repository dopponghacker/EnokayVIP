import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { adminCredentials } from "../../db/schema";

export const ADMIN_SESSION_COOKIE = "enokay_admin_session";
export const PAYMENT_TOKEN_COOKIE = "enokay_payment";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const PAYMENT_TTL_SECONDS = 60 * 60 * 24;

type SessionPayload = {
  username: string;
  expiresAt: number;
};

type PaymentPayload = {
  tier: string;
  expiresAt: number;
};

function getSecret() {
  return process.env.AUTH_SECRET;
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/* ---------- Password hashing (scrypt) ---------- */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const computed = scryptSync(password, salt, 64).toString("hex");
  const bufA = Buffer.from(computed, "hex");
  const bufB = Buffer.from(storedHash, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/* ---------- DB-backed credential checks ---------- */
export async function getAdminCredential() {
  const [existing] = await db
    .select()
    .from(adminCredentials)
    .where(eq(adminCredentials.id, "admin"))
    .limit(1);

  if (existing) return existing;

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return null;

  const { hash, salt } = hashPassword(password);
  await db
    .insert(adminCredentials)
    .values({
      id: "admin",
      username,
      passwordHash: hash,
      passwordSalt: salt,
    })
    .onConflictDoNothing();

  const [created] = await db
    .select()
    .from(adminCredentials)
    .where(eq(adminCredentials.id, "admin"))
    .limit(1);
  return created ?? null;
}

export async function updateAdminCredential(
  data: Partial<Pick<typeof adminCredentials.$inferInsert, "username" | "passwordHash" | "passwordSalt">>,
) {
  await db
    .update(adminCredentials)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(adminCredentials.id, "admin"));
}

export async function isAuthConfigured(): Promise<boolean> {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) return false;
  try {
    const cred = await getAdminCredential();
    return Boolean(cred);
  } catch {
    return false;
  }
}

export async function credentialsAreValid(
  username: string,
  password: string
): Promise<boolean> {
  try {
    const cred = await getAdminCredential();
    if (!cred) return false;

    const usernameMatch = safeCompare(username, cred.username);
    const passwordMatch = verifyPassword(password, cred.passwordHash, cred.passwordSalt);
    return usernameMatch && passwordMatch;
  } catch {
    return false;
  }
}

/* ---------- Session tokens ---------- */
export function createSessionToken(username: string) {
  const secret = getSecret();
  if (!secret) throw new Error("AUTH_SECRET is not configured");

  const payload: SessionPayload = {
    username,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  const secret = getSecret();
  if (!token || !secret) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expectedSignature = sign(encoded, secret);
  if (!safeCompare(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload;
    if (!payload.username || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------- Payment tokens ---------- */
export function createPaymentToken(tier: string) {
  const secret = getSecret();
  if (!secret) throw new Error("AUTH_SECRET is not configured");

  const payload: PaymentPayload = {
    tier,
    expiresAt: Date.now() + PAYMENT_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyPaymentToken(token?: string | null): PaymentPayload | null {
  const secret = getSecret();
  if (!token || !secret) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expectedSignature = sign(encoded, secret);
  if (!safeCompare(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as PaymentPayload;
    if (!payload.tier || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------- Cookie helpers ---------- */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: true,
  path: "/enokay-secure-login",
  maxAge: SESSION_TTL_SECONDS,
};

export const paymentCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: true,
  path: "/",
  maxAge: PAYMENT_TTL_SECONDS,
};
