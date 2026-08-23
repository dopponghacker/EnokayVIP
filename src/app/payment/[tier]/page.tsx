"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Tier, TIER_META } from "@/lib/types";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

interface PaystackData {
  accessCode: string;
  reference: string;
  amount: number;
  tierLabel: string;
  email: string;
}

export default function PaymentPage() {
  const { tier } = useParams<{ tier: string }>();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);

  const tierKey = tier as Tier;
  const meta = TIER_META[tierKey];
  const [amount, setAmount] = useState<number | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

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

      setTimeout(() => openPaystack(data), 500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setLoading(false);
    }
  }

  function openPaystack(data: PaystackData) {
    if (!window.PaystackPop) {
      setError("Payment system is loading. Please try again.");
      setLoading(false);
      return;
    }

    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: data.email,
      amount: Math.round(data.amount * 100),
      currency: "GHS",
      ref: data.reference,
      onClose: () => {
        setLoading(false);
        setError("Payment was cancelled. Click pay again when ready.");
      },
      callback: (response: { reference: string }) => {
        handleVerification(response.reference);
      },
    });

    handler.openIframe();
  }

  async function handleVerification(reference: string) {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(`/api/payment/verify?reference=${encodeURIComponent(reference)}`);
      const data = await res.json();
      if (!res.ok || !data.verified) {
        throw new Error(data.error || "Payment verification failed.");
      }

      if (data.paymentToken && data.cookieOptions) {
        const opts = data.cookieOptions as { maxAge: number; path: string; sameSite: string; secure: boolean; httpOnly: boolean };
        document.cookie = `enokay_payment=${data.paymentToken}; max-age=${opts.maxAge}; path=${opts.path}; samesite=${opts.sameSite};${opts.secure ? " secure" : ""}`;
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.href = `/vip/${tierKey}`;
      }, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed. Contact support with your payment code.");
    } finally {
      setVerifying(false);
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
              <i className="fas fa-check-circle text-teal-500 shrink-0" /> Instant delivery via email
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

          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-check text-3xl text-green-600" />
              </div>
              <h2 className="text-lg font-black text-slate-950">Payment Confirmed!</h2>
              <p className="text-xs text-slate-400 mt-3">
                Redirecting you to your VIP tips...
              </p>
            </div>
          ) : verifying ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-spinner fa-spin text-2xl text-teal-600" />
              </div>
              <h2 className="text-lg font-black text-slate-950">Verifying Payment...</h2>
              <p className="text-sm text-slate-500 mt-2">Please wait while we confirm your payment.</p>
            </div>
          ) : (
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
                <i className={`fas ${tierKey === "accurate-odds" ? "fa-crown" : tierKey === "draw-tips" ? "fa-handshake" : "fa-bullseye"} text-2xl`} />
              </div>
              <h2 className="text-lg font-black text-slate-950">{meta.label}</h2>
              <p className="text-sm text-slate-500 mt-1">
                You&apos;ll enter your email in the secure payment window.
              </p>

              <button
                onClick={handlePay}
                disabled={loading}
                className="mt-6 w-full min-h-[48px] py-3.5 rounded-lg bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 active:bg-teal-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><i className="fas fa-spinner fa-spin" /> Opening Paystack...</>
                ) : (
                  <>Pay GH₵{displayAmount} <i className="fas fa-arrow-right text-xs" /></>
                )}
              </button>

              <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <i className="fas fa-lock" /> Secure payment via Paystack
                </span>
                <span className="flex items-center gap-1">
                  <i className="fas fa-bolt" /> Instant delivery
                </span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
