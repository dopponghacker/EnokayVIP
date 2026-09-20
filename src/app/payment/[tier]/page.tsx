"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Tier, TIER_META } from "@/lib/types";
import RushPayCheckout from "@/components/RushPayCheckout";

interface PaymentData {
  paymentCode: string;
  amount: number;
  tier: string;
  tierLabel: string;
  widgetSessionToken: string | null;
  sessionExpiresIn: number;
  paymentReference: string | null;
}

interface VerifyResponse {
  paid?: boolean;
  failed?: boolean;
  error?: string;
}

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 20 * 60 * 1000;
const UNCONFIRMED_MESSAGE =
  "We could not confirm your payment automatically. If you were charged, please contact support with your MoMo receipt.";
const FAILED_MESSAGE = "Your payment was not completed. Please try again.";

function storageKey(tier: string) {
  return `enokay_pay_${tier}`;
}

function readStoredCode(tier: string): string | null {
  try {
    return localStorage.getItem(storageKey(tier));
  } catch {
    return null;
  }
}

function writeStoredCode(tier: string, code: string | null) {
  try {
    if (code) localStorage.setItem(storageKey(tier), code);
    else localStorage.removeItem(storageKey(tier));
  } catch {}
}

const noopSubscribe = () => () => {};

/**
 * The widget sends the customer back here with ?paid=1. That query proves
 * nothing by itself; it only tells us to ask the server about the payment we
 * stored before checkout started.
 */
function useWidgetReturn(tier: string) {
  const returned = useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("paid") === "1",
    () => false
  );
  const storedCode = useSyncExternalStore(
    noopSubscribe,
    () => (returned ? readStoredCode(tier) : null),
    () => null
  );
  return { returned, storedCode };
}

export default function PaymentPage() {
  const { tier } = useParams<{ tier: string }>();
  const startingRef = useRef(false);

  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [verifyCode, setVerifyCode] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [paid, setPaid] = useState(false);

  const tierKey = tier as Tier;
  const meta = TIER_META[tierKey];
  const displayAmount = amount ?? meta?.amount;

  const { returned, storedCode } = useWidgetReturn(tierKey);
  const activeCode = finished ? null : (verifyCode ?? storedCode);
  const returnedWithoutPayment = returned && !storedCode && !verifyCode;

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

  // The server decides the amount and creates the RushPay payment; we only
  // receive the reference and a short-lived widget session token.
  const startCheckout = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;

    setError(null);
    setStarting(true);
    setPaymentData(null);
    try {
      const res = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierKey }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.paymentReference || !data.widgetSessionToken) {
        throw new Error("Payment gateway failed to initialize. Please try again.");
      }
      writeStoredCode(tierKey, data.paymentCode);
      setPaymentData(data);
      setVerifyCode(data.paymentCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize payment.");
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [tierKey]);

  // A widget session is scoped to one payment, so a new attempt gets a fresh
  // session (and a new payment if the old one can no longer be continued).
  const restart = useCallback(() => {
    setFinished(false);
    setConfirming(false);
    setSessionExpired(false);
    setVerifyCode(null);
    startCheckout();
  }, [startCheckout]);

  // On load, start checkout unless we are coming back to a payment we already
  // started, in which case the poll below just verifies it.
  useEffect(() => {
    if (!meta) return;

    const isReturn = new URLSearchParams(window.location.search).get("paid") === "1";
    if (isReturn && readStoredCode(tierKey)) return;

    // Deferred so the state updates inside startCheckout are not synchronous
    // effect work. startingRef stops a double start, e.g. under StrictMode.
    const timer = setTimeout(startCheckout, 0);
    return () => clearTimeout(timer);
  }, [meta, tierKey, startCheckout]);

  // Widget sessions last about an hour. Once ours is gone, offer a fresh
  // checkout, but keep checking the old payment until the customer chooses to.
  useEffect(() => {
    if (!paymentData || paid) return;
    const ms = Math.max(0, (paymentData.sessionExpiresIn - 15) * 1000);
    const timer = setTimeout(() => setSessionExpired(true), ms);
    return () => clearTimeout(timer);
  }, [paymentData, paid]);

  // Ask the server whether RushPay has confirmed the payment. On success it
  // sets the access cookie, so the VIP page will authorize this browser.
  useEffect(() => {
    if (!activeCode || paid) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/payment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentCode: activeCode }),
        });
        const data: VerifyResponse | null = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.paid) {
          writeStoredCode(tierKey, null);
          setPaid(true);
          return;
        }
        if (res.ok && data?.failed) {
          writeStoredCode(tierKey, null);
          setFinished(true);
          setConfirming(false);
          setError(FAILED_MESSAGE);
          return;
        }
        if (res.status === 410) {
          setFinished(true);
          setError(data?.error || "Access has expired. Please purchase again.");
          return;
        }
        if (res.status === 404) {
          setFinished(true);
          setError(UNCONFIRMED_MESSAGE);
          return;
        }
      } catch {}
      if (Date.now() - startedAt < POLL_TIMEOUT_MS) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } else {
        setFinished(true);
        setError(UNCONFIRMED_MESSAGE);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeCode, paid, tierKey]);

  useEffect(() => {
    if (!paid) return;
    const timeout = setTimeout(() => {
      window.location.href = `/vip/${tierKey}`;
    }, 1500);
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

  const verifyingReturn = Boolean(storedCode) && !paymentData;

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
            <div className="flex-1">
              <span>{error}</span>
              <button
                onClick={restart}
                disabled={starting}
                className="mt-2 block text-xs font-semibold text-teal-600 hover:underline disabled:opacity-50"
              >
                {starting ? "Retrying..." : "Try again"}
              </button>
            </div>
          </div>
        )}

        {returnedWithoutPayment && !error && !paid && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-3 text-xs text-amber-800 flex items-start gap-2">
            <i className="fas fa-info-circle mt-0.5 shrink-0" />
            <span>{UNCONFIRMED_MESSAGE}</span>
          </div>
        )}

        {sessionExpired && !paid && !error && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-3 text-xs text-amber-800 flex items-start gap-2">
            <i className="fas fa-clock mt-0.5 shrink-0" />
            <div className="flex-1">
              <span>This checkout session has expired. If you have not paid yet, start a new one.</span>
              <button
                onClick={restart}
                disabled={starting}
                className="mt-2 block text-xs font-semibold text-teal-600 hover:underline disabled:opacity-50"
              >
                Start new checkout
              </button>
            </div>
          </div>
        )}

        {paid && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-3.5 py-3 text-sm text-green-700 flex items-center gap-2">
            <i className="fas fa-check-circle" />
            <span>Payment confirmed! Redirecting to your predictions...</span>
          </div>
        )}

        {(verifyingReturn || confirming) && !paid && !error && (
          <div className="mb-4 rounded-lg bg-teal-50 border border-teal-200 px-3.5 py-3 text-sm text-teal-800 flex items-center gap-2">
            <i className="fas fa-spinner fa-spin" />
            <span>Confirming your payment...</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
          {!paymentData && !paid && !verifyingReturn && starting && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <i className="fas fa-spinner fa-spin" />
              <span>Preparing checkout...</span>
            </div>
          )}
          {paymentData?.paymentReference && paymentData.widgetSessionToken && !paid && (
            <RushPayCheckout
              key={`${paymentData.paymentReference}:${paymentData.widgetSessionToken}`}
              paymentReference={paymentData.paymentReference}
              widgetSessionToken={paymentData.widgetSessionToken}
              returnUrl={`${window.location.origin}/payment/${tierKey}?paid=1`}
              onPaymentComplete={() => setConfirming(true)}
              onError={setError}
            />
          )}
        </div>
      </main>
    </div>
  );
}
