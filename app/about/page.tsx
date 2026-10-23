import type { Metadata } from "next";
import Link from "next/link";
import PublicPage, { h2, p, small } from "@/components/PublicPage";

export const metadata: Metadata = { title: "About — SciCollab" };

/*
 * Source for everything on this page: the team's submitted strategic-project
 * deck (ESSEC & Mannheim EMBA, May 2026) — team roles slide, field research
 * and prototype test slides, and the "What's next" timeline.
 * Survey figures are the team's own (small samples, stated as such).
 */

const TEAM = [
  { name: "Christian", role: "Product & Research Lead", line: "Clinician-scientist. Domain expertise, R&D roadmap, academic partnerships." },
  { name: "Janmejay", role: "Tech & Engineering Lead", line: "Platform architecture, the MVP build, structuring data, the AI retrieval layer." },
  { name: "Elias", role: "Marketing & Community Lead", line: "Go-to-market, community growth, the lab-champion network, conference adoption." },
  { name: "Yann", role: "Operations & Legal Lead", line: "Infrastructure, compliance, GDPR, data governance, the IP framework." },
  { name: "Hoelig", role: "Finance & Strategy Lead", line: "Financial modelling, investor relations, pricing strategy, SaaS metrics." },
  { name: "Maureen", role: "Partnerships & Enterprise Sales", line: "Institutional pilots, letters of intent, enterprise onboarding, R&D partnerships." },
];

const BUILDING = [
  ["Questions that carry their evidence", "A question comes with the data, the code, the conditions and the outcome that produced it — so the people answering see what you see."],
  ["Method cards", "Structured, versioned records of how something was actually done, including the conditions under which it failed. Fork one, run it, and your result attaches to it."],
  ["Negative results as first-class objects", "A failure that reproduces is a contribution. Null results are citable and reusable, with the same weight as a positive one."],
  ["A living database of unpublished science", "Raw data and methods stored before and alongside formal publication — searchable by the next person who hits the same wall."],
  ["AI that finds; people who validate", "AI retrieves and structures prior cases. The community checks them. No black-box answers on questions that matter."],
];

export default function AboutPage() {
  return (
    <PublicPage
      eyebrow="ABOUT US"
      title="Science, easy together."
      lede="SciCollab is where researchers share the data, methods and failed runs behind their work — before publication — and get help from peers who have been there."
    >
      <h2 style={{ ...h2, marginTop: 0, paddingTop: 0, borderTop: 0 }}>Why we exist</h2>
      <p style={p}>
        An experiment fails. The researcher asks a colleague — nobody knows. The supervisor — stumped, or busy.
        Collaborators by e-mail — no answer. Weeks later, the work is shelved, and the next lab repeats the same failure,
        because nobody wrote it down anywhere they could find it.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, margin: "18px 0 6px" }}>
        <Stat n="70%+" text="of researchers surveyed by Nature have tried and failed to reproduce another scientist's experiment." src="Baker, Nature 533, 2016" />
        <Stat n="71%" text="of the researchers in our own survey would share their negative results — yet none of them follows an existing negative-results platform." src="SciCollab survey, n = 17" />
        <Stat n="5–90%" text="success rate of AI tools on failed experiments, for researchers who all ask AI first. It has no access to the messy, unpublished context." src="SciCollab survey, n = 6" />
      </div>

      <h2 style={h2}>What we are building</h2>
      <div style={{ border: "1px solid var(--rule)" }}>
        {BUILDING.map(([title, text], i) => (
          <div key={title} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid var(--rule)" : 0 }}>
            <span style={{ font: "500 11px/1.6 var(--mono)", color: "var(--mute)" }}>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div style={{ font: "600 13px/1.4 var(--mono)", marginBottom: 3 }}>{title}</div>
              <div style={{ font: "400 14px/1.6 var(--sans)" }}>{text}</div>
            </div>
          </div>
        ))}
      </div>

      <h2 style={h2}>Where we are</h2>
      <p style={p}>
        We interviewed and surveyed researchers across disciplines, and changed course on what we heard:
        the real pain is not publishing — it is being alone at the bench with a problem. A first prototype was tested
        with early users; their verdict was that the value appears when data, methods and discussion live in one place.
      </p>
      <ol style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 0, border: "1px solid var(--ink)" }}>
        {[
          ["DONE", "Field research", "Interviews and two surveys with researchers."],
          ["DONE", "Prototype", "Five core flows tested with early users."],
          ["NEXT", "Invite-only beta", "A first cohort of about 50 researchers."],
          ["PLANNED", "Public launch", "Targeted for December 2026."],
        ].map(([state, title, text], i) => (
          <li key={title} style={{ padding: "12px 14px", borderLeft: i ? "1px solid var(--rule)" : 0 }}>
            <div style={{ font: "700 9.5px/1 var(--mono)", letterSpacing: ".1em", color: state === "DONE" ? "var(--ok)" : state === "NEXT" ? "var(--signal)" : "var(--mute)", marginBottom: 8 }}>{state}</div>
            <div style={{ font: "600 13px/1.3 var(--mono)", marginBottom: 4 }}>{title}</div>
            <div style={{ font: "400 13px/1.5 var(--sans)", color: "var(--mute)" }}>{text}</div>
          </li>
        ))}
      </ol>

      <h2 style={h2}>Who we are</h2>
      <p style={p}>
        Six people who met in the ESSEC &amp; Mannheim Executive MBA, where SciCollab began as our strategic project.
        Between us: a clinician-scientist, engineers, and people from operations, finance, marketing and enterprise sales.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {TEAM.map((m) => (
          <div key={m.name} style={{ border: "1px solid var(--rule)", background: "var(--bg)", padding: 14, display: "grid", gridTemplateColumns: "40px 1fr", gap: 12 }}>
            <span aria-hidden="true" style={{ width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--ink)", color: "var(--bg)", font: "700 16px/1 var(--mono)" }}>
              {m.name[0]}
            </span>
            <div>
              <div style={{ font: "700 14px/1.2 var(--mono)" }}>{m.name}</div>
              <div style={{ font: "500 10.5px/1.4 var(--mono)", letterSpacing: ".04em", color: "var(--signal)", margin: "3px 0 6px", textTransform: "uppercase" }}>{m.role}</div>
              <div style={{ font: "400 13px/1.5 var(--sans)", color: "var(--mute)" }}>{m.line}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 34, padding: "18px 20px", background: "#0D0D0D", color: "#F2F0EC", display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
        <div style={{ flex: "1 1 260px", font: "500 15px/1.4 var(--mono)" }}>Want to try it in your lab, or just have a question?</div>
        <Link href="/contact" style={{ height: 40, padding: "0 18px", display: "inline-flex", alignItems: "center", background: "#FF5A14", color: "#fff", font: "500 13px/1 var(--mono)" }}>Talk to us</Link>
        <Link href="/faq" style={{ height: 40, padding: "0 18px", display: "inline-flex", alignItems: "center", border: "1px solid #F2F0EC", color: "#F2F0EC", font: "500 13px/1 var(--mono)" }}>Read the questions</Link>
      </div>

      <p style={{ ...small, marginTop: 20 }}>
        Survey figures are from our own field research in 2026 (small samples, as noted). Nature figure: M. Baker,
        &ldquo;1,500 scientists lift the lid on reproducibility&rdquo;, Nature 533, 452–454 (2016).
      </p>
    </PublicPage>
  );
}

function Stat({ n, text, src }: { n: string; text: string; src: string }) {
  return (
    <div style={{ border: "1px solid var(--ink)", padding: "14px 14px 12px", background: "var(--bg)" }}>
      <div style={{ font: "700 26px/1 var(--mono)", letterSpacing: "-.03em", color: "var(--signal)", marginBottom: 8 }}>{n}</div>
      <div style={{ font: "400 13px/1.5 var(--sans)", marginBottom: 8 }}>{text}</div>
      <div style={{ font: "400 10.5px/1.4 var(--mono)", color: "var(--mute)" }}>{src}</div>
    </div>
  );
}
