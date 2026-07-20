import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transactStatus, TX_FAILED, TX_SUCCESS } from "@/lib/moolre";

/**
 * Moolre payment callback (set this URL in your Moolre dashboard:
 * https://yourdomain.com/api/payment/webhook).
 *
 * The payload is NOT trusted — we re-verify the transaction against
 * Moolre's status API before updating our records.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const externalRef =
      body?.externalref ?? body?.externalRef ?? body?.data?.externalref ?? null;

    if (!externalRef || typeof externalRef !== "string") {
      return NextResponse.json({ received: true });
    }

    const payment = await prisma.payment.findUnique({
      where: { externalRef },
    });
    if (!payment || payment.status !== "pending") {
      return NextResponse.json({ received: true });
    }

    const status = await transactStatus(externalRef);
    if (status.txstatus === TX_SUCCESS) {
      await prisma.payment.update({
        where: { externalRef },
        data: { status: "success" },
      });
    } else if (status.txstatus === TX_FAILED) {
      await prisma.payment.update({
        where: { externalRef },
        data: { status: "failed" },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("payment/webhook error:", error);
    return NextResponse.json({ received: true });
  }
}
