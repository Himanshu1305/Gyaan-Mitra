import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import { blogPosts, CATEGORY_COLORS } from "@/lib/blog-posts";
import { seoConfig } from "@/app/seo-config";

export const metadata: Metadata = {
  title: seoConfig.home.title,
  description: seoConfig.home.description,
  keywords: seoConfig.home.keywords,
};

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
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: "Exam Paper Generator",
    description: "Create unit tests, half-yearly and annual papers instantly",
    detail:
      "Generate complete exam papers for any subject and grade — with MCQs, short and long answers — plus a full answer key and marking scheme.",
    href: "/exam-papers",
    cta: "Create Exam Paper",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    title: "Prompt Library",
    description: "78 ready-to-use prompts for every subject and grade",
    detail:
      "Browse a curated library of AI prompts for lesson planning, parent communication, student feedback, exam prep, and classroom activities.",
    href: "/prompt-library",
    cta: "Browse Prompts",
  },
];

const whyPoints = [
  {
    icon: "⏱",
    title: "Save 8+ Hours Every Week",
    body: "Teachers across India report saving 2 hours per lesson plan. Multiply that by four lessons a week and you get your evenings back.",
  },
  {
    icon: "🎓",
    title: "Built for the Indian Curriculum",
    body: "Gyaan Mitra knows CBSE, ICSE, and State Board syllabi. Every output is aligned to NEP 2020 competency goals — not generic AI filler.",
  },
  {
    icon: "🌐",
    title: "Works in English, Hindi, and Hinglish",
    body: "Generate content in the language you actually teach in. Switch between English and Hindi in one click — no re-prompting needed.",
  },
];

const howItWorksSteps = [
  {
    step: "1",
    title: "Choose Your Tool",
    body: "Pick from Lesson Plan Generator, Worksheet Creator, or Exam Paper Generator.",
  },
  {
    step: "2",
    title: "Fill in the Details",
    body: "Enter subject, grade, topic, and any specific requirements. It takes under a minute.",
  },
  {
    step: "3",
    title: "Get Your Content",
    body: "AI generates complete, curriculum-aligned content in seconds. Copy, edit, or download as PDF.",
  },
];

const faqs = [
  {
    q: "Is Gyaan Mitra free to use?",
    a: "Yes, Gyaan Mitra is free for all teachers in India. You get 5 free AI generations every month with no credit card required. A premium plan for unlimited access is available at ₹499/year.",
  },
  {
    q: "Which boards does Gyaan Mitra support?",
    a: "Gyaan Mitra supports CBSE, ICSE, and all major State Boards across India. The content is aligned with the National Education Policy (NEP) 2020 framework.",
  },
  {
    q: "Can I use Gyaan Mitra to create Hindi lesson plans?",
    a: "Yes. You can generate lesson plans, worksheets, and exam papers in English, Hindi, or a mix of both. Simply mention your language preference when filling in the form.",
  },
  {
    q: "How is Gyaan Mitra different from ChatGPT?",
    a: "Gyaan Mitra is purpose-built for Indian teachers. Unlike ChatGPT, it understands the Indian curriculum, uses the right board-specific formats, and gives you structured output ready to print — without any prompt engineering on your part.",
  },
  {
    q: "Can I edit the generated content?",
    a: "Absolutely. Every piece of content generated is fully editable. You can copy the text, modify it in Word or Google Docs, and tailor it to your classroom needs.",
  },
  {
    q: "Does Gyaan Mitra work on mobile?",
    a: "Yes, Gyaan Mitra works on any device — phone, tablet, or computer. No app download needed. Just open gyaanmitra.com in your browser and start creating.",
  },
  {
    q: "Is the generated content accurate and curriculum-aligned?",
    a: "The AI is prompted to follow CBSE, ICSE, and NEP 2020 guidelines. We recommend reviewing the output before use, as AI can occasionally make errors — especially for highly specific or regional topics.",
  },
  {
    q: "How do I get more than 5 free generations per month?",
    a: "You can upgrade to Gyaan Mitra Premium for ₹499/year, which gives you unlimited generations. This works out to less than ₹42 per month — far less than the cost of a single printed book.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const recentPosts = blogPosts.slice(0, 3);

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

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
              India&apos;s Best AI Tool for Teachers{" "}
              <span className="text-primary">— Save Hours Every Week</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed text-balance">
              Create lesson plans, worksheets, and exam papers in minutes — not hours.
              Gyaan Mitra is built for CBSE, ICSE, and State Board teachers across India.
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
            <div className="mt-10 py-4 px-6 bg-white/70 rounded-2xl border border-gray-100 shadow-sm inline-block">
              <p className="text-sm font-semibold text-gray-600 text-center">
                Trusted by teachers across India &mdash;&nbsp;
                <span className="text-secondary">CBSE</span> &nbsp;&middot;&nbsp;
                <span className="text-secondary">ICSE</span> &nbsp;&middot;&nbsp;
                <span className="text-secondary">State Boards</span> &nbsp;&middot;&nbsp;
                <span className="text-primary font-bold">Aligned with NEP 2020</span>
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
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
                CBSE &middot; ICSE &middot; State Board
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Teachers Love Gyaan Mitra ── */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-secondary">
              Why Teachers Love Gyaan Mitra
            </h2>
            <p className="mt-3 text-gray-500 text-lg">
              Real benefits that make a real difference in the classroom
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {whyPoints.map((pt) => (
              <div key={pt.title} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <div className="text-4xl mb-4">{pt.icon}</div>
                <h3 className="text-xl font-bold text-secondary mb-3">{pt.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{pt.body}</p>
              </div>
            ))}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-lg hover:border-primary-200 transition-all duration-200"
              >
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

      {/* ── How It Works ── */}
      <section className="bg-gradient-to-br from-secondary via-secondary-700 to-secondary-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">How It Works</h2>
            <p className="mt-3 text-secondary-200 text-lg">
              From blank page to ready-to-use content in under 60 seconds
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {howItWorksSteps.map((s, i) => (
              <div key={s.step} className="relative text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary text-white text-2xl font-extrabold mb-5 shadow-lg shadow-primary/30">
                  {s.step}
                </div>
                {i < howItWorksSteps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] right-[-calc(50%-2rem)] h-0.5 bg-white/20" />
                )}
                <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
                <p className="text-secondary-200 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link
              href="/lesson-plans"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-white font-bold text-lg hover:bg-primary-600 transition-colors shadow-lg shadow-primary/40"
            >
              Try It Now — Free
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── From Our Blog ── */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-secondary">From Our Blog</h2>
            <p className="mt-3 text-gray-500 text-lg">
              Practical guides on AI, NEP 2020, and teaching smarter
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {recentPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group bg-white border border-gray-100 rounded-2xl p-7 shadow-sm hover:shadow-lg hover:border-primary-200 transition-all duration-200 flex flex-col"
              >
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full inline-block mb-4 ${CATEGORY_COLORS[post.category] ?? "bg-gray-100 text-gray-600"}`}>
                  {post.category}
                </span>
                <h3 className="text-base font-bold text-secondary mb-3 group-hover:text-primary transition-colors leading-snug">
                  {post.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed flex-1 mb-4">{post.excerpt}</p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{post.date}</span>
                  <span>&middot;</span>
                  <span>{post.readTime}</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-secondary text-secondary font-semibold text-sm hover:bg-secondary hover:text-white transition-colors"
            >
              Read All Articles
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-secondary">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-gray-500 text-lg">
              Everything teachers ask before getting started
            </p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-4 px-7 py-5 cursor-pointer list-none select-none">
                  <span className="font-semibold text-secondary text-sm sm:text-base">{faq.q}</span>
                  <svg
                    className="w-5 h-5 text-gray-400 flex-shrink-0 group-open:rotate-180 transition-transform duration-200"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-7 pb-6">
                  <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
                </div>
              </details>
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
            Get Started &mdash; It&apos;s Free
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
