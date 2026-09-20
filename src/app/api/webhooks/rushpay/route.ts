import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyWebhookSignature,
  type RushPayWebhookEvent,
} from "@/lib/rushpay";
import { fulfillPayment } from "@/lib/payment-fulfillment";

async function handlePaymentCompleted(event: RushPayWebhookEvent) {
  const paymentRef = event.data.payment_reference;
  const paymentCode = event.data.metadata?.payment_code as string | undefined;

  let payment = null;

  if (paymentCode) {
    payment = await prisma.payment.findFirst({ where: { paymentCode } });
  }

  if (!payment) {
    payment = await prisma.payment.findFirst({ where: { rushpayRef: paymentRef } });
  }

  if (!payment) {
    console.warn(
      `Webhook: payment not found for rushpayRef=${paymentRef}, paymentCode=${paymentCode}`
    );
    return;
  }

  const { claimed } = await fulfillPayment(payment.id, {
    rushpayRef: paymentRef,
  });
  if (!claimed) {
    console.log(`Webhook: payment ${payment.id} already processed`);
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("X-RushPay-Signature");

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

  try {
    switch (event.event) {
      case "payment.completed":
      case "checkout.completed":
        await handlePaymentCompleted(event);
        break;
      default:
        console.log(`Webhook: unhandled event type: ${event.event}`);
    }
  } catch (error) {
    console.error(`Webhook: error processing ${event.event}:`, error);
  }

  return NextResponse.json({ received: true });
}
