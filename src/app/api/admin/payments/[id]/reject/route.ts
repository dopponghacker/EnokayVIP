import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

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

    if (payment.status === "rejected") {
      return NextResponse.json({ error: "Payment already rejected" }, { status: 400 });
    }

    await prisma.payment.update({
      where: { id },
      data: { status: "rejected" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("admin/payments/reject error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
