import Link from "next/link";
import type { ReactNode } from "react";
import SiteFooter from "@/components/SiteFooter";

/**
 * Frame for the public reading pages (About, Questions, Terms, Contact):
 * a slim header with the wordmark, a single readable column, and the footer.
 * Same house rules as the app — borders, no shadows, no rounded corners.
 */
export default function PublicPage({ eyebrow, title, lede, children }: {
  eyebrow: string; title: string; lede?: ReactNode; children: ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)", display: "flex", flexDirection: "column" }}>
      <header className="sc-public-head" style={{ background: "var(--bg)", borderBottom: "1px solid var(--ink)" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", height: 60, padding: "0 16px", display: "flex", alignItems: "center", gap: 22 }}>
          <Link href="/" aria-label="SciCollab home" style={{ display: "inline-flex", alignItems: "flex-end", color: "var(--ink)" }}>
            <span style={{ position: "relative", font: "700 17px/1 var(--mono)", letterSpacing: "-.03em" }}>
              scicollab
              <span style={{ position: "absolute", left: 0, bottom: -5, width: 11, height: 3, background: "var(--signal)" }} />
            </span>
            <span style={{ font: "700 17px/1 var(--mono)", color: "var(--signal-ink)" }}>/</span>
          </Link>
          <nav aria-label="Public" className="sc-public-nav" style={{ display: "flex", gap: 18, font: "500 12px/1 var(--mono)" }}>
            <Link href="/about" style={{ color: "var(--mute)" }}>About</Link>
            <Link href="/faq" style={{ color: "var(--mute)" }}>Questions</Link>
            <Link href="/contact" style={{ color: "var(--mute)" }}>Contact</Link>
          </nav>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/login" style={{ font: "500 12px/1 var(--mono)", color: "var(--ink)" }}>Sign in</Link>
            <Link href="/signup" className="sc-cta-primary" style={{ height: 32, padding: "0 14px", display: "inline-flex", alignItems: "center", background: "var(--signal-fill)", color: "var(--on-signal)", font: "500 12px/1 var(--mono)" }}>
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: "28px 16px 56px" }}>
        <article className="sc-public-card" style={{ maxWidth: 880, margin: "0 auto", background: "var(--surface)", border: "1px solid var(--ink)", padding: "clamp(20px, 4vw, 40px)" }}>
          <div style={{ font: "500 11px/1 var(--mono)", letterSpacing: ".12em", color: "var(--signal-ink)", marginBottom: 12 }}>{eyebrow}</div>
          <h1 style={{ font: "700 clamp(22px, 3.2vw, 30px)/1.15 var(--mono)", letterSpacing: "-.03em", margin: "0 0 12px" }}>{title}</h1>
          {lede && <p style={{ font: "400 15px/1.6 var(--sans)", color: "var(--mute)", margin: "0 0 8px", maxWidth: "64ch" }}>{lede}</p>}
          <div style={{ marginTop: 26 }}>{children}</div>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}

/* Reading styles shared by the public pages. */
export const h2: React.CSSProperties = {
  font: "700 16px/1.3 var(--mono)", letterSpacing: "-.01em", margin: "34px 0 12px",
  paddingTop: 16, borderTop: "1px solid var(--rule)",
};
export const p: React.CSSProperties = { font: "400 14.5px/1.65 var(--sans)", margin: "0 0 12px", maxWidth: "70ch" };
export const small: React.CSSProperties = { font: "400 11.5px/1.6 var(--mono)", color: "var(--mute)" };
