import type { Bibliometrics, Snapshot } from "@/lib/record/bibliometrics";
import type { Event } from "@/lib/record/metrics";

/**
 * Two running totals on one time axis: citations, and your own involvement in
 * the community (every card, null result, repeat, question, answer, review,
 * mentorship and deposit you made). Reuse by others is left out on purpose:
 * that is what others did, not what you did.
 */

export type Range = "weeks" | "months" | "years";
export const RANGES: { key: Range; label: string; points: number }[] = [
  { key: "weeks",  label: "Weeks",  points: 12 },
  { key: "months", label: "Months", points: 12 },
  { key: "years",  label: "Years",  points: 10 },
];

export type Timeline = {
  range: Range;
  labels: string[];          // x tick per point
  tips: string[];            // full label for the hover readout
  citations: (number | null)[];
  involvement: number[];
  citationsNote: string;     // where the citation line comes from
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** End of each period, oldest first; the last one is "now". */
function periodEnds(range: Range, n: number): Date[] {
  const now = new Date();
  const ends: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    let d: Date;
    if (range === "weeks") {
      const monday = new Date(now); monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      d = new Date(monday.getTime() + (1 - i) * 7 * 864e5 - 1);
    } else if (range === "months") {
      d = new Date(now.getFullYear(), now.getMonth() - i + 1, 1, 0, 0, 0, -1);
    } else {
      d = new Date(now.getFullYear() - i + 1, 0, 1, 0, 0, 0, -1);
    }
    ends.push(i === 0 ? now : d);
  }
  return ends;
}

export function buildTimeline(range: Range, events: Event[], b: Bibliometrics, snapshots: Snapshot[]): Timeline {
  const n = RANGES.find((r) => r.key === range)!.points;
  const ends = periodEnds(range, n);

  const mine = events.filter((e) => !e.reuse).map((e) => +new Date(e.at)).sort((a, z) => a - z);
  const involvement = ends.map((end) => mine.filter((t) => t <= +end).length);

  let citations: (number | null)[] = ends.map(() => null);
  let citationsNote = "Add your ORCID in Settings to plot citations.";
  if (b.state === "ok") {
    if (range === "years") {
      const first = Math.min(...b.countsByYear.map((c) => c.year), b.year);
      citations = ends.map((end) => {
        const y = end.getFullYear();
        if (y < first) return null;
        return b.citations - b.countsByYear.filter((c) => c.year > y).reduce((s, c) => s + c.cited_by_count, 0);
      });
      citationsNote = `Totals at each year end, from OpenAlex's citations per year${b.example ? " (example values)" : ""}.`;
    } else {
      citations = ends.map((end) => {
        const day = end.toISOString().slice(0, 10);
        let v: number | null = null;
        for (const s of snapshots) if (s.day <= day) v = s.citations;
        return v;
      });
      const since = snapshots[0]?.day;
      citationsNote = b.example
        ? "Example values for the demo account."
        : since
          ? `OpenAlex reports citations per year only, so SciCollab records your total once a day; the line starts on ${since}.`
          : "OpenAlex reports citations per year only; SciCollab starts recording your total today.";
    }
  } else if (b.state === "unreachable") {
    citationsNote = "OpenAlex could not be reached, so citations are not plotted.";
  }

  const fmt = (d: Date) =>
    range === "years" ? String(d.getFullYear())
    : range === "months" ? `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
    : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const monday = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const labels = ends.map((d) => (range === "weeks" ? fmt(monday(d)) : fmt(d)));
  const tips = ends.map((d, i) => {
    const last = i === ends.length - 1;
    if (range === "weeks") return last ? "This week, so far" : `Week of ${fmt(monday(d))}`;
    if (range === "months") return last ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}, so far` : `End of ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    return last ? `${d.getFullYear()}, so far` : `End of ${d.getFullYear()}`;
  });

  return { range, labels, tips, citations, involvement, citationsNote };
}
