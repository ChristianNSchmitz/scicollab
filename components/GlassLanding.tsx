import Link from "next/link";
import LiveShowcase from "@/components/LiveShowcase";
import type { ShowItem } from "@/lib/showcase";

/**
 * The public front page in the glass look: SciCollab as a network for
 * scientists to exchange ideas, discuss, and share data and methods. A
 * responsive page instead of the fixed 1440px B1 artboard, so it reads the
 * same on a phone. Shown when data-look="glass" (the
 * default); the classic look keeps the board (app/page.tsx).
 */
const FEATURES = [
  { title: "Exchange ideas", text: "Post a result, a question, a paper or a picture from the bench to the topic groups you work in, and get replies from people who run the same experiments." },
  { title: "Discuss in groups", text: "Your lab, consortium or journal club in one place: members, shared projects anyone in the group can join, and what everyone did lately." },
  { title: "Share data and methods", text: "Attach datasets and code to a post, and record methods as cards that others can fork and reproduce, including the conditions under which they fail." },
  { title: "Find your people", text: "Link your ORCID: your publications and citations stay up to date, and your co-authors and people with your techniques are suggested to follow." },
];

export default function GlassLanding({ items }: { items: ShowItem[] }) {
  return (
    <div className="sc-land-glass">
      <header className="sc-public-head" style={{ position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", height: 60, padding: "0 20px", display: "flex", alignItems: "center", gap: 22 }}>
          <Link href="/" aria-label="SciCollab home" style={{ font: "700 18px/1 var(--sans)", letterSpacing: "-.03em", color: "var(--ink)", textDecoration: "none" }}>
            scicollab<span style={{ color: "var(--signal-ink)" }}>/</span>
          </Link>
          <nav aria-label="Public" className="sc-public-nav" style={{ display: "flex", gap: 18, font: "500 14px/1 var(--sans)" }}>
            <Link href="/about" style={{ color: "var(--mute)" }}>About</Link>
            <Link href="/faq" style={{ color: "var(--mute)" }}>Questions</Link>
            <Link href="/contact" style={{ color: "var(--mute)" }}>Contact</Link>
          </nav>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/login" className="sc-gl-btn">Sign in</Link>
            <Link href="/signup" className="sc-gl-btn sc-gl-primary">Create account</Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 20px 64px" }}>
        <section className="sc-gl-hero">
          <div>
            <div style={{ font: "600 13px/1.3 var(--sans)", color: "var(--signal-ink)", marginBottom: 14 }}>
              The network for scientists
            </div>
            <h1 style={{ font: "700 clamp(34px, 5.2vw, 58px)/1.04 var(--sans)", letterSpacing: "-.035em", margin: "0 0 18px" }}>
              Exchange ideas. Discuss your work. Share data and methods.
            </h1>
            <p style={{ font: "400 clamp(16px, 1.6vw, 19px)/1.55 var(--sans)", color: "var(--mute)", margin: "0 0 26px", maxWidth: 560 }}>
              SciCollab connects you with the researchers who run the same experiments as you: ask and answer, follow
              colleagues and co-authors, work together in groups, and share the data and methods behind your results,
              including the runs that didn&apos;t work.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/signup" className="sc-gl-btn sc-gl-primary sc-gl-big">Create your account</Link>
              <Link href="/contact?topic=pilot" className="sc-gl-btn sc-gl-big">Talk to us about a lab pilot</Link>
            </div>
            <p style={{ font: "400 13px/1.5 var(--sans)", color: "var(--mute)", margin: "14px 0 0" }}>
              Free for individual researchers · institutional pilots start at one lab · already a member? <Link href="/login" style={{ color: "var(--link)" }}>Sign in</Link>
            </p>
          </div>
          <div className="sc-gl-show">
            <div style={{ font: "600 12px/1 var(--sans)", color: "var(--mute)", margin: "0 0 10px 4px" }}>A random pick of public work</div>
            <LiveShowcase initial={items} />
          </div>
        </section>

        <section aria-label="What it does" className="sc-gl-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="sc-panel" style={{ padding: "20px 20px 22px", background: "var(--surface)" }}>
              <h2 style={{ font: "650 17px/1.3 var(--sans)", letterSpacing: "-.01em", margin: "0 0 8px" }}>{f.title}</h2>
              <p style={{ font: "400 14.5px/1.6 var(--sans)", color: "var(--mute)", margin: 0 }}>{f.text}</p>
            </div>
          ))}
        </section>

        <section className="sc-panel sc-gl-cta" style={{ background: "var(--surface)" }}>
          <div>
            <h2 style={{ font: "700 clamp(22px, 2.6vw, 30px)/1.15 var(--sans)", letterSpacing: "-.025em", margin: "0 0 8px" }}>
              Someone has already solved your problem. Find them.
            </h2>
            <p style={{ font: "400 15px/1.6 var(--sans)", color: "var(--mute)", margin: 0, maxWidth: 620 }}>
              One place for the people, discussions, data and methods of your field, instead of four tools and whoever happens to be reachable.
            </p>
          </div>
          <Link href="/signup" className="sc-gl-btn sc-gl-primary sc-gl-big">Join SciCollab</Link>
        </section>
      </main>
    </div>
  );
}
