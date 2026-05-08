"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  subscription_tier: string | null;
  is_admin: boolean | null;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  activeThisMonth: number;
  totalGenerations: number;
  premiumUsers: number;
}

function monthYear(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, session, loading } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [dataLoading, setDataLoading] = useState(true);
  const [actionError, setActionError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (user.email !== "usdvisionai@gmail.com") { router.push("/dashboard"); return; }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function loadData() {
    setDataLoading(true);
    const my = monthYear();

    const [profilesRes, usageRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, subscription_tier, is_admin, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("usage_tracking").select("user_id, month_year"),
    ]);

    const profiles: UserRow[] = profilesRes.data ?? [];
    const allUsage = usageRes.data ?? [];
    const thisMonthUsage = allUsage.filter((u) => u.month_year === my);
    const activeSet = new Set(thisMonthUsage.map((u) => u.user_id));
    const premiumCount = profiles.filter((p) => p.subscription_tier === "premium").length;

    setStats({
      totalUsers: profiles.length,
      activeThisMonth: activeSet.size,
      totalGenerations: allUsage.length,
      premiumUsers: premiumCount,
    });
    setUsers(profiles);
    setDataLoading(false);
  }

  async function handlePremiumAction(targetUser: UserRow, action: "grant" | "revoke") {
    const name = targetUser.full_name ?? targetUser.email ?? targetUser.id;
    const msg = action === "grant"
      ? `Grant premium access to ${name}?`
      : `Revoke premium from ${name}?`;
    if (!confirm(msg)) return;

    setActionError((prev) => ({ ...prev, [targetUser.id]: "" }));

    const res = await fetch("/api/admin/grant-premium", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ targetUserId: targetUser.id, action }),
    });

    if (!res.ok) {
      const text = await res.text();
      setActionError((prev) => ({ ...prev, [targetUser.id]: text || "Action failed" }));
      return;
    }

    const tier = action === "grant" ? "premium" : "free";
    setUsers((prev) =>
      prev.map((u) => u.id === targetUser.id ? { ...u, subscription_tier: tier } : u)
    );
    setStats((prev) => prev ? {
      ...prev,
      premiumUsers: action === "grant" ? prev.premiumUsers + 1 : Math.max(0, prev.premiumUsers - 1),
    } : prev);
  }

  function downloadCSV() {
    const headers = ["Name", "Email", "Tier", "Joined"];
    const rows = users.map((u) => [
      u.full_name ?? "",
      u.email ?? "",
      u.subscription_tier ?? "free",
      new Date(u.created_at).toLocaleDateString("en-IN"),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gyaan-mitra-users.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.full_name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  if (user?.email !== "usdvisionai@gmail.com") return null;

  const statCards = stats ? [
    { label: "Total Users", value: stats.totalUsers, color: "bg-blue-50 border-blue-200 text-blue-700" },
    { label: "Active This Month", value: stats.activeThisMonth, color: "bg-green-50 border-green-200 text-green-700" },
    { label: "Total Generations", value: stats.totalGenerations, color: "bg-orange-50 border-orange-200 text-orange-700" },
    { label: "Premium Users", value: stats.premiumUsers, color: "bg-amber-50 border-amber-200 text-amber-700" },
  ] : [];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex-1 py-10 px-4">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold" style={{ color: "#1B3A6B" }}>Admin Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">Gyaan Mitra — user management</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-100 text-red-700 border border-red-200">
              Admin Only
            </span>
          </div>

          {/* Stats */}
          {dataLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {statCards.map((c) => (
                <div key={c.label} className={`rounded-2xl border p-5 ${c.color}`}>
                  <div className="text-2xl font-extrabold">{c.value}</div>
                  <div className="text-xs font-medium mt-1 opacity-80">{c.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Users table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold" style={{ color: "#1B3A6B" }}>All Users</h2>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary w-56"
                />
                <button
                  onClick={downloadCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "#1B3A6B" }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>

            {dataLoading ? (
              <div className="p-6 space-y-3 animate-pulse">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tier</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          {users.length === 0 ? (
                            <div>
                              <p className="text-sm font-semibold text-gray-500">No users have signed up yet</p>
                              <p className="text-xs text-gray-400 mt-1">Users will appear here once they create an account.</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm text-gray-400">No users match &quot;{search}&quot;</p>
                              <button
                                onClick={() => setSearch("")}
                                className="mt-2 text-xs text-primary hover:underline font-medium"
                              >
                                Clear search
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 font-medium" style={{ color: "#1B3A6B" }}>
                            {u.full_name ?? <span className="text-gray-400 italic">No name</span>}
                            {u.is_admin && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-semibold">Admin</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{u.email ?? "—"}</td>
                          <td className="px-4 py-3">
                            {u.subscription_tier === "premium" ? (
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">
                                Premium
                              </span>
                            ) : (
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                Free
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {new Date(u.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-3">
                                {u.subscription_tier !== "premium" ? (
                                  <button
                                    onClick={() => handlePremiumAction(u, "grant")}
                                    className="text-xs font-semibold hover:underline"
                                    style={{ color: "#FF9933" }}
                                  >
                                    Grant Premium
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handlePremiumAction(u, "revoke")}
                                    className="text-xs font-semibold text-gray-500 hover:underline"
                                  >
                                    Revoke Premium
                                  </button>
                                )}
                                <button
                                  onClick={() => alert("Suspend feature coming soon")}
                                  className="text-xs font-semibold text-red-500 hover:underline"
                                >
                                  Suspend
                                </button>
                              </div>
                              {actionError[u.id] && (
                                <p className="text-xs text-red-500">{actionError[u.id]}</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}
