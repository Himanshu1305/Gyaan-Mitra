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

          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full inline-block mb-4 ${CATEGORY_COLORS[post.category] ?? "bg-gray-100 text-gray-600"}`}>
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
            <div
              className="prose prose-gray max-w-none
                prose-headings:text-secondary prose-headings:font-bold
                prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
                prose-h3:text-lg prose-h3:mt-7 prose-h3:mb-3
                prose-p:text-gray-600 prose-p:leading-relaxed prose-p:mb-5
                prose-li:text-gray-600 prose-li:leading-relaxed
                prose-strong:text-secondary prose-strong:font-semibold
                prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
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
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full inline-block mb-3 ${CATEGORY_COLORS[related.category] ?? "bg-gray-100 text-gray-600"}`}>
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
