import { isConfigured } from "@/lib/mode";
import { tables } from "@/lib/demo/store";

/** The record's tables in the demo store. */

/** The record's own tables, registered with the demo store on first use. */
export function ensureRecordTables() {
  if (isConfigured()) return;
  for (const t of ["reproductions", "reviews", "mentorships", "card_reads", "recommendations", "citation_snapshots", "openalex_authors", "publications", "sync_runs"]) {
    if (!tables[t]) tables[t] = [];
  }
}

/** Kept for the pages that call it. The record's rows (reproductions,
 *  reviews, recommendations, mentoring, reads) are part of the one seeded
 *  world in lib/demo/personas, so all this has to do is make sure the tables
 *  exist on a server that was started before they were added. */
export function ensureRecordSeed() {
  if (isConfigured()) return;
  ensureRecordTables();
}

/** ISO date of the Monday starting d's week. */
export function weekOf(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}
