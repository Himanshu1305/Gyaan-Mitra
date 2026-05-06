import type { Metadata } from "next";
import { seoConfig } from "@/app/seo-config";

export const metadata: Metadata = {
  title: seoConfig.promptLibrary.title,
  description: seoConfig.promptLibrary.description,
  keywords: seoConfig.promptLibrary.keywords,
};

export default function PromptLibraryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
