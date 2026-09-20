import { prisma } from "@/lib/prisma";
import { getRushPayPaymentStatus } from "@/lib/rushpay";

/**
 * Marks a payment approved. Called by both the RushPay webhook and the
 * browser-driven verify endpoint; whichever gets there first wins the
 * pending -> approved transition.
 */
export async function fulfillPayment(
  paymentId: string,
  opts: { rushpayRef?: string } = {}
): Promise<{ claimed: boolean }> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { claimed: false };

  const claim = await prisma.payment.updateMany({
    where: { id: payment.id, status: { in: ["pending", "rejected"] } },
    data: {
      status: "approved",
      approvedAt: new Date(),
      ...(opts.rushpayRef ? { rushpayRef: opts.rushpayRef } : {}),
    },
  });

  if (claim.count === 0) return { claimed: false };

  return { claimed: true };
}

export type PaymentOutcome = "paid" | "pending" | "failed";

const FAILED_STATUSES = new Set(["failed", "expired", "cancelled", "canceled"]);

/**
 * Asks RushPay for the payment's real state and approves it if it completed
 * for at least the expected amount. Never trusts a redirect or webhook body on
 * its own. Throws when RushPay can't be reached, so callers can retry.
 */
export async function confirmAndFulfillPayment(payment: {
  id: string;
  amount: number;
  rushpayRef: string | null;
}): Promise<PaymentOutcome> {
  if (!payment.rushpayRef) return "pending";

  const { data } = await getRushPayPaymentStatus(payment.rushpayRef);
  const status = data?.status?.toLowerCase();

  if (status === "completed") {
    const paidAmount = parseFloat(data.amount ?? "");
    if (!Number.isFinite(paidAmount) || paidAmount < payment.amount - 0.01) {
      console.error(
        `Payment ${payment.id}: RushPay completed ${data.amount} but ${payment.amount} was expected`
      );
      return "failed";
    }
    console.info(
      `Payment ${payment.id} completed on RushPay: ` +
        JSON.stringify({
          status: data.status,
          payment_status: data.payment_status,
          paid: data.paid,
          verified: data.verified,
          amount: data.amount,
        })
    );
    await fulfillPayment(payment.id);
    return "paid";
  }

  if (status && FAILED_STATUSES.has(status)) return "failed";
  return "pending";
}
