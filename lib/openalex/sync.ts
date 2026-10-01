import { fetchAuthor, fetchWorks, OpenAlexError } from "@/lib/openalex/client";
import { canWrite, finishRun, readAuthor, readPublications, startRun, writeSync, staleResearchers, type RunRow } from "@/lib/openalex/store";

/**
 * Sync one researcher's OpenAlex record: author summary and every work.
 *
 * What changed is worked out against the previous sync and kept on the run:
 * new publications, publications OpenAlex no longer attributes, and citation
 * changes per work. The first sync of a profile is an import, not "news".
 */

/** 12 hours unless SCICOLLAB_SYNC_INTERVAL_HOURS says otherwise. */
export const SYNC_INTERVAL_MS = (Number(process.env.SCICOLLAB_SYNC_INTERVAL_HOURS) || 12) * 3600 * 1000;
/** "Sync now" at most every 10 minutes (or every interval, if that is shorter). */
export const MANUAL_COOLDOWN_MS = Math.min(10 * 60 * 1000, SYNC_INTERVAL_MS);
const ORCID = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
/** The demo persona carries ORCID's public test record; it is never synced. */
export const DEMO_ORCID = "0000-0002-1825-0097";

export type SyncResult =
  | { status: "ok"; initial: boolean; newWorks: number; removedWorks: number; citationsDelta: number }
  | { status: "skipped"; reason: string }
  | { status: "error" | "rate-limited" | "not-found"; message: string };

// One sync per researcher at a time, within this server process.
const running = new Map<string, Promise<SyncResult>>();

export function normaliseOrcid(raw: string | null | undefined): string | null {
  const o = (raw ?? "").trim().replace(/^https?:\/\/orcid\.org\//, "");
  return ORCID.test(o) ? o : null;
}

export function syncResearcher(userId: string, orcidRaw: string | null | undefined, trigger: "schedule" | "visit" | "manual"): Promise<SyncResult> {
  const existing = running.get(userId);
  if (existing) return existing;
  const p = doSync(userId, orcidRaw, trigger).finally(() => running.delete(userId));
  running.set(userId, p);
  return p;
}

async function doSync(userId: string, orcidRaw: string | null | undefined, trigger: string): Promise<SyncResult> {
  const orcid = normaliseOrcid(orcidRaw);
  if (!orcid) return { status: "skipped", reason: "No valid ORCID on the profile." };
  if (orcid === DEMO_ORCID) return { status: "skipped", reason: "The demo account uses example values." };
  const can = canWrite();
  if (!can.ok) return { status: "skipped", reason: can.reason };

  const runId = await startRun(userId, trigger);
  try {
    const [prevAuthor, prevPubs] = await Promise.all([readAuthor(userId), readPublications(userId)]);
    // A changed ORCID is a different person's record: start over as an import.
    const sameRecord = prevAuthor?.orcid === orcid;
    const previous = sameRecord ? prevPubs : [];
    const initial = !sameRecord;

    const author = await fetchAuthor(orcid);
    const works = await fetchWorks(author.id);

    const before = new Map(previous.map((p) => [p.openalex_id, p]));
    const newWorks = works.filter((w) => !before.has(w.id));
    const changes: RunRow["changes"] = initial ? [] : [
      ...newWorks.map((w) => ({ openalex_id: w.id, title: w.title, new: true as const })),
      ...works
        .filter((w) => before.has(w.id) && w.cited_by_count !== before.get(w.id)!.cited_by_count)
        .map((w) => ({ openalex_id: w.id, title: w.title, delta: w.cited_by_count - before.get(w.id)!.cited_by_count }))
        .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!)),
    ].slice(0, 50);

    // prevPubs, not previous: after an ORCID change the old record's works are removed.
    const { removed } = await writeSync(userId, orcid, author, works, prevPubs);
    const citationsDelta = initial ? 0 : author.cited_by_count - (prevAuthor?.cited_by_count ?? 0);
    await finishRun(runId, {
      status: "ok", initial,
      new_works: initial ? 0 : newWorks.length,
      removed_works: initial ? 0 : removed,
      citations_delta: citationsDelta,
      changes,
    });
    return { status: "ok", initial, newWorks: initial ? 0 : newWorks.length, removedWorks: initial ? 0 : removed, citationsDelta };
  } catch (e) {
    const kind = e instanceof OpenAlexError ? e.kind : "error";
    const message = (e as Error).message || "Sync failed.";
    await finishRun(runId, { status: kind === "unreachable" ? "error" : kind, error: message });
    return { status: kind === "unreachable" ? "error" : kind, message } as SyncResult;
  }
}

/** True when the researcher has never been synced or the last sync is due. */
export async function isDue(userId: string, orcidRaw: string | null | undefined): Promise<boolean> {
  const orcid = normaliseOrcid(orcidRaw);
  if (!orcid || orcid === DEMO_ORCID) return false;
  const a = await readAuthor(userId);
  return !a || a.orcid !== orcid || Date.now() - +new Date(a.synced_at) >= SYNC_INTERVAL_MS;
}

/** One scheduled pass: everyone due, oldest first, one at a time. */
export async function syncDue(limit = 50): Promise<{ checked: number; results: { userId: string; result: SyncResult }[] }> {
  const due = await staleResearchers(new Date(Date.now() - SYNC_INTERVAL_MS), limit);
  const results: { userId: string; result: SyncResult }[] = [];
  for (const r of due) {
    const result = await syncResearcher(r.userId, r.orcid, "schedule");
    results.push({ userId: r.userId, result });
    if (result.status === "rate-limited") break;      // the allowance is shared; stop for now
    await new Promise((res) => setTimeout(res, 250));  // stay polite between researchers
  }
  return { checked: due.length, results };
}
