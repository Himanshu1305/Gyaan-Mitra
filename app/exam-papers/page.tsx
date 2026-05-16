"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import ReactMarkdown from "react-markdown";
import MicButton from "@/components/ui/MicButton";
import ChapterUpload, { UploadedFile } from "@/components/ui/ChapterUpload";
import ChapterSelector, { ChapterSelectorResult } from "@/components/shared/ChapterSelector";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { getUsageThisMonth, FREE_LIMIT } from "@/lib/usage";
import { getFriendlyError } from "@/lib/api-errors";

const EXAM_TYPES = ["Unit Test", "Half-Yearly Exam", "Annual Exam", "Class Test"];
const DURATIONS = ["1 hour", "1.5 hours", "2 hours", "2.5 hours", "3 hours"];
const DIFFICULTIES = ["Standard", "Easy", "Challenging"];
const LOADING_MSGS = ["Reading your inputs…", "Crafting your exam paper…", "Almost ready…", "Adding the finishing touches…"];

const CHAPTER_PROGRESS_STEPS = [
  "📚 Fetching chapter PDFs from NCERT library...",
  "🔍 Analysing chapter content with Gemini AI...",
  "✍️ Generating exam paper with Claude AI...",
  "📋 Formatting and structuring the paper...",
  "⏳ Almost done — finalising your exam paper...",
];

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

function parseExamContent(raw: string): { question: string; key: string } {
  const QS = "===QUESTION PAPER START===";
  const QE = "===QUESTION PAPER END===";
  const KS = "===ANSWER KEY START===";
  const KE = "===ANSWER KEY END===";
  const qsI = raw.indexOf(QS), qeI = raw.indexOf(QE);
  const ksI = raw.indexOf(KS), keI = raw.indexOf(KE);
  if (qsI === -1 && ksI === -1) return { question: raw, key: "" };
  const question = qsI !== -1 ? (qeI > qsI ? raw.slice(qsI + QS.length, qeI) : raw.slice(qsI + QS.length)).trim() : raw;
  const key = ksI !== -1 ? (keI > ksI ? raw.slice(ksI + KS.length, keI) : raw.slice(ksI + KS.length)).trim() : "";
  return { question, key };
}

function stripDelimiters(text: string): string {
  return text.replace(/===[A-Z][A-Z\s]*===\n?/g, "");
}

function SelectField({ label, value, onChange, options, disabled }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean;
}) {
  return (
    <div>
      <label className={`block text-sm font-semibold mb-1.5 ${disabled ? "text-gray-400" : "text-secondary"}`}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition ${disabled ? "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed" : "border-gray-200 bg-white text-gray-800"}`}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TabToggle({ mode, onChange }: { mode: "chapter" | "custom"; onChange: (m: "chapter" | "custom") => void }) {
  return (
    <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
      {(["chapter", "custom"] as const).map((m) => (
        <button key={m} onClick={() => onChange(m)}
          className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${mode === m ? "bg-white text-secondary shadow-sm" : "text-gray-500 hover:text-secondary"}`}>
          {m === "chapter" ? "Chapter Selector" : "My Own Prompt"}
        </button>
      ))}
    </div>
  );
}

function ExamPaper({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        img({ src, alt }) {
          if (!src) return null;
          return (
            <figure className="my-4 flex flex-col items-center">
              <img
                src={src}
                alt={alt || "Diagram"}
                className="max-w-full h-auto border border-gray-200 rounded-lg shadow-sm"
                style={{ maxHeight: "400px", objectFit: "contain" }}
                loading="lazy"
              />
              {alt && !src.startsWith("data:") && (
                <figcaption className="mt-1 text-sm text-gray-500 italic text-center">
                  {alt}
                </figcaption>
              )}
            </figure>
          );
        },
        h1({ children }) { return <h1 className="text-2xl font-bold text-[#1B3A6B] border-b-2 border-[#FF9933] pb-2 mb-4">{children}</h1>; },
        h2({ children }) { return <h2 className="text-xl font-semibold text-[#1B3A6B] mt-6 mb-3">{children}</h2>; },
        h3({ children }) { return <h3 className="text-lg font-medium text-[#1B3A6B] mt-4 mb-2">{children}</h3>; },
        table({ children }) { return <div className="overflow-x-auto my-4"><table className="min-w-full border-collapse border border-gray-300 text-sm">{children}</table></div>; },
        th({ children }) { return <th className="border border-gray-300 bg-[#1B3A6B] text-white px-3 py-2 text-left">{children}</th>; },
        td({ children }) { return <td className="border border-gray-300 px-3 py-2">{children}</td>; },
        hr() { return <hr className="border-t-2 border-[#FF9933] my-6 opacity-40" />; },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function ExamPapersPage() {
  const { user, session, subscriptionTier } = useAuth();
  const isPremium = subscriptionTier === "premium";
  const [mode, setMode] = useState<"chapter" | "custom">("chapter");

  // Chapter selector mode state
  const [selectorKey, setSelectorKey] = useState(0);
  const [chapterPreviewMode, setChapterPreviewMode] = useState<"preview" | "raw">("preview");
  const [chapterResult, setChapterResult] = useState<ChapterSelectorResult | null>(null);
  const [chapterExamType, setChapterExamType] = useState("Unit Test");
  const [chapterDifficulty, setChapterDifficulty] = useState("Standard");
  const [chapterDuration, setChapterDuration] = useState("2 hours");
  const [chapterDraft, setChapterDraft] = useState("");
  const [chapterAnswerKey, setChapterAnswerKey] = useState("");
  const [chapterTab, setChapterTab] = useState<"paper" | "key">("paper");
  const [chapterLoadingStep, setChapterLoadingStep] = useState("");
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState("");
  const [revisionInstructions, setRevisionInstructions] = useState("");
  const [chapterDraftReady, setChapterDraftReady] = useState(false);
  const [chapterFinalReady, setChapterFinalReady] = useState(false);
  const [generationMode, setGenerationMode] = useState<"quick" | "accurate">("quick");
  const [internalChoiceEnabled, setInternalChoiceEnabled] = useState(false);
  const [internalChoiceSections, setInternalChoiceSections] = useState<string[]>(["C", "D"]);
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);
  const [loadingProgressStep, setLoadingProgressStep] = useState(0);
  const [ncertFiguresFound, setNcertFiguresFound] = useState(0);
  const [ncertFiguresMissed, setNcertFiguresMissed] = useState(0);
  const [svgsGenerated, setSvgsGenerated] = useState(0);

  // Custom prompt mode state
  const [customPrompt, setCustomPrompt] = useState("");
  const [fileData, setFileData] = useState<UploadedFile | null>(null);
  const [outputLanguage, setOutputLanguage] = useState("auto");
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [questionContent, setQuestionContent] = useState("");
  const [keyContent, setKeyContent] = useState("");
  const [activeTab, setActiveTab] = useState<"question" | "key">("question");
  const [copied, setCopied] = useState(false);
  const [pdfHint, setPdfHint] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveToast, setSaveToast] = useState("");
  const [promptError, setPromptError] = useState("");
  const [apiError, setApiError] = useState("");
  const [usage, setUsage] = useState(0);
  const [usageLoading, setUsageLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const displayResult = stripDelimiters(result);

  useEffect(() => {
    if (user) {
      setUsageLoading(true);
      getUsageThisMonth(user.id).then((c) => { setUsage(c); setUsageLoading(false); });
    }
  }, [user]);

  const appendToCustom = (text: string) => setCustomPrompt((p) => p ? p + " " + text : text);

  const atLimit = user && !isPremium && usage >= FREE_LIMIT;

  useEffect(() => {
    if (!loading) return;
    let i = 0;
    setLoadingMsg(LOADING_MSGS[0]);
    const id = setInterval(() => { i = (i + 1) % LOADING_MSGS.length; setLoadingMsg(LOADING_MSGS[i]); }, 3000);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!chapterLoading) { setLoadingProgressStep(0); return; }
    setLoadingProgressStep(0);
    let step = 0;
    const id = setInterval(() => {
      step = Math.min(step + 1, CHAPTER_PROGRESS_STEPS.length - 1);
      setLoadingProgressStep(step);
    }, 15000);
    return () => clearInterval(id);
  }, [chapterLoading]);

  const handleStartFresh = () => {
    setSelectorKey(k => k + 1);
    setChapterResult(null);
    setChapterDraft("");
    setChapterAnswerKey("");
    setChapterDraftReady(false);
    setChapterFinalReady(false);
    setChapterError("");
    setRevisionInstructions("");
    setChapterPreviewMode("preview");
    setDraftBannerDismissed(false);
    setInternalChoiceEnabled(false);
    setInternalChoiceSections(["C", "D"]);
    setNcertFiguresFound(0);
    setNcertFiguresMissed(0);
    setSvgsGenerated(0);
  };

  // Custom prompt generation (uses streaming exam-paper route)
  const handleGenerate = async () => {
    if (!customPrompt.trim()) { setPromptError("Please enter your prompt before generating."); return; }
    setPromptError(""); setApiError(""); setResult(""); setSaved(false); setSaveToast("");
    setQuestionContent(""); setKeyContent("");
    setLoading(true);
    const token = session?.access_token;
    try {
      const res = await fetch("/api/exam-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mode: "custom", customPrompt, fileData, outputLanguage }),
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
        const parsed = parseExamContent(fullText);
        setQuestionContent(parsed.question || fullText);
        setKeyContent(parsed.key);
        setActiveTab("question");
      }
      if (user) getUsageThisMonth(user.id).then(setUsage);
    } catch (err: unknown) {
      setApiError(getFriendlyError(err));
    } finally { setLoading(false); }
  };

  const activeContent = !loading && keyContent ? (activeTab === "question" ? questionContent : keyContent) : displayResult;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeContent);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = (showPdfHint = false) => {
    const tabLabel = activeTab === "question" ? "Question Paper" : "Answer Key";
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const content = document.getElementById("result-content")?.innerHTML ?? activeContent;
    win.document.write(`<!DOCTYPE html><html><head><title>Exam Paper — ${tabLabel}</title><style>
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
    if (!user || !questionContent) return;
    const dateStr = formatDateTitle(new Date());
    const baseTitle = `Custom Exam Paper · ${dateStr}`;
    const { data: qpData } = await supabase.from("saved_content").insert([{
      user_id: user.id, content_type: "question-paper",
      title: `${baseTitle} — Question Paper`,
      input_data: { customPrompt }, output_content: questionContent,
    }]).select("id").single();
    if (keyContent && qpData?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("saved_content").insert([{
        user_id: user.id, content_type: "answer-key",
        title: `${baseTitle} — Answer Key`,
        input_data: { customPrompt }, output_content: keyContent, linked_id: qpData.id,
      }]);
      setSaveToast("Question paper and answer key saved to your dashboard");
    } else {
      setSaveToast("Question paper saved to your dashboard");
    }
    setSaved(true);
    setTimeout(() => setSaveToast(""), 6000);
  };

  const handleChaptersSelected = (result: ChapterSelectorResult) => {
    const newIds = result.chapters.map(c => c.chapterId).sort().join(",");
    const prevIds = (chapterResult?.chapters || []).map(c => c.chapterId).sort().join(",");
    setChapterResult(result);
    if (newIds !== prevIds) {
      setChapterDraft(""); setChapterAnswerKey("");
      setChapterDraftReady(false); setChapterFinalReady(false);
    }
    setChapterError("");
  };

  const handleChapterGenerate = async () => {
    if (!chapterResult || chapterResult.chapters.length === 0) return;
    setChapterError(""); setChapterDraft(""); setChapterAnswerKey("");
    setChapterDraftReady(false); setChapterFinalReady(false);
    setChapterLoading(true);
    const token = session?.access_token;
    try {
      setChapterLoadingStep("Loading chapter PDFs…");
      await new Promise((r) => setTimeout(r, 300));
      setChapterLoadingStep("Analysing with Gemini…");
      await new Promise((r) => setTimeout(r, 300));
      setChapterLoadingStep("Generating exam paper…");
      const res = await fetch("/api/generate-with-chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          generationType: "exam-paper",
          chapterSelections: chapterResult.chapters,
          additionalInstructions: chapterResult.additionalInstructions,
          board: chapterResult.board,
          classNumber: chapterResult.classNumber,
          subject: chapterResult.subject,
          questionMix: chapterResult.questionMix,
          examType: chapterExamType,
          duration: chapterDuration,
          difficulty: chapterDifficulty,
          generationMode,
          internalChoice: { enabled: internalChoiceEnabled, sections: internalChoiceSections },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setChapterDraft(data.draft);
      setNcertFiguresFound(data.ncertFiguresFound ?? 0);
      setNcertFiguresMissed(data.ncertFiguresMissed ?? 0);
      setSvgsGenerated(data.svgsGenerated ?? 0);
      setChapterDraftReady(true);
      setChapterPreviewMode("preview");
      if (user) getUsageThisMonth(user.id).then(setUsage);
    } catch (err) {
      setChapterError(String(err));
    } finally { setChapterLoading(false); setChapterLoadingStep(""); }
  };

  const handleChapterRevise = async () => {
    if (!revisionInstructions.trim() || !chapterResult) return;
    setChapterError("");
    setChapterLoading(true);
    setChapterLoadingStep("Revising draft…");
    const token = session?.access_token;
    try {
      const res = await fetch("/api/generate-with-chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          generationType: "exam-paper",
          chapterSelections: chapterResult.chapters,
          additionalInstructions: `REVISION REQUEST: ${revisionInstructions}\n\nMake only the requested changes, keep everything else identical.\n\nOriginal draft:\n${chapterDraft}`,
          board: chapterResult.board,
          classNumber: chapterResult.classNumber,
          subject: chapterResult.subject,
          questionMix: chapterResult.questionMix,
          examType: chapterExamType,
          duration: chapterDuration,
          difficulty: chapterDifficulty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Revision failed");
      setChapterDraft(data.draft);
      setRevisionInstructions("");
    } catch (err) {
      setChapterError(String(err));
    } finally { setChapterLoading(false); setChapterLoadingStep(""); }
  };

  const handleChapterFinalise = async () => {
    if (!chapterResult) return;
    setChapterError("");
    setChapterLoading(true);
    setChapterLoadingStep("Cleaning paper & generating answer key…");
    const token = session?.access_token;
    try {
      const res = await fetch("/api/generate-with-chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          generationType: "exam-paper",
          chapterSelections: chapterResult.chapters,
          additionalInstructions: `FINALISE_AND_KEY:${chapterDraft}`,
          board: chapterResult.board,
          classNumber: chapterResult.classNumber,
          subject: chapterResult.subject,
          generationMode: "quick",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const raw = data.draft as string;
      const PAPER_START = "===CLEAN PAPER START===", PAPER_END = "===CLEAN PAPER END===";
      const KEY_START = "===ANSWER KEY START===", KEY_END = "===ANSWER KEY END===";
      const psi = raw.indexOf(PAPER_START), pei = raw.indexOf(PAPER_END);
      const ksi = raw.indexOf(KEY_START), kei = raw.indexOf(KEY_END);
      const cleanedPaper = psi !== -1 && pei > psi ? raw.slice(psi + PAPER_START.length, pei).trim() : "";
      const answerKey = ksi !== -1 && kei > ksi ? raw.slice(ksi + KEY_START.length, kei).trim() : "";
      if (cleanedPaper) setChapterDraft(cleanedPaper);
      setChapterAnswerKey(answerKey || raw);
      setChapterFinalReady(true);
      setChapterTab("paper");
    } catch (err) {
      setChapterError(String(err));
    } finally { setChapterLoading(false); setChapterLoadingStep(""); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-white via-orange-50/40 to-blue-50/40">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            position: fixed; left: 0; top: 0; width: 100%;
            font-family: 'Times New Roman', serif;
            font-size: 12pt; line-height: 1.6; color: black; background: white;
            padding: 2cm; max-height: none !important; overflow: visible !important;
          }
          .no-print { display: none !important; }
          h1 { font-size: 16pt; text-align: center; }
          h2 { font-size: 14pt; }
          h3 { font-size: 12pt; }
        }
      `}</style>
      <Navbar />

      <section className="bg-secondary py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            AI Exam Paper Generator
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Create a full exam paper <span className="text-primary">in seconds</span>
          </h1>
          <p className="mt-3 text-secondary-200 text-base">
            Unit tests, half-yearly and annual papers with answer key — ready to print.
          </p>
        </div>
      </section>

      <section className="flex-1 py-10 px-4">
        <div className="max-w-3xl mx-auto">

          {user && !isPremium && !usageLoading && usage >= FREE_LIMIT - 1 && (
            <div className={`mb-6 rounded-xl px-4 py-3.5 flex items-start justify-between gap-3 ${usage >= FREE_LIMIT ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
              <p className={`text-sm font-medium ${usage >= FREE_LIMIT ? "text-red-700" : "text-amber-800"}`}>
                {usage >= FREE_LIMIT ? "You have used all 5 free generations this month." : `You have ${FREE_LIMIT - usage} free generation remaining this month.`}
                {" "}<Link href="/pricing" className="underline font-semibold">Upgrade to Premium</Link> for unlimited access.
              </p>
            </div>
          )}
          {user && isPremium && (
            <div className="mb-6 rounded-xl px-4 py-3 bg-green-50 border border-green-200 flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">Premium Member</span>
              <p className="text-sm text-green-700 font-medium">Unlimited generations — enjoy unrestricted access.</p>
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
            <TabToggle mode={mode} onChange={(m) => { setMode(m); setPromptError(""); setApiError(""); setChapterError(""); }} />

            {mode === "chapter" ? (
              <div className="space-y-5">
                <ChapterSelector
                  key={selectorKey}
                  onChaptersSelected={handleChaptersSelected}
                  showMarks={true}
                  locked={chapterDraftReady || chapterFinalReady}
                />

                {/* Paper settings — shown once chapters are selected */}
                {chapterResult && chapterResult.chapters.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 rounded-xl border border-gray-200 p-4">
                    <SelectField label="Exam Type"   value={chapterExamType}    onChange={setChapterExamType}    options={EXAM_TYPES}    disabled={chapterDraftReady} />
                    <SelectField label="Duration"    value={chapterDuration}    onChange={setChapterDuration}    options={DURATIONS}     disabled={chapterDraftReady} />
                    <SelectField label="Difficulty"  value={chapterDifficulty}  onChange={setChapterDifficulty}  options={DIFFICULTIES}  disabled={chapterDraftReady} />
                    {/* Internal Choice toggle */}
                    <div className="col-span-1 sm:col-span-3 border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-secondary">Include Internal Choice (OR questions)?</label>
                        <button
                          onClick={() => setInternalChoiceEnabled(v => !v)}
                          disabled={chapterDraftReady}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${internalChoiceEnabled ? "bg-primary" : "bg-gray-300"} ${chapterDraftReady ? "opacity-50 cursor-not-allowed" : ""}`}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${internalChoiceEnabled ? "translate-x-4" : "translate-x-1"}`} />
                        </button>
                      </div>
                      {internalChoiceEnabled && (
                        <div className="mt-2.5">
                          <p className="text-xs text-gray-500 mb-2">CBSE standard: Internal choice in Section C and D only</p>
                          <div className="flex gap-3 flex-wrap">
                            {([["B", "Section B (2m)"], ["C", "Section C (3m)"], ["D", "Section D (4 & 5m)"]] as [string, string][]).map(([code, label]) => (
                              <label key={code} className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox"
                                  checked={internalChoiceSections.includes(code)}
                                  onChange={(e) => {
                                    if (e.target.checked) setInternalChoiceSections(prev => [...prev, code].sort());
                                    else setInternalChoiceSections(prev => prev.filter(s => s !== code));
                                  }}
                                  disabled={chapterDraftReady}
                                  className="w-3.5 h-3.5 accent-primary" />
                                <span className="text-xs text-gray-700">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Quick / Accurate toggle */}
                {chapterResult && chapterResult.chapters.length > 0 && !chapterDraftReady && (
                  <div>
                    <div className="flex bg-gray-100 rounded-xl p-1">
                      <button onClick={() => setGenerationMode("quick")}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${generationMode === "quick" ? "bg-white text-secondary shadow-sm" : "text-gray-500"}`}>
                        ⚡ Quick (30s)
                      </button>
                      <button onClick={() => setGenerationMode("accurate")}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${generationMode === "accurate" ? "bg-white text-secondary shadow-sm" : "text-gray-500"}`}>
                        🎯 Accurate (60–90s)
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {generationMode === "quick" ? "Uses AI knowledge of NCERT syllabus. Fast but may not match exact book wording." : "Reads actual NCERT PDFs. Slower but strictly based on book content."}
                    </p>
                  </div>
                )}

                {chapterResult && chapterResult.chapters.length > 0 && (
                  <button
                    onClick={() => {
                      if (chapterDraftReady) {
                        if (!window.confirm("This will replace your current draft. Continue?")) return;
                      }
                      handleChapterGenerate();
                    }}
                    disabled={chapterLoading || !!atLimit}
                    className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-600 disabled:opacity-60 transition-colors shadow-md">
                    {chapterLoading ? chapterLoadingStep || "Working…" : chapterDraftReady ? "Regenerate Draft" : "Generate Draft →"}
                  </button>
                )}

                {chapterLoading && (
                  <div className="space-y-3 py-2 px-1">
                    <div className="flex items-center gap-3">
                      <svg className="animate-spin w-5 h-5 text-[#FF9933] flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                      <span className="text-sm font-medium text-[#1B3A6B]">{CHAPTER_PROGRESS_STEPS[loadingProgressStep]}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#FF9933] h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(10 + (loadingProgressStep / (CHAPTER_PROGRESS_STEPS.length - 1)) * 85, 95)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400">
                      {generationMode === "accurate" ? "Estimated time: 60–90 seconds" : "Estimated time: 20–40 seconds"}
                      {loadingProgressStep >= CHAPTER_PROGRESS_STEPS.length - 1 && " — Taking longer than usual, please wait…"}
                    </p>
                  </div>
                )}

                {chapterError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{chapterError}</div>
                )}

                {/* Draft */}
                {chapterDraftReady && !chapterFinalReady && (
                  <div className="space-y-4">
                    {!draftBannerDismissed && (
                      <div className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <p className="text-xs text-amber-800">
                          📝 <strong>DRAFT</strong> — Chapter references shown for your review only. Final paper will not contain chapter names.
                        </p>
                        <button onClick={() => setDraftBannerDismissed(true)} className="text-amber-500 hover:text-amber-700 text-xs flex-shrink-0 no-print">✕</button>
                      </div>
                    )}
                    <button onClick={handleStartFresh}
                      className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      Start Fresh
                    </button>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-secondary">Draft Exam Paper</h3>
                      <div className="flex items-center gap-2">
                        <div className="flex bg-gray-100 rounded-lg p-0.5">
                          <button onClick={() => setChapterPreviewMode("preview")}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${chapterPreviewMode === "preview" ? "bg-white text-secondary shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                            Preview
                          </button>
                          <button onClick={() => setChapterPreviewMode("raw")}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${chapterPreviewMode === "raw" ? "bg-white text-secondary shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                            Edit Raw
                          </button>
                        </div>
                        <button onClick={() => navigator.clipboard.writeText(chapterDraft)}
                          className="text-xs text-secondary border border-secondary px-3 py-1 rounded-lg hover:bg-secondary hover:text-white transition-colors">
                          Copy
                        </button>
                      </div>
                    </div>
                    {chapterPreviewMode === "preview" ? (
                      <div id="print-area" className="paper-output border border-gray-200 rounded-xl p-5 bg-white overflow-y-auto" style={{ minHeight: 400, maxHeight: 600 }}>
                        <ExamPaper content={chapterDraft} />
                      </div>
                    ) : (
                      <textarea value={chapterDraft} onChange={(e) => setChapterDraft(e.target.value)} rows={20}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-y" style={{ minHeight: 500 }} />
                    )}
                    {(ncertFiguresFound > 0 || svgsGenerated > 0 || ncertFiguresMissed > 0) && (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {ncertFiguresFound > 0 && <span className="text-green-600">✅ {ncertFiguresFound} NCERT diagram{ncertFiguresFound > 1 ? "s" : ""} embedded</span>}
                        {svgsGenerated > 0 && <span className="text-blue-600">✅ {svgsGenerated} diagram{svgsGenerated > 1 ? "s" : ""} generated</span>}
                        {ncertFiguresMissed > 0 && <span className="text-amber-600">⚠️ {ncertFiguresMissed} placeholder{ncertFiguresMissed > 1 ? "s" : ""} not matched</span>}
                      </div>
                    )}
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
                          Finalise & Get Answer Key →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Final paper + answer key */}
                {chapterFinalReady && (
                  <div className="space-y-4">
                    <button onClick={handleStartFresh}
                      className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      Start Fresh
                    </button>
                    <div className="flex border-b border-gray-200">
                      {(["paper", "key"] as const).map((t) => (
                        <button key={t} onClick={() => setChapterTab(t)}
                          className={`px-5 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${chapterTab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                          {t === "paper" ? "📄 Exam Paper" : "🔑 Answer Key"}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap no-print">
                      {[
                        { label: "Copy", action: () => navigator.clipboard.writeText(chapterTab === "paper" ? chapterDraft : chapterAnswerKey) },
                        { label: "Save as PDF", action: () => window.print() },
                      ].map(({ label, action }) => (
                        <button key={label} onClick={action} className="text-sm border border-gray-200 rounded-lg px-4 py-1.5 hover:bg-gray-50 transition-colors">{label}</button>
                      ))}
                    </div>
                    <div id="print-area" className="paper-output border border-gray-200 rounded-xl p-5 bg-white overflow-y-auto" style={{ maxHeight: 600 }}>
                      <ExamPaper content={chapterTab === "paper" ? chapterDraft : chapterAnswerKey} />
                    </div>
                    {(ncertFiguresFound > 0 || svgsGenerated > 0 || ncertFiguresMissed > 0) && (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {ncertFiguresFound > 0 && <span className="text-green-600">✅ {ncertFiguresFound} NCERT diagram{ncertFiguresFound > 1 ? "s" : ""} embedded</span>}
                        {svgsGenerated > 0 && <span className="text-blue-600">✅ {svgsGenerated} diagram{svgsGenerated > 1 ? "s" : ""} generated</span>}
                        {ncertFiguresMissed > 0 && <span className="text-amber-600">⚠️ {ncertFiguresMissed} placeholder{ncertFiguresMissed > 1 ? "s" : ""} not matched</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-secondary mb-2">Your Custom Prompt</h2>
                <p className="text-sm text-gray-500 mb-4">Describe exactly the exam paper you need. The AI will follow your instructions exactly.</p>
                <div className="mb-5 space-y-2">
                  <ChapterUpload value={fileData} onChange={setFileData} />
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                    💡 For best results — upload your textbook chapter. AI will base all content strictly on your uploaded material, giving you syllabus-accurate output.
                  </p>
                </div>
                <div className="flex gap-2 items-start mb-2">
                  <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} rows={8}
                    placeholder="e.g. Create a 25-mark CBSE Class 8 Mathematics Unit Test on Rational Numbers and Practical Geometry. Include 5 MCQs (1 mark each), 3 short answer (2 marks each), 2 short answer (3 marks each), 1 long answer (5 marks). Include an answer key at the end."
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

            {mode === "custom" && (
              <button onClick={handleGenerate} disabled={loading || !!atLimit}
                className="mt-6 w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-primary text-white font-bold text-base hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-md shadow-primary/25">
                {loading ? (
                  <><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>Generating your exam paper…</>
                ) : atLimit ? "Upgrade to continue generating" : (
                  <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Generate Exam Paper</>
                )}
              </button>
            )}

            {mode === "custom" && atLimit && (
              <div className="mt-3 text-center">
                <Link href="/pricing" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-600 transition-colors">
                  Upgrade Now — ₹499/year
                </Link>
              </div>
            )}

            {mode === "custom" && apiError && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2.5">
                <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                <div className="flex-1">
                  <p className="text-sm text-red-700">{apiError}</p>
                  <button onClick={() => { setApiError(""); handleGenerate(); }} className="mt-2 text-xs font-semibold text-red-600 hover:text-red-800 underline">Try Again</button>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3 justify-center text-xs text-gray-400">
              {["No login required", "CBSE · ICSE · State Board", "Includes answer key & marking scheme"].map((tag) => (
                <span key={tag} className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Loading skeleton — custom mode only */}
          {mode === "custom" && loading && !result && (
            <div className="mt-8 bg-white rounded-2xl border border-primary-100 shadow-sm p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <svg className="animate-spin w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                </div>
                <div>
                  <p className="font-semibold text-secondary text-sm">{loadingMsg}</p>
                  <p className="text-xs text-gray-400 mt-0.5">This usually takes 15–25 seconds</p>
                </div>
              </div>
              <div className="space-y-3 animate-pulse">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className={`h-3 bg-gray-100 rounded ${i % 3 === 0 ? "w-2/5" : i % 3 === 1 ? "w-full" : "w-4/5"}`} />
                ))}
              </div>
            </div>
          )}

          {/* Result — custom mode only */}
          {mode === "custom" && result && (
            <div ref={resultRef} className="mt-8 bg-white rounded-2xl border border-primary-100 shadow-sm overflow-hidden" id="print-content">
              <div className="print-only-header">Generated by Gyaan Mitra — gyaanmitra.com</div>

              {!loading && keyContent && (
                <div className="flex border-b border-gray-100">
                  <button onClick={() => setActiveTab("question")}
                    className={`px-6 py-3.5 text-sm font-bold border-b-2 transition-colors -mb-px ${activeTab === "question" ? "border-primary text-primary bg-primary-50/30" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                    📄 Question Paper
                  </button>
                  <button onClick={() => setActiveTab("key")}
                    className={`px-6 py-3.5 text-sm font-bold border-b-2 transition-colors -mb-px ${activeTab === "key" ? "border-secondary text-secondary bg-secondary/5" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                    🔑 Answer Key
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-blue-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <div>
                    <p className="font-bold text-secondary text-sm">{loading ? "Generating…" : "Exam Paper Generated"}</p>
                    <p className="text-xs text-gray-400">Custom prompt</p>
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

              {pdfHint && (
                <div className="mx-6 mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                  <p className="text-xs text-blue-700">In the print dialog, choose <strong>&quot;Save as PDF&quot;</strong> as the destination to download as PDF.</p>
                </div>
              )}
              {saveToast && (
                <div className="mx-6 mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  <p className="text-xs text-green-800 font-medium">{saveToast}</p>
                </div>
              )}

              <div className="px-6 sm:px-8 py-6" id="result-content">
                {!loading && keyContent ? (
                  activeTab === "question" ? <ExamPaper content={questionContent} /> : <ExamPaper content={keyContent} />
                ) : (
                  <>
                    <ExamPaper content={displayResult} />
                    {loading && <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 -mb-0.5" />}
                  </>
                )}
              </div>

              <div className="print-only-footer">Generated by Gyaan Mitra — gyaanmitra.com</div>
            </div>
          )}

          {mode === "custom" && result && !loading && (
            <div className="mt-4 text-center">
              <button onClick={() => { setResult(""); setSaved(false); setSaveToast(""); setQuestionContent(""); setKeyContent(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="text-sm text-secondary hover:text-primary font-medium transition-colors">
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
