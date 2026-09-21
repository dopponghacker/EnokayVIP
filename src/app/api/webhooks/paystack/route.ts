import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseWebhookEvent,
  verifyWebhookSignature,
  type PaystackWebhookEvent,
} from "@/lib/paystack";
import { confirmAndFulfillPayment } from "@/lib/payment-fulfillment";

/**
 * Paystack retries any non-2xx delivery with exponential backoff, so this
 * returns 2xx only once the event is fully handled or can never be handled,
 * and 5xx when a retry could succeed.
 */
async function handleChargeSuccess(event: PaystackWebhookEvent) {
  const paystackRef = event.data.reference;
  const paymentCode = event.data.metadata?.payment_code;

  let payment = null;

  if (typeof paymentCode === "string") {
    payment = await prisma.payment.findUnique({ where: { paymentCode } });
  }

  if (!payment && paystackRef) {
    payment = await prisma.payment.findFirst({ where: { paystackRef } });
  }

  if (!payment) {
    console.warn(
      `Webhook: payment not found for paystackRef=${paystackRef}, paymentCode=${String(paymentCode)}`
    );
    return NextResponse.json({ received: true });
  }

  const outcome = await confirmAndFulfillPayment(payment);

  if (outcome === "pending") {
    return NextResponse.json({ error: "Payment not settled yet" }, { status: 503 });
  }
  if (outcome === "failed") {
    console.error(`Webhook: payment ${payment.id} reported completed but Paystack says otherwise`);
  }
  return NextResponse.json({ received: true });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  try {
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn("Webhook: invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const event = parseWebhookEvent(parsed);
    if (!event) {
      return NextResponse.json({ error: "Unexpected payload" }, { status: 400 });
    }

    switch (event.event) {
      case "charge.success":
        return await handleChargeSuccess(event);
      default:
        console.log(`Webhook: unhandled event type: ${event.event}`);
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error("Webhook: processing error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
