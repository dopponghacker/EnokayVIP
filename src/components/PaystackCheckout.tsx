"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        currency?: string;
        onClose?: () => void;
        callback?: (response: { reference: string; status: string }) => void;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

const PAYSTACK_SCRIPT_URL = "https://js.paystack.co/v1/inline.js";

let scriptPromise: Promise<void> | null = null;

function loadPaystackScript(): Promise<void> {
  if (typeof window !== "undefined" && typeof window.PaystackPop?.setup === "function") {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PAYSTACK_SCRIPT_URL;
    script.async = true;

    const timer = setTimeout(() => {
      script.remove();
      scriptPromise = null;
      reject(new Error("Paystack script timed out"));
    }, 15000);

    script.onload = () => {
      clearTimeout(timer);
      if (typeof window.PaystackPop?.setup === "function") resolve();
      else reject(new Error("Paystack script loaded but PaystackPop unavailable"));
    };
    script.onerror = () => {
      clearTimeout(timer);
      scriptPromise = null;
      reject(new Error("Paystack script failed to load"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

interface PaystackCheckoutProps {
  email: string;
  amount: number;
  reference: string;
  publicKey: string;
  onSuccess: (reference: string) => void;
  onClose: () => void;
  onError: (message: string) => void;
}

export default function PaystackCheckout({
  email,
  amount,
  reference,
  publicKey,
  onSuccess,
  onClose,
  onError,
}: PaystackCheckoutProps) {
  const hasOpened = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasOpened.current) return;
    hasOpened.current = true;

    console.log("PaystackCheckout: Initializing with", {
      email,
      amount,
      reference,
      publicKeyLength: publicKey?.length,
    });

    loadPaystackScript()
      .then(() => {
        if (!window.PaystackPop) {
          const msg = "Payment library failed to load. Please try again.";
          console.error(msg);
          setError(msg);
          onError(msg);
          return;
        }

        console.log("PaystackCheckout: Opening popup");

        const handler = window.PaystackPop.setup({
          key: publicKey,
          email,
          amount: Math.round(amount * 100),
          ref: reference,
          currency: "GHS",
          onClose: () => {
            console.log("PaystackCheckout: Popup closed by user");
            onClose();
          },
          callback: (response) => {
            console.log("PaystackCheckout: Payment successful", response);
            onSuccess(response.reference);
          },
        });

        handler.openIframe();
        setLoading(false);
      })
      .catch((err: unknown) => {
        const msg = "Could not load payment form. Check your connection and try again.";
        console.error("Paystack load error:", err);
        setError(msg);
        onError(msg);
      });
  }, []);

  if (error) {
    return (
      <div className="py-4 text-center text-sm text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="py-4 text-center text-sm text-slate-500">
      <p>{loading ? "Loading secure checkout..." : "Awaiting payment..."}</p>
    </div>
  );
}
