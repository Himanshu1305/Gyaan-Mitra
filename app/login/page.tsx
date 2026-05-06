"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError(error === "Invalid login credentials"
        ? "Incorrect email or password. Please try again."
        : error);
      setLoading(false);
    } else {
      router.push("/dashboard");
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
          <p className="mt-2 text-sm text-gray-500">AI for Teachers across India</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-secondary mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 mb-6">Sign in to your free account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="text-right">
              <Link href="/forgot-password" className="text-xs text-primary hover:text-primary-600 font-medium transition-colors">
                Forgot password?
              </Link>
            </div>

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
                  Signing in…
                </>
              ) : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-primary hover:text-primary-600 transition-colors">
              Sign up free
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          By signing in, you agree to use Gyaan Mitra responsibly for educational purposes.
        </p>
      </div>
    </div>
  );
}
