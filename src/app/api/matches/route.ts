import { NextRequest, NextResponse } from "next/server";
import { getAllPublicMatches, addPublicMatch } from "@/lib/store";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  try {
    return NextResponse.json(await getAllPublicMatches());
  } catch (error) {
    console.error("GET /api/matches error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { homeTeam, awayTeam, prediction, league, date, time, odds, status } = body;

    if (!homeTeam || !awayTeam || !prediction || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const match = await addPublicMatch({
      homeTeam,
      awayTeam,
      prediction,
      league: league || "",
      date,
      time: time || "",
      odds: odds || "",
      status: status || "pending",
    });

    return NextResponse.json(match, { status: 201 });
  } catch (error) {
    console.error("POST /api/matches error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}