import Link from "next/link";
import { Panel, PanelHead } from "@/components/ui";
import { CV_KINDS, CV_LABEL, span, sortCv, type CvEntry } from "@/lib/cv";

const row = { display: "flex", gap: 10, padding: "8px 14px", borderBottom: "1px solid var(--rule)", font: "400 13px/1.5 var(--sans)" } as const;
const when = { flex: "0 0 92px", font: "400 12px/1.55 var(--sans)", color: "var(--mute)" } as const;

/** The CV on a profile: positions and education first, the rest one click away. */
export default function CvPanel({ entries, summary, isMe }: { entries: CvEntry[]; summary?: string; isMe: boolean }) {
  if (!entries.length && !summary) {
    return isMe ? <Panel><PanelHead>CV</PanelHead><div style={{ padding: 14, font: "400 13px/1.6 var(--sans)", color: "var(--mute)" }}>Add positions, degrees and grants, and export them as a DFG or ERC CV. <Link href="/you/cv" style={{ color: "var(--link)" }}>Your CV →</Link></div></Panel> : null;
  }
  const sorted = [...entries].sort(sortCv);
  const top = sorted.filter((e) => e.kind === "position" || e.kind === "education").slice(0, 5);
  const rest = CV_KINDS.filter((k) => sorted.some((e) => e.kind === k && !top.includes(e)));
  const Row = ({ e }: { e: CvEntry }) => (
    <div style={row}><span style={when}>{span(e)}</span><span style={{ minWidth: 0 }}><b style={{ fontWeight: 600 }}>{e.title}</b>{e.org && <span style={{ color: "var(--mute)" }}>, {e.org}</span>}</span></div>
  );
  return (
    <Panel>
      <PanelHead>CV</PanelHead>
      {summary && <p style={{ margin: 0, padding: "10px 14px", borderBottom: "1px solid var(--rule)", font: "400 13px/1.65 var(--sans)" }}>{summary}</p>}
      {top.map((e) => <Row key={e.id} e={e} />)}
      {rest.length > 0 && (
        <details className="sc-more-replies">
          <summary style={{ listStyle: "none", cursor: "pointer", padding: "9px 14px", font: "600 12.5px/1.5 var(--sans)", color: "var(--mute)" }}>
            <span className="sc-when-closed">Full CV · {rest.map((k) => CV_LABEL[k].label.toLowerCase()).join(", ")}</span><span className="sc-when-open">Less</span>
          </summary>
          {rest.map((k) => (
            <div key={k}>
              <div style={{ padding: "8px 14px 2px", font: "600 11.5px/1.4 var(--sans)", color: "var(--mute)", textTransform: "uppercase", letterSpacing: ".06em" }}>{CV_LABEL[k].label}</div>
              {sorted.filter((e) => e.kind === k && !top.includes(e)).map((e) => <Row key={e.id} e={e} />)}
            </div>
          ))}
        </details>
      )}
      {isMe && <div style={{ padding: "9px 14px" }}><Link href="/you/cv" style={{ font: "600 12.5px/1.5 var(--sans)", color: "var(--link)", textDecoration: "none" }}>Edit or export →</Link></div>}
    </Panel>
  );
}
