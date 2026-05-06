import type { Metadata } from "next";
import { seoConfig } from "@/app/seo-config";

export const metadata: Metadata = {
  title: seoConfig.about.title,
  description: seoConfig.about.description,
  keywords: seoConfig.about.keywords,
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
