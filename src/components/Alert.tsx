"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type AlertVariant = "success" | "error" | "warning" | "info" | "confirm";

interface AlertOptions {
  title?: string;
  message: string;
  variant?: AlertVariant;
  confirmText?: string;
  cancelText?: string;
}

interface AlertContextValue {
  alert: (options: AlertOptions) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlert must be used within AlertProvider");
  return ctx;
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlertOptions & { open: boolean; variant: AlertVariant } | null>(null);
  const resolver = useRef<(value: boolean) => void>(() => {});

  const close = useCallback((result: boolean) => {
    setState(null);
    resolver.current(result);
  }, []);

  const alert = useCallback(
    (options: AlertOptions) => {
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setState({ ...options, variant: options.variant ?? "info", open: true });
      });
    },
    []
  );

  return (
    <AlertContext.Provider value={{ alert }}>
      {children}
      {state && (
        <AlertDialog
          title={state.title}
          message={state.message}
          variant={state.variant}
          confirmText={state.confirmText}
          cancelText={state.cancelText}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </AlertContext.Provider>
  );
}

const variantConfig: Record<AlertVariant, { icon: string; iconBg: string; iconColor: string; accentColor: string }> = {
  success: { icon: "fa-circle-check", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", accentColor: "bg-emerald-600" },
  error: { icon: "fa-circle-xmark", iconBg: "bg-red-100", iconColor: "text-red-600", accentColor: "bg-red-600" },
  warning: { icon: "fa-triangle-exclamation", iconBg: "bg-amber-100", iconColor: "text-amber-600", accentColor: "bg-amber-600" },
  info: { icon: "fa-circle-info", iconBg: "bg-sky-100", iconColor: "text-sky-600", accentColor: "bg-sky-600" },
  confirm: { icon: "fa-circle-question", iconBg: "bg-violet-100", iconColor: "text-violet-600", accentColor: "bg-violet-600" },
};

function AlertDialog({
  title,
  message,
  variant,
  confirmText = "Continue",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: {
  title?: string;
  message: string;
  variant: AlertVariant;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const config = variantConfig[variant];
  const isConfirm = variant === "confirm";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl shadow-black/20 animate-scale-in overflow-hidden">
        <div className={`h-1 w-full ${config.accentColor}`} />
        <div className="px-6 pt-6 pb-5 text-center">
          <div className={`mx-auto h-14 w-14 rounded-2xl ${config.iconBg} flex items-center justify-center`}>
            <i className={`fas ${config.icon} ${config.iconColor} text-2xl`} />
          </div>
          {title && <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>}
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>
        <div className={`flex border-t border-slate-100 ${isConfirm ? "" : "justify-center"}`}>
          {isConfirm && (
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-3.5 text-sm font-semibold transition-colors ${
              isConfirm
                ? `${config.iconBg} ${config.iconColor} hover:opacity-80 border-l border-slate-100`
                : `${config.accentColor} text-white hover:opacity-90`
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
