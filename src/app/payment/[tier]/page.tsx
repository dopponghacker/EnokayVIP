"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Tier, TIER_META } from "@/lib/types";

export default function PaymentPage() {
  const { tier } = useParams<{ tier: string }>();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tierKey = tier as Tier;
  const meta = TIER_META[tierKey];
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get("reference");
    if (reference) {
      window.location.href = `/payment/success?reference=${encodeURIComponent(reference)}`;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tier-prices")
      .then((res) => (res.ok ? res.json() : null))
      .then((prices) => {
        if (!cancelled && prices && typeof prices[tierKey] === "number") {
          setAmount(prices[tierKey]);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tierKey]);

  const displayAmount = amount ?? meta?.amount;

  if (!meta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900">Invalid package</h1>
          <Link href="/" className="mt-4 inline-block text-sm text-teal-600 font-semibold hover:underline">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");

      window.location.href = data.authorizationUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
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
          <Link href="/" className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition rounded-xl hover:bg-white/10">
            <i className="fas fa-arrow-left" />
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <i className={`fas ${tierKey === "accurate-odds" ? "fa-crown" : tierKey === "draw-tips" ? "fa-handshake" : "fa-bullseye"}`} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-slate-950">{meta.label}</h1>
              <p className="text-xs text-slate-500 leading-relaxed">{meta.description}</p>
            </div>
          </div>
          <div className="flex items-end gap-1.5 mt-4 pt-4 border-t border-slate-100">
            <span className="text-2xl sm:text-3xl font-black text-slate-950">GH₵{displayAmount}</span>
            <span className="text-xs text-slate-500 mb-1">one-time access</span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <i className="fas fa-check-circle text-teal-500 shrink-0" /> Access valid for 24 hours
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <i className="fas fa-check-circle text-teal-500 shrink-0" /> Premium predictions for {meta.label}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <i className="fas fa-check-circle text-teal-500 shrink-0" /> Instant access after payment
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3 text-xs text-red-700 flex items-start gap-2">
              <i className="fas fa-exclamation-circle mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-center py-2">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
              <i className={`fas ${tierKey === "accurate-odds" ? "fa-crown" : tierKey === "draw-tips" ? "fa-handshake" : "fa-bullseye"} text-2xl`} />
            </div>
            <h2 className="text-lg font-black text-slate-950">{meta.label}</h2>
            <p className="text-sm text-slate-500 mt-1">
              You&apos;ll be redirected to Paystack to complete payment.
            </p>

            <button
              onClick={handlePay}
              disabled={loading}
              className="mt-6 w-full min-h-[48px] py-3.5 rounded-lg bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 active:bg-teal-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><i className="fas fa-spinner fa-spin" /> Redirecting to Paystack...</>
              ) : (
                <>Pay GH₵{displayAmount} <i className="fas fa-arrow-right text-xs" /></>
              )}
            </button>

            <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <i className="fas fa-lock" /> Secure payment via Paystack
              </span>
              <span className="flex items-center gap-1">
                <i className="fas fa-bolt" /> Instant access
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
