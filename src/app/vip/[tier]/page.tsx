"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Tier, VipTip, TIER_META, BookingCode } from "@/lib/types";
import PredictionCard from "@/components/PredictionCard";

export default function VipPage() {
  const { tier } = useParams<{ tier: string }>();
  const router = useRouter();
  const [tips, setTips] = useState<VipTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [bookingCode, setBookingCode] = useState<BookingCode | null>(null);
  const [copied, setCopied] = useState(false);

  const tierKey = tier as Tier;
  const meta = TIER_META[tierKey];
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetch(`/api/vip-tips?tier=${tierKey}`)
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          router.replace(`/payment/${tierKey}`);
          return;
        }
        return r.json();
      })
      .then((data: VipTip[] | undefined) => {
        if (data) {
          setTips(data);
          setAuthorized(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [tierKey, router]);

  useEffect(() => {
    if (!authorized) return;
    fetch(`/api/booking-codes?tier=${tierKey}&date=${today}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: BookingCode | null) => setBookingCode(data))
      .catch(() => {});
  }, [authorized, tierKey, today]);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-2xl text-teal-500" />
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900">Invalid package</h1>
          <Link href="/" className="mt-4 inline-block text-sm text-teal-600 font-semibold hover:underline">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  const todayTips = tips.filter((t) => t.date === today);

  function copyCode() {
    if (!bookingCode) return;
    navigator.clipboard.writeText(bookingCode.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-950 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-teal-400 rounded-xl flex items-center justify-center text-slate-950 font-black text-sm shrink-0">
              69
            </div>
            <span className="text-lg font-black text-white tracking-[-0.04em] hidden sm:inline">
              Enokay<span className="text-teal-400">69</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-teal-300 bg-teal-400/10 border border-teal-400/20 rounded-full px-2 py-1 uppercase tracking-wider">
              {meta.label}
            </span>
            <Link href="/" className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition rounded-xl hover:bg-white/10">
              <i className="fas fa-home" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Title */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <i className="fas fa-lock text-teal-500" />
            <span>Premium predictions — {meta.label}</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-slate-950 tracking-[-0.04em]">
            Today&apos;s VIP Picks
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Valid for 24 hours from payment. Predictions are opinions, not guarantees.
          </p>
        </div>

        {/* Tips */}
        {loading ? (
          <div className="text-center py-16">
            <i className="fas fa-spinner fa-spin text-2xl text-teal-500 mb-3" />
            <p className="text-sm text-slate-500">Loading predictions...</p>
          </div>
        ) : todayTips.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 sm:p-10 text-center">
            <i className="fas fa-futbol text-3xl text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No VIP predictions for today yet.</p>
            <p className="text-slate-400 text-xs mt-1">Check back closer to kick-off time.</p>
          </div>
        ) : (
          <>
            {/* Booking Code Bar */}
            {bookingCode && (
              <div className="mb-4 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-md">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">Booking Code</p>
                  <p className="text-xl sm:text-2xl font-black text-white tracking-widest">{bookingCode.code}</p>
                </div>
                <button
                  onClick={copyCode}
                  className="shrink-0 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition flex items-center gap-2"
                >
                  <i className={`fas ${copied ? "fa-check" : "fa-copy"}`} />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}

            {/* Save Tips Button */}
            <button
              onClick={() => setShowCard(true)}
              className="w-full mb-4 py-3 rounded-xl bg-slate-950 text-white font-bold text-sm hover:bg-slate-900 active:bg-slate-800 transition flex items-center justify-center gap-2"
            >
              <i className="fas fa-image text-xs" />
              Save tips as image
            </button>

            <div className="space-y-3">
              {todayTips.map((tip) => (
                <div
                  key={tip.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 shrink-0">
                      {tip.league}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-950 text-sm truncate">{tip.homeTeam}</div>
                      <div className="text-[10px] text-slate-400 my-0.5">vs</div>
                      <div className="font-bold text-slate-950 text-sm truncate">{tip.awayTeam}</div>
                      {tip.time && (
                        <div className="text-[11px] text-slate-400 mt-1.5">
                          <i className="fas fa-clock mr-1" />{tip.time}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base sm:text-lg font-black text-teal-600 leading-tight">{tip.prediction}</div>
                      <div className="text-xs font-bold text-slate-700 mt-1.5">odds {tip.odds}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Footer note */}
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <i className="fas fa-exclamation-triangle text-amber-500 text-sm mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-900">Disclaimer</p>
            <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
              Predictions are based on analysis and are not guaranteed outcomes. Bet responsibly.
            </p>
          </div>
        </div>
      </main>

      {/* Screenshot Overlay */}
      {showCard && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 overflow-y-auto">
          {/* Close */}
          <button
            onClick={() => setShowCard(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition z-10"
          >
            <i className="fas fa-times" />
          </button>

          {/* Instructions */}
          <p className="text-white/60 text-xs mb-4 text-center">
            Screenshot the card below to save your predictions
          </p>

          {/* The branded card */}
          <PredictionCard tips={todayTips} tier={tierKey} date={today} bookingCode={bookingCode?.code} />

          {/* Tip */}
          <p className="text-white/40 text-[10px] mt-4 text-center">
            <i className="fas fa-info-circle mr-1" />
            On iPhone: Side button + Volume Up &middot; On Android: Power + Volume Down
          </p>
        </div>
      )}
    </div>
  );
}
