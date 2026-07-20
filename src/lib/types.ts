export type Tier = "accurate-odds" | "draw-tips" | "correct-score";

export type MatchStatus = "won" | "lost" | "pending";

export interface PublicMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  prediction: string;
  league: string;
  date: string;
  time: string;
  odds: string;
  status: MatchStatus;
}

export interface VipTip {
  id: string;
  tier: Tier;
  homeTeam: string;
  awayTeam: string;
  prediction: string;
  league: string;
  time: string;
  date: string;
  odds: string;
}

export interface BookingCode {
  id: string;
  tier: Tier;
  date: string;
  code: string;
}

export const TIER_META: Record<Tier, { label: string; amount: number; description: string }> = {
  "accurate-odds": {
    label: "Accurate Odds",
    amount: 100,
    description: "A carefully selected premium slip built around disciplined value.",
  },
  "draw-tips": {
    label: "Draw Tips",
    amount: 100,
    description: "Focused draw selections for bettors who prefer higher-value markets.",
  },
  "correct-score": {
    label: "Correct Score",
    amount: 250,
    description: "Our most selective package for high-reward correct-score markets.",
  },
};
