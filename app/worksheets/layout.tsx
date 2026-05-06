import type { Metadata } from "next";
import { seoConfig } from "@/app/seo-config";

export const metadata: Metadata = {
  title: seoConfig.worksheets.title,
  description: seoConfig.worksheets.description,
  keywords: seoConfig.worksheets.keywords,
};

export default function WorksheetsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
