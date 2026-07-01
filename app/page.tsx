"use client";

import { useState } from "react";
import Link from "next/link";
import { addToWaitlist } from "@/lib/mock-db";

const L = {
  bg:       "#f8fafc",
  surface:  "#ffffff",
  surface2: "#f1f5f9",
  border:   "#e2e8f0",
  text:     "#0f172a",
  muted:    "#475569",
  subtle:   "#94a3b8",
};

function WaitlistForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail]   = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "dupe" | "invalid">("idle");
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 16px", color: "#15803d", fontSize: compact ? 14 : 16 }}>
        <span>🎉</span>
        <span style={{ fontWeight: 600 }}>You&apos;re on the list! We&apos;ll be in touch.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input
        type="email"
        placeholder="your@institution.edu"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (status !== "idle") setStatus("idle"); }}
        style={{ flex: 1, minWidth: 180, border: `1px solid ${status === "invalid" ? "#f87171" : L.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 14, outline: "none", background: L.surface, color: L.text }}
      />
      <button type="submit" disabled={loading}
        style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, whiteSpace: "nowrap" }}>
        {loading ? "Joining…" : "Request access"}
      </button>
      {status === "dupe"    && <p style={{ fontSize: 12, color: "#d97706", alignSelf: "center", margin: 0 }}>Already on the list!</p>}
      {status === "invalid" && <p style={{ fontSize: 12, color: "#dc2626", alignSelf: "center", margin: 0 }}>Please enter a valid email.</p>}
    </form>
  );
}

export default function LandingPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: L.bg, color: L.text, colorScheme: "only light" }}>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: `1px solid ${L.border}`, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#2563eb", letterSpacing: "-0.02em" }}>SciCollab</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: L.subtle, border: `1px solid ${L.border}`, borderRadius: 4, padding: "2px 6px" }}>beta</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/login" style={{ fontSize: 14, color: L.muted, textDecoration: "none" }}>Sign in</Link>
            <Link href="/onboarding" style={{ fontSize: 14, background: "#2563eb", color: "#fff", padding: "8px 16px", borderRadius: 8, fontWeight: 600, textDecoration: "none" }}>
              Join for free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "96px 24px", background: L.bg }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 999, padding: "6px 16px", marginBottom: 32 }}>
          <span style={{ width: 8, height: 8, background: "#3b82f6", borderRadius: "50%", display: "inline-block" }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "#1d4ed8" }}>Invite-only beta · 418 experiments uploaded</span>
        </div>

        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.75rem)", fontWeight: 700, lineHeight: 1.15, maxWidth: 768, marginBottom: 24, color: L.text }}>
          Where scientists <span style={{ color: "#2563eb" }}>debug their&nbsp;research</span> together
        </h1>

        <p style={{ fontSize: 18, color: L.muted, maxWidth: 640, marginBottom: 40, lineHeight: 1.7 }}>
          A collaborative platform for live and unpublished raw science — every experiment, successful or not, becomes a building block for the next breakthrough.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 40 }}>
          <Link href="/onboarding" style={{ background: "#2563eb", color: "#fff", padding: "14px 32px", borderRadius: 12, fontWeight: 600, fontSize: 16, textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,.12)" }}>
            Get started — it&apos;s free
          </Link>
          <Link href="/login" style={{ border: `1px solid ${L.border}`, color: L.text, padding: "14px 32px", borderRadius: 12, fontWeight: 600, fontSize: 16, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 32, maxWidth: 640, width: "100%" }}>
          {[
            { value: "67%",  label: "of experiments never shared — until now" },
            { value: "100%", label: "of researchers use AI as their first step" },
            { value: "<24h", label: "peer answers in our concierge prototype" },
            { value: "$28B", label: "wasted annually on non-reproducible research" },
          ].map((s) => (
            <div key={s.value} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: L.text }}>{s.value}</div>
              <div style={{ fontSize: 12, color: L.subtle, marginTop: 4, lineHeight: 1.4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: "96px 24px", background: L.surface }}>
        <div style={{ maxWidth: 1024, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2 style={{ fontSize: 30, fontWeight: 700, color: L.text, marginBottom: 16 }}>One platform. Three jobs done.</h2>
            <p style={{ color: L.muted, maxWidth: 480, margin: "0 auto" }}>GitHub for code, Stack Overflow for debugging, database for data — SciCollab connects all three for the lab bench.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 32 }}>
            {[
              { icon: "🧪", tag: "Upload & Tag",     title: "Method Cards",   desc: "Structured experiment records with protocol, conditions, reagents, and outcomes. Negative results are first-class citizens." },
              { icon: "💬", tag: "Ask Peers",         title: "Peer Q&A",       desc: "Ask questions grounded in specific experiments. AI routes to researchers with matching expertise." },
              { icon: "🤖", tag: "Search & Discover", title: "AI Retrieval",   desc: "AI grounded in structured artifacts — not generative hallucination. Reliable, not just confident." },
            ].map((f) => (
              <div key={f.title} style={{ border: `1px solid ${L.border}`, borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 30, marginBottom: 16 }}>{f.icon}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", background: "#eff6ff", borderRadius: 999, padding: "3px 10px", display: "inline-block", marginBottom: 12 }}>{f.tag}</span>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: L.text, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: L.muted, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section style={{ padding: "64px 24px", background: "#0f172a" }}>
        <div style={{ maxWidth: 768, margin: "0 auto", textAlign: "center" }}>
          <blockquote style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.7, color: "#f1f5f9", marginBottom: 24 }}>
            &ldquo;A dedicated database of what didn&apos;t work would save others months of troubleshooting.&rdquo;
          </blockquote>
          <cite style={{ fontSize: 14, color: "#94a3b8", fontStyle: "normal" }}>Tanzila Mukhtar · Researcher interview, Nov 2025</cite>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "96px 24px", background: "#eff6ff" }}>
        <div style={{ maxWidth: 512, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, color: L.text, marginBottom: 16 }}>Ready to stop losing research?</h2>
          <p style={{ color: L.muted, marginBottom: 32 }}>Join the beta. Upload your first experiment and connect with peers in under 5 minutes.</p>
          <Link href="/onboarding" style={{ display: "inline-block", background: "#2563eb", color: "#fff", padding: "16px 40px", borderRadius: 12, fontWeight: 600, fontSize: 16, textDecoration: "none", marginBottom: 24 }}>
            Create your account →
          </Link>
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 14, color: L.muted, marginBottom: 12 }}>Or join the waitlist:</p>
            <WaitlistForm compact />
          </div>
          <p style={{ fontSize: 12, color: L.subtle, marginTop: 16 }}>Free for individual researchers · No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${L.border}`, padding: "32px 24px", background: L.surface }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <span style={{ fontWeight: 700, color: "#2563eb" }}>SciCollab</span>
          <p style={{ fontSize: 12, color: L.subtle }}>© 2026 SciCollab · EU data residency · GDPR compliant</p>
        </div>
      </footer>
    </div>
  );
}
