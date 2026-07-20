import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { bookingCodes, publicMatches, vipTips } from "../../db/schema";
import { VipTip, Tier, PublicMatch, BookingCode } from "./types";

function toVipTip(row: typeof vipTips.$inferSelect): VipTip {
  return {
    id: row.id,
    tier: row.tier as Tier,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    prediction: row.prediction,
    league: row.league,
    time: row.time,
    date: row.date,
    odds: row.odds || "",
  };
}

function toPublicMatch(row: typeof publicMatches.$inferSelect): PublicMatch {
  return {
    id: row.id,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    prediction: row.prediction,
    league: row.league,
    odds: row.odds || "",
    date: row.date,
    time: row.time,
    status: row.status as PublicMatch["status"],
  };
}

export async function getVipTipsByTier(tier: Tier): Promise<VipTip[]> {
  const rows = await db.select().from(vipTips).where(eq(vipTips.tier, tier));
  return rows.map(toVipTip);
}

export async function getAllVipTips(): Promise<VipTip[]> {
  const rows = await db.select().from(vipTips);
  return rows.map(toVipTip);
}

export async function addVipTip(tip: Omit<VipTip, "id">): Promise<VipTip> {
  const [row] = await db
    .insert(vipTips)
    .values({ id: randomUUID(), ...tip })
    .returning();
  return toVipTip(row);
}

export async function updateVipTip(id: string, data: Partial<VipTip>): Promise<VipTip | undefined> {
  const [row] = await db
    .update(vipTips)
    .set({
      ...(data.tier && { tier: data.tier }),
      ...(data.homeTeam && { homeTeam: data.homeTeam }),
      ...(data.awayTeam && { awayTeam: data.awayTeam }),
      ...(data.prediction && { prediction: data.prediction }),
      ...(data.league && { league: data.league }),
      ...(data.time && { time: data.time }),
      ...(data.date && { date: data.date }),
      ...(data.odds !== undefined && { odds: data.odds }),
      updatedAt: new Date(),
    })
    .where(eq(vipTips.id, id))
    .returning();
  return row ? toVipTip(row) : undefined;
}

export async function deleteVipTip(id: string): Promise<boolean> {
  const rows = await db.delete(vipTips).where(eq(vipTips.id, id)).returning({ id: vipTips.id });
  return rows.length > 0;
}

export async function getBookingCode(tier: Tier, date: string): Promise<BookingCode | null> {
  const [row] = await db
    .select()
    .from(bookingCodes)
    .where(and(eq(bookingCodes.tier, tier), eq(bookingCodes.date, date)))
    .limit(1);
  return row ? { id: row.id, tier: row.tier as Tier, date: row.date, code: row.code } : null;
}

export async function upsertBookingCode(tier: Tier, date: string, code: string): Promise<BookingCode> {
  const [row] = await db
    .insert(bookingCodes)
    .values({ id: randomUUID(), tier, date, code })
    .onConflictDoUpdate({
      target: [bookingCodes.tier, bookingCodes.date],
      set: { code, updatedAt: new Date() },
    })
    .returning();
  return { id: row.id, tier: row.tier as Tier, date: row.date, code: row.code };
}

export async function deleteBookingCode(id: string): Promise<boolean> {
  const rows = await db
    .delete(bookingCodes)
    .where(eq(bookingCodes.id, id))
    .returning({ id: bookingCodes.id });
  return rows.length > 0;
}

export async function getAllPublicMatches(): Promise<PublicMatch[]> {
  const rows = await db.select().from(publicMatches);
  return rows.map(toPublicMatch);
}

export async function addPublicMatch(match: Omit<PublicMatch, "id">): Promise<PublicMatch> {
  const [row] = await db
    .insert(publicMatches)
    .values({ id: randomUUID(), ...match })
    .returning();
  return toPublicMatch(row);
}

export async function updatePublicMatch(
  id: string,
  data: Partial<PublicMatch>,
): Promise<PublicMatch | undefined> {
  const [row] = await db
    .update(publicMatches)
    .set({
      ...(data.homeTeam && { homeTeam: data.homeTeam }),
      ...(data.awayTeam && { awayTeam: data.awayTeam }),
      ...(data.prediction && { prediction: data.prediction }),
      ...(data.league && { league: data.league }),
      ...(data.odds !== undefined && { odds: data.odds }),
      ...(data.date && { date: data.date }),
      ...(data.time && { time: data.time }),
      ...(data.status && { status: data.status }),
      updatedAt: new Date(),
    })
    .where(eq(publicMatches.id, id))
    .returning();
  return row ? toPublicMatch(row) : undefined;
}

export async function deletePublicMatch(id: string): Promise<boolean> {
  const rows = await db
    .delete(publicMatches)
    .where(eq(publicMatches.id, id))
    .returning({ id: publicMatches.id });
  return rows.length > 0;
}
