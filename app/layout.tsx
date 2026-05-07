import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import CookieBanner from "@/components/CookieBanner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "Gyaan Mitra — Best AI Tool for Teachers in India",
    template: "%s | Gyaan Mitra",
  },
  description: "India's best AI tool for teachers. Create lesson plans, worksheets, and exam papers in minutes. Free to use. Aligned with NEP 2020.",
  keywords: ["AI for teachers India", "best AI tool for teachers", "lesson plan generator India", "AI worksheet maker", "NEP 2020 teaching tools"],
  authors: [{ name: "Himanshu Dixit", url: "https://gyaanmitra.com/about" }],
  creator: "Gyaan Mitra",
  metadataBase: new URL("https://gyaanmitra.com"),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://gyaanmitra.com",
    siteName: "Gyaan Mitra",
    title: "Gyaan Mitra — Best AI Tool for Teachers in India",
    description: "India's best AI tool for teachers. Create lesson plans, worksheets, and exam papers in minutes. Free to use. Aligned with NEP 2020.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Gyaan Mitra — AI for Teachers" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gyaan Mitra — Best AI Tool for Teachers in India",
    description: "India's best AI tool for teachers. Create lesson plans, worksheets, and exam papers in minutes.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} font-sans antialiased bg-white text-gray-900`}>
        <AuthProvider>
          {children}
          <CookieBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
