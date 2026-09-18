import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyWebhookSignature,
  type RushPayWebhookEvent,
} from "@/lib/rushpay";
import { sendVipTipsEmail } from "@/lib/email";
import { Tier, VipTip, BookingCode } from "@/lib/types";

const processedEvents = new Set<string>();

async function handlePaymentCompleted(event: RushPayWebhookEvent) {
  const paymentRef = event.data.payment_reference;
  const paymentCode = event.data.metadata?.payment_code as string | undefined;
  const customerEmail = event.data.email || (event.data.metadata?.customer_email as string) || "";

  let payment = null;

  if (paymentCode) {
    payment = await prisma.payment.findFirst({
      where: { paymentCode },
    });
  }

  if (!payment) {
    payment = await prisma.payment.findFirst({
      where: { rushpayRef: paymentRef },
    });
  }

  if (!payment) {
    console.warn(
      `Webhook: payment not found for rushpayRef=${paymentRef}, paymentCode=${paymentCode}`
    );
    return;
  }

  if (payment.status === "approved" || payment.status === "email_sent") {
    console.log(`Webhook: payment ${payment.id} already processed`);
    return;
  }

  const now = new Date();
  const emailToUse = customerEmail || payment.email;

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "approved",
      approvedAt: now,
      rushpayRef: paymentRef,
      ...(emailToUse && !payment.email ? { email: emailToUse } : {}),
    },
  });

  if (!emailToUse) {
    console.warn(`Webhook: no email available for payment ${payment.id}`);
    return;
  }

  const tier = payment.tier as Tier;
  const today = new Date().toISOString().split("T")[0];

  const [tips, bookingCodeRow] = await Promise.all([
    prisma.vipTip.findMany({ where: { tier, date: today } }),
    prisma.bookingCode.findUnique({
      where: { tier_date: { tier, date: today } },
    }),
  ]);

  const vipTips: VipTip[] = tips.map((t) => ({
    id: t.id,
    tier: t.tier as Tier,
    homeTeam: t.homeTeam,
    awayTeam: t.awayTeam,
    prediction: t.prediction,
    league: t.league,
    time: t.time,
    date: t.date,
    odds: t.odds || "",
  }));

  const bookingCode: BookingCode | null = bookingCodeRow
    ? {
        id: bookingCodeRow.id,
        tier: bookingCodeRow.tier as Tier,
        date: bookingCodeRow.date,
        code: bookingCodeRow.code,
      }
    : null;

  const emailResult = await sendVipTipsEmail(
    emailToUse,
    tier,
    vipTips,
    bookingCode
  );

  if (emailResult.success) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "email_sent", emailSentAt: new Date() },
    });
  } else {
    console.error(
      `Webhook: email failed for payment ${payment.id}: ${emailResult.error}`
    );
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("X-RushPay-Signature");
  const eventId = req.headers.get("X-RushPay-Event-Id");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("Webhook: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (eventId && processedEvents.has(eventId)) {
    return NextResponse.json({ received: true });
  }

  let event: RushPayWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (eventId) processedEvents.add(eventId);

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
