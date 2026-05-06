"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { getUsageThisMonth, FREE_LIMIT } from "@/lib/usage";

interface SavedItem {
  id: string;
  content_type: string;
  title: string;
  output_content: string;
  created_at: string;
}

const QUICK_ACTIONS = [
  { label: "Create Lesson Plan", href: "/lesson-plans", icon: "📄", color: "bg-blue-50 border-blue-200 hover:border-blue-400" },
  { label: "Create Worksheet", href: "/worksheets", icon: "📝", color: "bg-green-50 border-green-200 hover:border-green-400" },
  { label: "Create Exam Paper", href: "/exam-papers", icon: "📋", color: "bg-orange-50 border-orange-200 hover:border-orange-400" },
  { label: "Browse Prompts", href: "/prompt-library", icon: "💡", color: "bg-purple-50 border-purple-200 hover:border-purple-400" },
];

const TYPE_LABELS: Record<string, string> = {
  "lesson-plan": "Lesson Plan",
  "worksheet": "Worksheet",
  "exam-paper": "Exam Paper",
};

const TYPE_COLORS: Record<string, string> = {
  "lesson-plan": "bg-blue-100 text-blue-700",
  "worksheet": "bg-green-100 text-green-700",
  "exam-paper": "bg-orange-100 text-orange-700",
};

export default function DashboardPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();

  const [usage, setUsage] = useState(0);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [viewingItem, setViewingItem] = useState<SavedItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showWelcome] = useState(params.get("welcome") === "1");

  const displayName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Teacher";

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    Promise.all([
      getUsageThisMonth(user.id),
      supabase
        .from("saved_content")
        .select("id, content_type, title, output_content, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]).then(([usageCount, { data }]) => {
      setUsage(usageCount);
      setSavedItems(data ?? []);
      setLoadingData(false);
    });
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this saved item?")) return;
    setDeletingId(id);
    await supabase.from("saved_content").delete().eq("id", id);
    setSavedItems((items) => items.filter((i) => i.id !== id));
    setDeletingId(null);
    if (viewingItem?.id === id) setViewingItem(null);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  const usagePercent = Math.min((usage / FREE_LIMIT) * 100, 100);
  const remaining = Math.max(FREE_LIMIT - usage, 0);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex-1 py-10 px-4">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Welcome toast */}
          {showWelcome && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-green-800 font-medium">Account created successfully! Welcome to Gyaan Mitra.</p>
            </div>
          )}

          {/* Header */}
          <div>
            <h1 className="text-3xl font-extrabold text-secondary">
              Welcome back, {displayName}!
            </h1>
            <p className="mt-1 text-gray-500 text-sm">Here&apos;s your Gyaan Mitra dashboard.</p>
          </div>

          {/* Usage card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-secondary">Usage this month</h2>
              <span className="text-xs text-gray-400">Free tier · 5 generations/month</span>
            </div>
            {loadingData ? (
              <div className="h-8 bg-gray-100 rounded animate-pulse" />
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all ${usagePercent >= 100 ? "bg-red-400" : usagePercent >= 80 ? "bg-amber-400" : "bg-primary"}`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-secondary whitespace-nowrap">
                    {usage} of {FREE_LIMIT} used
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {remaining > 0
                    ? `${remaining} free generation${remaining !== 1 ? "s" : ""} remaining this month`
                    : "You've used all free generations this month"}
                </p>
              </>
            )}

            {/* Upgrade banner */}
            {(usage >= FREE_LIMIT - 1) && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {usage >= FREE_LIMIT ? "All free generations used!" : "1 free generation remaining!"}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">Upgrade to Premium for unlimited generations — ₹499/year</p>
                </div>
                <Link
                  href="/pricing"
                  className="flex-shrink-0 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-600 transition-colors shadow-sm shadow-primary/20"
                >
                  Upgrade to Premium
                </Link>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div>
            <h2 className="font-bold text-secondary mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all hover:shadow-md ${action.color}`}
                >
                  <span className="text-3xl">{action.icon}</span>
                  <span className="text-xs font-semibold text-secondary text-center leading-tight">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Saved content */}
          <div>
            <h2 className="font-bold text-secondary mb-4">Saved Content</h2>

            {loadingData ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : savedItems.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <p className="font-semibold text-secondary text-sm">No saved content yet</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">
                  Generate your first lesson plan or worksheet and save it here.
                </p>
                <Link href="/lesson-plans" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-600 transition-colors">
                  Create Lesson Plan
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {savedItems.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${TYPE_COLORS[item.content_type] ?? "bg-gray-100 text-gray-600"}`}>
                            {TYPE_LABELS[item.content_type] ?? item.content_type}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <p className="font-semibold text-secondary text-sm truncate">{item.title}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setViewingItem(viewingItem?.id === item.id ? null : item)}
                          className="px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary-600 transition-colors"
                        >
                          {viewingItem?.id === item.id ? "Close" : "View"}
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {deletingId === item.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </div>

                    {viewingItem?.id === item.id && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="bg-gray-50 rounded-xl p-4 max-h-80 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono text-xs">
                          {item.output_content}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
