import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where = status && status !== "all" ? { status } : {};

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("admin/payments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
