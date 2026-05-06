import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://gyaanmitra.com", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: "https://gyaanmitra.com/lesson-plans", lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: "https://gyaanmitra.com/worksheets", lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: "https://gyaanmitra.com/exam-papers", lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: "https://gyaanmitra.com/prompt-library", lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: "https://gyaanmitra.com/about", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: "https://gyaanmitra.com/pricing", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: "https://gyaanmitra.com/blog", lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: "https://gyaanmitra.com/blog/ai-for-teachers-india-complete-guide", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: "https://gyaanmitra.com/blog/best-ai-prompts-for-teachers-india", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: "https://gyaanmitra.com/blog/nep-2020-ai-tools-teachers", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: "https://gyaanmitra.com/blog/save-time-teaching-ai-indian-teachers", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: "https://gyaanmitra.com/blog/cbse-lesson-plan-guide-teachers", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];
}
