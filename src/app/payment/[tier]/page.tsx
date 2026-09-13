"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Tier, TIER_META } from "@/lib/types";

type Step = "form" | "instructions";

interface PaymentData {
  paymentCode: string;
  amount: number;
  tier: string;
  tierLabel: string;
  paymentNumber: string;
  paymentName: string;
  instructions: string;
}

export default function PaymentPage() {
  const { tier } = useParams<{ tier: string }>();

  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

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
    return () => {
      cancelled = true;
    };
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

  async function handleInitiate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierKey, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      setPaymentData(data);
      setStep("instructions");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
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
          </div>
        </div>

        {/* Payment Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3 text-xs text-red-700 flex items-start gap-2">
              <i className="fas fa-exclamation-circle mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === "form" && (
            <>
              <h2 className="text-base font-bold text-slate-900 mb-1">Get VIP Predictions</h2>
              <p className="text-xs text-slate-500 mb-5">
                Enter your email to receive predictions after payment confirmation.
              </p>

              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[48px] rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />

              <button
                onClick={handleInitiate}
                disabled={loading || !email.includes("@")}
                className="mt-5 w-full min-h-[48px] py-3.5 rounded-lg bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 active:bg-teal-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><i className="fas fa-spinner fa-spin" /> Generating code...</>
                ) : (
                  <>Continue <i className="fas fa-arrow-right text-xs" /></>
                )}
              </button>
            </>
          )}

          {step === "instructions" && paymentData && (
            <>
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-paper-plane text-xl" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Send Payment</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Transfer the exact amount to the number below
                </p>
              </div>

              {/* Payment Code */}
              <div className="bg-slate-50 rounded-lg p-4 mb-4 text-center">
                <p className="text-[10px] font-semibold text-slate-500 mb-1">YOUR PAYMENT CODE</p>
                <p className="text-2xl font-black text-slate-950 tracking-wider">{paymentData.paymentCode}</p>
                <button
                  onClick={() => copyToClipboard(paymentData.paymentCode)}
                  className="mt-2 text-[10px] text-teal-600 font-semibold hover:underline"
                >
                  <i className="fas fa-copy mr-1" /> Copy code
                </button>
              </div>

              {/* Payment Details */}
              <div className="space-y-3 mb-5">
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Amount</span>
                  <span className="text-sm font-bold text-slate-900">GH₵{paymentData.amount}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Send to</span>
                  <span className="text-sm font-bold text-slate-900">{paymentData.paymentNumber}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Name</span>
                  <span className="text-sm font-bold text-slate-900">{paymentData.paymentName}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-slate-500">Reference</span>
                  <button
                    onClick={() => copyToClipboard(paymentData.paymentCode)}
                    className="text-sm font-bold text-teal-600 hover:underline"
                  >
                    {paymentData.paymentCode} <i className="fas fa-copy text-xs ml-1" />
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <h3 className="text-xs font-bold text-amber-800 mb-2">
                  <i className="fas fa-info-circle mr-1" /> How to pay
                </h3>
                <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                  <li>Open your Mobile Money app</li>
                  <li>Select &quot;Send Money&quot;</li>
                  <li>Enter number: <strong>{paymentData.paymentNumber}</strong></li>
                  <li>Enter amount: <strong>GH₵{paymentData.amount}</strong></li>
                  <li>Use code as reference: <strong>{paymentData.paymentCode}</strong></li>
                  <li>Complete the transfer</li>
                </ol>
              </div>

              {/* Status */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                  <i className="fas fa-clock" />
                  Waiting for admin confirmation...
                </div>
                <p className="text-[10px] text-slate-400 mt-3">
                  After confirming payment, the admin will review and send predictions to your email.
                </p>
              </div>

              <button
                onClick={() => { setStep("form"); setPaymentData(null); setError(null); }}
                className="mt-4 w-full min-h-[44px] py-3 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                <i className="fas fa-arrow-left mr-2" /> Back
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
