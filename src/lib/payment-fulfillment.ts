import { prisma } from "@/lib/prisma";

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
