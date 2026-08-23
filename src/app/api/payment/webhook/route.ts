import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, verifyTransaction } from "@/lib/paystack";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    if (event.event !== "charge.success") {
      return NextResponse.json({ received: true });
    }

    const { reference, metadata } = event.data;

    const paystackResult = await verifyTransaction(reference);
    if (!paystackResult.status || paystackResult.data.status !== "success") {
      return NextResponse.json({ received: true });
    }

    const paymentId = metadata?.paymentId as string | undefined;
    if (!paymentId) {
      return NextResponse.json({ received: true });
    }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "approved") {
      return NextResponse.json({ received: true });
    }

    const paystackEmail = paystackResult.data.customer.email;

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "approved",
        approvedAt: new Date(),
        email: paystackEmail || payment.email,
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
