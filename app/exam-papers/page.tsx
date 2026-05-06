"use client";

import { useRef, useState } from "react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import MarkdownContent from "@/components/ui/MarkdownContent";
import MicButton from "@/components/ui/MicButton";
import FileUpload, { UploadedFile } from "@/components/ui/FileUpload";

/* ─── Options ───────────────────────────────────────────────── */
const SUBJECTS = ["Mathematics", "Science", "Social Studies", "Hindi", "English", "EVS", "Other"];
const GRADES = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);
const EXAM_TYPES = ["Unit Test", "Half-Yearly Exam", "Annual Exam", "Class Test"];
const BOARDS = ["CBSE", "ICSE", "State Board"];
const DURATIONS = ["1 hour", "1.5 hours", "2 hours", "2.5 hours", "3 hours"];

interface QuestionMix {
  mcq: number;
  shortTwo: number;
  shortThree: number;
  longFour: number;
  longFive: number;
}

/* ─── SelectField ───────────────────────────────────────────── */
function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-secondary mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/* ─── QuestionMixInput ──────────────────────────────────────── */
function QuestionMixInput({ mix, onChange }: { mix: QuestionMix; onChange: (m: QuestionMix) => void }) {
  const totalMarks = mix.mcq * 1 + mix.shortTwo * 2 + mix.shortThree * 3 + mix.longFour * 4 + mix.longFive * 5;

  const row = (label: string, marks: string, key: keyof QuestionMix, max: number, color: string) => (
    <div key={key} className="flex items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{marks}</p>
      </div>
      <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{mix[key] * parseInt(marks)} marks</div>
      <input
        type="number"
        min={0}
        max={max}
        value={mix[key]}
        onChange={(e) => onChange({ ...mix, [key]: Math.max(0, Math.min(max, parseInt(e.target.value) || 0)) })}
        className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary transition"
      />
    </div>
  );

  return (
    <div className="sm:col-span-2">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-semibold text-secondary">Question Mix</label>
        <span className="text-xs text-gray-400">Set any to 0 to exclude it</span>
      </div>
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
        {row("MCQ", "1 mark each", "mcq", 50, "bg-blue-100 text-blue-700")}
        {row("Short Answer", "2 marks each", "shortTwo", 20, "bg-green-100 text-green-700")}
        {row("Short Answer", "3 marks each", "shortThree", 20, "bg-yellow-100 text-yellow-700")}
        {row("Long Answer", "4 marks each", "longFour", 10, "bg-orange-100 text-orange-700")}
        {row("Long Answer", "5 marks each", "longFive", 10, "bg-red-100 text-red-700")}
        <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-secondary">Question Mix Total</span>
          <span className="text-lg font-extrabold text-primary">{totalMarks}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab toggle ─────────────────────────────────────────────── */
function TabToggle({ mode, onChange }: { mode: "form" | "custom"; onChange: (m: "form" | "custom") => void }) {
  return (
    <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
      {(["form", "custom"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
            mode === m ? "bg-white text-secondary shadow-sm" : "text-gray-500 hover:text-secondary"
          }`}
        >
          {m === "form" ? "Fill Form" : "Use My Own Prompt"}
        </button>
      ))}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function ExamPapersPage() {
  const [mode, setMode] = useState<"form" | "custom">("form");
  const [customPrompt, setCustomPrompt] = useState("");

  const [form, setForm] = useState({
    subject: "Mathematics",
    grade: "Class 8",
    examType: "Unit Test",
    board: "CBSE",
    chapters: "",
    totalMarks: 25,
    duration: "1 hour",
    additionalInstructions: "",
  });

  const [questionMix, setQuestionMix] = useState<QuestionMix>({
    mcq: 5,
    shortTwo: 3,
    shortThree: 2,
    longFour: 1,
    longFive: 0,
  });

  const [fileData, setFileData] = useState<UploadedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [chaptersError, setChaptersError] = useState("");
  const [promptError, setPromptError] = useState("");
  const [apiError, setApiError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  const set = (key: string) => (v: string | number) => setForm((f) => ({ ...f, [key]: v }));
  const appendToField = (field: "chapters" | "additionalInstructions") => (text: string) =>
    setForm((f) => ({ ...f, [field]: f[field] ? f[field] + " " + text : text }));
  const appendToCustom = (text: string) =>
    setCustomPrompt((p) => p ? p + " " + text : text);

  const handleGenerate = async () => {
    if (mode === "form" && !form.chapters.trim()) {
      setChaptersError("Please enter the chapters covered before generating.");
      return;
    }
    if (mode === "custom" && !customPrompt.trim()) {
      setPromptError("Please enter your prompt before generating.");
      return;
    }
    setChaptersError("");
    setPromptError("");
    setApiError("");
    setResult("");
    setLoading(true);

    try {
      const res = await fetch("/api/exam-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, customPrompt, ...form, questionMix, fileData }),
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
          setApiError(chunk.replace("__STREAM_ERROR__", "").trim() || "Generation failed.");
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
      setApiError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            AI Exam Paper Generator
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Create a full exam paper{" "}
            <span className="text-primary">in seconds</span>
          </h1>
          <p className="mt-3 text-secondary-200 text-base">
            Unit tests, half-yearly and annual papers with answer key — ready to print.
          </p>
        </div>
      </section>

      {/* ── Form ── */}
      <section className="flex-1 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <TabToggle mode={mode} onChange={(m) => { setMode(m); setChaptersError(""); setPromptError(""); setApiError(""); }} />

            {mode === "form" ? (
              <>
                <h2 className="text-lg font-bold text-secondary mb-6">Exam Paper Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <SelectField label="Subject"   value={form.subject}   onChange={set("subject")}   options={SUBJECTS} />
                  <SelectField label="Grade"     value={form.grade}     onChange={set("grade")}     options={GRADES} />
                  <SelectField label="Exam Type" value={form.examType}  onChange={set("examType")}  options={EXAM_TYPES} />
                  <SelectField label="Board"     value={form.board}     onChange={set("board")}     options={BOARDS} />

                  {/* Chapters Covered */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-secondary mb-1.5">
                      Chapters / Topics Covered <span className="text-primary">*</span>
                    </label>
                    <div className="flex gap-2 items-start">
                      <textarea
                        value={form.chapters}
                        onChange={(e) => setForm((f) => ({ ...f, chapters: e.target.value }))}
                        rows={3}
                        placeholder="e.g. Chapter 3: Rational Numbers, Chapter 4: Practical Geometry, Chapter 5: Data Handling"
                        className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition resize-none"
                      />
                      <MicButton onResult={appendToField("chapters")} />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">Tap mic to speak chapter names.</p>
                    {chaptersError && <p className="mt-1 text-xs text-red-500 font-medium">{chaptersError}</p>}
                  </div>

                  {/* Total Marks */}
                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-1.5">Total Marks</label>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={form.totalMarks}
                      onChange={(e) => setForm((f) => ({ ...f, totalMarks: Math.max(5, Math.min(100, parseInt(e.target.value) || 25)) }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary transition"
                    />
                  </div>

                  <SelectField label="Duration" value={form.duration} onChange={set("duration")} options={DURATIONS} />

                  {/* Question Mix */}
                  <QuestionMixInput mix={questionMix} onChange={setQuestionMix} />

                  {/* Additional Instructions */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-secondary mb-1.5">
                      Additional Instructions <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <div className="flex gap-2 items-start">
                      <textarea
                        value={form.additionalInstructions}
                        onChange={(e) => setForm((f) => ({ ...f, additionalInstructions: e.target.value }))}
                        rows={3}
                        placeholder="e.g. Include a map-based question, focus on Chapter 4, add internal choice in long answers…"
                        className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition resize-none"
                      />
                      <MicButton onResult={appendToField("additionalInstructions")} />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">Tap mic to speak instead of type.</p>
                  </div>

                  <FileUpload value={fileData} onChange={setFileData} />
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-secondary mb-2">Your Custom Prompt</h2>
                <p className="text-sm text-gray-500 mb-5">
                  Describe exactly the exam paper you need — subject, chapters, marks, question types. The AI will follow your instructions exactly.
                </p>
                <div className="flex gap-2 items-start mb-2">
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={10}
                    placeholder="e.g. Create a 25-mark CBSE Class 8 Mathematics Unit Test on Rational Numbers and Practical Geometry. Include 5 MCQs (1 mark each), 3 short answer questions (2 marks each), 2 short answer (3 marks each), and 1 long answer (5 marks). Include an answer key at the end."
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition resize-none"
                  />
                  <MicButton onResult={appendToCustom} />
                </div>
                <p className="text-xs text-gray-400 mb-5">Tap mic to speak your prompt.</p>
                {promptError && <p className="mb-3 text-xs text-red-500 font-medium">{promptError}</p>}
                <FileUpload value={fileData} onChange={setFileData} />
              </>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="mt-6 w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary text-white font-bold text-base hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-md shadow-primary/25"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Generating your exam paper…
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Exam Paper
                </>
              )}
            </button>

            {apiError && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2.5">
                <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700">{apiError}</p>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3 justify-center text-xs text-gray-400">
              {["No login required", "CBSE · ICSE · State Board", "Includes answer key & marking scheme"].map((tag) => (
                <span key={tag} className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {tag}
                </span>
              ))}
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
                  <p className="font-semibold text-secondary text-sm">Creating your exam paper…</p>
                  <p className="text-xs text-gray-400 mt-0.5">This usually takes 15–25 seconds</p>
                </div>
              </div>
              <div className="space-y-3 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-3/5" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-4/5" />
                <div className="h-5 bg-gray-100 rounded w-2/5 mt-4" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          )}

          {/* ── Result ── */}
          {result && (
            <div ref={resultRef} className="mt-8 bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-blue-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-secondary text-sm">Exam Paper Generated</p>
                    <p className="text-xs text-gray-400">
                      {mode === "form"
                        ? `${form.subject} · ${form.grade} · ${form.examType} · ${form.totalMarks} marks`
                        : "Custom prompt"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {loading && <span className="text-xs text-primary font-medium animate-pulse">Streaming…</span>}
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary-600 transition-colors"
                  >
                    {copied ? (
                      <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                    )}
                  </button>
                </div>
              </div>
              <div className="px-6 sm:px-8 py-6">
                <MarkdownContent text={result} />
                {loading && <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 -mb-0.5" />}
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="mt-4 text-center">
              <button
                onClick={() => { setResult(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="text-sm text-secondary hover:text-primary font-medium transition-colors"
              >
                ← Generate another exam paper
              </button>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
