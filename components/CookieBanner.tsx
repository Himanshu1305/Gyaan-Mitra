"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("cookie-consent")) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-secondary border-t border-secondary-700 px-4 py-4 shadow-lg">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-sm text-secondary-100 leading-relaxed">
          We use essential cookies to keep you signed in and remember your preferences. By continuing to use Gyaan Mitra, you agree to our{" "}
          <Link href="/privacy-policy" className="underline text-white hover:text-primary-200 transition-colors">Privacy Policy</Link>.
        </p>
        <button
          onClick={accept}
          className="flex-shrink-0 inline-flex items-center px-5 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-600 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
