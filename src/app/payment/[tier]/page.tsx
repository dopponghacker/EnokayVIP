"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Tier, TIER_META } from "@/lib/types";

type Network = "mtn" | "telecel" | "airteltigo";
type Step = "form" | "otp" | "prompt" | "success";

const NETWORKS: { id: Network; label: string; color: string }[] = [
  { id: "mtn", label: "MTN MoMo", color: "bg-yellow-400 text-slate-950" },
  { id: "telecel", label: "Telecel Cash", color: "bg-red-500 text-white" },
  { id: "airteltigo", label: "AT Money", color: "bg-blue-600 text-white" },
];

export default function PaymentPage() {
  const { tier } = useParams<{ tier: string }>();
  const router = useRouter();

  const [step, setStep] = useState<Step>("form");
  const [network, setNetwork] = useState<Network>("mtn");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [externalRef, setExternalRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
      if (pollTimer.current) clearInterval(pollTimer.current);
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

  async function post(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
    return data;
  }

  function startPolling(ref: string) {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      try {
        const data = await post("/api/payment/status", { externalRef: ref });
        if (data.granted) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setStep("success");
          setTimeout(() => router.push(`/vip/${tierKey}`), 1200);
        } else if (data.failed) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setStep("form");
          setError("Payment failed or was declined. Please try again.");
        }
      } catch {
        // keep polling; transient errors are fine
      }
    }, 4000);
  }

  async function handleInitiate() {
    setLoading(true);
    setError(null);
    try {
      const data = await post("/api/payment/initiate", { tier: tierKey, phone, network });
      setExternalRef(data.externalRef);
      if (data.step === "otp") {
        setStep("otp");
      } else {
        setStep("prompt");
        startPolling(data.externalRef);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp() {
    if (!externalRef) return;
    setLoading(true);
    setError(null);
    try {
      await post("/api/payment/otp", { externalRef, otp });
      setStep("prompt");
      startPolling(externalRef);
    } catch (e) {
      setError(e instanceof Error ? e.message : "OTP verification failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleManualCheck() {
    if (!externalRef) return;
    setLoading(true);
    try {
      const data = await post("/api/payment/status", { externalRef });
      if (data.granted) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setStep("success");
        setTimeout(() => router.push(`/vip/${tierKey}`), 800);
      }
    } catch {
      // ignore
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
              <h2 className="text-base font-bold text-slate-900 mb-1">Pay with Mobile Money</h2>
              <p className="text-xs text-slate-500 mb-5">
                Secured by Moolre. You&apos;ll approve the payment on your phone.
              </p>

              <label className="block text-xs font-semibold text-slate-700 mb-2">Network</label>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {NETWORKS.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setNetwork(n.id)}
                    className={`min-h-[44px] rounded-lg text-xs font-bold border-2 transition px-2 ${
                      network === n.id
                        ? `${n.color} border-transparent shadow-sm`
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {n.label}
                  </button>
                ))}
              </div>

              <label htmlFor="phone" className="block text-xs font-semibold text-slate-700 mb-2">
                Mobile Money number
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                placeholder="e.g. 0541234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-[48px] rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />

              <button
                onClick={handleInitiate}
                disabled={loading || phone.trim().length < 10}
                className="mt-5 w-full min-h-[48px] py-3.5 rounded-lg bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 active:bg-teal-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><i className="fas fa-spinner fa-spin" /> Starting payment...</>
                ) : (
                  <>Pay GH₵{displayAmount} <i className="fas fa-arrow-right text-xs" /></>
                )}
              </button>
              <p className="mt-3 text-[10px] text-slate-400 text-center">
                <i className="fas fa-lock mr-1" />
                Payments processed securely by Moolre
              </p>
            </>
          )}

          {step === "otp" && (
            <>
              <h2 className="text-base font-bold text-slate-900 mb-1">Enter OTP</h2>
              <p className="text-xs text-slate-500 mb-5">
                A one-time code was sent by SMS to <span className="font-semibold text-slate-700">{phone}</span>.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="Enter code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full min-h-[48px] rounded-lg border border-slate-300 px-4 text-center text-lg font-black tracking-[0.3em] text-slate-900 placeholder:tracking-normal placeholder:text-sm placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <button
                onClick={handleOtp}
                disabled={loading || otp.length < 4}
                className="mt-5 w-full min-h-[48px] py-3.5 rounded-lg bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 active:bg-teal-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><i className="fas fa-spinner fa-spin" /> Verifying...</>
                ) : (
                  <>Verify &amp; Continue</>
                )}
              </button>
            </>
          )}

          {step === "prompt" && (
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-mobile-alt text-xl fa-beat" style={{ animationDuration: "2s" }} />
              </div>
              <h2 className="text-base font-bold text-slate-900">Approve on your phone</h2>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                A payment prompt for <span className="font-bold text-slate-700">GH₵{displayAmount}</span> was
                sent to <span className="font-semibold text-slate-700">{phone}</span>.
                Enter your MoMo PIN to approve it. If you don&apos;t see the prompt, dial{" "}
                <span className="font-semibold text-slate-700">*170#</span> and check
                &quot;My Approvals&quot;.
              </p>
              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
                <i className="fas fa-spinner fa-spin text-teal-600" />
                Waiting for confirmation...
              </div>
              <button
                onClick={handleManualCheck}
                disabled={loading}
                className="mt-5 w-full min-h-[44px] py-3 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition disabled:opacity-50"
              >
                I&apos;ve approved — check now
              </button>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-check text-xl" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Payment confirmed!</h2>
              <p className="mt-2 text-xs text-slate-500">Taking you to your VIP tips...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
