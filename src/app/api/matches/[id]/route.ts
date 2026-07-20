import { NextRequest, NextResponse } from "next/server";
import { updatePublicMatch, deletePublicMatch } from "@/lib/store";
import { requireAdmin } from "@/lib/api-auth";
import { MatchStatus } from "@/lib/types";

const VALID_STATUSES: MatchStatus[] = ["pending", "won", "lost"];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await params;
    if (!id || id.length > 100) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const allowed: Record<string, string> = {};

    if (body.homeTeam) allowed.homeTeam = String(body.homeTeam).slice(0, 100);
    if (body.awayTeam) allowed.awayTeam = String(body.awayTeam).slice(0, 100);
    if (body.prediction) allowed.prediction = String(body.prediction).slice(0, 100);
    if (body.league !== undefined) allowed.league = String(body.league).slice(0, 100);
    if (body.odds !== undefined) allowed.odds = String(body.odds).slice(0, 20);
    if (body.date) allowed.date = String(body.date).slice(0, 10);
    if (body.time !== undefined) allowed.time = String(body.time).slice(0, 20);
    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      allowed.status = body.status;
    }

    const match = await updatePublicMatch(id, allowed);

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    return NextResponse.json(match);
  } catch (error) {
    console.error("PUT /api/matches/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await params;
    if (!id || id.length > 100) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const deleted = await deletePublicMatch(id);

    if (!deleted) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/matches/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
