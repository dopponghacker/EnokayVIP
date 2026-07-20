"use client";

import { useState, useEffect, useCallback } from "react";
import { VipTip, PublicMatch, MatchStatus, Tier, TIER_META, BookingCode } from "@/lib/types";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { useRouter } from "next/navigation";
import { useAlert } from "@/components/Alert";
import { useToast } from "@/components/Toast";

const TIERS: Tier[] = ["accurate-odds", "draw-tips", "correct-score"];
const STATUSES: MatchStatus[] = ["pending", "won", "lost"];

const emptyVipForm = {
  tier: "accurate-odds" as Tier,
  homeTeam: "",
  awayTeam: "",
  prediction: "",
  league: "",
  time: "",
  date: new Date().toISOString().split("T")[0],
  odds: "",
};

const emptyMatchForm = {
  homeTeam: "",
  awayTeam: "",
  prediction: "",
  league: "",
  time: "",
  date: new Date().toISOString().split("T")[0],
  odds: "",
  status: "pending" as MatchStatus,
};

const tierColors: Record<Tier, string> = {
  "accurate-odds": "bg-teal-600 text-white",
  "draw-tips": "bg-amber-500 text-white",
  "correct-score": "bg-violet-600 text-white",
};

const statusStyles: Record<MatchStatus, string> = {
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
};

type AdminTab = "vip" | "matches" | "settings";

export default function AdminPage() {
  const router = useRouter();
  const { alert } = useAlert();
  const { addToast } = useToast();
  const [tab, setTab] = useState<AdminTab>("vip");
  const [error, setError] = useState("");

  // VIP Tips state
  const [tips, setTips] = useState<VipTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTier, setActiveTier] = useState<Tier>("accurate-odds");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyVipForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Public Matches state
  const [matches, setMatches] = useState<PublicMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [savingMatch, setSavingMatch] = useState(false);
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [matchForm, setMatchForm] = useState(emptyMatchForm);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  // Settings state
  const [newUsername, setNewUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  // Booking code state
  const [bookingCode, setBookingCode] = useState<BookingCode | null>(null);
  const [bookingCodeInput, setBookingCodeInput] = useState("");
  const [savingBookingCode, setSavingBookingCode] = useState(false);

  const adminRequest = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    if (response.status === 401) {
      router.replace("/enokay-secure-login");
      throw new Error("Your session has expired.");
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Something went wrong.");
    }
    return response;
  }, [router]);

  // --- Fetch ---
  const fetchTips = useCallback(async () => {
    try {
      const res = await adminRequest("/api/vip-tips");
      setTips(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tips.");
    } finally {
      setLoading(false);
    }
  }, [adminRequest]);

  const fetchMatches = useCallback(async () => {
    try {
      const res = await adminRequest("/api/matches");
      setMatches(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load matches.");
    } finally {
      setLoadingMatches(false);
    }
  }, [adminRequest]);

  const today = new Date().toISOString().split("T")[0];

  const fetchBookingCode = useCallback(async (tier: Tier) => {
    try {
      const res = await fetch(`/api/booking-codes?tier=${tier}&date=${today}`);
      if (res.ok) {
        const data = await res.json();
        setBookingCode(data);
        setBookingCodeInput(data?.code || "");
      } else {
        setBookingCode(null);
        setBookingCodeInput("");
      }
    } catch {
      setBookingCode(null);
      setBookingCodeInput("");
    }
  }, [today]);

  useEffect(() => {
    const t1 = window.setTimeout(fetchTips, 0);
    const t2 = window.setTimeout(fetchMatches, 0);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [fetchTips, fetchMatches]);

  useEffect(() => {
    if (tab === "vip") {
      fetchBookingCode(activeTier);
    }
  }, [tab, activeTier, fetchBookingCode]);

  // --- VIP Tips handlers ---
  const filteredTips = tips.filter((t) => t.tier === activeTier);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const isEdit = Boolean(editingId);
    try {
      if (editingId) {
        await adminRequest(`/api/vip-tips/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        await adminRequest("/api/vip-tips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setEditingId(null);
      setForm({ ...emptyVipForm, tier: activeTier });
      setShowForm(false);
      await fetchTips();
      addToast(isEdit ? "Tip updated successfully" : "Tip added successfully", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save tip.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await alert({ title: "Delete tip?", message: "This tip will be permanently removed.", variant: "confirm", confirmText: "Delete", cancelText: "Keep" });
    if (!confirmed) return;
    setError("");
    try {
      await adminRequest(`/api/vip-tips/${id}`, { method: "DELETE" });
      await fetchTips();
      addToast("Tip deleted", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete.");
    }
  }

  function handleEdit(tip: VipTip) {
    setForm({ tier: tip.tier, homeTeam: tip.homeTeam, awayTeam: tip.awayTeam, prediction: tip.prediction, league: tip.league, time: tip.time, date: tip.date, odds: tip.odds });
    setEditingId(tip.id);
    setShowForm(true);
  }

  function handleCancel() {
    setForm({ ...emptyVipForm, tier: activeTier });
    setEditingId(null);
    setShowForm(false);
  }

  // --- Public Matches handlers ---
  async function handleMatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingMatch(true);
    setError("");
    const isEdit = Boolean(editingMatchId);
    try {
      if (editingMatchId) {
        await adminRequest(`/api/matches/${editingMatchId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(matchForm),
        });
      } else {
        await adminRequest("/api/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(matchForm),
        });
      }
      setEditingMatchId(null);
      setMatchForm(emptyMatchForm);
      setShowMatchForm(false);
      await fetchMatches();
      addToast(isEdit ? "Match updated successfully" : "Match added successfully", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save match.");
    } finally {
      setSavingMatch(false);
    }
  }

  async function handleMatchDelete(id: string) {
    const confirmed = await alert({ title: "Delete match?", message: "This match will be permanently removed.", variant: "confirm", confirmText: "Delete", cancelText: "Keep" });
    if (!confirmed) return;
    setError("");
    try {
      await adminRequest(`/api/matches/${id}`, { method: "DELETE" });
      await fetchMatches();
      addToast("Match deleted", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete.");
    }
  }

  function handleMatchEdit(match: PublicMatch) {
    setMatchForm({ homeTeam: match.homeTeam, awayTeam: match.awayTeam, prediction: match.prediction, league: match.league, time: match.time, date: match.date, odds: match.odds, status: match.status });
    setEditingMatchId(match.id);
    setShowMatchForm(true);
  }

  async function handleStatusChange(id: string, status: MatchStatus) {
    setError("");
    try {
      await adminRequest(`/api/matches/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await fetchMatches();
      addToast(`Status updated to ${status}`, "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status.");
    }
  }

  function handleMatchCancel() {
    setMatchForm(emptyMatchForm);
    setEditingMatchId(null);
    setShowMatchForm(false);
  }

  const won = matches.filter((m) => m.status === "won").length;
  const lost = matches.filter((m) => m.status === "lost").length;
  const pending = matches.filter((m) => m.status === "pending").length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-gray-400 hover:text-gray-600 transition shrink-0">
              <i className="fas fa-arrow-left text-lg" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold text-gray-900 truncate">Admin Dashboard</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Manage predictions</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {tab !== "settings" && (
              <button
                onClick={() => {
                  if (tab === "vip") { handleCancel(); setShowForm(!showForm); }
                  else { handleMatchCancel(); setShowMatchForm(!showMatchForm); }
                }}
                className="admin-btn admin-btn-primary"
              >
                <i className={`fas ${(tab === "vip" ? showForm : showMatchForm) ? "fa-times" : "fa-plus"}`} />
                <span className="hidden sm:inline">{(tab === "vip" ? showForm : showMatchForm) ? "Cancel" : tab === "vip" ? "Add Tip" : "Add Match"}</span>
              </button>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <i className="fas fa-circle-exclamation mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => { setTab("vip"); handleMatchCancel(); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${tab === "vip" ? "bg-slate-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}
          >
            <i className="fas fa-crown text-xs" /> VIP Tips
          </button>
          <button
            onClick={() => { setTab("matches"); handleCancel(); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${tab === "matches" ? "bg-slate-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}
          >
            <i className="fas fa-futbol text-xs" /> Track Record
            <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${tab === "matches" ? "bg-white/20" : "bg-gray-100"}`}>{matches.length}</span>
          </button>
          <button
            onClick={() => { setTab("settings"); handleCancel(); handleMatchCancel(); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${tab === "settings" ? "bg-slate-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}
          >
            <i className="fas fa-gear text-xs" /> Settings
          </button>
        </div>

        {/* ===== VIP TIPS TAB ===== */}
        {tab === "vip" && (
          <>
            {/* Tier sub-tabs */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
              {TIERS.map((tier) => {
                const count = tips.filter((t) => t.tier === tier).length;
                return (
                  <button
                    key={tier}
                    onClick={() => { setActiveTier(tier); handleCancel(); }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap ${activeTier === tier ? tierColors[tier] : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}
                  >
                    <i className={`fas ${tier === "accurate-odds" ? "fa-crown" : tier === "draw-tips" ? "fa-handshake" : "fa-bullseye"} text-xs`} />
                    <span className="hidden sm:inline">{TIER_META[tier].label}</span>
                    <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${activeTier === tier ? "bg-white/20" : "bg-gray-100"}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Booking Code */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <i className="fas fa-ticket text-gray-400" />
                <h3 className="text-sm font-bold text-gray-900">Booking Code — {TIER_META[activeTier].label} ({today})</h3>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  className="admin-input flex-1"
                  placeholder="e.g. AB12CD"
                  value={bookingCodeInput}
                  onChange={(e) => setBookingCodeInput(e.target.value)}
                />
                <button
                  onClick={async () => {
                    if (!bookingCodeInput.trim()) return;
                    setSavingBookingCode(true);
                    setError("");
                    try {
                      await adminRequest("/api/booking-codes", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tier: activeTier, date: today, code: bookingCodeInput.trim() }),
                      });
                      await fetchBookingCode(activeTier);
                      addToast(bookingCode ? "Booking code updated" : "Booking code saved", "success");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Unable to save booking code.");
                    } finally {
                      setSavingBookingCode(false);
                    }
                  }}
                  disabled={savingBookingCode || !bookingCodeInput.trim()}
                  className="admin-btn admin-btn-primary"
                >
                  <i className={`fas ${savingBookingCode ? "fa-spinner fa-spin" : "fa-save"}`} />
                  <span className="hidden sm:inline">{bookingCode ? "Update" : "Save"}</span>
                </button>
                {bookingCode && (
                  <button
                    onClick={async () => {
                      const confirmed = await alert({ title: "Delete booking code?", message: "This code will be removed.", variant: "confirm", confirmText: "Delete", cancelText: "Keep" });
                      if (!confirmed) return;
                      setError("");
                      try {
                        await adminRequest(`/api/booking-codes/${bookingCode.id}`, { method: "DELETE" });
                        setBookingCode(null);
                        setBookingCodeInput("");
                        addToast("Booking code deleted", "success");
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Unable to delete booking code.");
                      }
                    }}
                    className="admin-btn admin-btn-danger"
                  >
                    <i className="fas fa-trash" />
                  </button>
                )}
              </div>
            </div>

            {showForm && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 mb-6">
                <h3 className="text-base font-bold text-gray-900 mb-4">
                  <i className={`fas ${editingId ? "fa-edit" : "fa-plus-circle"} text-teal-600 mr-2`} />
                  {editingId ? "Edit Tip" : `Add Tip — ${TIER_META[activeTier].label}`}
                </h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tier *</label>
                    <select className="admin-input" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as Tier })}>
                      {TIERS.map((t) => <option key={t} value={t}>{TIER_META[t].label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Home Team *</label>
                    <input type="text" required className="admin-input" placeholder="e.g. Arsenal" value={form.homeTeam} onChange={(e) => setForm({ ...form, homeTeam: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Away Team *</label>
                    <input type="text" required className="admin-input" placeholder="e.g. Chelsea" value={form.awayTeam} onChange={(e) => setForm({ ...form, awayTeam: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Prediction *</label>
                    <input type="text" required className="admin-input" placeholder="e.g. Home Win" value={form.prediction} onChange={(e) => setForm({ ...form, prediction: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">League</label>
                    <input type="text" className="admin-input" placeholder="e.g. Premier League" value={form.league} onChange={(e) => setForm({ ...form, league: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
                    <input type="date" required className="admin-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Time</label>
                    <input type="time" className="admin-input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Odds</label>
                    <input type="text" className="admin-input" placeholder="e.g. 2.10" value={form.odds} onChange={(e) => setForm({ ...form, odds: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4 flex gap-3 pt-2">
                    <button type="submit" disabled={saving} className="admin-btn admin-btn-primary">
                      <i className={`fas ${saving ? "fa-spinner fa-spin" : editingId ? "fa-save" : "fa-plus"}`} />
                      {saving ? "Saving..." : editingId ? "Save Changes" : "Add Tip"}
                    </button>
                    {editingId && <button type="button" onClick={handleCancel} className="admin-btn admin-btn-danger"><i className="fas fa-times" /> Cancel</button>}
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">
                  <i className="fas fa-list text-gray-400 mr-2" />
                  {TIER_META[activeTier].label} Tips ({filteredTips.length})
                </h3>
              </div>
              {loading ? (
                <div className="p-10 text-center">
                  <i className="fas fa-spinner fa-spin text-2xl text-teal-500 mb-3" />
                  <p className="text-sm text-gray-500">Loading...</p>
                </div>
              ) : filteredTips.length === 0 ? (
                <div className="p-10 text-center">
                  <i className="fas fa-inbox text-3xl text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">No tips in this tier yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredTips.map((tip) => (
                    <div key={tip.id} className="p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900">{tip.homeTeam} vs {tip.awayTeam}</span>
                          <span className="text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{tip.league}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className="font-bold text-teal-700">{tip.prediction}</span>
                          {tip.odds && <span className="text-gray-500">odds {tip.odds}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleEdit(tip)} className="admin-btn-ghost rounded-lg" title="Edit"><i className="fas fa-pen text-xs" /></button>
                        <button onClick={() => handleDelete(tip.id)} className="admin-btn-ghost rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50" title="Delete"><i className="fas fa-trash text-xs" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== TRACK RECORD TAB ===== */}
        {tab === "matches" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-black text-green-600">{won}</div>
                <div className="text-xs text-gray-500 font-medium">Won</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-black text-red-600">{lost}</div>
                <div className="text-xs text-gray-500 font-medium">Lost</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-black text-amber-600">{pending}</div>
                <div className="text-xs text-gray-500 font-medium">Pending</div>
              </div>
            </div>

            {showMatchForm && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 mb-6">
                <h3 className="text-base font-bold text-gray-900 mb-4">
                  <i className={`fas ${editingMatchId ? "fa-edit" : "fa-plus-circle"} text-teal-600 mr-2`} />
                  {editingMatchId ? "Edit Match" : "Add Match"}
                </h3>
                <form onSubmit={handleMatchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Home Team *</label>
                    <input type="text" required className="admin-input" placeholder="e.g. Arsenal" value={matchForm.homeTeam} onChange={(e) => setMatchForm({ ...matchForm, homeTeam: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Away Team *</label>
                    <input type="text" required className="admin-input" placeholder="e.g. Chelsea" value={matchForm.awayTeam} onChange={(e) => setMatchForm({ ...matchForm, awayTeam: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Prediction *</label>
                    <input type="text" required className="admin-input" placeholder="e.g. Home Win" value={matchForm.prediction} onChange={(e) => setMatchForm({ ...matchForm, prediction: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">League</label>
                    <input type="text" className="admin-input" placeholder="e.g. Premier League" value={matchForm.league} onChange={(e) => setMatchForm({ ...matchForm, league: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
                    <input type="date" required className="admin-input" value={matchForm.date} onChange={(e) => setMatchForm({ ...matchForm, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Time</label>
                    <input type="time" className="admin-input" value={matchForm.time} onChange={(e) => setMatchForm({ ...matchForm, time: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Odds</label>
                    <input type="text" className="admin-input" placeholder="e.g. 1.85" value={matchForm.odds} onChange={(e) => setMatchForm({ ...matchForm, odds: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Status *</label>
                    <select className="admin-input" value={matchForm.status} onChange={(e) => setMatchForm({ ...matchForm, status: e.target.value as MatchStatus })}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4 flex gap-3 pt-2">
                    <button type="submit" disabled={savingMatch} className="admin-btn admin-btn-primary">
                      <i className={`fas ${savingMatch ? "fa-spinner fa-spin" : editingMatchId ? "fa-save" : "fa-plus"}`} />
                      {savingMatch ? "Saving..." : editingMatchId ? "Save Changes" : "Add Match"}
                    </button>
                    {editingMatchId && <button type="button" onClick={handleMatchCancel} className="admin-btn admin-btn-danger"><i className="fas fa-times" /> Cancel</button>}
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">
                  <i className="fas fa-futbol text-gray-400 mr-2" />
                  Match History ({matches.length})
                </h3>
              </div>
              {loadingMatches ? (
                <div className="p-10 text-center">
                  <i className="fas fa-spinner fa-spin text-2xl text-teal-500 mb-3" />
                  <p className="text-sm text-gray-500">Loading...</p>
                </div>
              ) : matches.length === 0 ? (
                <div className="p-10 text-center">
                  <i className="fas fa-inbox text-3xl text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">No matches yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {matches.map((match) => (
                    <div key={match.id} className="p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900">{match.homeTeam} vs {match.awayTeam}</span>
                          <span className="text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{match.league}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className="font-bold text-teal-700">{match.prediction}</span>
                          {match.odds && <span className="text-gray-500">odds {match.odds}</span>}
                          <select
                            value={match.status}
                            onChange={(e) => handleStatusChange(match.id, e.target.value as MatchStatus)}
                            className={`text-[10px] font-bold rounded-full px-2 py-1 border-0 cursor-pointer ${statusStyles[match.status]}`}
                          >
                            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleMatchEdit(match)} className="admin-btn-ghost rounded-lg" title="Edit"><i className="fas fa-pen text-xs" /></button>
                        <button onClick={() => handleMatchDelete(match.id)} className="admin-btn-ghost rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50" title="Delete"><i className="fas fa-trash text-xs" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {/* ===== SETTINGS TAB ===== */}
        {tab === "settings" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 max-w-lg">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              <i className="fas fa-shield-halved text-teal-600 mr-2" />
              Change Credentials
            </h3>
            <p className="text-xs text-gray-500 mb-5">Provide your current password to make changes.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setSavingCredentials(true);
                try {
                  const res = await adminRequest("/api/auth/change-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ currentPassword, newUsername: newUsername.trim() || undefined, newPassword: newPassword || undefined }),
                  });
                  if (res.ok) {
                    const result = await res.json();
                    const msg = [];
                    if (result.usernameChanged) msg.push("username");
                    if (result.passwordChanged) msg.push("password");
                    await alert({ title: "Success", message: `Updated: ${msg.join(" & ")}. Login again with new credentials.`, variant: "info", confirmText: "OK" });
                    fetch("/api/auth/logout", { method: "POST" }).then(() => router.replace("/enokay-secure-login"));
                  }
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to update credentials.");
                } finally {
                  setSavingCredentials(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">New Username (optional)</label>
                <input type="text" className="admin-input" placeholder="Leave blank to keep current" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">New Password (optional)</label>
                <div className="relative">
                  <input type={showNewPw ? "text" : "password"} className="admin-input pr-11" placeholder="Leave blank to keep current" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition" tabIndex={-1}>
                    <i className={`fas ${showNewPw ? "fa-eye-slash" : "fa-eye"} text-sm`} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Current Password *</label>
                <div className="relative">
                  <input type={showCurrentPw ? "text" : "password"} required className="admin-input pr-11" placeholder="Required to confirm" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition" tabIndex={-1}>
                    <i className={`fas ${showCurrentPw ? "fa-eye-slash" : "fa-eye"} text-sm`} />
                  </button>
                </div>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={savingCredentials} className="admin-btn admin-btn-primary">
                  <i className={`fas ${savingCredentials ? "fa-spinner fa-spin" : "fa-check"}`} />
                  {savingCredentials ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
