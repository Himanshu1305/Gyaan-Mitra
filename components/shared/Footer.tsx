import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-secondary text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Gyaan Mitra</h3>
            <p className="text-secondary-200 text-sm leading-relaxed">
              AI for Teachers — Transforming Indian Classrooms
            </p>
            <p className="mt-3 text-sm text-primary font-medium">gyaanmitra.com</p>
          </div>

          {/* Tools & Pages */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Tools</h4>
            <ul className="space-y-2 text-sm text-secondary-200">
              <li><Link href="/lesson-plans" className="hover:text-primary transition-colors">Lesson Plan Generator</Link></li>
              <li><Link href="/worksheets" className="hover:text-primary transition-colors">Worksheet Creator</Link></li>
              <li><Link href="/exam-papers" className="hover:text-primary transition-colors">Exam Paper Generator</Link></li>
              <li><Link href="/prompt-library" className="hover:text-primary transition-colors">Prompt Library</Link></li>
              <li><Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
              <li><Link href="/about" className="hover:text-primary transition-colors">About</Link></li>
            </ul>
          </div>

          {/* NEP badge + info */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Compliance</h4>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-4 py-2">
              <span className="text-primary text-lg">✓</span>
              <span className="text-sm font-medium text-white">Aligned with NEP 2020</span>
            </div>
            <p className="mt-3 text-xs text-secondary-200">
              Built for CBSE, ICSE, and State Board teachers across India.
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-secondary-200">
          <p>© {new Date().getFullYear()} Gyaan Mitra. All rights reserved.</p>
          <p>Made with care for teachers across India 🇮🇳</p>
        </div>
      </div>
    </footer>
  );
}
