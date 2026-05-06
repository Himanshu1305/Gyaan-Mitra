import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import { seoConfig } from "@/app/seo-config";

export const metadata: Metadata = {
  title: seoConfig.pricing.title,
  description: seoConfig.pricing.description,
  keywords: seoConfig.pricing.keywords,
};

const FREE_FEATURES = [
  "5 AI generations per month",
  "Full Prompt Library access (78 prompts)",
  "Lesson Plan Generator",
  "Worksheet Creator",
  "Exam Paper Generator",
  "No credit card needed",
];

const PREMIUM_FEATURES = [
  "Unlimited AI generations",
  "Save unlimited content to dashboard",
  "Priority support",
  "All future features included",
  "Perfect for active teachers",
  "Cancel anytime",
];

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="bg-secondary py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Simple, Teacher-Friendly Pricing
          </h1>
          <p className="mt-3 text-secondary-200 text-lg">
            Start free. Upgrade only if you need more.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="flex-1 bg-gray-50 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

            {/* Free card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Free Forever</p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-extrabold text-secondary">₹0</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">No credit card required</p>
              </div>

              <ul className="space-y-3 mb-8">
                {FREE_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className="block w-full text-center px-6 py-3 rounded-xl border-2 border-secondary text-secondary font-bold text-sm hover:bg-secondary hover:text-white transition-colors"
              >
                Get Started Free
              </Link>
            </div>

            {/* Premium card */}
            <div className="bg-white rounded-2xl border-2 border-primary shadow-lg shadow-primary/10 p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-white text-xs font-bold px-4 py-1 rounded-full shadow-sm">
                  Most Popular
                </span>
              </div>

              <div className="mb-6">
                <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">Premium</p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-extrabold text-secondary">₹499</span>
                  <span className="text-gray-400 text-sm pb-2">/year</span>
                </div>
                <p className="text-sm text-primary font-semibold mt-1">Less than ₹42 per month</p>
              </div>

              <ul className="space-y-3 mb-8">
                {PREMIUM_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                disabled
                className="block w-full text-center px-6 py-3 rounded-xl bg-primary/20 text-primary font-bold text-sm cursor-not-allowed"
              >
                Coming Soon
              </button>

              <p className="text-center text-xs text-gray-400 mt-3">
                Payment integration coming soon.{" "}
                <Link href="/about" className="text-primary hover:text-primary-600 font-medium transition-colors">
                  Register your interest
                </Link>
              </p>
            </div>

          </div>

          {/* FAQ note */}
          <div className="mt-12 bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <h3 className="font-bold text-secondary mb-2">Questions about pricing?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Gyaan Mitra is free to use for all teachers in India. Premium is for those who need unlimited access.
            </p>
            <Link
              href="/about"
              className="text-sm font-semibold text-primary hover:text-primary-600 transition-colors"
            >
              Contact us →
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
