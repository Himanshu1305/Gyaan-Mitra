import type { Metadata } from "next";
import { seoConfig } from "@/app/seo-config";

export const metadata: Metadata = {
  title: seoConfig.blog.title,
  description: seoConfig.blog.description,
  keywords: seoConfig.blog.keywords,
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
