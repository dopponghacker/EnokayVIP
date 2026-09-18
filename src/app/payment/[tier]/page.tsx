"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Tier, TIER_META } from "@/lib/types";

interface PaymentData {
  paymentReference: string;
  widgetSessionToken: string;
  amount: number;
  tier: string;
  tierLabel: string;
}

type Provider = "mtn" | "vod" | "atl";

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "mtn", label: "MTN Mobile Money" },
  { value: "vod", label: "Telecel Cash" },
  { value: "atl", label: "AirtelTigo Money" },
];

export default function PaymentPage() {
  const { tier } = useParams<{ tier: string }>();
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<Provider>("mtn");
  const [resolvedName, setResolvedName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [chargeRef, setChargeRef] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

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

  // Initiate payment session
  useEffect(() => {
    if (!meta || paid) return;
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

  // Resolve phone name
  const resolveName = useCallback(async () => {
    if (!paymentData) return;
    const clean = phone.replace(/[\s-]/g, "");
    if (!/^0\d{9}$/.test(clean)) {
      setResolvedName("");
      return;
    }
    setResolving(true);
    try {
      const res = await fetch("/api/rushpay-proxy/api/v1/merchant/payments/resolve-mobile-name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RushPay-Widget-Session": paymentData.widgetSessionToken,
        },
        body: JSON.stringify({ phone: clean, provider }),
      });
      const data = await res.json();
      setResolvedName(data?.data?.resolved ? String(data.data.account_name || "") : "");
    } catch {
      setResolvedName("");
    } finally {
      setResolving(false);
    }
  }, [phone, provider, paymentData]);

  useEffect(() => {
    const timer = setTimeout(resolveName, 500);
    return () => clearTimeout(timer);
  }, [resolveName]);

  // Submit payment
  async function handlePay() {
    if (!paymentData || !resolvedName) return;
    const clean = phone.replace(/[\s-]/g, "");
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rushpay-proxy/api/v1/merchant/payments/initiate-mobile-money", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RushPay-Widget-Session": paymentData.widgetSessionToken,
        },
        body: JSON.stringify({
          payment_reference: paymentData.paymentReference,
          name: resolvedName,
          phone: clean,
          provider,
        }),
      });
      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error(data.message || "Could not start mobile money payment");
      }
      if (data.data.authorization_url) {
        window.location.href = data.data.authorization_url;
        return;
      }
      setChargeRef(data.data.reference);
      setStatusMsg("Payment prompt sent. Approve it on your phone.");
      startPolling(data.data.reference);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start payment.");
    } finally {
      setSubmitting(false);
    }
  }

  // Poll charge status
  const startPolling = useCallback((ref: string) => {
    let attempts = 0;
    function tick() {
      attempts++;
      fetch("/api/rushpay-proxy/api/v1/merchant/payments/charge-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RushPay-Widget-Session": paymentData?.widgetSessionToken || "",
        },
        body: JSON.stringify({ reference: ref }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.status === "completed") {
            setPaid(true);
            setStatusMsg("Payment confirmed!");
            return;
          }
          if (data.status === "failed") {
            setError(data.message || "Payment failed. Please try again.");
            setStatusMsg("");
            return;
          }
          setStatusMsg(
            attempts < 3
              ? "Payment prompt sent. Approve it on your phone."
              : "Waiting for your network to confirm. You can safely close this page."
          );
          const delay = attempts <= 12 ? 2500 : attempts <= 30 ? 5000 : 10000;
          pollRef.current = setTimeout(tick, delay);
        })
        .catch(() => {
          pollRef.current = setTimeout(tick, 5000);
        });
    }
    tick();
  }, [paymentData]);

  useEffect(() => {
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  // Detect callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") setPaid(true);
  }, []);

  // Redirect after payment
  useEffect(() => {
    if (!paid) return;
    const t = setTimeout(() => { window.location.href = `/vip/${tierKey}`; }, 2000);
    return () => clearTimeout(t);
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

          {paymentData && !paid && !chargeRef && (
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-4">
                <i className="fas fa-mobile-alt text-teal-500 mr-2" />
                Pay with Mobile Money
              </h2>

              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Network</label>
                <div className="grid grid-cols-3 gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setProvider(p.value)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold transition border ${
                        provider === p.value
                          ? "bg-teal-50 border-teal-300 text-teal-700"
                          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Mobile Money Number</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="0XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3.5 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition"
                />
              </div>

              {resolving && (
                <div className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
                  <i className="fas fa-spinner fa-spin" /> Verifying account name...
                </div>
              )}

              {resolvedName && (
                <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-teal-50 border border-teal-100 text-xs text-teal-700">
                  <i className="fas fa-user-check mr-1.5" />
                  <span className="font-bold">{resolvedName}</span>
                </div>
              )}

              {!resolvedName && !resolving && /^0\d{9}$/.test(phone.replace(/[\s-]/g, "")) && (
                <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
                  <i className="fas fa-exclamation-triangle mr-1.5" />
                  Could not verify this number. Check the number and network.
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={!resolvedName || submitting || !paymentData}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-teal-500/20"
              >
                {submitting ? (
                  <><i className="fas fa-spinner fa-spin mr-2" /> Processing...</>
                ) : (
                  <>Pay GH₵{displayAmount}</>
                )}
              </button>

              <p className="text-center text-[10px] text-gray-400 mt-3">
                You will receive a payment prompt on your phone
              </p>
            </div>
          )}

          {chargeRef && !paid && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-teal-50 flex items-center justify-center">
                <i className="fas fa-mobile-alt text-2xl text-teal-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">Check your phone</h3>
              <p className="text-sm text-gray-500 mb-4">{statusMsg}</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-200">
                <i className="fas fa-spinner fa-spin text-teal-500" />
                <span className="text-xs font-medium text-gray-600">Waiting for confirmation...</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
