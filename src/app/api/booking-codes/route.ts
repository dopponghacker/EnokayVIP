import { NextRequest, NextResponse } from "next/server";
import { getBookingCode, upsertBookingCode } from "@/lib/store";
import { requireAdmin, requireAdminOrPayment } from "@/lib/api-auth";
import { Tier, TIER_META } from "@/lib/types";

const VALID_TIERS = Object.keys(TIER_META) as string[];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tier = searchParams.get("tier");
    const date = searchParams.get("date");

    if (!tier || !date) {
      return NextResponse.json({ error: "tier and date are required" }, { status: 400 });
    }

    if (!VALID_TIERS.includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const authError = requireAdminOrPayment(req, tier);
    if (authError) return authError;

    const code = await getBookingCode(tier as Tier, date);
    return NextResponse.json(code);
  } catch (error) {
    console.error("GET /api/booking-codes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { tier, date, code } = body;

    if (!tier || !date || !code) {
      return NextResponse.json({ error: "tier, date, and code are required" }, { status: 400 });
    }

    if (!VALID_TIERS.includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const trimmedCode = String(code).trim().slice(0, 100);
    if (!trimmedCode) {
      return NextResponse.json({ error: "Code cannot be empty" }, { status: 400 });
    }

    const result = await upsertBookingCode(tier as Tier, String(date).slice(0, 10), trimmedCode);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/booking-codes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
