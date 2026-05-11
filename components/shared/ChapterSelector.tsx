"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type ChapterSelectionItem = {
  chapterId: number;
  chapterName: string;
  bookCode: string;
  bookDisplayName: string;
  marks: number;
  questionType: string;
  filePath: string;
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

type BookRow = { book_code: string; book_display_name: string };
type ChapterRow = {
  id: number;
  class_number: number;
  subject: string;
  book_code: string;
  book_display_name: string;
  chapter_number: number;
  chapter_name: string;
  file_path: string;
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

  // Fetch subjects when class changes
  useEffect(() => {
    if (!selectedClass) return;
    setSubjects([]);
    setSelectedSubject(null);
    setBooks([]);
    setSelectedBookCodes([]);
    setChapters([]);
    setChecked({});
    setLoadingSubjects(true);
    supabase
      .from("ncert_chapters")
      .select("subject")
      .eq("class_number", selectedClass)
      .order("subject")
      .then(({ data }) => {
        setLoadingSubjects(false);
        if (!data) return;
        const unique = Array.from(new Set((data as { subject: string }[]).map((r) => r.subject)));
        setSubjects(unique);
      });
  }, [selectedClass]);

  // Fetch books when subject changes
  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;
    setBooks([]);
    setSelectedBookCodes([]);
    setChapters([]);
    setChecked({});
    setLoadingBooks(true);
    supabase
      .from("ncert_chapters")
      .select("book_code, book_display_name")
      .eq("class_number", selectedClass)
      .eq("subject", selectedSubject)
      .order("book_display_name")
      .then(({ data }) => {
        setLoadingBooks(false);
        if (!data) return;
        const seen = new Set<string>();
        const unique: BookRow[] = [];
        for (const row of data as BookRow[]) {
          if (!seen.has(row.book_code)) {
            seen.add(row.book_code);
            unique.push(row);
          }
        }
        setBooks(unique);
        // Auto-select if only one book
        if (unique.length === 1) setSelectedBookCodes([unique[0].book_code]);
      });
  }, [selectedClass, selectedSubject]);

  // Fetch chapters when books change
  useEffect(() => {
    if (!selectedClass || !selectedSubject || selectedBookCodes.length === 0) {
      setChapters([]);
      return;
    }
    setChapters([]);
    setChecked({});
    setLoadingChapters(true);
    supabase
      .from("ncert_chapters")
      .select("*")
      .eq("class_number", selectedClass)
      .eq("subject", selectedSubject)
      .in("book_code", selectedBookCodes)
      .order("chapter_number")
      .then(({ data }) => {
        setLoadingChapters(false);
        if (!data) return;
        setChapters(data as ChapterRow[]);
      });
  }, [selectedClass, selectedSubject, selectedBookCodes]);

  const toggleBook = (code: string) => {
    setSelectedBookCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleChapter = (id: number) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (!prev[id]) {
        setMarks((m) => ({ ...m, [id]: 10 }));
        setQuestionTypes((q) => ({ ...q, [id]: "All Types" }));
      }
      return next;
    });
  };

  const checkedChapters = chapters.filter((c) => checked[c.id]);
  const totalMarks = checkedChapters.reduce((sum, c) => sum + (marks[c.id] ?? 10), 0);

  const handleSubmit = () => {
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
  };

  const byBook = chapters.reduce<Record<string, ChapterRow[]>>((acc, ch) => {
    const key = ch.book_display_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ch);
    return acc;
  }, {});

  const btnBase =
    "px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all";
  const btnActive = "bg-[#FF9933] border-[#FF9933] text-white shadow-sm";
  const btnInactive =
    "bg-white border-[#1B3A6B] text-[#1B3A6B] hover:bg-[#FF9933] hover:border-[#FF9933] hover:text-white";

  return (
    <div className="space-y-6">
      {/* Step 1 — Class */}
      <div>
        <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">
          Select Class
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

      {/* Step 2 — Subject */}
      {loadingSubjects && (
        <p className="text-sm text-gray-400 animate-pulse">Loading subjects…</p>
      )}
      {subjects.length > 0 && (
        <div>
          <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">
            Select Subject
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

      {/* Step 3 — Books (only if multiple) */}
      {loadingBooks && (
        <p className="text-sm text-gray-400 animate-pulse">Loading books…</p>
      )}
      {books.length > 1 && (
        <div>
          <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">
            Select Books
          </p>
          <div className="flex flex-wrap gap-3">
            {books.map((book) => (
              <label
                key={book.book_code}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={selectedBookCodes.includes(book.book_code)}
                  onChange={() => toggleBook(book.book_code)}
                  className="w-4 h-4 accent-[#FF9933]"
                />
                <span className="text-sm text-[#1B3A6B] font-medium">
                  {book.book_display_name}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Step 4 — Chapters */}
      {loadingChapters && (
        <p className="text-sm text-gray-400 animate-pulse">Loading chapters…</p>
      )}
      {Object.keys(byBook).length > 0 && (
        <div>
          <p className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-3">
            Select Chapters
          </p>
          <div className="space-y-4">
            {Object.entries(byBook).map(([bookName, bookChapters]) => (
              <div key={bookName}>
                {Object.keys(byBook).length > 1 && (
                  <p className="text-xs font-bold text-[#FF9933] uppercase tracking-wide mb-2">
                    {bookName}
                  </p>
                )}
                <div className="space-y-2">
                  {bookChapters.map((ch) => {
                    const isChecked = !!checked[ch.id];
                    return (
                      <div
                        key={ch.id}
                        className={`rounded-xl border p-3 transition-all ${
                          isChecked
                            ? "border-[#FF9933] bg-orange-50"
                            : "border-gray-200 bg-white hover:border-[#1B3A6B]"
                        }`}
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleChapter(ch.id)}
                            className="mt-0.5 w-4 h-4 accent-[#FF9933] flex-shrink-0"
                          />
                          <span className="flex-1 text-sm font-medium text-[#1B3A6B]">
                            Ch {ch.chapter_number}: {ch.chapter_name}
                          </span>
                          {isChecked && showMarks && (
                            <>
                              <div className="flex items-center gap-1.5">
                                <label className="text-xs text-gray-500 whitespace-nowrap">
                                  Marks:
                                </label>
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
                                  <option key={qt} value={qt}>
                                    {qt}
                                  </option>
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
        </div>
      )}

      {/* Step 5 — Additional Instructions */}
      {checkedChapters.length > 0 && (
        <div>
          <label className="block text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-2">
            Additional Instructions{" "}
            <span className="text-gray-400 normal-case font-normal">(optional)</span>
          </label>
          <textarea
            value={additionalInstructions}
            onChange={(e) => setAdditionalInstructions(e.target.value)}
            rows={3}
            placeholder="e.g. Focus on application-based questions, include one map question, no fill-in-the-blanks…"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF9933] resize-none"
          />
        </div>
      )}

      {/* Step 6 — Total marks + submit */}
      {checkedChapters.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {showMarks ? (
            <p className="text-sm font-semibold text-[#1B3A6B]">
              Total Marks:{" "}
              <span className="text-[#FF9933] text-lg font-bold">{totalMarks}</span>
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              {checkedChapters.length} chapter{checkedChapters.length !== 1 ? "s" : ""} selected
            </p>
          )}
          <button
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm font-bold hover:bg-[#FF9933] transition-colors shadow-sm"
          >
            Use These Chapters →
          </button>
        </div>
      )}
    </div>
  );
}
