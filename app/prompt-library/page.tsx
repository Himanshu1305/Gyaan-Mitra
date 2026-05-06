"use client";

import { useMemo, useState } from "react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import { prompts, CATEGORIES, CATEGORY_STYLES } from "@/lib/prompts";

const TRUNCATE_AT = 160;
const SUBJECTS = ["All Subjects", "Mathematics", "Science", "Social Studies", "Hindi", "English", "Any"];

function PromptCard({ p }: { p: (typeof prompts)[0] }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(p.prompt);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const badges = (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${CATEGORY_STYLES[p.category] ?? "bg-gray-100 text-gray-600"}`}>
        {p.category}
      </span>
      {p.subject !== "Any" && (
        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-secondary-50 text-secondary-600 border border-secondary-100">
          {p.subject}
        </span>
      )}
    </div>
  );

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-primary-200 shadow-md p-5 flex flex-col gap-3">
        <h3 className="font-semibold text-secondary text-sm leading-snug">{p.title}</h3>
        {badges}
        <p className="text-xs text-gray-400">Fill in the <span className="font-semibold text-primary">[placeholders]</span> then copy.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition resize-none font-mono"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary-600 transition-colors"
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
          <button
            onClick={() => setText(p.prompt)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
          >
            Reset to original
          </button>
          <button
            onClick={() => setEditing(false)}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕ Close
          </button>
        </div>
      </div>
    );
  }

  const canTruncate = p.prompt.length > TRUNCATE_AT;
  const display = canTruncate ? p.prompt.slice(0, TRUNCATE_AT) + "…" : p.prompt;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md hover:border-primary-100 transition-all duration-200">
      <h3 className="font-semibold text-secondary text-sm leading-snug">{p.title}</h3>
      {badges}
      <p className="text-xs text-gray-600 leading-relaxed flex-1">{display}</p>
      <button
        onClick={() => setEditing(true)}
        className="mt-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary-600 transition-colors self-start"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit &amp; Copy
      </button>
    </div>
  );
}

export default function PromptLibraryPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeSubject, setActiveSubject] = useState<string>("All Subjects");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return prompts.filter((p) => {
      const matchCat = activeCategory === "All" || p.category === activeCategory;
      const matchSubject = activeSubject === "All Subjects" || p.subject === activeSubject;
      const matchSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q);
      return matchCat && matchSubject && matchSearch;
    });
  }, [search, activeCategory, activeSubject]);

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
            78 ready-to-use prompts from the book — edit the placeholders, then copy to any AI tool
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
              <strong>Tip:</strong> Click <strong>Edit &amp; Copy</strong> on any card to fill in the{" "}
              <span className="font-mono text-xs bg-primary-100 px-1.5 py-0.5 rounded">[placeholders]</span>{" "}
              before copying. Works with ChatGPT, Gemini, or any AI tool.
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
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
          <div className="flex flex-wrap gap-2 mb-3">
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
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeCategory === cat ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {countByCategory[cat] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Subject filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {SUBJECTS.map((sub) => (
              <button
                key={sub}
                onClick={() => setActiveSubject(sub)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
                  activeSubject === sub
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-primary hover:text-primary"
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          {/* Count */}
          <p className="text-xs text-gray-400 mb-5">
            Showing <span className="font-semibold text-secondary">{filtered.length}</span> of 78 prompts
            {activeCategory !== "All" && (
              <> in <span className="font-semibold text-secondary">{activeCategory}</span></>
            )}
            {activeSubject !== "All Subjects" && (
              <> · <span className="font-semibold text-secondary">{activeSubject}</span></>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <p className="text-gray-400 font-medium">No prompts found.</p>
              <button
                onClick={() => { setSearch(""); setActiveCategory("All"); setActiveSubject("All Subjects"); }}
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
