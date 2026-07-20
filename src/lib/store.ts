import { prisma } from "./prisma";
import { VipTip, Tier, PublicMatch, BookingCode } from "./types";

// --- VIP Tips ---
export async function getVipTipsByTier(tier: Tier): Promise<VipTip[]> {
  const tips = await prisma.vipTip.findMany({ where: { tier } });
  return tips.map((t) => ({
    id: t.id,
    tier: t.tier as Tier,
    homeTeam: t.homeTeam,
    awayTeam: t.awayTeam,
    prediction: t.prediction,
    league: t.league,
    time: t.time,
    date: t.date,
    odds: t.odds || "",
  }));
}

export async function getAllVipTips(): Promise<VipTip[]> {
  const tips = await prisma.vipTip.findMany();
  return tips.map((t) => ({
    id: t.id,
    tier: t.tier as Tier,
    homeTeam: t.homeTeam,
    awayTeam: t.awayTeam,
    prediction: t.prediction,
    league: t.league,
    time: t.time,
    date: t.date,
    odds: t.odds || "",
  }));
}

export async function addVipTip(tip: Omit<VipTip, "id">): Promise<VipTip> {
  const newTip = await prisma.vipTip.create({
    data: {
      tier: tip.tier,
      homeTeam: tip.homeTeam,
      awayTeam: tip.awayTeam,
      prediction: tip.prediction,
      league: tip.league,
      time: tip.time,
      date: tip.date,
      odds: tip.odds,
    },
  });
  return {
    id: newTip.id,
    tier: newTip.tier as Tier,
    homeTeam: newTip.homeTeam,
    awayTeam: newTip.awayTeam,
    prediction: newTip.prediction,
    league: newTip.league,
    time: newTip.time,
    date: newTip.date,
    odds: newTip.odds || "",
  };
}

export async function updateVipTip(id: string, data: Partial<VipTip>): Promise<VipTip | undefined> {
  try {
    const updated = await prisma.vipTip.update({
      where: { id },
      data: {
        ...(data.tier && { tier: data.tier }),
        ...(data.homeTeam && { homeTeam: data.homeTeam }),
        ...(data.awayTeam && { awayTeam: data.awayTeam }),
        ...(data.prediction && { prediction: data.prediction }),
        ...(data.league && { league: data.league }),
        ...(data.time && { time: data.time }),
        ...(data.date && { date: data.date }),
        ...(data.odds !== undefined && { odds: data.odds }),
      },
    });
    return {
      id: updated.id,
      tier: updated.tier as Tier,
      homeTeam: updated.homeTeam,
      awayTeam: updated.awayTeam,
      prediction: updated.prediction,
      league: updated.league,
      time: updated.time,
      date: updated.date,
      odds: updated.odds || "",
    };
  } catch {
    return undefined;
  }
}

export async function deleteVipTip(id: string): Promise<boolean> {
  try {
    await prisma.vipTip.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// --- Booking Codes ---
export async function getBookingCode(tier: Tier, date: string): Promise<BookingCode | null> {
  const row = await prisma.bookingCode.findUnique({ where: { tier_date: { tier, date } } });
  if (!row) return null;
  return { id: row.id, tier: row.tier as Tier, date: row.date, code: row.code };
}

export async function upsertBookingCode(tier: Tier, date: string, code: string): Promise<BookingCode> {
  const row = await prisma.bookingCode.upsert({
    where: { tier_date: { tier, date } },
    update: { code },
    create: { tier, date, code },
  });
  return { id: row.id, tier: row.tier as Tier, date: row.date, code: row.code };
}

export async function deleteBookingCode(id: string): Promise<boolean> {
  try {
    await prisma.bookingCode.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// --- Public Matches ---
export async function getAllPublicMatches(): Promise<PublicMatch[]> {
  const matches = await prisma.publicMatch.findMany();
  return matches.map((m) => ({
    id: m.id,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    prediction: m.prediction,
    league: m.league,
    odds: m.odds || "",
    date: m.date,
    time: m.time,
    status: m.status as "won" | "lost" | "pending",
  }));
}

export async function addPublicMatch(match: Omit<PublicMatch, "id">): Promise<PublicMatch> {
  const newMatch = await prisma.publicMatch.create({
    data: {
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      prediction: match.prediction,
      league: match.league,
      odds: match.odds,
      date: match.date,
      time: match.time,
      status: match.status,
    },
  });
  return {
    id: newMatch.id,
    homeTeam: newMatch.homeTeam,
    awayTeam: newMatch.awayTeam,
    prediction: newMatch.prediction,
    league: newMatch.league,
    odds: newMatch.odds || "",
    date: newMatch.date,
    time: newMatch.time,
    status: newMatch.status as "won" | "lost" | "pending",
  };
}

export async function updatePublicMatch(id: string, data: Partial<PublicMatch>): Promise<PublicMatch | undefined> {
  try {
    const updated = await prisma.publicMatch.update({
      where: { id },
      data: {
        ...(data.homeTeam && { homeTeam: data.homeTeam }),
        ...(data.awayTeam && { awayTeam: data.awayTeam }),
        ...(data.prediction && { prediction: data.prediction }),
        ...(data.league && { league: data.league }),
        ...(data.odds !== undefined && { odds: data.odds }),
        ...(data.date && { date: data.date }),
        ...(data.time && { time: data.time }),
        ...(data.status && { status: data.status }),
      },
    });
    return {
      id: updated.id,
      homeTeam: updated.homeTeam,
      awayTeam: updated.awayTeam,
      prediction: updated.prediction,
      league: updated.league,
      odds: updated.odds || "",
      date: updated.date,
      time: updated.time,
      status: updated.status as "won" | "lost" | "pending",
    };
  } catch {
    return undefined;
  }
}

export async function deletePublicMatch(id: string): Promise<boolean> {
  try {
    await prisma.publicMatch.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
