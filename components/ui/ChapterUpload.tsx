"use client";

import { useState } from "react";

export interface UploadedFile {
  type: "pdf" | "image" | "text";
  data?: string;
  text?: string;
  mimeType?: string;
  filename: string;
}

const MAX_BYTES = 10 * 1024 * 1024;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChapterUpload({
  value,
  onChange,
}: {
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const processFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      setError("File too large — maximum size is 10 MB.");
      return;
    }
    setError("");
    setProcessing(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (ext === "txt") {
        const text = await file.text();
        onChange({ type: "text", text, filename: file.name });
      } else if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
        const data = await readAsBase64(file);
        onChange({ type: "image", data, mimeType: file.type, filename: file.name });
      } else if (ext === "pdf") {
        const data = await readAsBase64(file);
        onChange({ type: "pdf", data, mimeType: "application/pdf", filename: file.name });
      } else {
        setError("Unsupported type. Please upload a PDF, JPG, PNG, or .txt file.");
      }
    } catch {
      setError("Could not read the file. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  if (value) {
    return (
      <div className="sm:col-span-2">
        <div className="rounded-2xl border-2 border-green-400 bg-green-50 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-green-800 text-sm">Chapter uploaded successfully!</p>
            <p className="text-green-700 text-xs truncate mt-0.5">{value.filename}</p>
            <p className="text-green-600 text-xs mt-1">AI will use this chapter for accurate, syllabus-aligned content.</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex-shrink-0 text-green-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
            title="Remove file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sm:col-span-2">
      <label
        className={`relative block cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          dragging
            ? "border-primary bg-primary-50 scale-[1.01]"
            : processing
            ? "border-gray-300 bg-gray-50 cursor-wait"
            : "border-primary/40 bg-orange-50/30 hover:border-primary hover:bg-primary-50/60"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.txt"
          className="hidden"
          onChange={handleInput}
          disabled={processing}
        />

        {processing ? (
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-sm font-medium text-primary">Processing your file…</p>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>

            <p className="text-base font-bold text-secondary mb-1">Upload Your Chapter First</p>
            <p className="text-sm text-gray-600 mb-3">
              PDF, photo of textbook page, or text file — for accurate, syllabus-aligned content
            </p>

            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-4">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Click anywhere here or drag &amp; drop to upload
            </div>

            <p className="text-xs text-gray-400 leading-relaxed max-w-md mx-auto">
              Without your chapter, AI gives <span className="font-medium text-gray-500">general content</span>. With your chapter, AI gives content based on <span className="font-medium text-primary">your exact syllabus</span>.
            </p>
            <p className="text-xs text-gray-300 mt-2">PDF · JPG · PNG · TXT · Max 10 MB</p>
          </>
        )}
      </label>

      {error && (
        <p className="mt-2 text-xs text-red-500 font-medium flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
