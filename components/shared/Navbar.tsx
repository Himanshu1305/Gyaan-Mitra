"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Lesson Plans", href: "/lesson-plans" },
  { label: "Worksheets", href: "/worksheets" },
  { label: "Exam Papers", href: "/exam-papers" },
  { label: "Prompt Library", href: "/prompt-library" },
  { label: "About", href: "/about" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut, loading } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
  };

  const displayName = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string).split(" ")[0]
    : user?.email?.split("@")[0] ?? "";

  return (
    <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-secondary">Gyaan Mitra</span>
            <span className="hidden sm:inline-block text-xs font-medium text-primary bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-full">
              Beta
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-secondary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA + auth + mobile toggle */}
          <div className="flex items-center gap-3">
            {!loading && (
              <>
                {user ? (
                  <div className="hidden sm:flex items-center gap-3">
                    <Link
                      href="/dashboard"
                      className="text-sm font-medium text-gray-600 hover:text-secondary transition-colors"
                    >
                      Hi, {displayName}
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:text-secondary hover:border-secondary transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="hidden sm:flex items-center gap-2">
                    <Link
                      href="/login"
                      className="text-sm font-medium text-gray-600 hover:text-secondary transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/signup"
                      className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-600 transition-colors"
                    >
                      Get Started Free
                    </Link>
                  </div>
                )}
              </>
            )}

            {/* Hamburger */}
            <button
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-secondary"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block text-sm font-medium text-gray-700 hover:text-secondary"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="block text-sm font-medium text-secondary"
                onClick={() => setMenuOpen(false)}
              >
                Dashboard ({displayName})
              </Link>
              <button
                onClick={handleSignOut}
                className="block w-full text-left text-sm font-medium text-gray-600"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="block text-sm font-medium text-gray-700"
                onClick={() => setMenuOpen(false)}
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="block w-full text-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-600 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Get Started Free
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
