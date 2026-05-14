"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

export type QuestionMix = {
  mcq: number;
  shortTwo: number;
  shortThree: number;
  longFour: number;
  longFive: number;
};

export type ChapterSelectionItem = {
  chapterId: number;
  chapterName: string;
  bookCode: string | null;
  bookDisplayName: string;
  filePath: string | null;
  questionMix: QuestionMix;
};

export type ChapterSelectorResult = {
  chapters: ChapterSelectionItem[];
  additionalInstructions: string;
  classNumber: number;
  subject: string;
  board: string;
  questionMix: QuestionMix; // aggregated total
};

type Props = {
  onChaptersSelected: (result: ChapterSelectorResult) => void;
  showMarks?: boolean;
  locked?: boolean;
};

type BookRow = { book_code: string | null; book_display_name: string };
type ChapterRow = {
  id: number;
  class_number: number;
  subject: string;
  book_code: string | null;
  book_display_name: string;
  chapter_number: number;
  chapter_name: string;
  file_path: string | null;
};

const BOARDS = ["CBSE", "ICSE", "State Board"];
const CLASSES = [6, 7, 8, 9, 10, 11, 12];
const ALL_BOOKS_SENTINEL = "__ALL__";
const EMPTY_MIX: QuestionMix = { mcq: 0, shortTwo: 0, shortThree: 0, longFour: 0, longFive: 0 };

const pill = "px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all";
const pillOn = "bg-[#FF9933] border-[#FF9933] text-white shadow-sm";
const pillOff = "bg-white border-[#1B3A6B] text-[#1B3A6B] hover:bg-[#FF9933] hover:border-[#FF9933] hover:text-white";
const pillDisabled = "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed";

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 text-[#FF9933]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

const MIX_COLS: { label: string; sub: string; key: keyof QuestionMix; max: number; multiplier: number; color: string }[] = [
  { label: "MCQ", sub: "1m", key: "mcq", max: 30, multiplier: 1, color: "bg-blue-100 text-blue-700" },
  { label: "Short", sub: "2m", key: "shortTwo", max: 20, multiplier: 2, color: "bg-green-100 text-green-700" },
  { label: "Short", sub: "3m", key: "shortThree", max: 20, multiplier: 3, color: "bg-yellow-100 text-yellow-700" },
  { label: "Long", sub: "4m", key: "longFour", max: 10, multiplier: 4, color: "bg-orange-100 text-orange-700" },
  { label: "Long", sub: "5m", key: "longFive", max: 10, multiplier: 5, color: "bg-red-100 text-red-700" },
];

export default function ChapterSelector({ onChaptersSelected, showMarks = true, locked = false }: Props) {
  const [board, setBoard] = useState("CBSE");
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [books, setBooks] = useState<BookRow[]>([]);
  const [selectedBookCodes, setSelectedBookCodes] = useState<string[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [chapterMix, setChapterMix] = useState<Record<number, QuestionMix>>({});
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [error, setError] = useState("");
  const [failedStep, setFailedStep] = useState<1 | 2 | 3 | null>(null);

  // Per-step retry counters — only re-triggers the affected effect
  const [retrySubjectCount, setRetrySubjectCount] = useState(0);
  const [retryBookCount, setRetryBookCount] = useState(0);
  const [retryChapterCount, setRetryChapterCount] = useState(0);

  // Query result cache — persists for the lifetime of this component instance
  const subjectCache = useRef<Map<number, string[]>>(new Map());
  const bookCache = useRef<Map<string, BookRow[]>>(new Map());
  const chapterCache = useRef<Map<string, ChapterRow[]>>(new Map());

  const handleRetry = useCallback(() => {
    setError("");
    if (failedStep === 1 && selectedClass != null) {
      subjectCache.current.delete(selectedClass);
      setRetrySubjectCount(c => c + 1);
    } else if (failedStep === 2 && selectedClass != null && selectedSubject != null) {
      bookCache.current.delete(`${selectedClass}-${selectedSubject}`);
      setRetryBookCount(c => c + 1);
    } else if (failedStep === 3 && selectedClass != null && selectedSubject != null) {
      chapterCache.current.delete(`${selectedClass}-${selectedSubject}-${selectedBookCodes.join(",")}`);
      setRetryChapterCount(c => c + 1);
    }
    setFailedStep(null);
  }, [failedStep, selectedClass, selectedSubject, selectedBookCodes]);

  // Step 1 — fetch subjects when class changes
  useEffect(() => {
    if (!selectedClass) return;
    setError("");
    setFailedStep(null);

    // Check cache first — avoids Supabase round-trip on re-visits
    const cached = subjectCache.current.get(selectedClass);
    if (cached) {
      setSubjects(cached);
      setSelectedSubject(null);
      setBooks([]);
      setSelectedBookCodes([]);
      setChapters([]);
      setChecked({});
      setChapterMix({});
      return;
    }

    setSubjects([]);
    setSelectedSubject(null);
    setBooks([]);
    setSelectedBookCodes([]);
    setChapters([]);
    setChecked({});
    setChapterMix({});
    setLoadingSubjects(true);

    supabase
      .from("ncert_chapters")
      .select("subject")
      .eq("class_number", selectedClass)
      .then(({ data, error: err }) => {
        setLoadingSubjects(false);
        if (err) {
          setError("Could not load subjects. " + err.message);
          setFailedStep(1);
          return;
        }
        if (!data || data.length === 0) {
          setError(`No subjects found for Class ${selectedClass}.`);
          setFailedStep(1);
          return;
        }
        const unique = Array.from(new Set((data as { subject: string }[]).map(r => r.subject))).sort();
        subjectCache.current.set(selectedClass, unique);
        setSubjects(unique);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, retrySubjectCount]);

  // Step 2 — fetch books when subject changes
  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;
    setError("");
    setFailedStep(null);
    setSelectedBookCodes([]);
    setChapters([]);
    setChecked({});
    setChapterMix({});

    const cacheKey = `${selectedClass}-${selectedSubject}`;
    const cached = bookCache.current.get(cacheKey);
    if (cached) {
      applyBookData(cached);
      return;
    }

    setBooks([]);
    setLoadingBooks(true);
    supabase
      .from("ncert_chapters")
      .select("book_code, book_display_name")
      .eq("class_number", selectedClass)
      .eq("subject", selectedSubject)
      .order("book_display_name")
      .then(({ data, error: err }) => {
        setLoadingBooks(false);
        if (err) {
          setError("Could not load books. " + err.message);
          setFailedStep(2);
          return;
        }
        if (!data || data.length === 0) return;
        const rows = data as BookRow[];
        bookCache.current.set(cacheKey, rows);
        applyBookData(rows);
      });

    function applyBookData(rows: BookRow[]) {
      const hasNullBookCodes = rows.some(r => r.book_code === null);
      if (hasNullBookCodes) {
        const seen = new Set<string>();
        const unique: BookRow[] = [];
        for (const row of rows) {
          if (!seen.has(row.book_display_name)) { seen.add(row.book_display_name); unique.push(row); }
        }
        setBooks(unique);
        setSelectedBookCodes([ALL_BOOKS_SENTINEL]);
      } else {
        const seen = new Set<string>();
        const unique: BookRow[] = [];
        for (const row of rows) {
          if (row.book_code && !seen.has(row.book_code)) { seen.add(row.book_code); unique.push(row); }
        }
        setBooks(unique);
        if (unique.length === 1) setSelectedBookCodes([unique[0].book_code!]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedSubject, retryBookCount]);

  // Step 3 — fetch chapters when book selection changes
  useEffect(() => {
    if (!selectedClass || !selectedSubject || selectedBookCodes.length === 0) {
      if (selectedBookCodes.length === 0 && books.length > 0) setChapters([]);
      return;
    }
    setError("");
    setFailedStep(null);

    const isAll = selectedBookCodes.includes(ALL_BOOKS_SENTINEL);
    const cacheKey = `${selectedClass}-${selectedSubject}-${selectedBookCodes.join(",")}`;

    const cached = chapterCache.current.get(cacheKey);
    if (cached) {
      // Restore selections for chapters present in cached set
      const prevChecked = { ...checked };
      const prevChapterMix = { ...chapterMix };
      setChapters(cached);
      const restoredChecked: Record<number, boolean> = {};
      const restoredMix: Record<number, QuestionMix> = {};
      for (const ch of cached) {
        if (prevChecked[ch.id]) restoredChecked[ch.id] = true;
        if (prevChapterMix[ch.id]) restoredMix[ch.id] = prevChapterMix[ch.id];
      }
      setChecked(restoredChecked);
      setChapterMix(restoredMix);
      return;
    }

    // Preserve selections before clearing
    const prevChecked = { ...checked };
    const prevChapterMix = { ...chapterMix };
    setChapters([]);
    setChecked({});
    setChapterMix({});
    setLoadingChapters(true);

    let query = supabase
      .from("ncert_chapters")
      .select("*")
      .eq("class_number", selectedClass)
      .eq("subject", selectedSubject)
      .order("chapter_number");

    if (!isAll) query = query.in("book_code", selectedBookCodes);

    query.then(({ data, error: err }) => {
      setLoadingChapters(false);
      if (err) {
        setError("Could not load chapters. " + err.message);
        setFailedStep(3);
        return;
      }
      if (!data || data.length === 0) {
        setError("No chapters found for the selected book(s).");
        setFailedStep(3);
        return;
      }
      const newChapters = data as ChapterRow[];
      chapterCache.current.set(cacheKey, newChapters);
      setChapters(newChapters);
      const restoredChecked: Record<number, boolean> = {};
      const restoredMix: Record<number, QuestionMix> = {};
      for (const ch of newChapters) {
        if (prevChecked[ch.id]) restoredChecked[ch.id] = true;
        if (prevChapterMix[ch.id]) restoredMix[ch.id] = prevChapterMix[ch.id];
      }
      setChecked(restoredChecked);
      setChapterMix(restoredMix);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedSubject, selectedBookCodes.join(","), retryChapterCount]);

  const toggleBook = (code: string) =>
    setSelectedBookCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );

  const toggleChapter = (id: number) => {
    if (locked) return;
    setChecked((prev) => {
      const isNowChecked = !prev[id];
      if (isNowChecked) {
        setChapterMix((m) => ({ ...m, [id]: m[id] ?? { ...EMPTY_MIX } }));
      }
      return { ...prev, [id]: isNowChecked };
    });
  };

  const toggleAll = (ids: number[], allChecked: boolean) => {
    if (locked) return;
    setChecked((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = !allChecked;
        if (!allChecked) {
          setChapterMix((m) => ({ ...m, [id]: m[id] ?? { ...EMPTY_MIX } }));
        }
      });
      return next;
    });
  };

  const updateChapterMix = (id: number, key: keyof QuestionMix, val: number) => {
    if (locked) return;
    setChapterMix((m) => ({
      ...m,
      [id]: { ...(m[id] ?? EMPTY_MIX), [key]: Math.max(0, val) },
    }));
  };

  const checkedChapters = chapters.filter((c) => checked[c.id]);

  const totalMix: QuestionMix = checkedChapters.reduce(
    (acc, c) => {
      const m = chapterMix[c.id] ?? EMPTY_MIX;
      return {
        mcq: acc.mcq + m.mcq,
        shortTwo: acc.shortTwo + m.shortTwo,
        shortThree: acc.shortThree + m.shortThree,
        longFour: acc.longFour + m.longFour,
        longFive: acc.longFive + m.longFive,
      };
    },
    { ...EMPTY_MIX }
  );

  const totalMarks =
    totalMix.mcq + totalMix.shortTwo * 2 + totalMix.shortThree * 3 +
    totalMix.longFour * 4 + totalMix.longFive * 5;

  const chapterMixKey = checkedChapters
    .map((c) => `${c.id}:${JSON.stringify(chapterMix[c.id] ?? {})}`)
    .join("|");

  const notifyParent = useCallback(() => {
    if (!selectedClass || !selectedSubject || checkedChapters.length === 0) return;
    const agg: QuestionMix = checkedChapters.reduce(
      (acc, c) => {
        const m = chapterMix[c.id] ?? EMPTY_MIX;
        return { mcq: acc.mcq + m.mcq, shortTwo: acc.shortTwo + m.shortTwo, shortThree: acc.shortThree + m.shortThree, longFour: acc.longFour + m.longFour, longFive: acc.longFive + m.longFive };
      },
      { ...EMPTY_MIX }
    );
    onChaptersSelected({
      chapters: checkedChapters.map((c) => ({
        chapterId: c.id,
        chapterName: c.chapter_name,
        bookCode: c.book_code,
        bookDisplayName: c.book_display_name,
        filePath: c.file_path,
        questionMix: chapterMix[c.id] ?? { ...EMPTY_MIX },
      })),
      additionalInstructions,
      classNumber: selectedClass,
      subject: selectedSubject,
      board,
      questionMix: agg,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedChapters.length, chapterMixKey, additionalInstructions, selectedClass, selectedSubject, board]);

  useEffect(() => { notifyParent(); }, [notifyParent]);

  const byBook = chapters.reduce<Record<string, ChapterRow[]>>((acc, ch) => {
    const key = ch.book_display_name ?? "Chapters";
    if (!acc[key]) acc[key] = [];
    acc[key].push(ch);
    return acc;
  }, {});

  const booksWithCodes = books.filter((b) => b.book_code !== null);
  const hasChapters = Object.keys(byBook).length > 0;
  const stepOffset = booksWithCodes.length > 1 ? 1 : 0;

  const inputCls = (extra = "") =>
    `w-full rounded-lg border border-gray-200 bg-white px-1 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#FF9933] transition ${locked ? "opacity-50 cursor-not-allowed" : ""} ${extra}`;

  return (
    <div className="space-y-6">
      {locked && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-amber-700 font-medium">Settings locked after generation — click <strong>Start Fresh</strong> above to make changes.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-2">
          <span>⚠️ {error}</span>
          <button
            onClick={handleRetry}
            className="text-xs font-semibold text-red-600 border border-red-300 rounded px-2 py-0.5 hover:bg-red-100 transition-colors flex-shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* Board */}
      <div>
        <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">
          Board {locked && <span className="ml-1 normal-case text-amber-600 font-normal">🔒 locked</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {BOARDS.map((b) => (
            <button key={b} onClick={() => !locked && setBoard(b)} disabled={locked}
              className={`${pill} ${locked ? pillDisabled : board === b ? pillOn : pillOff}`}>
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Class */}
      <div>
        <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">
          Step 1 — Select Class {locked && <span className="ml-1 normal-case text-amber-600 font-normal">🔒 locked</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {CLASSES.map((cls) => (
            <button key={cls} onClick={() => !locked && setSelectedClass(cls)} disabled={locked}
              className={`${pill} ${locked ? (selectedClass === cls ? pillOn + " opacity-60 cursor-not-allowed" : pillDisabled) : selectedClass === cls ? pillOn : pillOff}`}>
              Class {cls}
            </button>
          ))}
        </div>
      </div>

      {loadingSubjects && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> <span>Loading subjects…</span>
        </div>
      )}

      {/* Subject */}
      {subjects.length > 0 && (
        <div>
          <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">
            Step 2 — Select Subject {locked && <span className="ml-1 normal-case text-amber-600 font-normal">🔒 locked</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {subjects.map((sub) => (
              <button key={sub} onClick={() => !locked && setSelectedSubject(sub)} disabled={locked}
                className={`${pill} ${locked ? (selectedSubject === sub ? pillOn + " opacity-60 cursor-not-allowed" : pillDisabled) : selectedSubject === sub ? pillOn : pillOff}`}>
                {sub}
              </button>
            ))}
          </div>
        </div>
      )}

      {loadingBooks && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> <span>Loading books…</span>
        </div>
      )}

      {/* Books (only when multiple real book_codes) */}
      {booksWithCodes.length > 1 && (
        <div>
          <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">Step 3 — Select Books</p>
          <div className="flex flex-wrap gap-3">
            {booksWithCodes.map((book) => (
              <label key={book.book_code} className={`flex items-center gap-2 cursor-pointer select-none ${locked ? "opacity-50 pointer-events-none" : ""}`}>
                <input type="checkbox" checked={selectedBookCodes.includes(book.book_code!)}
                  onChange={() => toggleBook(book.book_code!)} disabled={locked}
                  className="w-4 h-4 accent-[#FF9933]" />
                <span className="text-sm text-[#1B3A6B] font-medium">{book.book_display_name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {loadingChapters && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> <span>Loading chapters…</span>
        </div>
      )}

      {/* Chapters */}
      {hasChapters && (
        <div>
          <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-3">
            Step {2 + stepOffset} — Select Chapters{" "}
            <span className="text-gray-400 normal-case font-normal">(check to include)</span>
            {locked && <span className="ml-1 normal-case text-amber-600 font-normal">🔒 locked</span>}
          </p>
          <div className="space-y-4">
            {Object.entries(byBook).map(([bookName, bookChapters]) => {
              const ids = bookChapters.map((c) => c.id);
              const allChecked = ids.every((id) => checked[id]);
              return (
                <div key={bookName}>
                  {Object.keys(byBook).length > 1 && (
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-bold text-[#FF9933] uppercase tracking-wide">{bookName}</p>
                      {!locked && (
                        <button onClick={() => toggleAll(ids, allChecked)}
                          className="text-xs text-[#1B3A6B] underline hover:text-[#FF9933]">
                          {allChecked ? "Deselect all" : "Select all"}
                        </button>
                      )}
                    </div>
                  )}
                  {Object.keys(byBook).length === 1 && !locked && (
                    <div className="flex justify-end mb-2">
                      <button onClick={() => toggleAll(ids, allChecked)}
                        className="text-xs text-[#1B3A6B] underline hover:text-[#FF9933]">
                        {allChecked ? "Deselect all" : "Select all"}
                      </button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {bookChapters.map((ch) => {
                      const isChecked = !!checked[ch.id];
                      const mix = chapterMix[ch.id] ?? EMPTY_MIX;
                      return (
                        <div key={ch.id}
                          className={`rounded-xl border p-3 transition-all ${isChecked ? "border-[#FF9933] bg-orange-50" : "border-gray-200 bg-white hover:border-[#1B3A6B]"} ${locked ? "opacity-70" : ""}`}>
                          <div className="flex items-start gap-3">
                            <input type="checkbox" checked={isChecked} onChange={() => toggleChapter(ch.id)}
                              disabled={locked}
                              className="mt-0.5 w-4 h-4 accent-[#FF9933] flex-shrink-0 cursor-pointer" />
                            <span className={`flex-1 text-sm font-medium text-[#1B3A6B] ${locked ? "" : "cursor-pointer"}`}
                              onClick={() => toggleChapter(ch.id)}>
                              Ch {ch.chapter_number}: {ch.chapter_name}
                            </span>
                          </div>

                          {/* Per-chapter question mix */}
                          {isChecked && showMarks && (
                            <div className="mt-2.5 ml-7">
                              <div className="grid grid-cols-5 gap-1.5">
                                {MIX_COLS.map(({ label, sub, key, max }) => (
                                  <div key={key} className="text-center">
                                    <div className="text-xs text-gray-500 mb-0.5 leading-tight">
                                      {label}<br />
                                      <span className="font-bold text-[#FF9933]">{sub}</span>
                                    </div>
                                    <input
                                      type="number" min={0} max={max}
                                      value={mix[key]}
                                      disabled={locked}
                                      onChange={(e) => updateChapterMix(ch.id, key, parseInt(e.target.value) || 0)}
                                      className={inputCls()}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Auto-aggregated totals */}
          {showMarks && checkedChapters.length > 0 && (
            <div className="mt-5 bg-gray-50 rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-3">Total Question Mix</p>
              <div className="space-y-2">
                {MIX_COLS.map(({ label, key, multiplier, color }) => {
                  const count = totalMix[key];
                  if (count === 0) return null;
                  return (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{label} ({multiplier}m each)</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">{count} q</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{count * multiplier} marks</span>
                      </div>
                    </div>
                  );
                })}
                {totalMarks === 0 && (
                  <p className="text-xs text-gray-400 text-center">Enter question counts above to see total marks</p>
                )}
              </div>
              {totalMarks > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm font-bold text-[#1B3A6B]">Total Marks</p>
                  <p className="text-2xl font-extrabold text-[#FF9933]">{totalMarks}</p>
                </div>
              )}
            </div>
          )}

          {/* Additional instructions */}
          {!locked && (
            <div className="mt-4">
              <label className="block text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">
                Additional Instructions <span className="text-gray-400 normal-case font-normal">(optional)</span>
              </label>
              <textarea value={additionalInstructions} onChange={(e) => setAdditionalInstructions(e.target.value)} rows={2}
                placeholder="e.g. Focus on application questions, include a diagram question…"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF9933] resize-none" />
            </div>
          )}

          {/* Status */}
          {checkedChapters.length > 0 ? (
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100">
              <p className="text-sm text-[#1B3A6B] font-semibold">
                {checkedChapters.length} chapter{checkedChapters.length !== 1 ? "s" : ""} selected ✓
              </p>
              {!locked && <p className="text-xs text-green-600 font-semibold">✓ Ready — click Generate Draft below</p>}
            </div>
          ) : (
            <p className="mt-3 text-xs text-gray-400 text-center pt-1">☝️ Check at least one chapter above to enable generation</p>
          )}
        </div>
      )}
    </div>
  );
}
