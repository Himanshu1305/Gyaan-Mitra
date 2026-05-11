"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import MarkdownContent from "@/components/ui/MarkdownContent";
import MicButton from "@/components/ui/MicButton";
import ChapterUpload, { UploadedFile } from "@/components/ui/ChapterUpload";
import ChapterSelector, { ChapterSelectorResult } from "@/components/shared/ChapterSelector";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { getUsageThisMonth, FREE_LIMIT } from "@/lib/usage";
import { getFriendlyError } from "@/lib/api-errors";

const SUBJECTS = ["Mathematics", "Science", "Social Studies", "Hindi", "English", "EVS", "Other"];
const GRADES = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);
const WORKSHEET_TYPES = ["Practice", "Revision", "Homework", "Activity", "Multi-level — Three Levels"];
const DIFFICULTIES = ["Easy", "Medium", "Mixed"];
const BOARDS = ["CBSE", "ICSE", "State Board"];
const LOADING_MSGS = ["Reading your inputs…", "Crafting your worksheet…", "Almost ready…", "Adding the finishing touches…"];

interface QuestionMix { mcq: number; shortTwo: number; shortThree: number; longFour: number; longFive: number; }

function cleanOutput(text: string): string {
  return text
    .replace(/&emsp;/g, "   ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function formatDateTitle(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
}

function trunc(s: string, max = 30): string {
  return s.length > max ? s.slice(0, max).trim() + "..." : s;
}

function parseWorksheetContent(raw: string): { worksheet: string; key: string } {
  const WS = "===WORKSHEET START===", WE = "===WORKSHEET END===";
  const KS = "===ANSWER KEY START===", KE = "===ANSWER KEY END===";
  const wsI = raw.indexOf(WS), weI = raw.indexOf(WE);
  const ksI = raw.indexOf(KS), keI = raw.indexOf(KE);
  if (wsI === -1 && ksI === -1) return { worksheet: raw, key: "" };
  const worksheet = wsI !== -1 ? (weI > wsI ? raw.slice(wsI + WS.length, weI) : raw.slice(wsI + WS.length)).trim() : raw;
  const key = ksI !== -1 ? (keI > ksI ? raw.slice(ksI + KS.length, keI) : raw.slice(ksI + KS.length)).trim() : "";
  return { worksheet, key };
}

function stripDelimiters(text: string): string {
  return text.replace(/===[A-Z][A-Z\s]*===\n?/g, "");
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[]; }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-secondary mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function QuestionMixInput({ mix, onChange }: { mix: QuestionMix; onChange: (m: QuestionMix) => void }) {
  const total = mix.mcq * 1 + mix.shortTwo * 2 + mix.shortThree * 3 + mix.longFour * 4 + mix.longFive * 5;
  const row = (label: string, marks: string, key: keyof QuestionMix, max: number, color: string) => (
    <div key={key} className="flex items-center gap-3">
      <div className="flex-1"><p className="text-sm font-medium text-gray-700">{label}</p><p className="text-xs text-gray-400">{marks}</p></div>
      <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{mix[key] * parseInt(marks)} marks</div>
      <input type="number" min={0} max={max} value={mix[key]}
        onChange={(e) => onChange({ ...mix, [key]: Math.max(0, Math.min(max, parseInt(e.target.value) || 0)) })}
        className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-center text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary transition" />
    </div>
  );
  return (
    <div className="sm:col-span-2">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-semibold text-secondary">Question Mix</label>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <span className="text-xs text-gray-400">Set any to 0 to exclude</span>
          <span className="text-sm font-bold text-secondary whitespace-nowrap">
            Total Marks: <span className="text-xl font-extrabold text-primary ml-1">{total}</span>
          </span>
        </div>
      </div>
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
        {row("MCQ", "1 mark each", "mcq", 50, "bg-blue-100 text-blue-700")}
        {row("Short Answer", "2 marks each", "shortTwo", 20, "bg-green-100 text-green-700")}
        {row("Short Answer", "3 marks each", "shortThree", 20, "bg-yellow-100 text-yellow-700")}
        {row("Long Answer", "4 marks each", "longFour", 10, "bg-orange-100 text-orange-700")}
        {row("Long Answer", "5 marks each", "longFive", 10, "bg-red-100 text-red-700")}
      </div>
    </div>
  );
}

function TabToggle({ mode, onChange }: { mode: "form" | "chapter" | "custom"; onChange: (m: "form" | "chapter" | "custom") => void }) {
  const labels: Record<string, string> = { form: "Fill Form", chapter: "Chapter Selector", custom: "My Own Prompt" };
  return (
    <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
      {(["form", "chapter", "custom"] as const).map((m) => (
        <button key={m} onClick={() => onChange(m)}
          className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${mode === m ? "bg-white text-secondary shadow-sm" : "text-gray-500 hover:text-secondary"}`}>
          {labels[m]}
        </button>
      ))}
    </div>
  );
}

export default function WorksheetsPage() {
  const { user, session } = useAuth();
  const [mode, setMode] = useState<"form" | "chapter" | "custom">("form");
  // Chapter selector state
  const [chapterResult, setChapterResult] = useState<ChapterSelectorResult | null>(null);
  const [chapterBoard, setChapterBoard] = useState("CBSE");
  const [chapterDraft, setChapterDraft] = useState("");
  const [chapterFinal, setChapterFinal] = useState("");
  const [chapterLoadingStep, setChapterLoadingStep] = useState("");
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState("");
  const [revisionInstructions, setRevisionInstructions] = useState("");
  const [chapterDraftReady, setChapterDraftReady] = useState(false);
  const [chapterFinalReady, setChapterFinalReady] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [form, setForm] = useState({
    subject: "Mathematics", grade: "Class 6", topic: "", worksheetType: "Practice",
    difficulty: "Medium", board: "CBSE", additionalInstructions: "",
  });
  const [questionMix, setQuestionMix] = useState<QuestionMix>({ mcq: 5, shortTwo: 3, shortThree: 2, longFour: 1, longFive: 1 });
  const [fileData, setFileData] = useState<UploadedFile | null>(null);
  const [outputLanguage, setOutputLanguage] = useState("auto");
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [worksheetContent, setWorksheetContent] = useState("");
  const [keyContent, setKeyContent] = useState("");
  const [activeTab, setActiveTab] = useState<"worksheet" | "key">("worksheet");
  const [copied, setCopied] = useState(false);
  const [pdfHint, setPdfHint] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveToast, setSaveToast] = useState("");
  const [topicError, setTopicError] = useState("");
  const [promptError, setPromptError] = useState("");
  const [apiError, setApiError] = useState("");
  const [usage, setUsage] = useState(0);
  const [usageLoading, setUsageLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const totalMarks = questionMix.mcq * 1 + questionMix.shortTwo * 2 + questionMix.shortThree * 3 + questionMix.longFour * 4 + questionMix.longFive * 5;
  const displayResult = stripDelimiters(result);

  useEffect(() => {
    if (user) {
      setUsageLoading(true);
      getUsageThisMonth(user.id).then((c) => { setUsage(c); setUsageLoading(false); });
    }
  }, [user]);

  const set = (key: string) => (v: string) => setForm((f) => ({ ...f, [key]: v }));
  const appendToField = (field: "topic" | "additionalInstructions") => (text: string) =>
    setForm((f) => ({ ...f, [field]: f[field] ? f[field] + " " + text : text }));
  const appendToCustom = (text: string) => setCustomPrompt((p) => p ? p + " " + text : text);

  const atLimit = user && usage >= FREE_LIMIT;

  useEffect(() => {
    if (!loading) return;
    let i = 0;
    setLoadingMsg(LOADING_MSGS[0]);
    const id = setInterval(() => { i = (i + 1) % LOADING_MSGS.length; setLoadingMsg(LOADING_MSGS[i]); }, 3000);
    return () => clearInterval(id);
  }, [loading]);

  const handleGenerate = async () => {
    if (mode === "form" && !form.topic.trim()) { setTopicError("Please enter a topic before generating."); return; }
    if (mode === "custom" && !customPrompt.trim()) { setPromptError("Please enter your prompt before generating."); return; }
    setTopicError(""); setPromptError(""); setApiError(""); setResult(""); setSaved(false); setSaveToast("");
    setWorksheetContent(""); setKeyContent("");
    setLoading(true);
    const token = session?.access_token;
    try {
      const res = await fetch("/api/worksheet", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mode, customPrompt, ...form, questionMix, fileData, outputLanguage }),
      });
      if (res.status === 429) {
        const text = await res.text();
        throw new Error(text || "Usage limit reached. Upgrade to Premium for unlimited access.");
      }
      if (!res.ok) throw new Error("Server error. Please try again.");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let firstChunk = true;
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk.startsWith("__STREAM_ERROR__")) { setApiError(getFriendlyError({ message: chunk.replace("__STREAM_ERROR__", "").trim() })); setResult(""); break; }
        fullText += cleanOutput(chunk);
        setResult(fullText);
        if (firstChunk && resultRef.current) { firstChunk = false; resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); }
      }
      if (fullText) {
        const parsed = parseWorksheetContent(fullText);
        setWorksheetContent(parsed.worksheet || fullText);
        setKeyContent(parsed.key);
        setActiveTab("worksheet");
      }
      if (user) getUsageThisMonth(user.id).then(setUsage);
    } catch (err: unknown) {
      setApiError(getFriendlyError(err));
    } finally { setLoading(false); }
  };

  const activeContent = !loading && keyContent ? (activeTab === "worksheet" ? worksheetContent : keyContent) : displayResult;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeContent);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = (showPdfHint = false) => {
    const tabLabel = activeTab === "worksheet" ? "Worksheet" : "Answer Key";
    const title = mode === "form"
      ? `${form.subject} Class ${form.grade.replace("Class ", "")} ${form.worksheetType} — ${tabLabel}`
      : `Worksheet — ${tabLabel}`;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const content = document.getElementById("result-content")?.innerHTML ?? activeContent;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.7;color:#000;padding:2cm}
      h1,h2{color:#1B3A6B;page-break-after:avoid}h2{font-size:14pt;margin-top:16pt;margin-bottom:6pt;border-bottom:1px solid #ccc;padding-bottom:3pt}
      h3{font-size:13pt;margin-top:12pt;margin-bottom:5pt;color:#333;page-break-after:avoid}p{margin-bottom:7pt}
      ul,ol{margin-left:20pt;margin-bottom:7pt}li{margin-bottom:3pt}strong{font-weight:bold}em{font-style:italic}hr{border:none;border-top:1px solid #ccc;margin:10pt 0}
      .gm-header{text-align:center;border-bottom:2px solid #FF9933;padding-bottom:10pt;margin-bottom:20pt}.gm-header p{font-size:11pt;color:#666}
      .gm-footer{text-align:center;border-top:1px solid #ccc;padding-top:10pt;margin-top:20pt;font-size:10pt;color:#888}
    </style></head><body>
      <div class="gm-header"><p>Generated by Gyaan Mitra — gyaanmitra.com</p></div>
      ${content}
      <div class="gm-footer">Generated by Gyaan Mitra — gyaanmitra.com</div>
    </body></html>`);
    win.document.close(); win.print();
    if (showPdfHint) { setPdfHint(true); setTimeout(() => setPdfHint(false), 8000); }
  };

  const handleSave = async () => {
    if (!user || !worksheetContent) return;
    const gradeNum = form.grade.replace("Class ", "");
    const dateStr = formatDateTitle(new Date());
    const topicTrunc = trunc(mode === "form" ? form.topic : "Custom", 30);
    const langSuffix = outputLanguage === "hindi" ? " (Hindi)" : outputLanguage === "hinglish" ? " (Hinglish)" : "";
    const baseTitle = mode === "form"
      ? `${form.subject} · Class ${gradeNum} · ${topicTrunc} · ${form.worksheetType} · ${dateStr}${langSuffix}`
      : `Custom Worksheet · ${dateStr}${langSuffix}`;

    const { data: wsData } = await supabase.from("saved_content").insert([{
      user_id: user.id, content_type: "worksheet",
      title: `${baseTitle} — Worksheet`,
      input_data: mode === "form" ? { ...form, questionMix } : { customPrompt },
      output_content: worksheetContent,
    }]).select("id").single();

    if (keyContent && wsData?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("saved_content").insert([{
        user_id: user.id, content_type: "answer-key",
        title: `${baseTitle} — Answer Key`,
        input_data: mode === "form" ? { ...form, questionMix } : { customPrompt },
        output_content: keyContent,
        linked_id: wsData.id,
      }]);
      setSaveToast("Worksheet and answer key saved to your dashboard");
    } else {
      setSaveToast("Worksheet saved to your dashboard");
    }
    setSaved(true);
    setTimeout(() => setSaveToast(""), 6000);
  };

  const handleChaptersSelected = (result: ChapterSelectorResult) => {
    setChapterResult(result);
    setChapterDraft(""); setChapterFinal("");
    setChapterDraftReady(false); setChapterFinalReady(false); setChapterError("");
  };

  const handleChapterGenerate = async () => {
    if (!chapterResult || chapterResult.chapters.length === 0) return;
    setChapterError(""); setChapterDraft(""); setChapterFinal("");
    setChapterDraftReady(false); setChapterFinalReady(false);
    setChapterLoading(true);
    try {
      setChapterLoadingStep("Loading chapter PDFs…");
      await new Promise((r) => setTimeout(r, 400));
      setChapterLoadingStep("Analysing with Gemini…");
      await new Promise((r) => setTimeout(r, 400));
      setChapterLoadingStep("Generating worksheet…");
      const res = await fetch("/api/generate-with-chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationType: "worksheet",
          chapterSelections: chapterResult.chapters,
          additionalInstructions: chapterResult.additionalInstructions,
          board: chapterBoard,
          classNumber: chapterResult.classNumber,
          subject: chapterResult.subject,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setChapterDraft(data.draft); setChapterDraftReady(true);
    } catch (err) { setChapterError(String(err)); }
    finally { setChapterLoading(false); setChapterLoadingStep(""); }
  };

  const handleChapterRevise = async () => {
    if (!revisionInstructions.trim() || !chapterResult) return;
    setChapterError(""); setChapterLoading(true); setChapterLoadingStep("Revising…");
    try {
      const res = await fetch("/api/generate-with-chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationType: "worksheet",
          chapterSelections: chapterResult.chapters,
          additionalInstructions: `REVISION: ${revisionInstructions}\nMake only the requested changes.\n\nOriginal:\n${chapterDraft}`,
          board: chapterBoard, classNumber: chapterResult.classNumber, subject: chapterResult.subject,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setChapterDraft(data.draft); setRevisionInstructions("");
    } catch (err) { setChapterError(String(err)); }
    finally { setChapterLoading(false); setChapterLoadingStep(""); }
  };

  const handleChapterFinalise = async () => {
    if (!chapterResult) return;
    setChapterError(""); setChapterLoading(true); setChapterLoadingStep("Finalising…");
    try {
      const res = await fetch("/api/generate-with-chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationType: "worksheet",
          chapterSelections: chapterResult.chapters,
          additionalInstructions: `Create the FINAL print-ready version of this worksheet:\n\n${chapterDraft}`,
          board: chapterBoard, classNumber: chapterResult.classNumber, subject: chapterResult.subject,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setChapterFinal(data.draft); setChapterFinalReady(true);
    } catch (err) { setChapterError(String(err)); }
    finally { setChapterLoading(false); setChapterLoadingStep(""); }
  };

  const chapterCopy = (t: string) => navigator.clipboard.writeText(t);
  const chapterDownload = (t: string, n: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([t], { type: "text/plain" }));
    a.download = n; a.click();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-white via-orange-50/40 to-blue-50/40">
      <Navbar />

      <section className="bg-secondary py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            AI Worksheet Creator
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Create a perfect worksheet <span className="text-primary">in seconds</span>
          </h1>
          <p className="mt-3 text-secondary-200 text-base">Fill the form or paste your own prompt — get a print-ready worksheet with answer key.</p>
        </div>
      </section>

      <section className="flex-1 py-10 px-4">
        <div className="max-w-3xl mx-auto">

          {/* Usage warning */}
          {user && !usageLoading && usage >= FREE_LIMIT - 1 && (
            <div className={`mb-6 rounded-xl px-4 py-3.5 flex items-start justify-between gap-3 ${usage >= FREE_LIMIT ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
              <p className={`text-sm font-medium ${usage >= FREE_LIMIT ? "text-red-700" : "text-amber-800"}`}>
                {usage >= FREE_LIMIT ? "You have used all 5 free generations this month." : `You have ${FREE_LIMIT - usage} free generation remaining this month.`}
                {" "}<Link href="/pricing" className="underline font-semibold">Upgrade to Premium</Link> for unlimited access.
              </p>
            </div>
          )}

          {!user && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <p className="text-sm text-blue-700">
                <Link href="/signup" className="font-semibold underline">Sign in</Link> to save your work and track your generations. Free account — no credit card needed.
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <TabToggle mode={mode} onChange={(m) => { setMode(m); setTopicError(""); setPromptError(""); setApiError(""); setChapterError(""); }} />

            {mode === "chapter" ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-secondary">Board:</span>
                  {["CBSE", "ICSE", "State Board"].map((b) => (
                    <button key={b} onClick={() => setChapterBoard(b)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium border-2 transition-all ${chapterBoard === b ? "bg-secondary text-white border-secondary" : "border-secondary text-secondary hover:bg-secondary hover:text-white"}`}>
                      {b}
                    </button>
                  ))}
                </div>
                <ChapterSelector onChaptersSelected={handleChaptersSelected} showMarks={true} />
                {chapterResult && chapterResult.chapters.length > 0 && !chapterDraftReady && (
                  <button onClick={handleChapterGenerate} disabled={chapterLoading}
                    className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-600 disabled:opacity-60 transition-colors shadow-md">
                    {chapterLoading ? chapterLoadingStep || "Working…" : "Generate Draft →"}
                  </button>
                )}
                {chapterLoading && (
                  <div className="flex items-center gap-3 py-2">
                    <svg className="animate-spin w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                    <span className="text-sm font-medium text-secondary">{chapterLoadingStep}</span>
                  </div>
                )}
                {chapterError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{chapterError}</div>}
                {chapterDraftReady && !chapterFinalReady && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-secondary">Draft Worksheet</h3>
                      <button onClick={() => chapterCopy(chapterDraft)} className="text-xs text-secondary border border-secondary px-3 py-1 rounded-lg hover:bg-secondary hover:text-white transition-colors">Copy</button>
                    </div>
                    <textarea value={chapterDraft} onChange={(e) => setChapterDraft(e.target.value)} rows={20}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-y" style={{ minHeight: 500 }} />
                    <div className="space-y-3 pt-3 border-t border-gray-100">
                      <p className="text-sm font-semibold text-secondary">Revision Instructions</p>
                      <textarea value={revisionInstructions} onChange={(e) => setRevisionInstructions(e.target.value)} rows={3}
                        placeholder="e.g. Make Q3 harder, add one more diagram question, remove Q7…"
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                      <div className="flex gap-3">
                        <button onClick={handleChapterRevise} disabled={chapterLoading || !revisionInstructions.trim()}
                          className="flex-1 py-2.5 rounded-xl border-2 border-secondary text-secondary font-semibold text-sm hover:bg-secondary hover:text-white disabled:opacity-50 transition-colors">
                          Revise Draft
                        </button>
                        <button onClick={handleChapterFinalise} disabled={chapterLoading}
                          className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-600 disabled:opacity-50 transition-colors shadow">
                          Finalise Worksheet →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {chapterFinalReady && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-secondary">Final Worksheet</h3>
                    <div className="flex gap-2 flex-wrap">
                      {[{ label: "Copy", action: () => chapterCopy(chapterFinal) }, { label: "Download", action: () => chapterDownload(chapterFinal, "worksheet.txt") }, { label: "Print", action: () => window.print() }].map(({ label, action }) => (
                        <button key={label} onClick={action} className="text-sm border border-gray-200 rounded-lg px-4 py-1.5 hover:bg-gray-50 transition-colors">{label}</button>
                      ))}
                      <button onClick={() => { setChapterDraftReady(false); setChapterFinalReady(false); setChapterDraft(""); setChapterFinal(""); setChapterResult(null); }}
                        className="text-sm bg-secondary text-white rounded-lg px-4 py-1.5 hover:bg-primary transition-colors">New Worksheet</button>
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 rounded-xl border border-gray-200 p-4 max-h-[600px] overflow-y-auto">{chapterFinal}</pre>
                  </div>
                )}
              </div>
            ) : mode === "form" ? (
              <>
                <h2 className="text-lg font-bold text-secondary mb-6">Worksheet Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Chapter upload at top */}
                  <div className="sm:col-span-2">
                    <ChapterUpload value={fileData} onChange={setFileData} />
                    <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                      💡 For best results — upload your textbook chapter. AI will base all content strictly on your uploaded material, giving you syllabus-accurate output.
                    </p>
                  </div>

                  <SelectField label="Subject"        value={form.subject}       onChange={set("subject")}       options={SUBJECTS} />
                  <SelectField label="Grade"          value={form.grade}         onChange={set("grade")}         options={GRADES} />

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-secondary mb-1.5">Topic <span className="text-primary">*</span></label>
                    <div className="flex gap-2">
                      <input type="text" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                        placeholder="e.g. Fractions, Photosynthesis, The Indian Constitution"
                        className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition" />
                      <MicButton onResult={appendToField("topic")} />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">Tap mic to speak instead of type.</p>
                    {topicError && <p className="mt-1 text-xs text-red-500 font-medium">{topicError}</p>}
                  </div>

                  <SelectField label="Worksheet Type" value={form.worksheetType} onChange={set("worksheetType")} options={WORKSHEET_TYPES} />
                  <SelectField label="Difficulty"     value={form.difficulty}    onChange={set("difficulty")}    options={DIFFICULTIES} />
                  <SelectField label="Board"          value={form.board}         onChange={set("board")}         options={BOARDS} />

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-secondary mb-1.5">Output Language</label>
                    <select value={outputLanguage} onChange={(e) => setOutputLanguage(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition">
                      <option value="auto">Auto (Hindi subject → Hindi output, others → English)</option>
                      <option value="english">English</option>
                      <option value="hindi">Hindi (हिंदी)</option>
                      <option value="hinglish">Hinglish (Hindi + English mix)</option>
                    </select>
                  </div>

                  <QuestionMixInput mix={questionMix} onChange={setQuestionMix} />

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-secondary mb-1.5">
                      Additional Instructions <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <div className="flex gap-2 items-start">
                      <textarea value={form.additionalInstructions} onChange={(e) => setForm((f) => ({ ...f, additionalInstructions: e.target.value }))}
                        rows={3} placeholder="e.g. Include diagram-based questions, focus on word problems…"
                        className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition resize-none" />
                      <MicButton onResult={appendToField("additionalInstructions")} />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">Tap mic to speak instead of type.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-secondary mb-2">Your Custom Prompt</h2>
                <p className="text-sm text-gray-500 mb-4">Write your own worksheet prompt. The AI will follow your instructions exactly.</p>
                <div className="mb-5 space-y-2">
                  <ChapterUpload value={fileData} onChange={setFileData} />
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                    💡 For best results — upload your textbook chapter. AI will base all content strictly on your uploaded material, giving you syllabus-accurate output.
                  </p>
                </div>
                <div className="flex gap-2 items-start mb-2">
                  <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} rows={8}
                    placeholder="e.g. Create a Science worksheet for Class 8 CBSE on 'Cell Structure'. Include 5 labelling diagrams, 3 short answer questions, and 2 true/false questions. Add an answer key at the end."
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition resize-none" />
                  <MicButton onResult={appendToCustom} />
                </div>
                <p className="text-xs text-gray-400 mb-2">Tap mic to speak your prompt.</p>
                {promptError && <p className="mb-3 text-xs text-red-500 font-medium">{promptError}</p>}
                <div className="mt-3">
                  <label className="block text-sm font-semibold text-secondary mb-1.5">Output Language</label>
                  <select value={outputLanguage} onChange={(e) => setOutputLanguage(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition">
                    <option value="auto">Auto (detect from subject)</option>
                    <option value="english">English</option>
                    <option value="hindi">Hindi (हिंदी)</option>
                    <option value="hinglish">Hinglish (Hindi + English mix)</option>
                  </select>
                </div>
              </>
            )}

            {mode !== "chapter" && <button onClick={handleGenerate} disabled={loading || !!atLimit}
              className="mt-6 w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary text-white font-bold text-base hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-md shadow-primary/25">
              {loading ? (
                <><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>Generating your worksheet…</>
              ) : atLimit ? "Upgrade to continue generating" : (
                <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Generate Worksheet</>
              )}
            </button>}

            {mode !== "chapter" && atLimit && (
              <div className="mt-3 text-center">
                <Link href="/pricing" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-600 transition-colors">
                  Upgrade Now — ₹499/year
                </Link>
              </div>
            )}

            {mode !== "chapter" && apiError && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2.5">
                <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                <div className="flex-1">
                  <p className="text-sm text-red-700">{apiError}</p>
                  <button onClick={() => { setApiError(""); handleGenerate(); }} className="mt-2 text-xs font-semibold text-red-600 hover:text-red-800 underline">Try Again</button>
                </div>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-3 justify-center text-xs text-gray-400">
              {["No login required", "CBSE · ICSE · State Board", "Includes answer key"].map((tag) => (
                <span key={tag} className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Loading skeleton */}
          {mode !== "chapter" && loading && !result && (
            <div className="mt-8 bg-white rounded-2xl border border-primary-100 shadow-sm p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <svg className="animate-spin w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                </div>
                <div>
                  <p className="font-semibold text-secondary text-sm">{loadingMsg}</p>
                  <p className="text-xs text-gray-400 mt-0.5">This usually takes 10–20 seconds</p>
                </div>
              </div>
              <div className="space-y-3 animate-pulse">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`h-3 bg-gray-100 rounded ${i % 3 === 0 ? "w-2/5" : i % 3 === 1 ? "w-full" : "w-4/5"}`} />
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {mode !== "chapter" && result && (
            <div ref={resultRef} className="mt-8 bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden" id="print-content">
              <div className="print-only-header">Generated by Gyaan Mitra — gyaanmitra.com</div>

              {/* Worksheet / Answer Key tabs */}
              {!loading && keyContent && (
                <div className="flex border-b border-gray-100">
                  <button onClick={() => setActiveTab("worksheet")}
                    className={`px-6 py-3.5 text-sm font-bold border-b-2 transition-colors -mb-px ${activeTab === "worksheet" ? "border-primary text-primary bg-primary-50/30" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                    📝 Worksheet
                  </button>
                  <button onClick={() => setActiveTab("key")}
                    className={`px-6 py-3.5 text-sm font-bold border-b-2 transition-colors -mb-px ${activeTab === "key" ? "border-secondary text-secondary bg-secondary/5" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                    🔑 Answer Key
                  </button>
                </div>
              )}

              {/* Action bar */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-blue-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                  </div>
                  <div>
                    <p className="font-bold text-secondary text-sm">Worksheet Generated</p>
                    <p className="text-xs text-gray-400">
                      {mode === "form" ? `${form.subject} · ${form.grade} · ${form.topic} · ${totalMarks} marks` : "Custom prompt"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {loading && <span className="text-xs text-primary font-medium animate-pulse">Streaming…</span>}
                  <button onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary-600 transition-colors">
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                  <button onClick={() => handlePrint(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:border-secondary hover:text-secondary transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print
                  </button>
                  <button onClick={() => handlePrint(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/40 text-primary text-xs font-semibold hover:bg-primary-50 hover:border-primary transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    PDF
                  </button>
                  {user ? (
                    <button onClick={handleSave} disabled={saved}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:border-secondary hover:text-secondary transition-colors disabled:opacity-60">
                      {saved ? "✓ Saved" : (
                        <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>Save</>
                      )}
                    </button>
                  ) : (
                    <Link href="/signup" className="text-xs text-primary font-medium hover:text-primary-600 transition-colors">Sign in to save</Link>
                  )}
                </div>
              </div>

              {/* PDF hint */}
              {pdfHint && (
                <div className="mx-6 mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                  <p className="text-xs text-blue-700">In the print dialog, choose <strong>&quot;Save as PDF&quot;</strong> as the destination to download as PDF.</p>
                </div>
              )}

              {/* Save toast */}
              {saveToast && (
                <div className="mx-6 mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  <p className="text-xs text-green-800 font-medium">{saveToast}</p>
                </div>
              )}

              {/* Content area */}
              <div className="px-6 sm:px-8 py-6" id="result-content">
                {!loading && keyContent ? (
                  activeTab === "worksheet" ? (
                    <MarkdownContent text={worksheetContent} />
                  ) : (
                    <MarkdownContent text={keyContent} />
                  )
                ) : (
                  <>
                    <MarkdownContent text={displayResult} />
                    {loading && <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 -mb-0.5" />}
                  </>
                )}
              </div>

              <div className="print-only-footer">Generated by Gyaan Mitra — gyaanmitra.com</div>
            </div>
          )}

          {mode !== "chapter" && result && !loading && (
            <div className="mt-4 text-center">
              <button onClick={() => { setResult(""); setSaved(false); setSaveToast(""); setWorksheetContent(""); setKeyContent(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="text-sm text-secondary hover:text-primary font-medium transition-colors">
                ← Generate another worksheet
              </button>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}
