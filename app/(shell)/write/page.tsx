import Link from "next/link";
import { Page, Panel, mono } from "@/components/ui";

/**
 * Write: one place to start any piece of writing. Each kind has its own form
 * elsewhere; this page says which one fits. Shared drafting of a paper before
 * publication (board F1) needs a collaborative editing backend and the
 * rights check on board F3 first, so it is listed but not offered yet.
 */
const KINDS = [
  { href: "/post", label: "Post in a room", text: "Share a result, ask for a hand or offer a protocol to the people in a room you joined." },
  { href: "/methods/new", label: "Record a method", text: "A method card: what you ran, on what, under which conditions, and what came out, including runs that failed." },
  { href: "/ask", label: "Ask a question", text: "A public question others can answer, vote on and find again later. You can attach a method card." },
  { href: "/projects", label: "Notebook entry", text: "Lab notebook entries live inside a project, next to its data and code. Open a project and use its Notebook tab." },
  { href: "/projects/new", label: "Start a project", text: "A container for the notebook, the datasets and the people working on them." },
];

export default function Write() {
  return (
    <Page title="Write" lede="Pick what you want to write. Each kind has its own form, so the right fields are there from the start.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {KINDS.map((k) => (
          <Link key={k.href} href={k.href} style={{ textDecoration: "none", color: "var(--ink)" }}>
            <Panel style={{ padding: 14, height: "100%" }}>
              <div style={{ font: mono(13, 700), marginBottom: 6 }}>{k.label} <span style={{ color: "var(--signal-ink)" }}>→</span></div>
              <div style={{ font: "400 13.5px/1.6 var(--sans)", color: "var(--mute)" }}>{k.text}</div>
            </Panel>
          </Link>
        ))}
      </div>
      <p style={{ font: "400 13px/1.6 var(--sans)", color: "var(--mute)", marginTop: 18 }}>
        Drafting a manuscript together before publication is planned but not available yet.
      </p>
    </Page>
  );
}
