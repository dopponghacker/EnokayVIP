"use client";

import { ToastProvider } from "@/components/Toast";
import { AlertProvider } from "@/components/Alert";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AlertProvider>{children}</AlertProvider>
    </ToastProvider>
  );
}
