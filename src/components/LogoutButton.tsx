"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/enokay-secure-login";
  }

  return (
    <button type="button" onClick={logout} disabled={loading} className="admin-btn admin-btn-ghost" title="Sign out">
      <i className={`fas ${loading ? "fa-spinner fa-spin" : "fa-arrow-right-from-bracket"}`} />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
