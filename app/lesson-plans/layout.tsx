import type { Metadata } from "next";
import { seoConfig } from "@/app/seo-config";

export const metadata: Metadata = {
  title: seoConfig.lessonPlans.title,
  description: seoConfig.lessonPlans.description,
  keywords: seoConfig.lessonPlans.keywords,
};

export default function LessonPlansLayout({ children }: { children: React.ReactNode }) {
  return children;
}
