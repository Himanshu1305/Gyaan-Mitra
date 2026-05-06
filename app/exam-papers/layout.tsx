import type { Metadata } from "next";
import { seoConfig } from "@/app/seo-config";

export const metadata: Metadata = {
  title: seoConfig.examPapers.title,
  description: seoConfig.examPapers.description,
  keywords: seoConfig.examPapers.keywords,
};

export default function ExamPapersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
