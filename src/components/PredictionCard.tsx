"use client";

import { VipTip, Tier, TIER_META } from "@/lib/types";

const tierAccent: Record<Tier, string> = {
  "accurate-odds": "#14b8a6",
  "draw-tips": "#f59e0b",
  "correct-score": "#7c3aed",
};

interface Props {
  tips: VipTip[];
  tier: Tier;
  date: string;
  bookingCode?: string;
}

export default function PredictionCard({ tips, tier, date, bookingCode }: Props) {
  const meta = TIER_META[tier];
  const accent = tierAccent[tier];
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      id="prediction-card"
      className="w-[380px] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl"
      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}08)` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs"
              style={{ background: accent, color: "#071513" }}
            >
              69
            </div>
            <span className="text-sm font-black text-white tracking-tight">
              Enokay<span style={{ color: accent }}>69</span>
            </span>
          </div>
          <span
            className="text-[9px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5"
            style={{ background: `${accent}20`, color: accent }}
          >
            {meta.label}
          </span>
        </div>
        <div className="mt-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Premium Predictions</p>
          <p className="text-xs text-slate-300 mt-0.5">{formattedDate}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }} />

      {/* Tips */}
      <div className="px-5 py-4 space-y-3">
        {tips.map((tip, i) => (
          <div key={tip.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 bg-white/5 rounded px-1.5 py-0.5">
                    {tip.league}
                  </span>
                  {tip.time && (
                    <span className="text-[10px] text-slate-500">{tip.time}</span>
                  )}
                </div>
                <div className="mt-1.5">
                  <span className="text-sm font-bold text-white">{tip.homeTeam}</span>
                  <span className="text-[10px] text-slate-500 mx-1.5">vs</span>
                  <span className="text-sm font-bold text-white">{tip.awayTeam}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-black" style={{ color: accent }}>{tip.prediction}</div>
                <div className="text-[11px] font-bold text-slate-400 mt-0.5">odds {tip.odds}</div>
              </div>
            </div>
            {i < tips.length - 1 && (
              <div className="mt-3 h-px bg-white/5" />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4">
        {bookingCode && (
          <div className="mb-3 rounded-lg px-3 py-2.5 flex items-center justify-between" style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>Booking Code</span>
            <span className="text-sm font-black text-white tracking-widest">{bookingCode}</span>
          </div>
        )}
        <div className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2 flex items-center gap-2">
          <i className="fas fa-shield-halved text-[10px]" style={{ color: accent }} />
          <span className="text-[10px] text-slate-500">Private predictions — for authorized members only</span>
        </div>
        <p className="text-center text-[9px] text-slate-600 mt-2.5">
          enokay69.com &middot; Bet responsibly
        </p>
      </div>
    </div>
  );
}
