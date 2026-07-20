"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Tier, TIER_META } from "@/lib/types";

export default function PaymentPage() {
  const { tier } = useParams<{ tier: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const tierKey = tier as Tier;
  const meta = TIER_META[tierKey];

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

  async function handleAccess() {
    setLoading(true);
    try {
      const res = await fetch("/api/payment/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierKey }),
      });
      if (res.ok) {
        router.push(`/vip/${tierKey}`);
      }
    } finally {
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
        {/* Tier Info Card */}
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
            <span className="text-2xl sm:text-3xl font-black text-slate-950">GH₵{meta.amount}</span>
            <span className="text-xs text-slate-500 mb-1">one-time access</span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <i className="fas fa-check-circle text-teal-500 shrink-0" /> Access valid for 24 hours
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <i className="fas fa-check-circle text-teal-500 shrink-0" /> Premium predictions for {meta.label}
            </div>
          </div>
        </div>

        {/* Demo Payment */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-flask text-xl" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Demo Mode</h2>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Payment integration is not active yet. Tap below to simulate a successful payment and access VIP tips.
          </p>
          <button
            onClick={handleAccess}
            disabled={loading}
            className="mt-6 w-full min-h-[48px] py-3.5 rounded-lg bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 active:bg-teal-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><i className="fas fa-spinner fa-spin" /> Granting access...</>
            ) : (
              <>Simulate Payment — GH₵{meta.amount} <i className="fas fa-arrow-right text-xs" /></>
            )}
          </button>
          <p className="mt-3 text-[10px] text-slate-400">
            <i className="fas fa-info-circle mr-1" />
            This is a placeholder. Real payment will be added later.
          </p>
        </div>
      </main>
    </div>
  );
}
