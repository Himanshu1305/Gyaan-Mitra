import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | Gyaan Mitra",
  description: "Privacy Policy for Gyaan Mitra — how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <section className="bg-secondary py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-extrabold text-white">Privacy Policy</h1>
          <p className="mt-2 text-secondary-200 text-sm">Last updated: May 2026</p>
        </div>
      </section>

      <section className="flex-1 bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-8 prose prose-sm max-w-none text-gray-700 leading-relaxed">

            <h2 className="text-lg font-bold text-secondary mt-0 mb-3">1. Who We Are</h2>
            <p>Gyaan Mitra is an AI-powered teaching assistant for Indian school teachers, operated by <strong>USD Vision AI LLP</strong>. Our platform helps teachers create lesson plans, worksheets, and exam papers. Our website is <strong>gyaanmitra.com</strong>.</p>

            <h2 className="text-lg font-bold text-secondary mt-8 mb-3">2. Information We Collect</h2>
            <p>We collect information you provide directly:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Account information:</strong> Name, email address, and password when you register.</li>
              <li><strong>Usage data:</strong> Content you generate (lesson plans, worksheets, exam papers), inputs you provide (subject, grade, topic, uploaded files), and generation history.</li>
              <li><strong>Technical data:</strong> Browser type, device information, IP address, and cookies for session management.</li>
            </ul>
            <p className="mt-3">We do <strong>not</strong> collect payment card details directly — payments are processed by our payment provider.</p>

            <h2 className="text-lg font-bold text-secondary mt-8 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>To provide and improve the Gyaan Mitra service.</li>
              <li>To track your monthly usage for the free tier limit.</li>
              <li>To save your generated content to your dashboard.</li>
              <li>To send you service-related communications (e.g., account verification).</li>
              <li>To improve our AI prompts and service quality in aggregate.</li>
            </ul>

            <h2 className="text-lg font-bold text-secondary mt-8 mb-3">4. Uploaded Files</h2>
            <p>When you upload a textbook chapter or file, it is sent to our AI provider (Anthropic) to generate your requested content. We do not permanently store uploaded files on our servers beyond the duration of your request. Please do not upload files containing personal data of students or sensitive information.</p>

            <h2 className="text-lg font-bold text-secondary mt-8 mb-3">5. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Supabase:</strong> Authentication and database storage.</li>
              <li><strong>Anthropic:</strong> AI generation (your prompts and inputs are processed by Claude AI).</li>
              <li><strong>Vercel:</strong> Hosting and deployment.</li>
            </ul>
            <p className="mt-3">Each provider has their own privacy policy governing how they handle data.</p>

            <h2 className="text-lg font-bold text-secondary mt-8 mb-3">6. Data Retention</h2>
            <p>We retain your account and generated content as long as your account is active. You may request deletion of your account and associated data by emailing us at <strong>hello@gyaanmitra.com</strong>.</p>

            <h2 className="text-lg font-bold text-secondary mt-8 mb-3">7. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use advertising or tracking cookies. You can disable cookies in your browser settings, but this may affect core functionality.</p>

            <h2 className="text-lg font-bold text-secondary mt-8 mb-3">8. Children&apos;s Privacy</h2>
            <p>Gyaan Mitra is designed for use by <strong>teachers and educators</strong>, not directly by children. We do not knowingly collect personal data from individuals under 13 years of age.</p>

            <h2 className="text-lg font-bold text-secondary mt-8 mb-3">9. Your Rights</h2>
            <p>Depending on your location, you may have rights to access, correct, or delete your personal data. To exercise these rights, contact us at <strong>hello@gyaanmitra.com</strong>.</p>

            <h2 className="text-lg font-bold text-secondary mt-8 mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by email or by a notice on the website. Your continued use of Gyaan Mitra after changes means you accept the updated policy.</p>

            <h2 className="text-lg font-bold text-secondary mt-8 mb-3">11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, contact us at:<br />
              <strong>USD Vision AI LLP</strong><br />
              Email: <strong>hello@gyaanmitra.com</strong>
            </p>
          </div>

          <p className="text-center text-sm text-gray-400">
            Also see our{" "}
            <Link href="/terms" className="text-primary font-medium hover:underline">Terms of Service</Link>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
