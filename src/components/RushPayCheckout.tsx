"use client";

import { useEffect, useRef, useState } from "react";

// RushPay requires the widget to talk to Core directly. Core only allows CORS
// from the registered production domains, so on localhost (dev only) the
// widget goes through our pass-through route instead.
const RUSHPAY_API_BASE = "https://core.rushpay.cash";
const WIDGET_SCRIPT_URL = `${RUSHPAY_API_BASE}/widget/payment-widget-v2.js`;
const WIDGET_SCRIPT_TIMEOUT_MS = 15_000;
const CONTAINER_ID = "rushpay-widget";

interface RushPayV2Options {
  containerId: string;
  paymentReference: string;
  widgetSessionToken: string;
  callbackUrl: string;
  returnUrl: string;
  apiBase: string;
  onSuccess?: () => void;
}

declare global {
  interface Window {
    RushPayV2?: {
      init?: (options: RushPayV2Options) => void;
    };
  }
}

function getWidgetApiBase(): string {
  const { hostname, origin } = window.location;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  return isLocal ? `${origin}/api/rushpay-proxy` : RUSHPAY_API_BASE;
}

let scriptPromise: Promise<void> | null = null;

/** Loads the widget script once per page, however often the component mounts. */
function loadWidgetScript(): Promise<void> {
  if (typeof window.RushPayV2?.init === "function") return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = WIDGET_SCRIPT_URL;
    script.async = true;

    const fail = (message: string) => {
      clearTimeout(timer);
      script.remove();
      scriptPromise = null;
      reject(new Error(message));
    };
    const timer = setTimeout(() => fail("Widget script timed out"), WIDGET_SCRIPT_TIMEOUT_MS);

    script.onload = () => {
      clearTimeout(timer);
      if (typeof window.RushPayV2?.init === "function") resolve();
      else fail("Widget script loaded without RushPayV2.init");
    };
    script.onerror = () => fail("Widget script failed to load");
    document.head.appendChild(script);
  });

  return scriptPromise;
}

interface RushPayCheckoutProps {
  paymentReference: string;
  /** Short-lived token from our server; the API key never reaches the browser. */
  widgetSessionToken: string;
  /** Where RushPay sends the customer back to. It is not proof of payment. */
  returnUrl: string;
  /** The widget reports success. Treat it as a hint and verify on the server. */
  onPaymentComplete?: () => void;
  onError: (message: string) => void;
}

/**
 * Mounts the official RushPay checkout widget. Give it a `key` that changes
 * with the payment so a new payment gets a fresh widget.
 */
export default function RushPayCheckout({
  paymentReference,
  widgetSessionToken,
  returnUrl,
  onPaymentComplete,
  onError,
}: RushPayCheckoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Keep the latest callbacks without re-running the init effect on re-renders.
  const onErrorRef = useRef(onError);
  const onCompleteRef = useRef(onPaymentComplete);
  useEffect(() => {
    onErrorRef.current = onError;
    onCompleteRef.current = onPaymentComplete;
  });

  useEffect(() => {
    const container = containerRef.current;
    let cancelled = false;

    loadWidgetScript()
      .then(() => {
        if (cancelled) return;
        const init = window.RushPayV2?.init;
        if (!init) throw new Error("RushPayV2.init is unavailable");

        init({
          containerId: CONTAINER_ID,
          paymentReference,
          widgetSessionToken,
          callbackUrl: returnUrl,
          returnUrl,
          apiBase: getWidgetApiBase(),
          onSuccess: () => {
            if (!cancelled) onCompleteRef.current?.();
          },
        });
        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("RushPay widget error:", err);
        onErrorRef.current(
          "We could not load the payment form. Check your connection and try again."
        );
      });

    return () => {
      cancelled = true;
      if (container) container.innerHTML = "";
    };
  }, [paymentReference, widgetSessionToken, returnUrl]);

  return (
    <div>
      {!ready && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
          <i className="fas fa-spinner fa-spin" />
          <span>Loading secure checkout...</span>
        </div>
      )}
      <div id={CONTAINER_ID} ref={containerRef} className="min-h-[60px]" />
    </div>
  );
}
