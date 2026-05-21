"use client";

import { useState } from "react";
import Link from "next/link";
import { addToWaitlist } from "@/lib/mock-db";

function WaitlistForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail]     = useState("");
  const [status, setStatus]   = useState<"idle" | "success" | "dupe" | "invalid">("idle");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) { setStatus("invalid"); return; }
    setLoading(true);
    setTimeout(() => {
      const added = addToWaitlist(email.trim());
      setStatus(added ? "success" : "dupe");
      setLoading(false);
      if (added) setEmail("");
    }, 600);
  }

  if (status === "success") {
    return (
      <div className={`flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 ${compact ? "text-sm" : ""}`}>
        <span>🎉</span>
        <span className="font-medium">You&apos;re on the list! We&apos;ll be in touch.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex gap-2 ${compact ? "flex-col sm:flex-row" : "flex-col sm:flex-row"}`}>
      <input
        type="email"
        placeholder="your@institution.edu"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (status !== "idle") setStatus("idle"); }}
        className={`flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors ${
          status === "invalid" ? "border-red-400" : ""
        }`}
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm whitespace-nowrap disabled:opacity-60"
      >
        {loading ? "Joining…" : "Request access"}
      </button>
      {status === "dupe" && (
        <p className="text-xs text-amber-600 self-center">You&apos;re already on the list!</p>
      )}
      {status === "invalid" && (
        <p className="text-xs text-red-500 self-center">Please enter a valid email.</p>
      )}
    </form>
  );
}

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-blue-600 tracking-tight">SciCollab</span>
            <span className="text-xs font-medium text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 ml-1">beta</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Sign in</Link>
            <Link
              href="/onboarding"
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Join for free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
          <span className="text-xs font-medium text-blue-700">Invite-only beta · 418 experiments uploaded</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.15] max-w-3xl mb-6">
          Where scientists<br />
          <span className="text-blue-600">debug their research</span><br />
          together
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mb-10 leading-relaxed">
          A collaborative platform for live and unpublished raw science — every experiment,
          successful or not, becomes a building block for the next breakthrough.
          GitHub × Stack Overflow × Database, built for the lab bench.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Link
            href="/onboarding"
            className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-base shadow-sm"
          >
            Get started — it&apos;s free
          </Link>
          <a
            href="#how-it-works"
            className="border border-slate-300 text-slate-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-slate-50 transition-colors text-base"
          >
            See how it works
          </a>
        </div>

        {/* Waitlist inline */}
        <div className="w-full max-w-md mb-12">
          <p className="text-xs text-slate-400 mb-2">Or join the waitlist — no commitment:</p>
          <WaitlistForm />
          <p className="text-xs text-slate-400 mt-2">
            Already have a code?{" "}
            <Link href="/onboarding" className="text-blue-600 hover:underline">Sign up →</Link>
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-2xl w-full">
          {[
            { value: "67%", label: "of experiments never shared — until now" },
            { value: "100%", label: "of researchers use AI as their first step" },
            { value: "<24h", label: "peer answers in our concierge prototype" },
            { value: "$28B", label: "wasted annually on non-reproducible research" },
          ].map((stat) => (
            <div key={stat.value} className="text-center">
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-1 leading-snug">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">One platform. Three jobs done.</h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Scientists have GitHub for code, Stack Overflow for debugging, and databases for data.
              SciCollab connects all three for the experimental lab.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "🧪",
                title: "Method Cards",
                description:
                  "Structured experiment records with protocol version, conditions, reagents, and outcomes. Negative results are first-class citizens — not an afterthought.",
                tag: "Upload & Tag",
              },
              {
                icon: "💬",
                title: "Peer Q&A",
                description:
                  "Ask questions grounded in specific experiments. AI routes to researchers with matching expertise. Every answer enriches the method card.",
                tag: "Ask Peers",
              },
              {
                icon: "🤖",
                title: "AI Retrieval",
                description:
                  "AI grounded in structured artifacts — not generative hallucination. If no experiment matches your query, it says so. Reliable, not just confident.",
                tag: "Search & Discover",
              },
            ].map((feature) => (
              <div key={feature.title} className="border border-slate-200 rounded-2xl p-6 hover:border-blue-200 hover:shadow-sm transition-all">
                <div className="text-3xl mb-4">{feature.icon}</div>
                <div className="inline-block text-xs font-medium text-blue-600 bg-blue-50 rounded-full px-2.5 py-0.5 mb-3">
                  {feature.tag}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow steps */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">How researchers use SciCollab</h2>
            <p className="text-slate-600">From onboarding to breakthrough — the full loop.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { step: "01", title: "Onboard", desc: "Sign up, verify ORCID, join your lab workspace" },
              { step: "02", title: "Upload", desc: "Create a method card with conditions, protocol, and outcome" },
              { step: "03", title: "Search", desc: "AI-grounded discovery across all structured experiments" },
              { step: "04", title: "Ask Peers", desc: "Post Q&A anchored to specific experiment artifacts" },
              { step: "05", title: "Fork & Adapt", desc: "Build on existing protocols with tracked attribution" },
              { step: "06", title: "Contribute Back", desc: "Earn reputation — even from negative results" },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-xs font-bold text-blue-500 mb-2">{item.step}</div>
                <div className="font-semibold text-slate-900 mb-1">{item.title}</div>
                <div className="text-sm text-slate-500">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="py-16 px-6 bg-slate-900 dark:bg-slate-800 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <blockquote className="text-xl font-medium leading-relaxed mb-6 text-slate-100">
            &ldquo;A dedicated database of what didn&apos;t work would save others months of troubleshooting.&rdquo;
          </blockquote>
          <cite className="text-sm not-italic" style={{ color: "#94a3b8" }}>
            Tanzila Mukhtar · Researcher interview, Nov 2025
          </cite>
        </div>
      </section>

      {/* CTA with waitlist */}
      <section className="py-24 px-6 bg-gradient-to-b from-white to-blue-50">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Ready to stop losing research?
          </h2>
          <p className="text-slate-600 mb-8">
            Join the beta. Get your lab workspace, upload your first experiment, and connect with peers in under 5 minutes.
          </p>
          <Link
            href="/onboarding"
            className="inline-block bg-blue-600 text-white px-10 py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-base shadow-sm mb-6"
          >
            Create your account →
          </Link>
          <p className="text-sm text-slate-500 mb-4">or join the waitlist:</p>
          <WaitlistForm compact />
          <p className="text-xs text-slate-400 mt-4">Free for individual researchers · No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-600">SciCollab</span>
            <span className="text-xs text-slate-400">… Science Made Easy</span>
          </div>
          <p className="text-xs text-slate-400">© 2026 SciCollab · EU data residency · GDPR compliant</p>
        </div>
      </footer>
    </div>
  );
}
