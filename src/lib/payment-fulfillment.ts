import { prisma } from "@/lib/prisma";
import { sendVipTipsEmail } from "@/lib/email";
import { Tier, VipTip, BookingCode } from "@/lib/types";

/**
 * Marks a payment approved and emails today's tips. Called by both the
 * RushPay webhook and the browser-driven verify endpoint; whichever gets
 * there first wins the pending -> approved transition, so the email is sent
 * only once.
 */
export async function fulfillPayment(
  paymentId: string,
  opts: { rushpayRef?: string; customerEmail?: string } = {}
): Promise<{ claimed: boolean }> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { claimed: false };

  const emailToUse = payment.email || opts.customerEmail || "";

  const claim = await prisma.payment.updateMany({
    where: { id: payment.id, status: { in: ["pending", "rejected"] } },
    data: {
      status: "approved",
      approvedAt: new Date(),
      ...(opts.rushpayRef ? { rushpayRef: opts.rushpayRef } : {}),
      ...(emailToUse && !payment.email ? { email: emailToUse } : {}),
    },
  });

  if (claim.count === 0) return { claimed: false };

  if (!emailToUse) {
    console.warn(`Fulfillment: no email available for payment ${payment.id}`);
    return { claimed: true };
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
      `Fulfillment: email failed for payment ${payment.id}: ${emailResult.error}`
    );
  }

  return { claimed: true };
}
