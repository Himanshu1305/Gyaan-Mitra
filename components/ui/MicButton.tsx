"use client";

import { useRef, useState } from "react";

export default function MicButton({
  onResult,
}: {
  onResult: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input requires Chrome or Edge. Please use a supported browser.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR();
    recognition.lang = "hi-IN"; // Supports Hindi, English, and Hinglish
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      onResult(e.results[0][0].transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Tap to stop listening" : "Tap to speak"}
      className={`flex-shrink-0 p-2.5 rounded-xl border transition-all duration-200 ${
        listening
          ? "bg-red-500 border-red-500 text-white"
          : "bg-white border-gray-200 text-gray-400 hover:border-primary hover:text-primary hover:bg-primary-50"
      }`}
    >
      <svg
        className={`w-4 h-4 ${listening ? "animate-pulse" : ""}`}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
      </svg>
    </button>
  );
}
