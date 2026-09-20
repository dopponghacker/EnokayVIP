import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import type { Payment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { Tier, TIER_META } from "@/lib/types";
import { getTierAmount } from "@/lib/pricing";
import { paymentCookieOptions } from "@/lib/auth";
import {
  RushPayError,
  type RushPayWidgetSessionResponse,
  createRushPayPayment,
  createRushPayWidgetSession,
  toPublicMessage,
} from "@/lib/rushpay";

const DEFAULT_WIDGET_SESSION_SECONDS = 900;
const CURRENCY = "GHS";
const PAYMENT_CODE_RE = /^ENK-[A-Z0-9]{6}$/;

// A double-click or refresh should continue the checkout already in progress
// rather than open a second RushPay payment. The cookie remembers which
// payment this browser started; it lives shorter than the widget session.
const CHECKOUT_COOKIE = "enokay_checkout";
const REUSE_WINDOW_SECONDS = 45 * 60;

function generatePaymentCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const len = chars.length;
  const bytes = randomBytes(12);
  let code = "ENK-";
  for (let i = 0; i < 6; i++) {
    const b = bytes[i];
    if (b < 256 - (256 % len)) {
      code += chars[b % len];
    } else {
      code += chars[bytes[i + 6] % len];
    }
  }
  return code;
}

function reply(
  body: Record<string, unknown>,
  status: number,
  paymentCode?: string
) {
  const response = NextResponse.json(body, { status });
  if (paymentCode) {
    response.cookies.set(CHECKOUT_COOKIE, paymentCode, {
      ...paymentCookieOptions,
      maxAge: REUSE_WINDOW_SECONDS,
    });
  }
  return response;
}

/** The still-open payment this browser already started for this tier, if any. */
async function findReusablePayment(
  req: NextRequest,
  tier: Tier,
  amount: number
): Promise<Payment | null> {
  const code = req.cookies.get(CHECKOUT_COOKIE)?.value;
  if (!code || !PAYMENT_CODE_RE.test(code)) return null;

  const payment = await prisma.payment.findUnique({ where: { paymentCode: code } });
  if (
    !payment ||
    payment.tier !== tier ||
    payment.status !== "pending" ||
    !payment.rushpayRef ||
    payment.currency !== CURRENCY ||
    payment.amount !== amount ||
    Date.now() - payment.createdAt.getTime() > REUSE_WINDOW_SECONDS * 1000
  ) {
    return null;
  }
  return payment;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = checkRateLimit(`pay-init:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return reply({ error: "Too many attempts. Please try again later." }, 429);
    }

    const body: unknown = await req.json().catch(() => null);
    const tier =
      typeof body === "object" && body !== null && "tier" in body
        ? (body as { tier: unknown }).tier
        : undefined;

    if (typeof tier !== "string" || !(tier in TIER_META)) {
      return reply({ error: "Invalid tier" }, 400);
    }

    // The amount only ever comes from the server, never from the request.
    const meta = TIER_META[tier as Tier];
    const amount = await getTierAmount(tier as Tier);
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(`payment/initiate: invalid configured price for ${tier}: ${amount}`);
      return reply({ error: "Something went wrong. Please try again." }, 500);
    }

    let payment = await findReusablePayment(req, tier as Tier, amount);
    let widgetSession: RushPayWidgetSessionResponse | null = null;

    if (payment?.rushpayRef) {
      try {
        widgetSession = await createRushPayWidgetSession(payment.rushpayRef);
      } catch (err) {
        // Only a payment RushPay no longer accepts (e.g. it is no longer
        // pending) is replaced; an outage must not spawn extra payments.
        if (!(err instanceof RushPayError && [400, 404, 409].includes(err.status))) {
          console.error("RushPay API error:", err);
          return reply({ error: toPublicMessage(err) }, 502, payment.paymentCode);
        }
        console.warn(`Payment ${payment.id} can no longer be continued; starting a new one`);
        payment = null;
      }
    }

    if (!payment) {
      const paymentCode = generatePaymentCode();

      let rushpayRef: string;
      try {
        const created = await createRushPayPayment(
          amount,
          `Enokay69 - ${meta.label}`,
          paymentCode
        );
        rushpayRef = created.data.payment_reference;
      } catch (err) {
        // Details stay in the server log; customers get a generic message.
        console.error("RushPay API error:", err);
        return reply({ error: toPublicMessage(err) }, 502);
      }

      // Store the reference before issuing a widget session: verify and the
      // webhook both find the payment through it.
      try {
        payment = await prisma.payment.create({
          data: {
            paymentCode,
            tier,
            amount,
            currency: CURRENCY,
            status: "pending",
            rushpayRef,
          },
        });
      } catch (dbError) {
        console.error("DB create error:", dbError);
        return reply({ error: "Could not record your payment. Please try again." }, 500);
      }

      try {
        widgetSession = await createRushPayWidgetSession(rushpayRef);
      } catch (err) {
        // The payment is saved, so a retry continues it instead of duplicating.
        console.error("RushPay API error:", err);
        return reply({ error: toPublicMessage(err) }, 502, payment.paymentCode);
      }
    }

    if (!widgetSession || !payment.rushpayRef) {
      return reply({ error: "Something went wrong. Please try again." }, 500);
    }

    return reply(
      {
        paymentCode: payment.paymentCode,
        amount: payment.amount,
        tier,
        tierLabel: meta.label,
        widgetSessionToken: widgetSession.data.widget_session_token,
        sessionExpiresIn:
          widgetSession.data.expires_in ?? DEFAULT_WIDGET_SESSION_SECONDS,
        paymentReference: payment.rushpayRef,
      },
      200,
      payment.paymentCode
    );
  } catch (error) {
    console.error("payment/initiate error:", error);
    return reply({ error: "Something went wrong. Please try again." }, 500);
  }
}
