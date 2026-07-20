"use client";

import { useState, useEffect, useMemo } from "react";
import { PublicMatch } from "@/lib/types";

const statusStyles: Record<string, string> = {
  won: "text-green-700 bg-green-50 border-green-200",
  lost: "text-red-600 bg-red-50 border-red-200",
  pending: "text-amber-600 bg-amber-50 border-amber-200",
};

const statusIcons: Record<string, string> = {
  won: "fa-check-circle",
  lost: "fa-times-circle",
  pending: "fa-clock",
};

export default function TrackRecord() {
  const [matches, setMatches] = useState<PublicMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    fetch("/api/matches")
      .then((r) => r.json())
      .then((data: PublicMatch[]) => {
        const completed = data.filter((m) => m.status !== "pending");
        setMatches(completed);
        if (completed.length > 0) {
          const dates = [...new Set(completed.map((m) => m.date))].sort().reverse();
          setSelectedDate(dates[0]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const dates = useMemo(() => {
    return [...new Set(matches.map((m) => m.date))].sort().reverse();
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (!selectedDate) return [];
    return matches.filter((m) => m.date === selectedDate);
  }, [matches, selectedDate]);

  const stats = useMemo(() => {
    const resolved = filteredMatches.filter((m) => m.status !== "pending");
    const won = resolved.filter((m) => m.status === "won").length;
    const lost = resolved.filter((m) => m.status === "lost").length;
    const rate = resolved.length > 0 ? Math.round((won / resolved.length) * 100) : 0;
    return { won, lost, pending: filteredMatches.length - resolved.length, rate };
  }, [filteredMatches]);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = today.getTime() - d.getTime();
    const days = Math.round(diff / 86400000);

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });

    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function formatDateFull(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <i className="fas fa-spinner fa-spin text-2xl text-teal-500 mb-3" />
        <p className="text-sm text-slate-500">Loading track record...</p>
      </div>
    );
  }

  if (matches.length === 0) return null;

  return (
    <div>
      {/* Date tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {dates.map((date) => {
          const count = matches.filter((m) => m.date === date).length;
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                selectedDate === date
                  ? "bg-slate-950 text-white shadow-md"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {formatDate(date)}
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                selectedDate === date ? "bg-white/20" : "bg-slate-100"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stats for selected date */}
      {filteredMatches.length > 0 && (
        <>
          <p className="text-[11px] text-slate-400 mb-4">{formatDateFull(selectedDate)}</p>

          <div className="grid grid-cols-3 gap-3 max-w-lg mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
              <div className="text-xl sm:text-2xl font-black text-green-600">{stats.won}</div>
              <div className="text-[10px] text-slate-500 font-medium">Won</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
              <div className="text-xl sm:text-2xl font-black text-red-500">{stats.lost}</div>
              <div className="text-[10px] text-slate-500 font-medium">Lost</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
              <div className="text-xl sm:text-2xl font-black text-teal-600">{stats.rate}%</div>
              <div className="text-[10px] text-slate-500 font-medium">Win rate</div>
            </div>
          </div>

          <div className="space-y-2">
            {filteredMatches.map((match) => (
              <div key={match.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-950">{match.homeTeam} vs {match.awayTeam}</span>
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{match.league}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <span className="font-bold text-teal-700">{match.prediction}</span>
                    {match.odds && <span>odds {match.odds}</span>}
                  </div>
                </div>
                <div className="shrink-0">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-1 border ${statusStyles[match.status]}`}>
                    <i className={`fas ${statusIcons[match.status]} text-[10px]`} />
                    {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {filteredMatches.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <i className="fas fa-calendar-xmark text-2xl text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No predictions for this date</p>
        </div>
      )}
    </div>
  );
}
