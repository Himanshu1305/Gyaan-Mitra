import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";

const features = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Lesson Plan Generator",
    description: "Build complete lesson plans in 15 minutes, not 2 hours",
    detail:
      "Generate structured lesson plans aligned to CBSE, ICSE, or State Board curricula. Covers learning objectives, activities, assessments, and homework.",
    href: "/lesson-plans",
    cta: "Generate a Plan",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    title: "Worksheet Creator",
    description: "Create practice, revision, and multi-level worksheets instantly",
    detail:
      "Design differentiated worksheets for all learning levels — from foundational to advanced. Supports MCQs, fill-in-the-blanks, short answer, and more.",
    href: "/worksheets",
    cta: "Create Worksheet",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    title: "Prompt Library",
    description: "55+ ready-to-use prompts for every subject and grade",
    detail:
      "Browse a curated library of AI prompts for lesson planning, parent communication, student feedback, exam prep, and classroom activities.",
    href: "/prompt-library",
    cta: "Browse Prompts",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ── Hero ── */}
      <section className="flex-1 bg-gradient-to-br from-white via-orange-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center">
            {/* NEP badge */}
            <div className="inline-flex items-center gap-2 bg-white border border-primary-200 text-primary-700 text-xs font-semibold px-4 py-1.5 rounded-full shadow-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
              Aligned with NEP 2020
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-secondary leading-tight text-balance">
              Your AI Teaching Partner{" "}
              <span className="text-primary">is Here</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed text-balance">
              Save hours every week on lesson plans, worksheets, and exam papers.
              Gyaan Mitra is built for teachers across India.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/lesson-plans"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-white font-semibold text-base hover:bg-primary-600 transition-colors shadow-md shadow-primary/30"
              >
                Create Lesson Plan
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/prompt-library"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border-2 border-secondary text-secondary font-semibold text-base hover:bg-secondary hover:text-white transition-colors"
              >
                Browse Prompt Library
              </Link>
            </div>

            {/* Trust bar */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                No login required
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Completely free
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                CBSE · ICSE · State Board
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-secondary">
              Everything a teacher needs
            </h2>
            <p className="mt-3 text-gray-500 text-lg">
              Powered by AI, designed for Indian classrooms
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-lg hover:border-primary-200 transition-all duration-200"
              >
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary-50 text-primary mb-5 group-hover:bg-primary group-hover:text-white transition-colors duration-200">
                  {feature.icon}
                </div>

                <h3 className="text-xl font-bold text-secondary mb-2">{feature.title}</h3>
                <p className="text-primary font-semibold text-sm mb-3">{feature.description}</p>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">{feature.detail}</p>

                <Link
                  href={feature.href}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:text-primary transition-colors"
                >
                  {feature.cta}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="bg-secondary py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Start saving time today
          </h2>
          <p className="text-secondary-200 text-lg mb-8">
            Join thousands of teachers across India using Gyaan Mitra to teach smarter.
          </p>
          <Link
            href="/lesson-plans"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-white font-bold text-lg hover:bg-primary-600 transition-colors shadow-lg shadow-primary/40"
          >
            Get Started — It&apos;s Free
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
