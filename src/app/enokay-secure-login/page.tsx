"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to sign in.");
      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-glow" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md px-4">
        <Link href="/" className="flex items-center justify-center gap-3 mb-8">
          <div className="w-11 h-11 bg-teal-400 rounded-xl flex items-center justify-center text-slate-950 font-black">69</div>
          <span className="text-2xl font-black text-white tracking-tight">Enokay<span className="text-teal-400">69</span></span>
        </Link>
        <section className="login-card">
          <div className="h-12 w-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center"><i className="fas fa-lock" /></div>
          <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-950">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to manage private predictions.</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-bold text-slate-700 mb-2">Username</label>
              <input id="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} className="login-input" placeholder="Enter your username" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-bold text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input pr-11"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"} text-sm`} />
                </button>
              </div>
            </div>
            {error && <div role="alert" className="rounded-xl bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm"><i className="fas fa-circle-exclamation mr-2" />{error}</div>}
            <button type="submit" disabled={loading} className="w-full premium-button premium-button-dark">
              {loading ? <><i className="fas fa-spinner fa-spin" /> Signing in…</> : <>Sign in securely <i className="fas fa-arrow-right text-xs" /></>}
            </button>
          </form>
        </section>
        <p className="mt-6 text-center text-xs text-slate-500">Authorized administrators only</p>
      </div>
    </main>
  );
}
