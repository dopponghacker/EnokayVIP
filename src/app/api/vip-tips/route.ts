import { NextRequest, NextResponse } from "next/server";
import { getVipTipsByTier, getAllVipTips, addVipTip } from "@/lib/store";
import { requireAdmin, requireAdminOrPayment } from "@/lib/api-auth";
import { Tier, TIER_META } from "@/lib/types";

const VALID_TIERS = Object.keys(TIER_META) as string[];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tier = searchParams.get("tier");

    if (tier) {
      if (!VALID_TIERS.includes(tier)) {
        return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
      }
      const authError = requireAdminOrPayment(req, tier);
      if (authError) return authError;
      return NextResponse.json(await getVipTipsByTier(tier as Tier));
    }

    const authError = requireAdmin(req);
    if (authError) return authError;

    return NextResponse.json(await getAllVipTips());
  } catch (error) {
    console.error("GET /api/vip-tips error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { tier, homeTeam, awayTeam, prediction, league, time, date, odds } = body;

    if (!tier || !homeTeam || !awayTeam || !prediction) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!VALID_TIERS.includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const tip = await addVipTip({
      tier: tier as Tier,
      homeTeam: String(homeTeam).slice(0, 100),
      awayTeam: String(awayTeam).slice(0, 100),
      prediction: String(prediction).slice(0, 100),
      league: String(league || "").slice(0, 100),
      time: String(time || "").slice(0, 20),
      date: String(date || new Date().toISOString().split("T")[0]).slice(0, 10),
      odds: String(odds || "").slice(0, 20),
    });

    return NextResponse.json(tip, { status: 201 });
  } catch (error) {
    console.error("POST /api/vip-tips error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
