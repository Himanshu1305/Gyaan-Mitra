"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  subscription_tier: string | null;
  is_admin: boolean | null;
  created_at: string;
}

interface UserRow extends Profile {
  totalGenerations: number;
}

interface Stats {
  totalUsers: number;
  activeThisMonth: number;
  totalGenerationsThisMonth: number;
  mostUsedFeature: string;
}

function monthYear(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.push("/login"); return; }
    if (!loading && user) {
      supabase.from("profiles").select("is_admin").eq("id", user.id).single()
        .then(({ data }) => {
          if (!data?.is_admin) { router.push("/dashboard"); return; }
          setIsAdmin(true);
          setCheckingAdmin(false);
          loadData();
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function loadData() {
    setDataLoading(true);
    const my = monthYear();

    const [profilesRes, usageRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, subscription_tier, is_admin, created_at").order("created_at", { ascending: false }),
      supabase.from("usage_tracking").select("user_id, feature_used, month_year"),
    ]);

    const profiles: Profile[] = profilesRes.data ?? [];
    const allUsage = usageRes.data ?? [];
    const thisMonthUsage = allUsage.filter((u) => u.month_year === my);

    // Active this month = distinct users with a usage record this month
    const activeSet = new Set(thisMonthUsage.map((u) => u.user_id));

    // Most used feature this month
    const featureCounts: Record<string, number> = {};
    thisMonthUsage.forEach((u) => { featureCounts[u.feature_used] = (featureCounts[u.feature_used] ?? 0) + 1; });
    const topFeature = Object.entries(featureCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    setStats({
      totalUsers: profiles.length,
      activeThisMonth: activeSet.size,
      totalGenerationsThisMonth: thisMonthUsage.length,
      mostUsedFeature: topFeature,
    });

    // Attach per-user generation count
    const genCounts: Record<string, number> = {};
    allUsage.forEach((u) => { genCounts[u.user_id] = (genCounts[u.user_id] ?? 0) + 1; });

    setUsers(profiles.map((p) => ({ ...p, totalGenerations: genCounts[p.id] ?? 0 })));
    setDataLoading(false);
  }

  function downloadCSV() {
    const headers = ["Name", "Email", "Subscription", "Total Generations", "Joined"];
    const rows = users.map((u) => [
      u.full_name ?? "",
      u.email ?? "",
      u.subscription_tier ?? "free",
      String(u.totalGenerations),
      new Date(u.created_at).toLocaleDateString("en-IN"),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "gyaan-mitra-users.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (u.full_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
  });

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  if (!isAdmin) return null;

  const statCards = stats ? [
    { label: "Total Users", value: stats.totalUsers, icon: "👥", color: "bg-blue-50 border-blue-200" },
    { label: "Active This Month", value: stats.activeThisMonth, icon: "📈", color: "bg-green-50 border-green-200" },
    { label: "Generations This Month", value: stats.totalGenerationsThisMonth, icon: "⚡", color: "bg-orange-50 border-orange-200" },
    { label: "Top Feature This Month", value: stats.mostUsedFeature, icon: "🏆", color: "bg-purple-50 border-purple-200" },
  ] : [];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex-1 py-10 px-4">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-secondary">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">Gyaan Mitra — internal admin view</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-100 text-red-700 border border-red-200">Admin Only</span>
          </div>

          {/* Stats */}
          {dataLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1,2,3,4].map((i) => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {statCards.map((c) => (
                <div key={c.label} className={`rounded-2xl border p-5 ${c.color}`}>
                  <div className="text-2xl mb-2">{c.icon}</div>
                  <div className="text-2xl font-extrabold text-secondary">{c.value}</div>
                  <div className="text-xs font-medium text-gray-500 mt-1">{c.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Users table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-secondary">All Users</h2>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary w-56"
                />
                <button onClick={downloadCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary/80 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Export CSV
                </button>
              </div>
            </div>

            {dataLoading ? (
              <div className="p-6 space-y-3 animate-pulse">
                {[1,2,3,4,5].map((i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tier</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Generations</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No users found.</td></tr>
                    ) : filtered.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-secondary">
                          {u.full_name ?? <span className="text-gray-400 italic">No name</span>}
                          {u.is_admin && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-semibold">Admin</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{u.email ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-400 italic text-xs">Not available</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.subscription_tier === "premium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                            {u.subscription_tier ?? "free"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-secondary">{u.totalGenerations}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button className="text-xs text-primary font-semibold hover:underline">View</button>
                            <button className="text-xs text-red-500 font-semibold hover:underline">Suspend</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center">
            Location data not collected yet. To collect it in future, add a &quot;city&quot; or &quot;state&quot; field to the signup form and store in profiles.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
