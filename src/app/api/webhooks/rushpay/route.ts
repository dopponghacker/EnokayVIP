import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyWebhookSignature,
  type RushPayWebhookEvent,
} from "@/lib/rushpay";
import { confirmAndFulfillPayment } from "@/lib/payment-fulfillment";

/**
 * RushPay retries any non-2xx delivery with exponential backoff, so this
 * returns 2xx only once the event is fully handled or can never be handled,
 * and 5xx when a retry could succeed.
 */
async function handlePaymentCompleted(event: RushPayWebhookEvent) {
  const paymentRef = event.data.payment_reference;
  const paymentCode = event.data.metadata?.payment_code;

  let payment = null;

  if (typeof paymentCode === "string") {
    payment = await prisma.payment.findUnique({ where: { paymentCode } });
  }

  if (!payment && paymentRef) {
    payment = await prisma.payment.findFirst({ where: { rushpayRef: paymentRef } });
  }

  if (!payment) {
    // Not one of ours (or created before this system tracked it): retrying won't help.
    console.warn(
      `Webhook: payment not found for rushpayRef=${paymentRef}, paymentCode=${String(paymentCode)}`
    );
    return NextResponse.json({ received: true });
  }

  // The signed body says the payment completed; the status API is the record of it.
  const outcome = await confirmAndFulfillPayment(payment);

  if (outcome === "pending") {
    return NextResponse.json({ error: "Payment not settled yet" }, { status: 503 });
  }
  if (outcome === "failed") {
    console.error(`Webhook: payment ${payment.id} reported completed but RushPay says otherwise`);
  }
  return NextResponse.json({ received: true });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("X-RushPay-Signature");

  try {
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn("Webhook: invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let event: RushPayWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    switch (event.event) {
      case "payment.completed":
      case "checkout.completed":
        return await handlePaymentCompleted(event);
      default:
        console.log(`Webhook: unhandled event type: ${event.event}`);
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error("Webhook: processing error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
