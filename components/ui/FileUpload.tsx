"use client";

import { useState } from "react";

export interface UploadedFile {
  type: "pdf" | "image" | "text";
  data?: string;    // base64 (no data-URI prefix) for pdf/image
  text?: string;    // raw text for .txt files
  mimeType?: string;
  filename: string;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FileUpload({
  value,
  onChange,
}: {
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setError("File too large — maximum size is 10 MB.");
      e.target.value = "";
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
      e.target.value = "";
    }
  };

  return (
    <div className="sm:col-span-2">
      <label className="block text-sm font-semibold text-secondary mb-1">
        Upload Chapter{" "}
        <span className="text-gray-400 font-normal">(PDF, image, or text)</span>
      </label>
      <p className="text-xs text-gray-400 mb-2">
        Upload your textbook chapter so AI creates content based on your exact syllabus.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <label
          className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed text-sm transition-colors ${
            processing
              ? "border-gray-200 text-gray-400 cursor-wait"
              : "border-gray-200 text-gray-500 hover:border-primary hover:bg-primary-50 hover:text-primary"
          }`}
        >
          {processing ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Processing…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {value ? "Change file" : "Choose file"}
            </>
          )}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.txt"
            className="hidden"
            onChange={handle}
            disabled={processing}
          />
        </label>

        {value && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd" />
            </svg>
            {value.filename}
            <button
              type="button"
              onClick={() => onChange(null)}
              className="ml-0.5 text-gray-400 hover:text-red-500 text-lg leading-none"
            >
              ×
            </button>
          </span>
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
