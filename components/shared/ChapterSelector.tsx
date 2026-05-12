"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

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

const CLASSES = [6, 7, 8, 9, 10, 11, 12];
const QUESTION_TYPES = [
  "MCQ",
  "Short Answer",
  "Long Answer",
  "MCQ + Short Answer",
  "MCQ + Long Answer",
  "All Types",
];

// Sentinel used when subject has NULL book_codes — fetch all chapters for that subject
const ALL_BOOKS_SENTINEL = "__ALL__";

const btnBase = "px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all";
const btnActive = "bg-[#FF9933] border-[#FF9933] text-white shadow-sm";
const btnInactive = "bg-white border-[#1B3A6B] text-[#1B3A6B] hover:bg-[#FF9933] hover:border-[#FF9933] hover:text-white";

export default function ChapterSelector({ onChaptersSelected, showMarks = true }: Props) {
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

        // Check if this subject has null book_codes (single-book subject like Maths, Science)
        const hasNullBookCodes = rows.some((r) => r.book_code === null);

        if (hasNullBookCodes) {
          // Deduplicate by book_display_name
          const seen = new Set<string>();
          const unique: BookRow[] = [];
          for (const row of rows) {
            if (!seen.has(row.book_display_name)) {
              seen.add(row.book_display_name);
              unique.push(row);
            }
          }
          console.log("[ChapterSelector] Books loaded (null book_code subject):", unique.map(b => b.book_display_name));
          setBooks(unique);
          // Use sentinel so chapter query skips the .in("book_code") filter
          setSelectedBookCodes([ALL_BOOKS_SENTINEL]);
        } else {
          // Deduplicate by book_code
          const seen = new Set<string>();
          const unique: BookRow[] = [];
          for (const row of rows) {
            if (row.book_code && !seen.has(row.book_code)) {
              seen.add(row.book_code);
              unique.push(row);
            }
          }
          console.log("[ChapterSelector] Books loaded:", unique.map(b => b.book_display_name));
          setBooks(unique);
          // Auto-select if only one real book
          if (unique.length === 1) {
            setSelectedBookCodes([unique[0].book_code!]);
          }
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

    const isAllBooks = selectedBookCodes.includes(ALL_BOOKS_SENTINEL);
    console.log(
      "[ChapterSelector] Fetching chapters — class:", selectedClass,
      "subject:", selectedSubject,
      isAllBooks ? "(all books / null book_code)" : "books:" + selectedBookCodes.join(",")
    );

    let query = supabase
      .from("ncert_chapters")
      .select("*")
      .eq("class_number", selectedClass)
      .eq("subject", selectedSubject)
      .order("chapter_number");

    // Only filter by book_code when we have real (non-null) book codes selected
    if (!isAllBooks) {
      query = query.in("book_code", selectedBookCodes);
    }

    query.then(({ data, error: err }) => {
      setLoadingChapters(false);
      if (err) {
        console.error("[ChapterSelector] Chapter fetch error:", err);
        setError("Could not load chapters: " + err.message);
        return;
      }
      if (!data || data.length === 0) {
        console.warn("[ChapterSelector] No chapters found");
        setError("No chapters found for the selected book(s). Check your Supabase data.");
        return;
      }
      console.log("[ChapterSelector] Chapters loaded:", data.length, "chapters");
      setChapters(data as ChapterRow[]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedSubject, selectedBookCodes.join(",")]);

  const toggleBook = (code: string) => {
    setSelectedBookCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

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

  const checkedChapters = chapters.filter((c) => checked[c.id]);
  const totalMarks = checkedChapters.reduce((sum, c) => sum + (marks[c.id] ?? 10), 0);

  // Auto-notify parent whenever selection changes
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
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedChapters.length, marks, questionTypes, additionalInstructions, selectedClass, selectedSubject]);

  useEffect(() => {
    notifyParent();
  }, [notifyParent]);

  // Group chapters by book_display_name for rendering
  const byBook = chapters.reduce<Record<string, ChapterRow[]>>((acc, ch) => {
    const key = ch.book_display_name ?? "Chapters";
    if (!acc[key]) acc[key] = [];
    acc[key].push(ch);
    return acc;
  }, {});

  // Books with real book_codes (for the toggle UI) — excludes null-book-code subjects
  const booksWithCodes = books.filter((b) => b.book_code !== null);

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Step 1 — Class */}
      <div>
        <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">
          Step 1 — Select Class
        </p>
        <div className="flex flex-wrap gap-2">
          {CLASSES.map((cls) => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className={`${btnBase} ${selectedClass === cls ? btnActive : btnInactive}`}
            >
              Class {cls}
            </button>
          ))}
        </div>
      </div>

      {/* Loading subjects */}
      {loadingSubjects && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="animate-spin w-4 h-4 text-[#FF9933]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading subjects…
        </div>
      )}

      {/* Step 2 — Subject */}
      {subjects.length > 0 && (
        <div>
          <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">
            Step 2 — Select Subject
          </p>
          <div className="flex flex-wrap gap-2">
            {subjects.map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`${btnBase} ${selectedSubject === sub ? btnActive : btnInactive}`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading books */}
      {loadingBooks && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="animate-spin w-4 h-4 text-[#FF9933]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading books…
        </div>
      )}

      {/* Step 3 — Books (only show when there are multiple real book_codes) */}
      {booksWithCodes.length > 1 && (
        <div>
          <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">
            Step 3 — Select Books
          </p>
          <div className="flex flex-wrap gap-3">
            {booksWithCodes.map((book) => (
              <label key={book.book_code} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedBookCodes.includes(book.book_code!)}
                  onChange={() => toggleBook(book.book_code!)}
                  className="w-4 h-4 accent-[#FF9933]"
                />
                <span className="text-sm text-[#1B3A6B] font-medium">{book.book_display_name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Loading chapters */}
      {loadingChapters && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="animate-spin w-4 h-4 text-[#FF9933]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading chapters…
        </div>
      )}

      {/* Step 4 — Chapters */}
      {Object.keys(byBook).length > 0 && (
        <div>
          <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-3">
            {booksWithCodes.length > 1 ? "Step 4 — " : "Step 3 — "}Select Chapters{" "}
            <span className="text-gray-400 normal-case font-normal">(check to include)</span>
          </p>
          <div className="space-y-4">
            {Object.entries(byBook).map(([bookName, bookChapters]) => (
              <div key={bookName}>
                {Object.keys(byBook).length > 1 && (
                  <p className="text-xs font-bold text-[#FF9933] uppercase tracking-wide mb-2">{bookName}</p>
                )}
                <div className="space-y-2">
                  {bookChapters.map((ch) => {
                    const isChecked = !!checked[ch.id];
                    return (
                      <div
                        key={ch.id}
                        className={`rounded-xl border p-3 transition-all ${
                          isChecked ? "border-[#FF9933] bg-orange-50" : "border-gray-200 bg-white hover:border-[#1B3A6B]"
                        }`}
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleChapter(ch.id)}
                            className="mt-0.5 w-4 h-4 accent-[#FF9933] flex-shrink-0 cursor-pointer"
                          />
                          <span
                            className="flex-1 text-sm font-medium text-[#1B3A6B] cursor-pointer"
                            onClick={() => toggleChapter(ch.id)}
                          >
                            Ch {ch.chapter_number}: {ch.chapter_name}
                          </span>
                          {isChecked && showMarks && (
                            <>
                              <div className="flex items-center gap-1.5">
                                <label className="text-xs text-gray-500 whitespace-nowrap">Marks:</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={marks[ch.id] ?? 10}
                                  onChange={(e) =>
                                    setMarks((m) => ({
                                      ...m,
                                      [ch.id]: Math.min(50, Math.max(1, Number(e.target.value))),
                                    }))
                                  }
                                  className="w-14 text-sm text-center border border-[#1B3A6B] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#FF9933]"
                                />
                              </div>
                              <select
                                value={questionTypes[ch.id] ?? "All Types"}
                                onChange={(e) =>
                                  setQuestionTypes((q) => ({ ...q, [ch.id]: e.target.value }))
                                }
                                className="text-xs border border-[#1B3A6B] rounded-lg px-2 py-1.5 text-[#1B3A6B] focus:outline-none focus:ring-2 focus:ring-[#FF9933]"
                              >
                                {QUESTION_TYPES.map((qt) => (
                                  <option key={qt} value={qt}>{qt}</option>
                                ))}
                              </select>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Additional instructions + status */}
          <div className="mt-5 space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">
                Additional Instructions{" "}
                <span className="text-gray-400 normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                rows={2}
                placeholder="e.g. Focus on application-based questions, include one map question…"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF9933] resize-none"
              />
            </div>

            {checkedChapters.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                {showMarks ? (
                  <p className="text-sm font-semibold text-[#1B3A6B]">
                    Total Marks:{" "}
                    <span className="text-[#FF9933] text-lg font-bold">{totalMarks}</span>
                  </p>
                ) : (
                  <p className="text-sm text-[#1B3A6B] font-semibold">
                    {checkedChapters.length} chapter{checkedChapters.length !== 1 ? "s" : ""} selected ✓
                  </p>
                )}
                <p className="text-xs text-green-600 font-semibold">
                  ✓ Ready — click Generate Draft below
                </p>
              </div>
            )}

            {checkedChapters.length === 0 && (
              <p className="text-xs text-gray-400 text-center pt-1">
                ☝️ Check at least one chapter above to enable generation
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
