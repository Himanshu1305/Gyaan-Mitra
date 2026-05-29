"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// ── Constants ──────────────────────────────────────────────────────────────────

const DIAGRAM_TYPES = [
  "biological_diagram",
  "circuit_diagram",
  "chemical_structure",
  "geographical_map",
  "graph",
  "mathematical_diagram",
  "illustration",
  "flowchart",
  "other",
];

const SUBJECTS_BY_CLASS: Record<number, string[]> = {
  6:  ["Science", "Mathematics", "Social Science", "English", "Hindi"],
  7:  ["Science", "Mathematics", "Social Science", "English", "Hindi"],
  8:  ["Science", "Mathematics", "Social Science", "English", "Hindi"],
  9:  ["Science", "Mathematics", "Social Science", "English", "Hindi"],
  10: ["Science", "Mathematics", "Social Science", "English", "Hindi"],
  11: ["Physics", "Chemistry", "Biology", "Mathematics", "Computer Science", "Economics", "History", "Geography"],
  12: ["Physics", "Chemistry", "Biology", "Mathematics", "Computer Science", "Economics", "History", "Geography"],
};

// ── Types ──────────────────────────────────────────────────────────────────────

type Stage = "setup" | "extracting" | "reviewing" | "done";

interface ExtractedFigure {
  id: string;
  pageNum: number;
  figIdx: number;
  imageDataUrl: string;
  caption: string;
  keywords: string;
  diagramType: string;
  bbox: { x: number; y: number; w: number; h: number };
  width: number;
  height: number;
  status: "pending" | "approved" | "rejected" | "skipped";
}

interface DebugEntry {
  page: number;
  figureCount: number;
  error?: string;
  raw?: string;
}

// ── Filename parser ────────────────────────────────────────────────────────────

function parseFilename(name: string): { chapterNumber: number | ""; chapterName: string; bookCode: string } {
  const stem = name.replace(/\.pdf$/i, "");
  const bookMatch = stem.match(/_(Part|Book|Vol(?:ume)?)(\d+)_/i);
  const bookCode = bookMatch ? bookMatch[1].toLowerCase() + bookMatch[2] : "unknown";
  const chMatch = stem.match(/_Ch(\d+)_(.*)/i);
  if (!chMatch) return { chapterNumber: "", chapterName: "", bookCode };
  const chapterNumber = parseInt(chMatch[1], 10);
  const chapterName = chMatch[2].replace(/_/g, " ").replace(/\?$/, "").trim();
  return { chapterNumber, chapterName, bookCode };
}

// ── Canvas helpers (browser-only) ─────────────────────────────────────────────

async function renderPageToCanvas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  pageNum: number,
  scale = 2.0
): Promise<{ base64: string; canvas: HTMLCanvasElement }> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return { base64, canvas };
}

function cropFigureFromCanvas(
  source: HTMLCanvasElement,
  bbox: { x: number; y: number; w: number; h: number }
): { dataUrl: string; width: number; height: number } {
  const sw = source.width;
  const sh = source.height;
  const cx = Math.floor(bbox.x * sw);
  const cy = Math.floor(bbox.y * sh);
  const cw = Math.max(1, Math.floor(bbox.w * sw));
  const ch = Math.max(1, Math.floor(bbox.h * sh));

  const crop = document.createElement("canvas");
  crop.width = cw;
  crop.height = ch;
  const ctx = crop.getContext("2d")!;
  ctx.drawImage(source, cx, cy, cw, ch, 0, 0, cw, ch);
  return { dataUrl: crop.toDataURL("image/png"), width: cw, height: ch };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ExtractFiguresPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const token = session?.access_token ? String(session.access_token) : null;

  // pdfjs loaded dynamically (browser-only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfjsLib, setPdfjsLib] = useState<any>(null);

  // Stage
  const [stage, setStage] = useState<Stage>("setup");

  // Form state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [selectedClass, setSelectedClass] = useState<number>(10);
  const [subject, setSubject] = useState("");
  const [bookCode, setBookCode] = useState("unknown");
  const [chapterNumber, setChapterNumber] = useState<number | "">("");
  const [chapterName, setChapterName] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Extraction progress
  const [processingPage, setProcessingPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [extractingError, setExtractingError] = useState("");
  const extractAbortRef = useRef(false);

  // Figures
  const [figures, setFigures] = useState<ExtractedFigure[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Edit state
  const [editCaption, setEditCaption] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editDiagramType, setEditDiagramType] = useState("illustration");

  // Action state
  const [uploading, setUploading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Debug log — one entry per processed page
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);

  // ── Auth guard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (user.email !== "usdvisionai@gmail.com") { router.push("/"); return; }
  }, [authLoading, user, router]);

  // ── Load pdfjs dynamically ────────────────────────────────────────────────────
  useEffect(() => {
    import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc =
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`;
      setPdfjsLib(lib);
    }).catch(console.error);
  }, []);

  // ── API helper ────────────────────────────────────────────────────────────────
  async function adminPost(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!token) return { error: "Not authenticated" };
    try {
      const res = await fetch("/api/admin/extract-figures", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      return await res.json();
    } catch (err) {
      return { error: String(err) };
    }
  }

  // ── File handling ─────────────────────────────────────────────────────────────
  function applyFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) return;
    setPdfFile(file);
    const parsed = parseFilename(file.name);
    setChapterNumber(parsed.chapterNumber);
    setChapterName(parsed.chapterName);
    setBookCode(parsed.bookCode);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) applyFile(file);
  }

  // ── Edit fields sync ──────────────────────────────────────────────────────────
  function populateEditFields(fig: ExtractedFigure) {
    setEditCaption(fig.caption);
    setEditKeywords(fig.keywords);
    setEditDiagramType(fig.diagramType);
    setActionMsg("");
  }

  // ── Extraction ────────────────────────────────────────────────────────────────
  async function handleExtract() {
    if (!pdfjsLib || !pdfFile || !token) return;
    extractAbortRef.current = false;
    setStage("extracting");
    setExtractingError("");
    setFigures([]);
    setCurrentIdx(0);
    setDebugLog([]);

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages: number = pdf.numPages;
      setTotalPages(numPages);

      const allFigures: ExtractedFigure[] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (extractAbortRef.current) break;
        setProcessingPage(pageNum);

        try {
          const { base64, canvas } = await renderPageToCanvas(pdf, pageNum, 2.0);

          const result = await adminPost({
            action: "detect",
            pageImage: base64,
            pageNum,
            totalPages: numPages,
          });

          if (result.error) {
            const errMsg = result.stack
              ? `${result.error}\n${result.stack}`
              : String(result.error);
            console.warn(`Page ${pageNum} detection error:`, errMsg);
            setDebugLog(prev => [...prev, { page: pageNum, figureCount: 0, error: errMsg }]);
            continue;
          }

          const rawResponse = typeof result.rawResponse === "string" ? result.rawResponse : "";
          const pageFigures = result.figures as Array<{
            caption: string;
            keywords: string[];
            diagram_type: string;
            bbox: { x: number; y: number; w: number; h: number };
          }>;

          if (!Array.isArray(pageFigures)) {
            setDebugLog(prev => [...prev, { page: pageNum, figureCount: 0, error: "figures was not an array", raw: rawResponse }]);
            continue;
          }

          setDebugLog(prev => [...prev, { page: pageNum, figureCount: pageFigures.length, raw: rawResponse }]);

          for (let figIdx = 0; figIdx < pageFigures.length; figIdx++) {
            const fig = pageFigures[figIdx];
            const { dataUrl, width, height } = cropFigureFromCanvas(canvas, fig.bbox);
            allFigures.push({
              id: `${pageNum}-${figIdx}-${Date.now()}`,
              pageNum,
              figIdx,
              imageDataUrl: dataUrl,
              caption: fig.caption || "",
              keywords: Array.isArray(fig.keywords) ? fig.keywords.join(", ") : "",
              diagramType: fig.diagram_type || "illustration",
              bbox: fig.bbox,
              width,
              height,
              status: "pending",
            });
          }
        } catch (pageErr) {
          const errMsg = String(pageErr);
          console.error(`Page ${pageNum} error:`, pageErr);
          setDebugLog(prev => [...prev, { page: pageNum, figureCount: 0, error: errMsg }]);
        }
      }

      setFigures(allFigures);

      if (allFigures.length > 0) {
        setCurrentIdx(0);
        populateEditFields(allFigures[0]);
        setStage("reviewing");
      } else {
        setExtractingError("No figures were detected in this PDF.");
        setStage("done");
      }
    } catch (err) {
      setExtractingError(String(err));
      setStage("done");
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  const pendingFigures = figures.filter((f) => f.status === "pending");
  const approvedCount  = figures.filter((f) => f.status === "approved").length;
  const rejectedCount  = figures.filter((f) => f.status === "rejected").length;
  const currentFigure  = figures[currentIdx] ?? null;

  function goNext() {
    const nextIdx = figures.findIndex((f, i) => i > currentIdx && f.status === "pending");
    if (nextIdx !== -1) {
      setCurrentIdx(nextIdx);
      populateEditFields(figures[nextIdx]);
    } else {
      setStage("done");
    }
  }

  function goPrev() {
    for (let i = currentIdx - 1; i >= 0; i--) {
      if (figures[i].status === "pending") {
        setCurrentIdx(i);
        populateEditFields(figures[i]);
        return;
      }
    }
  }

  function updateStatus(idx: number, status: ExtractedFigure["status"]) {
    setFigures((prev) => prev.map((f, i) => (i === idx ? { ...f, status } : f)));
  }

  // ── Actions ───────────────────────────────────────────────────────────────────
  async function handleApprove() {
    if (!currentFigure || uploading) return;
    setUploading(true);
    setActionMsg("");
    try {
      const base64 = currentFigure.imageDataUrl.replace(/^data:image\/[^;]+;base64,/, "");
      const keywords = editKeywords.split(",").map((k) => k.trim()).filter(Boolean);
      const result = await adminPost({
        action: "upload",
        imageBase64: base64,
        classNumber: selectedClass,
        subject,
        bookCode,
        chapterNumber: Number(chapterNumber) || 1,
        chapterName,
        caption: editCaption,
        keywords,
        diagramType: editDiagramType,
        width: currentFigure.width,
        height: currentFigure.height,
      });
      if (result.error) throw new Error(String(result.error));
      setActionMsg("Approved ✓");
      updateStatus(currentIdx, "approved");
      goNext();
    } catch (err) {
      setActionMsg("Error: " + String(err));
    } finally {
      setUploading(false);
    }
  }

  function handleReject() {
    if (!currentFigure || uploading) return;
    updateStatus(currentIdx, "rejected");
    setActionMsg("Rejected");
    goNext();
  }

  function handleSkip() {
    if (!currentFigure) return;
    goNext();
    setActionMsg("Skipped");
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const subjects = SUBJECTS_BY_CLASS[selectedClass] || [];
  const progressPct = totalPages > 0 ? Math.round((processingPage / totalPages) * 100) : 0;
  const reviewProgressPct = figures.length > 0
    ? Math.round(((approvedCount + rejectedCount) / figures.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1B3A6B] text-white px-6 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">AI Figure Extractor</h1>
        <a href="/admin" className="text-sm text-blue-200 hover:text-white transition-colors">
          ← Back to Admin
        </a>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* ── SETUP STAGE ──────────────────────────────────────────────────── */}
        {stage === "setup" && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* PDF Upload */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed transition-colors p-10 text-center cursor-pointer
                ${isDragging ? "border-[#1B3A6B] bg-blue-50" : "border-gray-300 bg-white hover:border-gray-400"}`}
              onClick={() => document.getElementById("pdf-input")?.click()}
            >
              <input
                id="pdf-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileInput}
              />
              {pdfFile ? (
                <div>
                  <p className="text-2xl mb-2">📄</p>
                  <p className="font-semibold text-gray-800">{pdfFile.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {(pdfFile.size / 1024 / 1024).toFixed(1)} MB — click to change
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-4xl mb-3">📄</p>
                  <p className="font-semibold text-gray-700">Drop a PDF here or click to upload</p>
                  <p className="text-sm text-gray-400 mt-1">One chapter at a time</p>
                </div>
              )}
            </div>

            {/* Metadata form */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-semibold text-gray-700 text-sm">Chapter Metadata</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Class</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => { setSelectedClass(Number(e.target.value)); setSubject(""); }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                  >
                    {[6, 7, 8, 9, 10, 11, 12].map((c) => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                  >
                    <option value="">Select subject…</option>
                    {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Chapter Number</label>
                  <input
                    type="number"
                    value={chapterNumber}
                    onChange={(e) => setChapterNumber(e.target.value ? Number(e.target.value) : "")}
                    min={1}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                    placeholder="e.g. 1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Book Code</label>
                  <input
                    type="text"
                    value={bookCode}
                    onChange={(e) => setBookCode(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                    placeholder="unknown / part1 / part2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Chapter Name</label>
                  <input
                    type="text"
                    value={chapterName}
                    onChange={(e) => setChapterName(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                    placeholder="e.g. Chemical Reactions and Equations"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleExtract}
              disabled={!pdfFile || !subject || !chapterNumber || !token || !pdfjsLib}
              className="w-full py-3 rounded-xl bg-[#1B3A6B] text-white font-semibold text-sm
                hover:bg-[#162d55] disabled:opacity-50 transition-colors"
            >
              {!pdfjsLib ? "Loading PDF library…" :
               !token ? "Sign in to extract" :
               "Extract Figures with AI"}
            </button>
          </div>
        )}

        {/* ── EXTRACTING STAGE ─────────────────────────────────────────────── */}
        {stage === "extracting" && (
          <div className="max-w-xl mx-auto text-center space-y-6 py-16">
            <p className="text-5xl">🔍</p>
            <h2 className="text-xl font-bold text-gray-800">Extracting figures…</h2>
            <p className="text-sm text-gray-500">
              Analysing page {processingPage} of {totalPages} with Claude AI
            </p>
            {debugLog.length > 0 && (
              <p className="text-xs text-gray-400">
                {debugLog.reduce((s, e) => s + e.figureCount, 0)} figure(s) found so far
                {debugLog.filter(e => e.error).length > 0 && ` · ${debugLog.filter(e => e.error).length} page error(s)`}
              </p>
            )}
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-[#1B3A6B] h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">{progressPct}%</p>
            <button
              onClick={() => { extractAbortRef.current = true; }}
              className="text-xs text-red-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── REVIEWING STAGE ──────────────────────────────────────────────── */}
        {stage === "reviewing" && currentFigure && (
          <div className="flex gap-6 items-start">
            {/* Figure review card */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Counter header */}
                <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    Page {currentFigure.pageNum} · Figure {currentFigure.figIdx + 1}
                    <span className="ml-3 text-xs font-normal text-gray-400">
                      ({pendingFigures.length} pending)
                    </span>
                  </span>
                  <span className="text-xs text-gray-400">
                    {currentFigure.width} × {currentFigure.height} px
                  </span>
                </div>

                {/* Image preview */}
                <div
                  className="flex justify-center items-center p-6 bg-gray-50 border-b border-gray-100"
                  style={{ minHeight: 280 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentFigure.imageDataUrl}
                    alt={editCaption || "Extracted figure"}
                    className="rounded-lg shadow border border-gray-200 object-contain"
                    style={{ maxWidth: 600, maxHeight: 420 }}
                  />
                </div>

                {/* Edit fields */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Caption</label>
                      <input
                        type="text"
                        value={editCaption}
                        onChange={(e) => setEditCaption(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                        placeholder="Figure caption…"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Diagram Type</label>
                      <select
                        value={editDiagramType}
                        onChange={(e) => setEditDiagramType(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                      >
                        {DIAGRAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Keywords <span className="font-normal text-gray-400">(comma-separated)</span>
                      </label>
                      <input
                        type="text"
                        value={editKeywords}
                        onChange={(e) => setEditKeywords(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                        placeholder="e.g. human eye, cornea, retina"
                      />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      onClick={handleReject}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200
                        text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      ❌ Reject
                    </button>
                    <button
                      onClick={handleSkip}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200
                        text-gray-700 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
                    >
                      ⏭️ Skip
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-green-600 text-white
                        text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {uploading ? "Uploading…" : "✅ Approve & Upload"}
                    </button>

                    {actionMsg && !uploading && (
                      <span className={`text-sm font-semibold self-center ${
                        actionMsg.startsWith("Error") ? "text-red-600" : "text-green-600"
                      }`}>
                        {actionMsg}
                      </span>
                    )}
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    <button
                      onClick={goPrev}
                      disabled={uploading}
                      className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600
                        hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      ← Previous
                    </button>
                    <button
                      onClick={goNext}
                      disabled={uploading}
                      className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600
                        hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats sidebar */}
            <div className="w-52 flex-shrink-0 space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-gray-700 text-sm mb-3 pb-2 border-b border-gray-100">Stats</h3>
                <div className="space-y-2.5">
                  {[
                    { label: "Total",    value: figures.length,  color: "text-gray-800" },
                    { label: "Approved", value: approvedCount,   color: "text-green-600" },
                    { label: "Rejected", value: rejectedCount,   color: "text-red-500" },
                    { label: "Pending",  value: pendingFigures.length, color: "text-amber-600" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className={`text-sm font-bold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-gray-700 text-sm mb-2">Review Progress</h3>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${reviewProgressPct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5 text-center">{reviewProgressPct}% reviewed</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-gray-700 text-sm mb-2 pb-2 border-b border-gray-100">Chapter</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Class</span>
                    <span className="text-gray-700 font-medium">{selectedClass}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Subject</span>
                    <span className="text-gray-700 font-medium truncate ml-2 text-right">{subject}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Chapter</span>
                    <span className="text-gray-700 font-medium">{chapterNumber}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DONE STAGE ───────────────────────────────────────────────────── */}
        {stage === "done" && (
          <div className="max-w-2xl mx-auto py-12 space-y-6">
            <div className="text-center space-y-3">
              <p className="text-5xl">{extractingError ? "⚠️" : figures.length === 0 ? "🔍" : "🎉"}</p>
              <h2 className="text-xl font-bold text-gray-800">
                {extractingError ? "Extraction failed" : figures.length === 0 ? "No figures detected" : "Review complete!"}
              </h2>
              {extractingError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{extractingError}</p>
              )}
            </div>

            {figures.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                {[
                  { label: "Total extracted", value: figures.length },
                  { label: "Approved & uploaded", value: approvedCount },
                  { label: "Rejected", value: rejectedCount },
                  { label: "Skipped (pending)", value: pendingFigures.length },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-bold text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Debug log */}
            {debugLog.length > 0 && (
              <details className="bg-gray-900 rounded-xl overflow-hidden" open={figures.length === 0}>
                <summary className="px-4 py-3 text-sm font-semibold text-gray-300 cursor-pointer select-none hover:text-white">
                  Debug log — {debugLog.length} page(s) processed · {debugLog.reduce((s, e) => s + e.figureCount, 0)} figure(s) found · {debugLog.filter(e => e.error).length} error(s)
                </summary>
                <div className="px-4 pb-4 space-y-3 max-h-[480px] overflow-y-auto">
                  {debugLog.map((entry) => (
                    <div key={entry.page} className="border border-gray-700 rounded-lg p-3 text-xs">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="font-bold text-white">Page {entry.page}</span>
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${entry.error ? "bg-red-900 text-red-300" : entry.figureCount > 0 ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"}`}>
                          {entry.error ? `Error` : `${entry.figureCount} figure(s)`}
                        </span>
                      </div>
                      {entry.error && (
                        <p className="text-red-400 mb-1.5">{entry.error}</p>
                      )}
                      {entry.raw && (
                        <pre className="text-gray-400 whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto">
                          {entry.raw.slice(0, 600)}{entry.raw.length > 600 ? "…" : ""}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setStage("setup");
                  setPdfFile(null);
                  setFigures([]);
                  setExtractingError("");
                  setDebugLog([]);
                }}
                className="px-5 py-2.5 rounded-lg bg-[#1B3A6B] text-white text-sm font-semibold hover:bg-[#162d55] transition-colors"
              >
                Extract Another PDF
              </button>
              {figures.length > 0 && pendingFigures.length > 0 && (
                <button
                  onClick={() => {
                    const firstPending = figures.findIndex((f) => f.status === "pending");
                    if (firstPending !== -1) {
                      setCurrentIdx(firstPending);
                      populateEditFields(figures[firstPending]);
                      setStage("reviewing");
                    }
                  }}
                  className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Resume Review
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
