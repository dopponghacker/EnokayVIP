import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code parameter" }, { status: 400 });
  }

  try {
    const payment = await prisma.payment.findFirst({
      where: { paymentCode: code },
      select: { status: true },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({ status: payment.status });
  } catch (error) {
    console.error("payment/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
