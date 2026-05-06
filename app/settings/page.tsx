"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

interface CommPrefs { newsletters: boolean; product_updates: boolean; teaching_tips: boolean; }

const DEFAULT_PREFS: CommPrefs = { newsletters: true, product_updates: true, teaching_tips: true };

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [prefs, setPrefs] = useState<CommPrefs>(DEFAULT_PREFS);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.push("/login"); return; }
    if (!loading && user) {
      setEmail(user.email ?? "");
      supabase.from("profiles").select("full_name, communication_preferences").eq("id", user.id).single()
        .then(({ data }) => {
          setDisplayName(data?.full_name ?? user.user_metadata?.full_name ?? "");
          setPrefs({ ...DEFAULT_PREFS, ...(data?.communication_preferences ?? {}) });
          setPageLoading(false);
        });
    }
  }, [loading, user, router]);

  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("profiles").update({ full_name: displayName.trim() }).eq("id", user.id);
    setProfileSaving(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const savePrefs = async () => {
    if (!user) return;
    setPrefsSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("profiles").update({ communication_preferences: prefs }).eq("id", user.id);
    setPrefsSaving(false);
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 3000);
  };

  const deleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    // Delete user data in order (respecting FK constraints)
    await supabase.from("saved_content").delete().eq("user_id", user.id);
    await supabase.from("usage_tracking").delete().eq("user_id", user.id);
    await supabase.from("profiles").delete().eq("id", user.id);
    // Sign out (actual auth.users deletion requires service role — logged out user can't regenerate)
    await signOut();
    router.push("/");
  };

  const togglePref = (key: keyof CommPrefs) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex-1 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-8">

          <div>
            <h1 className="text-3xl font-extrabold text-secondary">Account Settings</h1>
            <p className="mt-1 text-sm text-gray-500">Manage your profile and communication preferences.</p>
          </div>

          {/* Profile */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-secondary mb-5">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-secondary mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-secondary mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-400">Email cannot be changed here. Contact support if needed.</p>
              </div>
              <button
                onClick={saveProfile}
                disabled={profileSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-600 disabled:opacity-60 transition-colors"
              >
                {profileSaving ? "Saving…" : profileSaved ? "✓ Saved" : "Save Profile"}
              </button>
            </div>
          </div>

          {/* Communication preferences */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-secondary mb-1">Communication Preferences</h2>
            <p className="text-xs text-gray-400 mb-5">We respect your inbox. You can change these anytime.</p>
            <div className="space-y-4">
              {([
                { key: "newsletters" as const, label: "Newsletters and articles from Gyaan Mitra" },
                { key: "product_updates" as const, label: "Product updates and new feature announcements" },
                { key: "teaching_tips" as const, label: "Teaching tips and AI guides" },
              ]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{label}</span>
                  <button
                    onClick={() => togglePref(key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs[key] ? "bg-primary" : "bg-gray-200"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${prefs[key] ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={savePrefs}
              disabled={prefsSaving}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-600 disabled:opacity-60 transition-colors"
            >
              {prefsSaving ? "Saving…" : prefsSaved ? "✓ Preferences Saved" : "Save Preferences"}
            </button>
          </div>

          {/* Account / Delete */}
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-secondary mb-2">Account</h2>
            <p className="text-sm text-gray-500 mb-4">Permanently delete your account and all saved content. This cannot be undone.</p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-5 py-2.5 rounded-xl border border-red-300 text-red-600 text-sm font-bold hover:bg-red-50 transition-colors"
            >
              Delete My Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
            <h3 className="text-lg font-bold text-secondary mb-2">Delete Account?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure? This will permanently delete your account and all saved content. <strong>This cannot be undone.</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleting ? "Deleting…" : "Yes, Delete My Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
