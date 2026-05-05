"use client";

import { useRef, useState } from "react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";

/* ─── Options ────────────────────────────────────────────────── */
const SUBJECTS = [
  "Mathematics",
  "Science",
  "Social Studies",
  "Hindi",
  "English",
  "EVS",
  "Other",
];
const GRADES = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);
const BOARDS = ["CBSE", "ICSE", "State Board"];
const DURATIONS = ["30 minutes", "40 minutes", "45 minutes", "60 minutes"];

/* ─── Inline markdown renderer ───────────────────────────────── */
function parseInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-secondary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="space-y-1 mb-2">
        {listBuffer.map((item, i) => (
          <li key={i} className="flex gap-2 text-gray-700 text-sm leading-relaxed">
            <span className="text-primary font-bold mt-0.5 flex-shrink-0">•</span>
            <span>{parseInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  lines.forEach((line, i) => {
    if (line.startsWith("## ")) {
      flushList();
      nodes.push(
        <h2
          key={i}
          className="text-lg font-bold text-secondary mt-7 mb-2 pb-1 border-b border-primary-100"
        >
          {parseInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      flushList();
      nodes.push(
        <h3 key={i} className="text-base font-semibold text-secondary mt-5 mb-1.5">
          {parseInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("#### ")) {
      flushList();
      nodes.push(
        <h4 key={i} className="text-sm font-semibold text-gray-700 mt-3 mb-1">
          {parseInline(line.slice(5))}
        </h4>
      );
    } else if (/^(\d+)\.\s/.test(line)) {
      flushList();
      const content = line.replace(/^\d+\.\s/, "");
      const num = (line.match(/^(\d+)/) || ["1"])[0];
      nodes.push(
        <div key={i} className="flex gap-2 text-gray-700 text-sm leading-relaxed mb-1">
          <span className="text-primary font-bold flex-shrink-0 w-5">{num}.</span>
          <span>{parseInline(content)}</span>
        </div>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuffer.push(line.slice(2));
    } else if (line.trim() === "") {
      flushList();
      nodes.push(<div key={i} className="h-1" />);
    } else {
      flushList();
      nodes.push(
        <p key={i} className="text-gray-700 text-sm leading-relaxed">
          {parseInline(line)}
        </p>
      );
    }
  });

  flushList();
  return <div>{nodes}</div>;
}

/* ─── Select field helper ────────────────────────────────────── */
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-secondary mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function LessonPlansPage() {
  const [form, setForm] = useState({
    subject: "Mathematics",
    grade: "Class 6",
    topic: "",
    board: "CBSE",
    duration: "45 minutes",
    additionalInstructions: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [topicError, setTopicError] = useState("");
  const [apiError, setApiError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  const set = (key: string) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  const handleGenerate = async () => {
    if (!form.topic.trim()) {
      setTopicError("Please enter a topic before generating.");
      return;
    }
    setTopicError("");
    setApiError("");
    setResult("");
    setLoading(true);

    try {
      const res = await fetch("/api/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Server error. Please try again.");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        if (chunk.startsWith("__STREAM_ERROR__")) {
          setApiError(chunk.replace("__STREAM_ERROR__", "").trim() || "Generation failed. Please try again.");
          setResult("");
          break;
        }

        setResult((prev) => prev + chunk);

        if (firstChunk && resultRef.current) {
          firstChunk = false;
          resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Something went wrong. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-white via-orange-50/40 to-blue-50/40">
      <Navbar />

      {/* ── Hero ── */}
      <section className="bg-secondary py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            AI Lesson Plan Generator
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Build a complete lesson plan{" "}
            <span className="text-primary">in seconds</span>
          </h1>
          <p className="mt-3 text-secondary-200 text-base">
            Fill in the details below and let Gyaan Mitra do the planning work for you.
          </p>
        </div>
      </section>

      {/* ── Form ── */}
      <section className="flex-1 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-secondary mb-6">Lesson Details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <SelectField
                label="Subject"
                value={form.subject}
                onChange={set("subject")}
                options={SUBJECTS}
              />
              <SelectField
                label="Grade"
                value={form.grade}
                onChange={set("grade")}
                options={GRADES}
              />

              {/* Topic — full width */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-secondary mb-1.5">
                  Topic <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="e.g. Fractions and Decimals, Photosynthesis, The Mughal Empire"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                />
                {topicError && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium">{topicError}</p>
                )}
              </div>

              <SelectField
                label="Board"
                value={form.board}
                onChange={set("board")}
                options={BOARDS}
              />
              <SelectField
                label="Duration"
                value={form.duration}
                onChange={set("duration")}
                options={DURATIONS}
              />

              {/* Additional instructions — full width */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-secondary mb-1.5">
                  Additional Instructions{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.additionalInstructions}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, additionalInstructions: e.target.value }))
                  }
                  rows={3}
                  placeholder="e.g. Include a group activity, focus on real-life examples, prepare for upcoming unit test, class has 40 students…"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="mt-6 w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary text-white font-bold text-base hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-md shadow-primary/25"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Generating your lesson plan…
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Lesson Plan
                </>
              )}
            </button>

            {/* API error banner */}
            {apiError && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2.5">
                <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
                <p className="text-sm text-red-700">{apiError}</p>
              </div>
            )}

            {/* Trust tags */}
            <div className="mt-5 flex flex-wrap gap-3 justify-center text-xs text-gray-400">
              {["No login required", "CBSE · ICSE · State Board", "Powered by Claude AI"].map(
                (tag) => (
                  <span key={tag} className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {tag}
                  </span>
                )
              )}
            </div>
          </div>

          {/* ── Loading skeleton ── */}
          {loading && !result && (
            <div className="mt-8 bg-white rounded-2xl border border-primary-100 shadow-sm p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <svg className="animate-spin w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-secondary text-sm">Building your lesson plan…</p>
                  <p className="text-xs text-gray-400 mt-0.5">This usually takes 10–20 seconds</p>
                </div>
              </div>
              <div className="space-y-3 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-2/5" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-4/5" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-5 bg-gray-100 rounded w-1/3 mt-5" />
                <div className="h-3 bg-gray-100 rounded w-3/5" />
                <div className="h-3 bg-gray-100 rounded w-4/5" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          )}

          {/* ── Result ── */}
          {result && (
            <div
              ref={resultRef}
              className="mt-8 bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden"
            >
              {/* Result header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-blue-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-secondary text-sm">Lesson Plan Generated</p>
                    <p className="text-xs text-gray-400">
                      {form.subject} · {form.grade} · {form.topic} · {form.board}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {loading && (
                    <span className="text-xs text-primary font-medium animate-pulse">
                      Streaming…
                    </span>
                  )}
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
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Rendered content */}
              <div className="px-6 sm:px-8 py-6">
                <MarkdownContent text={result} />
                {loading && (
                  <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 -mb-0.5" />
                )}
              </div>
            </div>
          )}

          {/* ── Try again / new plan nudge ── */}
          {result && !loading && (
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setResult("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="text-sm text-secondary hover:text-primary font-medium transition-colors"
              >
                ← Generate another lesson plan
              </button>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
