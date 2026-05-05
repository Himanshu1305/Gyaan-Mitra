"use client";

import { useMemo, useState } from "react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import { prompts, CATEGORIES, CATEGORY_STYLES } from "@/lib/prompts";

const TRUNCATE_AT = 160;

function PromptCard({ p }: { p: (typeof prompts)[0] }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const canTruncate = p.prompt.length > TRUNCATE_AT;
  const display = expanded || !canTruncate ? p.prompt : p.prompt.slice(0, TRUNCATE_AT) + "…";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(p.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md hover:border-primary-100 transition-all duration-200">
      <h3 className="font-semibold text-secondary text-sm leading-snug">{p.title}</h3>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
            CATEGORY_STYLES[p.category] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {p.category}
        </span>
        {p.subject !== "Any" && (
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-secondary-50 text-secondary-600 border border-secondary-100">
            {p.subject}
          </span>
        )}
      </div>

      <p className="text-xs text-gray-600 leading-relaxed flex-1">{display}</p>

      {canTruncate && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-primary font-medium self-start hover:text-primary-600 transition-colors"
        >
          {expanded ? "Show less ↑" : "Show more ↓"}
        </button>
      )}

      <button
        onClick={handleCopy}
        className="mt-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary-600 transition-colors self-start"
      >
        {copied ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Prompt
          </>
        )}
      </button>
    </div>
  );
}

export default function PromptLibraryPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return prompts.filter((p) => {
      const matchCat = activeCategory === "All" || p.category === activeCategory;
      const matchSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [search, activeCategory]);

  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = { All: prompts.length };
    prompts.forEach((p) => {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    });
    return counts;
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ── Hero ── */}
      <section className="bg-secondary py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Prompt Library
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Prompt Library
          </h1>
          <p className="mt-3 text-secondary-200 text-base max-w-2xl mx-auto">
            78 ready-to-use prompts from the book — copy, fill in the blanks, and send to any AI tool
          </p>
        </div>
      </section>

      {/* ── Main ── */}
      <section className="flex-1 bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">

          {/* Tip note */}
          <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 mb-6 flex items-start gap-2.5 text-sm text-gray-700">
            <span className="text-primary font-bold flex-shrink-0 mt-0.5">💡</span>
            <span>
              <strong>Tip:</strong> These prompts work best when you paste or upload your chapter content first.
              See the book for guidance.
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, subject, or keyword…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition shadow-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  activeCategory === cat
                    ? "bg-secondary text-white border-secondary shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-secondary hover:text-secondary"
                }`}
              >
                {cat}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    activeCategory === cat
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {countByCategory[cat] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Count */}
          <p className="text-xs text-gray-400 mb-5">
            Showing <span className="font-semibold text-secondary">{filtered.length}</span> of 78 prompts
            {activeCategory !== "All" && (
              <> in <span className="font-semibold text-secondary">{activeCategory}</span></>
            )}
            {search && (
              <> matching <span className="font-semibold text-secondary">&ldquo;{search}&rdquo;</span></>
            )}
          </p>

          {/* Grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((p) => (
                <PromptCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <svg className="w-12 h-12 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <p className="text-gray-400 font-medium">No prompts found.</p>
              <button
                onClick={() => { setSearch(""); setActiveCategory("All"); }}
                className="mt-3 text-sm text-primary hover:text-primary-600 font-medium"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
