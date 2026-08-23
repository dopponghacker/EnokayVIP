"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PaymentSuccessPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [tier, setTier] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");

    if (!reference) {
      setStatus("error");
      setErrorMsg("No payment reference found.");
      return;
    }

    fetch(`/api/payment/verify?reference=${encodeURIComponent(reference)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.verified && data.paymentToken && data.cookieOptions) {
          const opts = data.cookieOptions as { maxAge: number; path: string; sameSite: string; secure: boolean; httpOnly: boolean };
          document.cookie = `enokay_payment=${data.paymentToken}; max-age=${opts.maxAge}; path=${opts.path}; samesite=${opts.sameSite};${opts.secure ? " secure" : ""}`;
          setTier(data.tier);
          setStatus("success");
          setTimeout(() => {
            window.location.href = `/vip/${data.tier}`;
          }, 2000);
        } else {
          setStatus("error");
          setErrorMsg(data.error || "Payment verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Something went wrong. Please try again.");
      });
  }, []);

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
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 text-center">
          {status === "loading" && (
            <>
              <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-spinner fa-spin text-2xl text-teal-600" />
              </div>
              <h1 className="text-lg font-black text-slate-950">Verifying Payment...</h1>
              <p className="text-sm text-slate-500 mt-2">Please wait while we confirm your payment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-check text-3xl text-green-600" />
              </div>
              <h1 className="text-lg font-black text-slate-950">Payment Confirmed!</h1>
              <p className="text-sm text-slate-500 mt-2">
                Redirecting you to your VIP tips...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-times text-3xl text-red-600" />
              </div>
              <h1 className="text-lg font-black text-slate-950">Payment Issue</h1>
              <p className="text-sm text-slate-500 mt-2">{errorMsg}</p>
              <Link
                href="/"
                className="mt-6 inline-block px-6 py-3 rounded-lg bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition"
              >
                Go back home
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
