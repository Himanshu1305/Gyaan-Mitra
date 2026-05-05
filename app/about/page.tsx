"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";

/* ─── Contact form ───────────────────────────────────────────── */
function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setErrorMsg("Please fill in all fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setErrorMsg("");
    setStatus("loading");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Submission failed.");
      }
      setStatus("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-secondary mb-2">Message sent!</h3>
        <p className="text-gray-600 text-sm">Thank you for reaching out. We&apos;ll get back to you soon.</p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-secondary mb-1.5">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={set("name")}
            placeholder="Your name"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-secondary mb-1.5">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-secondary mb-1.5">Message</label>
        <textarea
          value={form.message}
          onChange={set("message")}
          rows={4}
          placeholder="Your message…"
          className={`${inputClass} resize-none`}
        />
      </div>

      {errorMsg && (
        <p className="text-sm text-red-500 font-medium">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-md shadow-primary/20"
      >
        {status === "loading" ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Sending…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send Message
          </>
        )}
      </button>
    </form>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ── Hero ── */}
      <section className="bg-secondary py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-5">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            About
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            About Gyaan Mitra
          </h1>
          <p className="mt-3 text-secondary-200 text-lg">
            AI-powered tools built for teachers across India
          </p>
        </div>
      </section>

      <div className="flex-1 bg-gray-50">

        {/* ── About the Platform ── */}
        <section className="py-14 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10">
              <div className="inline-flex items-center gap-2 bg-primary-50 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-5">
                About the Platform
              </div>
              <h2 className="text-2xl font-bold text-secondary mb-4">What is Gyaan Mitra?</h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Gyaan Mitra is a free AI-powered platform designed specifically for school teachers
                  across India. It helps you create lesson plans, worksheets, exam papers, and
                  presentations in minutes — so you can spend less time on paperwork and more time
                  teaching.
                </p>
                <p>
                  Built for teachers in CBSE, ICSE, and State Board schools, Gyaan Mitra understands
                  the Indian curriculum, Indian classroom realities, and the languages teachers
                  and students speak every day — English, Hindi, and Hinglish.
                </p>
                <p>
                  Gyaan Mitra is fully aligned with the vision of the{" "}
                  <strong className="text-secondary">National Education Policy (NEP) 2020</strong> — which
                  encourages innovative teaching methods, technology integration, and a focus on
                  conceptual understanding over rote learning.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: "🆓", label: "Free to use", desc: "No subscription, no hidden fees" },
                  { icon: "🔓", label: "No login required", desc: "Start using immediately" },
                  { icon: "🇮🇳", label: "Built for India", desc: "CBSE · ICSE · State Board" },
                ].map((item) => (
                  <div key={item.label} className="bg-primary-50 rounded-xl p-4 text-center">
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <p className="font-semibold text-secondary text-sm">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── About the Author ── */}
        <section className="py-4 px-4 pb-14">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10">
              <div className="inline-flex items-center gap-2 bg-secondary-50 text-secondary text-xs font-semibold px-3 py-1 rounded-full mb-5">
                About the Author
              </div>
              <div className="flex flex-col sm:flex-row gap-8 items-start">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-secondary to-secondary-400 flex items-center justify-center text-white text-3xl font-extrabold shadow-md">
                    HD
                  </div>
                </div>
                {/* Bio */}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-secondary">Himanshu Dixit</h2>
                  <p className="text-primary font-semibold text-sm mt-0.5 mb-4">
                    Hyderabad, India
                  </p>
                  <div className="space-y-3 text-gray-600 leading-relaxed text-sm">
                    <p>
                      Himanshu Dixit is a technology leader with over 20 years of experience in
                      enterprise software and digital transformation. He is a{" "}
                      <strong className="text-secondary">Principal Program Manager at Oracle Corporation</strong>,
                      where he leads large-scale technology programs.
                    </p>
                    <p>
                      As an AI consultant, Himanshu designs AI agents and automated workflows that
                      help organisations work smarter. His work spans strategy, implementation, and
                      hands-on building — from intelligent process automation to conversational AI systems.
                    </p>
                    <p>
                      Gyaan Mitra is his effort to bring the power of AI to Indian school classrooms —
                      making advanced technology accessible and practical for every teacher, regardless
                      of their technical background.
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["20+ years in technology", "Principal PM · Oracle", "AI Consultant", "Author", "Hyderabad"].map(
                      (tag) => (
                        <span
                          key={tag}
                          className="text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600"
                        >
                          {tag}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Book Section ── */}
        <section className="py-4 px-4 pb-14">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-secondary to-secondary-600 px-8 sm:px-10 py-10 flex flex-col sm:flex-row gap-8 items-center">
                {/* Book cover mockup */}
                <div className="flex-shrink-0">
                  <div className="w-32 h-44 bg-white rounded-lg shadow-xl flex flex-col items-center justify-center p-3 text-center">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center mb-2">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                      </svg>
                    </div>
                    <p className="text-secondary text-xs font-bold leading-tight">Gyaan Mitra</p>
                    <p className="text-gray-500 text-xs leading-tight mt-1">AI for Teachers</p>
                    <div className="mt-2 w-full h-0.5 bg-primary-200 rounded" />
                    <p className="text-gray-400 text-xs mt-1.5">Himanshu Dixit</p>
                  </div>
                </div>

                {/* Book info */}
                <div className="flex-1 text-center sm:text-left">
                  <span className="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Aligned with NEP 2020
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-1">
                    Gyaan Mitra: AI for Teachers
                  </h2>
                  <p className="text-secondary-200 text-sm mb-4">
                    Transforming Indian Classrooms with Artificial Intelligence
                  </p>
                  <p className="text-secondary-200 text-sm leading-relaxed mb-6">
                    The companion book to this platform — a complete guide for Indian school teachers
                    on using AI in the classroom. Covers lesson plans, worksheets, exam papers,
                    presentations, and responsible AI use.
                  </p>
                  <Link
                    href="#"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-600 transition-colors shadow-lg shadow-primary/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    Buy the Book
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Contact Form ── */}
        <section className="py-4 px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10">
              <div className="inline-flex items-center gap-2 bg-primary-50 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-5">
                Get in Touch
              </div>
              <h2 className="text-2xl font-bold text-secondary mb-2">Contact Us</h2>
              <p className="text-gray-500 text-sm mb-6">
                Have a question, suggestion, or feedback? We&apos;d love to hear from you.
              </p>
              <ContactForm />
            </div>
          </div>
        </section>

      </div>

      <Footer />
    </div>
  );
}
