"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = `toast-${++counter}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      const timer = setTimeout(() => removeToast(id), 4000);
      timers.current.set(id, timer);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const variantStyles: Record<ToastVariant, { bg: string; border: string; icon: string; iconColor: string }> = {
  success: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "fa-circle-check", iconColor: "text-emerald-500" },
  error: { bg: "bg-red-50", border: "border-red-200", icon: "fa-circle-xmark", iconColor: "text-red-500" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", icon: "fa-triangle-exclamation", iconColor: "text-amber-500" },
  info: { bg: "bg-sky-50", border: "border-sky-200", icon: "fa-circle-info", iconColor: "text-sky-500" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const s = variantStyles[toast.variant];
  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${s.bg} ${s.border} px-4 py-3 shadow-lg shadow-black/5 animate-slide-in`}
    >
      <i className={`fas ${s.icon} ${s.iconColor} text-base mt-0.5 shrink-0`} />
      <p className="flex-1 text-sm font-medium text-slate-800 leading-snug">{toast.message}</p>
      <button onClick={() => onDismiss(toast.id)} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-0.5">
        <i className="fas fa-xmark text-sm" />
      </button>
    </div>
  );
}
