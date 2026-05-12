"use client";

import { useState, useEffect, useCallback } from "react";
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
  marks: number;
  questionType: string;
  filePath: string | null;
};

export type ChapterSelectorResult = {
  chapters: ChapterSelectionItem[];
  additionalInstructions: string;
  classNumber: number;
  subject: string;
  board: string;
  questionMix: QuestionMix;
};

type Props = {
  onChaptersSelected: (result: ChapterSelectorResult) => void;
  showMarks?: boolean;
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
const QUESTION_TYPES = ["MCQ", "Short Answer", "Long Answer", "MCQ + Short Answer", "MCQ + Long Answer", "All Types"];
const DEFAULT_MIX: QuestionMix = { mcq: 10, shortTwo: 3, shortThree: 2, longFour: 1, longFive: 0 };
const ALL_BOOKS_SENTINEL = "__ALL__";

const pill = "px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all";
const pillOn = "bg-[#FF9933] border-[#FF9933] text-white shadow-sm";
const pillOff = "bg-white border-[#1B3A6B] text-[#1B3A6B] hover:bg-[#FF9933] hover:border-[#FF9933] hover:text-white";

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 text-[#FF9933]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export default function ChapterSelector({ onChaptersSelected, showMarks = true }: Props) {
  const [board, setBoard] = useState("CBSE");
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [books, setBooks] = useState<BookRow[]>([]);
  const [selectedBookCodes, setSelectedBookCodes] = useState<string[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [marks, setMarks] = useState<Record<number, number>>({});
  const [questionTypes, setQuestionTypes] = useState<Record<number, string>>({});
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [questionMix, setQuestionMix] = useState<QuestionMix>(DEFAULT_MIX);
  const [perChapterMarks, setPerChapterMarks] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [error, setError] = useState("");

  // Step 1 — fetch subjects when class changes
  useEffect(() => {
    if (!selectedClass) return;
    setError("");
    setSubjects([]);
    setSelectedSubject(null);
    setBooks([]);
    setSelectedBookCodes([]);
    setChapters([]);
    setChecked({});
    setLoadingSubjects(true);
    console.log("[ChapterSelector] Fetching subjects for class:", selectedClass);
    supabase
      .from("ncert_chapters")
      .select("subject")
      .eq("class_number", selectedClass)
      .order("subject")
      .then(({ data, error: err }) => {
        setLoadingSubjects(false);
        if (err) {
          console.error("[ChapterSelector] Subject fetch error:", err);
          setError("Could not load subjects: " + err.message);
          return;
        }
        if (!data || data.length === 0) {
          setError(`No subjects found for Class ${selectedClass}. Check that the ncert_chapters table has data.`);
          return;
        }
        const unique = Array.from(new Set((data as { subject: string }[]).map((r) => r.subject)));
        console.log("[ChapterSelector] Subjects loaded:", unique);
        setSubjects(unique);
      });
  }, [selectedClass]);

  // Step 2 — fetch books when subject changes
  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;
    setError("");
    setBooks([]);
    setSelectedBookCodes([]);
    setChapters([]);
    setChecked({});
    setLoadingBooks(true);
    console.log("[ChapterSelector] Fetching books for class:", selectedClass, "subject:", selectedSubject);
    supabase
      .from("ncert_chapters")
      .select("book_code, book_display_name")
      .eq("class_number", selectedClass)
      .eq("subject", selectedSubject)
      .order("book_display_name")
      .then(({ data, error: err }) => {
        setLoadingBooks(false);
        if (err) {
          console.error("[ChapterSelector] Book fetch error:", err);
          setError("Could not load books: " + err.message);
          return;
        }
        if (!data || data.length === 0) {
          console.warn("[ChapterSelector] No books found");
          return;
        }
        const rows = data as BookRow[];
        const hasNullBookCodes = rows.some((r) => r.book_code === null);

        if (hasNullBookCodes) {
          const seen = new Set<string>();
          const unique: BookRow[] = [];
          for (const row of rows) {
            if (!seen.has(row.book_display_name)) {
              seen.add(row.book_display_name);
              unique.push(row);
            }
          }
          console.log("[ChapterSelector] Books (null book_code subject):", unique.map((b) => b.book_display_name));
          setBooks(unique);
          setSelectedBookCodes([ALL_BOOKS_SENTINEL]);
        } else {
          const seen = new Set<string>();
          const unique: BookRow[] = [];
          for (const row of rows) {
            if (row.book_code && !seen.has(row.book_code)) {
              seen.add(row.book_code);
              unique.push(row);
            }
          }
          console.log("[ChapterSelector] Books loaded:", unique.map((b) => b.book_display_name));
          setBooks(unique);
          if (unique.length === 1) setSelectedBookCodes([unique[0].book_code!]);
        }
      });
  }, [selectedClass, selectedSubject]);

  // Step 3 — fetch chapters when book selection changes
  useEffect(() => {
    if (!selectedClass || !selectedSubject || selectedBookCodes.length === 0) {
      if (selectedBookCodes.length === 0 && books.length > 0) setChapters([]);
      return;
    }
    setError("");
    setChapters([]);
    setChecked({});
    setLoadingChapters(true);
    const isAll = selectedBookCodes.includes(ALL_BOOKS_SENTINEL);
    console.log("[ChapterSelector] Fetching chapters — isAll:", isAll, "books:", selectedBookCodes.join(","));

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
        console.error("[ChapterSelector] Chapter fetch error:", err);
        setError("Could not load chapters: " + err.message);
        return;
      }
      if (!data || data.length === 0) {
        setError("No chapters found for the selected book(s). Check your Supabase data.");
        return;
      }
      console.log("[ChapterSelector] Chapters loaded:", data.length, "chapters");
      setChapters(data as ChapterRow[]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedSubject, selectedBookCodes.join(",")]);

  const toggleBook = (code: string) =>
    setSelectedBookCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );

  const toggleChapter = (id: number) => {
    setChecked((prev) => {
      const isNowChecked = !prev[id];
      if (isNowChecked) {
        setMarks((m) => ({ ...m, [id]: 10 }));
        setQuestionTypes((q) => ({ ...q, [id]: "All Types" }));
      }
      return { ...prev, [id]: isNowChecked };
    });
  };

  const toggleAll = (ids: number[], allChecked: boolean) => {
    setChecked((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = !allChecked;
        if (!allChecked) {
          setMarks((m) => ({ ...m, [id]: 10 }));
          setQuestionTypes((q) => ({ ...q, [id]: "All Types" }));
        }
      });
      return next;
    });
  };

  const checkedChapters = chapters.filter((c) => checked[c.id]);
  const totalMixMarks =
    questionMix.mcq * 1 + questionMix.shortTwo * 2 + questionMix.shortThree * 3 +
    questionMix.longFour * 4 + questionMix.longFive * 5;

  const notifyParent = useCallback(() => {
    if (!selectedClass || !selectedSubject || checkedChapters.length === 0) return;
    onChaptersSelected({
      chapters: checkedChapters.map((c) => ({
        chapterId: c.id,
        chapterName: c.chapter_name,
        bookCode: c.book_code,
        bookDisplayName: c.book_display_name,
        marks: marks[c.id] ?? 10,
        questionType: questionTypes[c.id] ?? "All Types",
        filePath: c.file_path,
      })),
      additionalInstructions,
      classNumber: selectedClass,
      subject: selectedSubject,
      board,
      questionMix,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    checkedChapters.length, marks, questionTypes, additionalInstructions,
    selectedClass, selectedSubject, board,
    questionMix.mcq, questionMix.shortTwo, questionMix.shortThree, questionMix.longFour, questionMix.longFive,
  ]);

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

  const mixRows: { label: string; sub: string; key: keyof QuestionMix; max: number; color: string }[] = [
    { label: "MCQ", sub: "1 mark each", key: "mcq", max: 50, color: "bg-blue-100 text-blue-700" },
    { label: "Short Answer", sub: "2 marks each", key: "shortTwo", max: 20, color: "bg-green-100 text-green-700" },
    { label: "Short Answer", sub: "3 marks each", key: "shortThree", max: 20, color: "bg-yellow-100 text-yellow-700" },
    { label: "Long Answer", sub: "4 marks each", key: "longFour", max: 10, color: "bg-orange-100 text-orange-700" },
    { label: "Long Answer", sub: "5 marks each", key: "longFive", max: 10, color: "bg-red-100 text-red-700" },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">⚠️ {error}</div>
      )}

      {/* Board */}
      <div>
        <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">Board</p>
        <div className="flex flex-wrap gap-2">
          {BOARDS.map((b) => (
            <button key={b} onClick={() => setBoard(b)} className={`${pill} ${board === b ? pillOn : pillOff}`}>{b}</button>
          ))}
        </div>
      </div>

      {/* Class */}
      <div>
        <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">Step 1 — Select Class</p>
        <div className="flex flex-wrap gap-2">
          {CLASSES.map((cls) => (
            <button key={cls} onClick={() => setSelectedClass(cls)} className={`${pill} ${selectedClass === cls ? pillOn : pillOff}`}>
              Class {cls}
            </button>
          ))}
        </div>
      </div>

      {loadingSubjects && <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner /> Loading subjects…</div>}

      {/* Subject */}
      {subjects.length > 0 && (
        <div>
          <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">Step 2 — Select Subject</p>
          <div className="flex flex-wrap gap-2">
            {subjects.map((sub) => (
              <button key={sub} onClick={() => setSelectedSubject(sub)} className={`${pill} ${selectedSubject === sub ? pillOn : pillOff}`}>{sub}</button>
            ))}
          </div>
        </div>
      )}

      {loadingBooks && <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner /> Loading books…</div>}

      {/* Books (only when multiple real book_codes) */}
      {booksWithCodes.length > 1 && (
        <div>
          <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">Step 3 — Select Books</p>
          <div className="flex flex-wrap gap-3">
            {booksWithCodes.map((book) => (
              <label key={book.book_code} className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={selectedBookCodes.includes(book.book_code!)}
                  onChange={() => toggleBook(book.book_code!)} className="w-4 h-4 accent-[#FF9933]" />
                <span className="text-sm text-[#1B3A6B] font-medium">{book.book_display_name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {loadingChapters && <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner /> Loading chapters…</div>}

      {/* Chapters */}
      {hasChapters && (
        <div>
          <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-3">
            Step {2 + stepOffset} — Select Chapters{" "}
            <span className="text-gray-400 normal-case font-normal">(check to include)</span>
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
                      <button onClick={() => toggleAll(ids, allChecked)}
                        className="text-xs text-[#1B3A6B] underline hover:text-[#FF9933]">
                        {allChecked ? "Deselect all" : "Select all"}
                      </button>
                    </div>
                  )}
                  {Object.keys(byBook).length === 1 && (
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
                      return (
                        <div key={ch.id}
                          className={`rounded-xl border p-3 transition-all ${isChecked ? "border-[#FF9933] bg-orange-50" : "border-gray-200 bg-white hover:border-[#1B3A6B]"}`}>
                          <div className="flex flex-wrap items-start gap-3">
                            <input type="checkbox" checked={isChecked} onChange={() => toggleChapter(ch.id)}
                              className="mt-0.5 w-4 h-4 accent-[#FF9933] flex-shrink-0 cursor-pointer" />
                            <span className="flex-1 text-sm font-medium text-[#1B3A6B] cursor-pointer" onClick={() => toggleChapter(ch.id)}>
                              Ch {ch.chapter_number}: {ch.chapter_name}
                            </span>
                            {isChecked && showMarks && perChapterMarks && (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <label className="text-xs text-gray-500 whitespace-nowrap">Marks:</label>
                                  <input type="number" min={1} max={50} value={marks[ch.id] ?? 10}
                                    onChange={(e) => setMarks((m) => ({ ...m, [ch.id]: Math.min(50, Math.max(1, Number(e.target.value))) }))}
                                    className="w-14 text-sm text-center border border-[#1B3A6B] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#FF9933]" />
                                </div>
                                <select value={questionTypes[ch.id] ?? "All Types"}
                                  onChange={(e) => setQuestionTypes((q) => ({ ...q, [ch.id]: e.target.value }))}
                                  className="text-xs border border-[#1B3A6B] rounded-lg px-2 py-1.5 text-[#1B3A6B] focus:outline-none focus:ring-2 focus:ring-[#FF9933]">
                                  {QUESTION_TYPES.map((qt) => <option key={qt} value={qt}>{qt}</option>)}
                                </select>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Question Mix section */}
          {showMarks && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">Question Mix</p>
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" checked={perChapterMarks} onChange={(e) => setPerChapterMarks(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#FF9933]" />
                  Set marks per chapter (advanced)
                </label>
              </div>

              {!perChapterMarks && (
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                  {mixRows.map(({ label, sub, key, max, color }) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700">{label}</p>
                        <p className="text-xs text-gray-400">{sub}</p>
                      </div>
                      <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
                        {questionMix[key] * parseInt(sub)} marks
                      </div>
                      <input type="number" min={0} max={max} value={questionMix[key]}
                        onChange={(e) => setQuestionMix((m) => ({ ...m, [key]: Math.max(0, Math.min(max, parseInt(e.target.value) || 0)) }))}
                        className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#FF9933] transition" />
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-600">Total Marks</p>
                    <p className="text-xl font-extrabold text-[#FF9933]">{totalMixMarks}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Additional instructions */}
          <div className="mt-4">
            <label className="block text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">
              Additional Instructions <span className="text-gray-400 normal-case font-normal">(optional)</span>
            </label>
            <textarea value={additionalInstructions} onChange={(e) => setAdditionalInstructions(e.target.value)} rows={2}
              placeholder="e.g. Focus on application questions, include a diagram question…"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF9933] resize-none" />
          </div>

          {/* Status */}
          {checkedChapters.length > 0 ? (
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100">
              {showMarks && !perChapterMarks ? (
                <p className="text-sm font-semibold text-[#1B3A6B]">
                  Total Marks: <span className="text-[#FF9933] text-lg font-bold">{totalMixMarks}</span>
                </p>
              ) : (
                <p className="text-sm text-[#1B3A6B] font-semibold">
                  {checkedChapters.length} chapter{checkedChapters.length !== 1 ? "s" : ""} selected ✓
                </p>
              )}
              <p className="text-xs text-green-600 font-semibold">✓ Ready — click Generate Draft below</p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-gray-400 text-center pt-1">☝️ Check at least one chapter above to enable generation</p>
          )}
        </div>
      )}
    </div>
  );
}
