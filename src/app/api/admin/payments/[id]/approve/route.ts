import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { sendVipTipsEmail } from "@/lib/email";
import { Tier, VipTip, BookingCode } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await params;

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "approved" || payment.status === "email_sent") {
      return NextResponse.json({ error: "Payment already approved" }, { status: 400 });
    }

    const now = new Date();

    await prisma.payment.update({
      where: { id },
      data: {
        status: "approved",
        approvedAt: now,
      },
    });

    const tier = payment.tier as Tier;
    const today = new Date().toISOString().split("T")[0];

    const [tips, bookingCodeRow] = await Promise.all([
      prisma.vipTip.findMany({
        where: { tier, date: today },
      }),
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

    let emailResult: { success: boolean; error?: string } = { success: false, error: "No email address available" };

    if (payment.email) {
      emailResult = await sendVipTipsEmail(payment.email, tier, vipTips, bookingCode);

      if (emailResult.success) {
        await prisma.payment.update({
          where: { id },
          data: {
            status: "email_sent",
            emailSentAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      emailSent: emailResult.success,
      emailError: emailResult.error,
      hasEmail: !!payment.email,
    });
  } catch (error) {
    console.error("admin/payments/approve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
