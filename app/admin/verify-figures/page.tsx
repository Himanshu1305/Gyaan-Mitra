"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface NcertFigureRow {
  id: string;
  public_url: string;
  figure_caption: string | null;
  figure_number: string | null;
  description: string | null;
  diagram_type: string | null;
  keywords: string[] | null;
  class_number: number | null;
  subject: string | null;
  chapter_number: number | null;
  chapter_name: string | null;
  is_active: boolean | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

type ReviewStatus = "all" | "unreviewed" | "verified" | "rejected";

const DIAGRAM_TYPES = [
  "diagram",
  "biological_diagram",
  "chemical_structure",
  "circuit",
  "geometric_figure",
  "graph",
  "flowchart",
  "illustration",
  "other",
];

const SUBJECTS_BY_CLASS: Record<number, string[]> = {
  6: ["Science", "Mathematics", "Social Science", "English", "Hindi"],
  7: ["Science", "Mathematics", "Social Science", "English", "Hindi"],
  8: ["Science", "Mathematics", "Social Science", "English", "Hindi"],
  9: ["Science", "Mathematics", "Social Science", "English", "Hindi"],
  10: ["Science", "Mathematics", "Social Science", "English", "Hindi"],
  11: ["Physics", "Chemistry", "Biology", "Mathematics", "Computer Science", "Economics", "History", "Geography"],
  12: ["Physics", "Chemistry", "Biology", "Mathematics", "Computer Science", "Economics", "History", "Geography"],
};

export default function VerifyFiguresPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const token = session?.access_token ?? null;

  // Filter state
  const [selectedClass, setSelectedClass] = useState<number>(10);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus>("all");
  const [chapters, setChapters] = useState<Array<{ chapter_number: number; chapter_name: string | null }>>([]);

  // Images state
  const [images, setImages] = useState<NcertFigureRow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingImages, setLoadingImages] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Edit fields for current image
  const [editCaption, setEditCaption] = useState("");
  const [editDiagramType, setEditDiagramType] = useState("diagram");
  const [editKeywords, setEditKeywords] = useState("");
  const [editChapterNumber, setEditChapterNumber] = useState<number | "">("");
  const [editNotes, setEditNotes] = useState("");

  // Action state
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Stats
  const [stats, setStats] = useState({ total: 0, verified: 0, rejected: 0, remaining: 0 });
  const [reviewed, setReviewed] = useState(0);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (user.email !== "usdvisionai@gmail.com") { router.push("/"); return; }
  }, [authLoading, user, router]);

  // ── API helper ────────────────────────────────────────────────────────────

  async function adminGet(params: Record<string, string>): Promise<{ data: unknown; error: string | null }> {
    if (!token) return { data: null, error: "Not authenticated" };
    try {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/admin/figures?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
      return await res.json();
    } catch (err) {
      return { data: null, error: String(err) };
    }
  }

  async function adminPost(body: Record<string, unknown>): Promise<{ error: string | null }> {
    if (!token) return { error: "Not authenticated" };
    try {
      const res = await fetch("/api/admin/figures", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      return await res.json();
    } catch (err) {
      return { error: String(err) };
    }
  }

  // ── Chapter list ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedSubject || !token) { setChapters([]); setSelectedChapter(""); return; }
    (async () => {
      try {
        const result = await adminGet({
          type: "chapters",
          class: String(selectedClass),
          subject: selectedSubject,
        });
        if (!result.data) { setChapters([]); return; }
        const rows = result.data as Array<{ chapter_number: number; chapter_name: string | null }>;
        const seen = new Set<number>();
        const unique = rows.filter((r) => {
          if (seen.has(r.chapter_number)) return false;
          seen.add(r.chapter_number);
          return true;
        });
        setChapters(unique);
        setSelectedChapter("");
      } catch (err) {
        console.error("[verify-figures] chapters load exception:", err);
        setChapters([]);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedSubject, token]);

  // ── Populate edit fields ──────────────────────────────────────────────────

  function populateEditFields(img: NcertFigureRow) {
    setEditCaption(img.figure_caption || "");
    setEditDiagramType(img.diagram_type || "diagram");
    setEditKeywords(img.keywords ? img.keywords.join(", ") : "");
    setEditChapterNumber(img.chapter_number ?? "");
    setEditNotes(img.review_notes || "");
    setActionMsg("");
  }

  // ── Load images ───────────────────────────────────────────────────────────

  async function loadImages() {
    if (!token) { setLoadError("Not authenticated — please sign in."); return; }
    setLoadingImages(true);
    setLoadError("");
    setImages([]);
    setCurrentIndex(0);
    setActionMsg("");
    try {
      const filters = {
        type: "figures",
        class: String(selectedClass),
        subject: selectedSubject,
        chapter: selectedChapter,
        status: statusFilter,
      };
      console.log("[verify-figures] loadImages filters:", filters);
      const result = await adminGet(filters);
      console.log("[verify-figures] loadImages error field:", result.error);
      console.log("[verify-figures] loadImages rows returned:", Array.isArray(result.data) ? result.data.length : result.data);
      if (result.error) throw new Error(`API error: ${result.error}`);
      const rows = (result.data as NcertFigureRow[]) || [];
      setImages(rows);
      if (rows.length > 0) populateEditFields(rows[0]);
      await loadStats();
    } catch (err) {
      console.error("[verify-figures] loadImages exception:", err);
      setLoadError(String(err));
    } finally {
      setLoadingImages(false);
    }
  }

  // ── Load stats ────────────────────────────────────────────────────────────

  async function loadStats() {
    try {
      const result = await adminGet({
        type: "stats",
        class: String(selectedClass),
        subject: selectedSubject,
        chapter: selectedChapter,
      });
      if (result.error) {
        console.error("[verify-figures] loadStats error:", result.error);
        return;
      }
      const data = (result.data as Array<{ is_active: boolean | null; reviewed_at: string | null }>) || [];
      const total = data.length;
      const verifiedCount = data.filter((r) => r.is_active && r.reviewed_at).length;
      const rejectedCount = data.filter((r) => r.is_active === false).length;
      const reviewedCount = verifiedCount + rejectedCount;
      setStats({ total, verified: verifiedCount, rejected: rejectedCount, remaining: total - reviewedCount });
      setReviewed(reviewedCount);
    } catch (err) {
      console.error("[verify-figures] loadStats exception:", err);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  const currentImage = images[currentIndex] ?? null;

  function goNext() {
    if (currentIndex < images.length - 1) {
      setCurrentIndex((i) => i + 1);
      populateEditFields(images[currentIndex + 1]);
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      populateEditFields(images[currentIndex - 1]);
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleReject() {
    if (!currentImage || saving) return;
    setSaving(true);
    try {
      const result = await adminPost({ action: "reject", id: currentImage.id, review_notes: editNotes });
      if (result.error) throw new Error(result.error);
      setActionMsg("Rejected");
      setImages((prev) =>
        prev.map((img, i) =>
          i === currentIndex ? { ...img, is_active: false, reviewed_at: new Date().toISOString() } : img
        )
      );
      await loadStats();
      goNext();
    } catch (err) {
      setActionMsg("Error: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    goNext();
    setActionMsg("Skipped");
  }

  async function handleSaveEdits() {
    if (!currentImage || saving) return;
    setSaving(true);
    const keywords = editKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    try {
      const result = await adminPost({
        action: "save",
        id: currentImage.id,
        figure_caption: editCaption,
        diagram_type: editDiagramType,
        keywords,
        chapter_number: editChapterNumber || null,
        review_notes: editNotes,
      });
      if (result.error) throw new Error(result.error);
      setActionMsg("Saved ✓");
      setImages((prev) =>
        prev.map((img, i) =>
          i === currentIndex
            ? { ...img, figure_caption: editCaption, diagram_type: editDiagramType, keywords, chapter_number: editChapterNumber ? Number(editChapterNumber) : null }
            : img
        )
      );
    } catch (err) {
      setActionMsg("Error: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify() {
    if (!currentImage || saving) return;
    setSaving(true);
    const keywords = editKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    try {
      const result = await adminPost({
        action: "verify",
        id: currentImage.id,
        figure_caption: editCaption,
        diagram_type: editDiagramType,
        keywords,
        chapter_number: editChapterNumber || null,
        review_notes: editNotes,
        class_number: selectedClass,
        subject: selectedSubject || currentImage.subject,
        chapter_name: currentImage.chapter_name,
        public_url: currentImage.public_url,
      });
      if (result.error) throw new Error(result.error);
      setActionMsg("Verified ✓");
      setImages((prev) =>
        prev.map((img, i) =>
          i === currentIndex
            ? { ...img, is_active: true, reviewed_at: new Date().toISOString(), figure_caption: editCaption, diagram_type: editDiagramType, keywords }
            : img
        )
      );
      await loadStats();
      goNext();
    } catch (err) {
      setActionMsg("Error: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") { e.preventDefault(); handleSkip(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else if (e.key === "v" || e.key === "V") handleVerify();
      else if (e.key === "r" || e.key === "R") handleReject();
      else if (e.key === "s" || e.key === "S") handleSaveEdits();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, images, editCaption, editDiagramType, editKeywords, editChapterNumber, editNotes, saving]);

  // ── Render ────────────────────────────────────────────────────────────────

  const subjects = SUBJECTS_BY_CLASS[selectedClass] || [];
  const progressPct = stats.total > 0 ? Math.round((reviewed / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1B3A6B] text-white px-6 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">🖼️ NCERT Figure Verification</h1>
        <a href="/admin" className="text-sm text-blue-200 hover:text-white transition-colors">
          ← Back to Admin
        </a>
      </div>

      {/* Filters bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(Number(e.target.value));
                setSelectedSubject("");
                setSelectedChapter("");
              }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            >
              {[6, 7, 8, 9, 10, 11, 12].map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => { setSelectedSubject(e.target.value); setSelectedChapter(""); }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[140px] focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Chapter</label>
            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            >
              <option value="">All Chapters</option>
              {chapters.map((c) => (
                <option key={c.chapter_number} value={c.chapter_number}>
                  {c.chapter_number}. {c.chapter_name || `Chapter ${c.chapter_number}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReviewStatus)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            >
              <option value="all">All</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <button
            onClick={loadImages}
            disabled={loadingImages || !token}
            className="px-5 py-2 rounded-lg bg-[#1B3A6B] text-white text-sm font-semibold hover:bg-[#162d55] disabled:opacity-50 transition-colors"
          >
            {!token ? "Sign in to load" : loadingImages ? "Loading…" : "Load Images"}
          </button>

          {images.length > 0 && (
            <div className="ml-auto flex flex-col items-end gap-1">
              <span className="text-xs text-gray-500 font-medium">
                {reviewed} of {stats.total} reviewed
              </span>
              <div className="w-48 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {loadError && (
          <p className="mt-2 text-sm text-red-600 max-w-7xl mx-auto">{loadError}</p>
        )}
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6 items-start">
        {/* Review card */}
        <div className="flex-1 min-w-0">
          {images.length === 0 && !loadingImages && (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <p className="text-4xl mb-4">🖼️</p>
              <p className="text-gray-500 text-sm">
                Select filters above and click &ldquo;Load Images&rdquo; to begin reviewing
              </p>
            </div>
          )}

          {loadingImages && (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-gray-400">
              Loading images…
            </div>
          )}

          {currentImage && !loadingImages && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {/* Image counter header */}
              <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                  Image {currentIndex + 1} of {images.length}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    currentImage.reviewed_at && currentImage.is_active
                      ? "bg-green-100 text-green-700"
                      : currentImage.is_active === false
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {currentImage.reviewed_at && currentImage.is_active
                    ? "Verified"
                    : currentImage.is_active === false
                    ? "Rejected"
                    : "Unreviewed"}
                </span>
              </div>

              {/* Image preview */}
              <div className="flex justify-center items-center p-6 bg-gray-50 border-b border-gray-100" style={{ minHeight: 280 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentImage.public_url}
                  alt={editCaption || "NCERT Figure"}
                  className="rounded-lg shadow border border-gray-200 object-contain"
                  style={{ maxWidth: 600, maxHeight: 400 }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='120'%3E%3Crect width='300' height='120' fill='%23f3f4f6'/%3E%3Ctext x='150' y='65' text-anchor='middle' font-family='Arial' font-size='13' fill='%236b7280'%3EImage not found%3C/text%3E%3C/svg%3E";
                  }}
                />
              </div>

              {/* Editable fields */}
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
                      {DIAGRAM_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Chapter Number</label>
                    <input
                      type="number"
                      value={editChapterNumber}
                      onChange={(e) => setEditChapterNumber(e.target.value ? Number(e.target.value) : "")}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                      placeholder="e.g. 11"
                      min={1}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Keywords <span className="font-normal text-gray-400">(comma-separated)</span>
                    </label>
                    <input
                      type="text"
                      value={editKeywords}
                      onChange={(e) => setEditKeywords(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                      placeholder="e.g. human eye, cornea, retina, optic nerve"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Review Notes</label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] resize-none"
                      placeholder="Optional notes for this image…"
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    onClick={handleReject}
                    disabled={saving}
                    title="Reject (R)"
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    ❌ Reject
                  </button>
                  <button
                    onClick={handleSkip}
                    disabled={saving}
                    title="Skip / Next (→)"
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  >
                    ⏭️ Skip
                  </button>
                  <button
                    onClick={handleSaveEdits}
                    disabled={saving}
                    title="Save Edits (S)"
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    💾 Save Edits
                  </button>
                  <button
                    onClick={handleVerify}
                    disabled={saving}
                    title="Verify & Next (V)"
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    ✅ Verify &amp; Next
                  </button>

                  {saving && (
                    <span className="text-xs text-gray-400 self-center animate-pulse">Saving…</span>
                  )}
                  {actionMsg && !saving && (
                    <span
                      className={`text-sm font-semibold self-center ${
                        actionMsg.startsWith("Error") ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {actionMsg}
                    </span>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <button
                    onClick={goPrev}
                    disabled={currentIndex === 0 || saving}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={goNext}
                    disabled={currentIndex >= images.length - 1 || saving}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >
                    Next →
                  </button>
                  <span className="text-xs text-gray-400 ml-1 hidden sm:inline">
                    Shortcuts: <kbd className="bg-gray-100 px-1 rounded">V</kbd> Verify &nbsp;
                    <kbd className="bg-gray-100 px-1 rounded">R</kbd> Reject &nbsp;
                    <kbd className="bg-gray-100 px-1 rounded">S</kbd> Save &nbsp;
                    <kbd className="bg-gray-100 px-1 rounded">→</kbd> Next &nbsp;
                    <kbd className="bg-gray-100 px-1 rounded">←</kbd> Prev
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats sidebar */}
        {images.length > 0 && (
          <div className="w-56 flex-shrink-0 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 text-sm mb-3 pb-2 border-b border-gray-100">
                Stats
              </h3>
              <div className="space-y-2.5">
                {[
                  { label: "Total", value: stats.total, color: "text-gray-800" },
                  { label: "Verified", value: stats.verified, color: "text-green-600" },
                  { label: "Rejected", value: stats.rejected, color: "text-red-500" },
                  { label: "Remaining", value: stats.remaining, color: "text-amber-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className={`text-sm font-bold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 text-sm mb-2">Progress</h3>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5 text-center">{progressPct}% reviewed</p>
            </div>

            {currentImage && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <h3 className="font-semibold text-gray-700 text-sm mb-2 pb-2 border-b border-gray-100">
                  Current
                </h3>
                <div className="space-y-1.5">
                  {[
                    ["ID", currentImage.id.slice(0, 8) + "…"],
                    ["Fig #", currentImage.figure_number || "—"],
                    ["Class", String(currentImage.class_number ?? "—")],
                    ["Subject", currentImage.subject || "—"],
                    ["Added", currentImage.created_at ? new Date(currentImage.created_at).toLocaleDateString("en-IN") : "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">{k}</span>
                      <span className="text-xs text-gray-700 font-medium truncate text-right">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
