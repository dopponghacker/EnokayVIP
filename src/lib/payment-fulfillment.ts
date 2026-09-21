import { prisma } from "@/lib/prisma";
import { verifyTransaction } from "@/lib/paystack";

/**
 * Marks a payment approved. Called by both the Paystack webhook and the
 * browser-driven verify endpoint; whichever gets there first wins the
 * pending -> approved transition.
 */
export async function fulfillPayment(
  paymentId: string,
  opts: { paystackRef?: string } = {}
): Promise<{ claimed: boolean }> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { claimed: false };

  const claim = await prisma.payment.updateMany({
    where: {
      id: payment.id,
      status: { in: ["pending", "rejected", "failed", "expired"] },
    },
    data: {
      status: "approved",
      approvedAt: new Date(),
      ...(opts.paystackRef ? { paystackRef: opts.paystackRef } : {}),
    },
  });

  if (claim.count === 0) return { claimed: false };

  return { claimed: true };
}

export type PaymentOutcome = "paid" | "pending" | "failed";

const FAILED_STATUSES = new Set(["failed", "cancelled", "canceled", "abandoned", "reversed"]);
const EXPIRED_STATUSES = new Set(["expired"]);

async function markPaymentDead(paymentId: string, status: "failed" | "expired") {
  await prisma.payment.updateMany({
    where: { id: paymentId, status: "pending" },
    data: { status },
  });
}

/**
 * Asks Paystack for the payment's real state and approves it if it completed
 * for at least the expected amount. Never trusts a redirect or webhook body on
 * its own. Throws when Paystack can't be reached, so callers can retry.
 */
export async function confirmAndFulfillPayment(payment: {
  id: string;
  amount: number;
  currency: string;
  paystackRef: string | null;
}): Promise<PaymentOutcome> {
  if (!payment.paystackRef) return "pending";

  const { data } = await verifyTransaction(payment.paystackRef);
  const status = data?.status?.toLowerCase();

  if (status === "success") {
    if (data.currency && data.currency.toUpperCase() !== payment.currency.toUpperCase()) {
      console.error(
        `Payment ${payment.id}: Paystack currency ${data.currency} does not match ${payment.currency}`
      );
      return "failed";
    }
    const paidAmount = data.amount / 100;
    if (!Number.isFinite(paidAmount) || paidAmount < payment.amount - 0.01) {
      console.error(
        `Payment ${payment.id}: Paystack completed ${data.amount / 100} but ${payment.amount} was expected`
      );
      return "failed";
    }
    console.info(
      `Payment ${payment.id} completed on Paystack: ` +
        JSON.stringify({
          status: data.status,
          gateway_response: data.gateway_response,
          amount: data.amount / 100,
        })
    );
    await fulfillPayment(payment.id);
    return "paid";
  }

  if (status && EXPIRED_STATUSES.has(status)) {
    await markPaymentDead(payment.id, "expired");
    return "failed";
  }
  if (status && FAILED_STATUSES.has(status)) {
    await markPaymentDead(payment.id, "failed");
    return "failed";
  }
  return "pending";
}
