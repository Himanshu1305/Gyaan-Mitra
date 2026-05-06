import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import ShareButtons from "@/components/ShareButtons";
import { blogPosts, CATEGORY_COLORS } from "@/lib/blog-posts";

interface PageProps {
  params: { slug: string };
}

export async function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = blogPosts.find((p) => p.slug === params.slug);
  if (!post) return {};
  return {
    title: `${post.title} | Gyaan Mitra`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://gyaanmitra.com/blog/${post.slug}`,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

/* ── Markdown renderer ─────────────────────────────────────────── */

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={i} className="font-semibold text-secondary">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2 && !part.startsWith("**")) {
          return (
            <em key={i} className="italic text-gray-600">
              {part.slice(1, -1)}
            </em>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function renderContent(content: string) {
  const blocks = content
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter((b) => b && b !== "---");

  return (
    <>
      {blocks.map((block, blockIdx) => {
        /* H2 */
        if (block.startsWith("## ")) {
          return (
            <h2
              key={blockIdx}
              className="text-2xl font-bold text-secondary mt-10 mb-4 leading-snug"
            >
              {renderInline(block.slice(3))}
            </h2>
          );
        }

        /* H3 */
        if (block.startsWith("### ")) {
          return (
            <h3
              key={blockIdx}
              className="text-lg font-semibold text-secondary mt-7 mb-3"
            >
              {renderInline(block.slice(4))}
            </h3>
          );
        }

        const lines = block.split("\n");
        const hasBullets = lines.some((l) => /^[-*]\s/.test(l.trim()));

        /* Block containing bullet lines (possibly mixed with text) */
        if (hasBullets) {
          const elements: JSX.Element[] = [];
          let bullets: string[] = [];
          let bulletKey = 0;

          const flushBullets = () => {
            if (bullets.length === 0) return;
            elements.push(
              <ul key={`${blockIdx}-ul-${bulletKey++}`} className="my-5 space-y-2.5">
                {bullets.map((item, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <span className="mt-[0.6rem] w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span className="text-gray-700 leading-[1.8] text-base">
                      {renderInline(item)}
                    </span>
                  </li>
                ))}
              </ul>
            );
            bullets = [];
          };

          lines.forEach((line, li) => {
            const t = line.trim();
            if (!t) { flushBullets(); return; }
            if (/^[-*]\s/.test(t)) {
              bullets.push(t.replace(/^[-*]\s+/, ""));
            } else {
              flushBullets();
              elements.push(
                <p
                  key={`${blockIdx}-p-${li}`}
                  className="text-gray-700 leading-[1.8] text-base mb-3"
                >
                  {renderInline(t)}
                </p>
              );
            }
          });
          flushBullets();

          return <div key={blockIdx}>{elements}</div>;
        }

        /* Regular paragraph — join lines with a space */
        const joined = lines.map((l) => l.trim()).filter(Boolean).join(" ");
        return (
          <p
            key={blockIdx}
            className="text-gray-700 leading-[1.8] text-base mb-5"
          >
            {renderInline(joined)}
          </p>
        );
      })}
    </>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function BlogPostPage({ params }: PageProps) {
  const post = blogPosts.find((p) => p.slug === params.slug);
  if (!post) notFound();

  const pageUrl = `https://gyaanmitra.com/blog/${post.slug}`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    author: { "@type": "Organization", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "Gyaan Mitra",
      url: "https://gyaanmitra.com",
    },
    datePublished: post.date,
    url: pageUrl,
  };

  const relatedPosts = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <Navbar />

      {/* Hero */}
      <section className="bg-secondary py-14 px-4">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-secondary-200 hover:text-white text-sm font-medium mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Articles
          </Link>

          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full inline-block mb-4 ${
              CATEGORY_COLORS[post.category] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {post.category}
          </span>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight mb-4">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-secondary-200 text-sm">
            <span>{post.author}</span>
            <span>&middot;</span>
            <span>{post.date}</span>
            <span>&middot;</span>
            <span>{post.readTime}</span>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="flex-1 bg-gray-50 py-14 px-4">
        <div className="max-w-3xl mx-auto">

          {/* Share buttons */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-7 py-5 mb-10">
            <ShareButtons url={pageUrl} title={post.title} />
          </div>

          {/* Article body */}
          <article className="bg-white rounded-2xl border border-gray-100 shadow-sm px-7 sm:px-10 py-10">
            {renderContent(post.content)}
          </article>

          {/* Share again at bottom */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-7 py-5 mt-10">
            <ShareButtons url={pageUrl} title={post.title} />
          </div>

          {/* Related articles */}
          {relatedPosts.length > 0 && (
            <div className="mt-16">
              <h2 className="text-2xl font-bold text-secondary mb-8">More Articles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/blog/${related.slug}`}
                    className="group bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:border-primary-200 transition-all duration-200 flex flex-col"
                  >
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full inline-block mb-3 ${
                        CATEGORY_COLORS[related.category] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {related.category}
                    </span>
                    <h3 className="text-sm font-bold text-secondary group-hover:text-primary transition-colors leading-snug mb-2">
                      {related.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-auto pt-3">{related.readTime}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-14 bg-secondary rounded-2xl p-8 sm:p-10 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">
              Ready to save hours every week?
            </h2>
            <p className="text-secondary-200 text-sm mb-6">
              Create lesson plans, worksheets, and exam papers in minutes with Gyaan Mitra — free for all teachers.
            </p>
            <Link
              href="/lesson-plans"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-600 transition-colors shadow-lg shadow-primary/30"
            >
              Try Gyaan Mitra Free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
