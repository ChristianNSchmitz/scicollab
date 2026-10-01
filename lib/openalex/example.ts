import type { PubRow, RunRow } from "@/lib/openalex/store";

/**
 * Example publications for the demo persona, which carries ORCID's public
 * test record and is never synced. Invented, labelled as such, and consistent
 * with the persona's example totals (34 works, 412 citations).
 */
const TOPICS = [
  "Passage-dependent transfection efficiency in HEK293T cells",
  "Incubator CO₂ drift as a hidden variable in cell culture",
  "Reporting null results in molecular cell biology",
  "Lipid reagent lot variability and transfection outcomes",
  "qPCR primer efficiency across cDNA synthesis kits",
  "Methanol concentration and high-molecular-weight protein transfer",
  "Flow cytometry gating for low-efficiency knock-ins",
  "Receptor density changes with serial passaging",
  "Endotoxin thresholds in plasmid preparations",
  "Reproducibility of transient expression protocols",
  "Serum-free conditions during lipofection",
  "Automated logging of incubator conditions",
];
const VENUES = ["Example Journal of Cell Methods", "Example Reports in Biology", "Example Protocols", "Example Preprint Server"];

export function examplePublications(userId: string): PubRow[] {
  const year = new Date().getFullYear();
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows: PubRow[] = [];
  for (let i = 0; i < 34; i++) {
    const y = year - Math.floor(i / 3.4);
    const age = year - y + 1;
    rows.push({
      user_id: userId, openalex_id: `W-example-${i}`, doi: null,
      title: `${TOPICS[i % TOPICS.length]}${i >= TOPICS.length ? ` — part ${Math.floor(i / TOPICS.length) + 1}` : ""} (example)`,
      year: y, pub_date: `${y}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-15`,
      venue: VENUES[Math.floor(rnd() * VENUES.length)], type: i % 7 === 3 ? "preprint" : "article",
      cited_by_count: 0, prev_cited_by_count: 0,
      first_seen_at: new Date(Date.now() - (i === 0 ? 2 : 400) * 864e5).toISOString(),
      updated_at: new Date().toISOString(),
    });
    rows[i].cited_by_count = Math.round(age * (2 + rnd() * 3));
  }
  // scale to the persona's 412 total, then give the newest few small recent gains
  const sum = rows.reduce((n, r) => n + r.cited_by_count, 0);
  let left = 412;
  rows.forEach((r, i) => { r.cited_by_count = i === rows.length - 1 ? left : Math.round((r.cited_by_count / sum) * 412); left -= r.cited_by_count; });
  rows.forEach((r, i) => { r.prev_cited_by_count = Math.max(0, r.cited_by_count - (i % 5 === 1 ? 2 : i % 4 === 0 ? 1 : 0)); });
  return rows;
}

export function exampleRun(userId: string): RunRow {
  const pubs = examplePublications(userId);
  const changes = pubs.filter((p) => p.cited_by_count !== p.prev_cited_by_count)
    .map((p) => ({ openalex_id: p.openalex_id, title: p.title, delta: p.cited_by_count - p.prev_cited_by_count }));
  return {
    id: "run-example", user_id: userId, started_at: new Date(Date.now() - 3 * 3600e3).toISOString(),
    finished_at: new Date(Date.now() - 3 * 3600e3).toISOString(), trigger: "schedule", status: "ok", initial: false,
    new_works: 1, removed_works: 0, citations_delta: changes.reduce((n, c) => n + (c.delta ?? 0), 0),
    changes: [{ openalex_id: pubs[0].openalex_id, title: pubs[0].title, new: true }, ...changes.slice(0, 6)], error: null,
  };
}
