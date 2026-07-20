import { prisma } from "@/lib/prisma";
import { Tier, TIER_META } from "@/lib/types";

export const MIN_TIER_AMOUNT = 1;
export const MAX_TIER_AMOUNT = 10_000;

/** All tier prices, falling back to TIER_META defaults when not set. */
export async function getTierPrices(): Promise<Record<Tier, number>> {
  const prices = Object.fromEntries(
    (Object.keys(TIER_META) as Tier[]).map((t) => [t, TIER_META[t].amount])
  ) as Record<Tier, number>;

  try {
    const rows = await prisma.tierPrice.findMany();
    for (const row of rows) {
      if (row.tier in prices && row.amount >= MIN_TIER_AMOUNT) {
        prices[row.tier as Tier] = row.amount;
      }
    }
  } catch {
    // fall back to defaults if the table isn't reachable
  }
  return prices;
}

/** Current price for a single tier (GHS). */
export async function getTierAmount(tier: Tier): Promise<number> {
  const prices = await getTierPrices();
  return prices[tier];
}
