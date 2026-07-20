import { NextRequest, NextResponse } from "next/server";
import { updateVipTip, deleteVipTip } from "@/lib/store";
import { requireAdmin } from "@/lib/api-auth";
import { TIER_META } from "@/lib/types";

const VALID_TIERS = Object.keys(TIER_META) as string[];

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await params;
    if (!id || id.length > 100) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const allowed: Record<string, string> = {};

    if (body.tier) {
      if (!VALID_TIERS.includes(body.tier)) {
        return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
      }
      allowed.tier = body.tier;
    }
    if (body.homeTeam) allowed.homeTeam = String(body.homeTeam).slice(0, 100);
    if (body.awayTeam) allowed.awayTeam = String(body.awayTeam).slice(0, 100);
    if (body.prediction) allowed.prediction = String(body.prediction).slice(0, 100);
    if (body.league !== undefined) allowed.league = String(body.league).slice(0, 100);
    if (body.time !== undefined) allowed.time = String(body.time).slice(0, 20);
    if (body.date) allowed.date = String(body.date).slice(0, 10);
    if (body.odds !== undefined) allowed.odds = String(body.odds).slice(0, 20);

    const tip = await updateVipTip(id, allowed);
    if (!tip) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(tip);
  } catch (error) {
    console.error("PUT /api/vip-tips/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAdmin(_req);
  if (authError) return authError;

  try {
    const { id } = await params;
    if (!id || id.length > 100) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const deleted = await deleteVipTip(id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/vip-tips/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
