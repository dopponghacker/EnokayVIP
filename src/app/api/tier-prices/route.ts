import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { TIER_META } from "@/lib/types";
import { getTierPrices, MAX_TIER_AMOUNT, MIN_TIER_AMOUNT } from "@/lib/pricing";

/** Public: current prices for all tiers. */
export async function GET() {
  const prices = await getTierPrices();
  return NextResponse.json(prices);
}

/** Admin only: update one or more tier prices. Body: { "accurate-odds": 120, ... } */
export async function PUT(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const updates: { tier: string; amount: number }[] = [];

    for (const [tier, value] of Object.entries(body ?? {})) {
      if (!(tier in TIER_META)) {
        return NextResponse.json({ error: `Unknown tier: ${tier}` }, { status: 400 });
      }
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount < MIN_TIER_AMOUNT || amount > MAX_TIER_AMOUNT) {
        return NextResponse.json(
          { error: `Amount for ${TIER_META[tier as keyof typeof TIER_META].label} must be between GH₵${MIN_TIER_AMOUNT} and GH₵${MAX_TIER_AMOUNT}` },
          { status: 400 }
        );
      }
      updates.push({ tier, amount: Math.round(amount * 100) / 100 });
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No prices provided" }, { status: 400 });
    }

    await prisma.$transaction(
      updates.map(({ tier, amount }) =>
        prisma.tierPrice.upsert({
          where: { tier },
          update: { amount },
          create: { tier, amount },
        })
      )
    );

    return NextResponse.json(await getTierPrices());
  } catch (error) {
    console.error("tier-prices PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
