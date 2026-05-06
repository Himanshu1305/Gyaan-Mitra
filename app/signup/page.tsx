"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);
    const { error } = await signUp(form.email.trim(), form.password, form.fullName.trim());
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      router.push("/dashboard?welcome=1");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-orange-50/40 to-blue-50/40 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-3xl font-extrabold text-secondary">Gyaan Mitra</span>
          </Link>
          <p className="mt-2 text-sm text-gray-500">Free account — no credit card needed</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-secondary mb-1">Create your free account</h1>
          <p className="text-sm text-gray-500 mb-6">5 free AI generations every month</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1.5">Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={set("fullName")}
                placeholder="e.g. Priya Sharma"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="Min. 6 characters"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                placeholder="Repeat your password"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-md shadow-primary/20"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Creating account…
                </>
              ) : "Create Free Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:text-primary-600 transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-6 bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 text-center">
          <p className="text-xs text-gray-600">
            <span className="font-semibold text-primary">Free forever:</span> Lesson Plans, Worksheets, Exam Papers, Prompt Library — 5 generations/month
          </p>
        </div>
      </div>
    </div>
  );
}
