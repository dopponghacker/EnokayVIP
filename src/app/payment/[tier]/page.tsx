"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Tier, TIER_META } from "@/lib/types";

interface PaymentData {
  paymentCode: string;
  amount: number;
  tier: string;
  tierLabel: string;
  widgetSessionToken: string | null;
  paymentReference: string | null;
}

declare global {
  interface Window {
    RushPayV2?: {
      init: (config: {
        containerId: string;
        widgetSessionToken: string;
        paymentReference: string;
        callbackUrl: string;
        apiBase: string;
      }) => void;
    };
  }
}

export default function PaymentPage() {
  const { tier } = useParams<{ tier: string }>();
  const widgetInitRef = useRef(false);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const tierKey = tier as Tier;
  const meta = TIER_META[tierKey];
  const displayAmount = amount ?? meta?.amount;

  // Fetch live price
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

  // Load RushPay widget script + initiate payment
  useEffect(() => {
    if (!meta || paid || scriptRef.current) return;

    const script = document.createElement("script");
    script.src = "https://core.rushpay.cash/widget/payment-widget-v2.js";
    script.async = true;
    script.onerror = () => {
      setError("Failed to load payment widget. Please refresh or try a different browser.");
    };
    document.body.appendChild(script);
    scriptRef.current = script;

    fetch("/api/payment/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: tierKey }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPaymentData(data);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to initialize payment.");
      });
  }, [meta, tierKey, paid]);

  // Initialize widget once both script + paymentData are ready
  useEffect(() => {
    if (widgetInitRef.current || paid) return;

    function tryInit() {
      if (!paymentData?.widgetSessionToken || !paymentData?.paymentReference) return;

      if (!window.RushPayV2) {
        timerRef.current = setTimeout(tryInit, 200);
        return;
      }

      if (widgetInitRef.current) return;
      widgetInitRef.current = true;

      try {
        window.RushPayV2.init({
          containerId: "rushpay-widget",
          paymentReference: paymentData.paymentReference,
          widgetSessionToken: paymentData.widgetSessionToken,
          callbackUrl: `${window.location.origin}/payment/${tierKey}?paid=1`,
          apiBase: `${window.location.origin}/api/rushpay-proxy`,
        });
      } catch (err) {
        console.error("RushPayV2.init error:", err);
        setError("Failed to initialize payment widget. Please refresh.");
      }
    }

    tryInit();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [paymentData, tierKey, paid]);

  // Detect callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      setPaid(true);
    }
  }, []);

  // Redirect after payment confirmed
  useEffect(() => {
    if (!paid) return;
    const timeout = setTimeout(() => {
      window.location.href = `/vip/${tierKey}`;
    }, 2000);
    return () => clearTimeout(timeout);
  }, [paid, tierKey]);

  if (!meta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900">Invalid package</h1>
          <Link href="/" className="mt-4 inline-block text-sm text-teal-600 font-semibold hover:underline">Go back home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-950 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-teal-400 rounded-xl flex items-center justify-center text-slate-950 font-black text-sm shrink-0">69</div>
            <span className="text-lg font-black text-white tracking-[-0.04em] hidden sm:inline">Enokay<span className="text-teal-400">69</span></span>
          </Link>
          <Link href="/" className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition rounded-xl hover:bg-white/10">
            <i className="fas fa-arrow-left" />
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <i className={`fas ${tierKey === "accurate-odds" ? "fa-crown" : tierKey === "draw-tips" ? "fa-handshake" : "fa-bullseye"}`} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-slate-950">{meta.label}</h1>
              <div className="flex items-end gap-1.5">
                <span className="text-2xl font-black text-slate-950">GH₵{displayAmount}</span>
                <span className="text-xs text-slate-500 mb-0.5">one-time access</span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <i className="fas fa-check-circle text-teal-500 shrink-0" /> Access valid for 24 hours
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <i className="fas fa-check-circle text-teal-500 shrink-0" /> Premium predictions for {meta.label}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3 text-xs text-red-700 flex items-start gap-2">
            <i className="fas fa-exclamation-circle mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {paid && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-3.5 py-3 text-sm text-green-700 flex items-center gap-2">
            <i className="fas fa-check-circle" />
            <span>Payment confirmed! Redirecting to your predictions...</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
          {!paymentData && !error && (
            <div className="text-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-teal-500 mb-3" />
              <p className="text-xs text-slate-500">Preparing checkout...</p>
            </div>
          )}
          <div id="rushpay-widget" className="min-h-[60px]" />
        </div>
      </main>
    </div>
  );
}
