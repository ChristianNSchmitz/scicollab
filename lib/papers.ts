import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/mode";
import { examplePublications } from "@/lib/openalex/example";
import { readPublications, type PubRow } from "@/lib/openalex/store";
import { DEMO_ORCID, normaliseOrcid } from "@/lib/openalex/sync";

/**
 * A paper page (supabase/21-researcher.sql): one paper, by its OpenAlex work
 * id, with its authors who are members. Its details come from any author's
 * synced publications; the demo uses the example publications of its persona.
 */

const DEMO_AUTHOR = "u-rivera";
export const isWorkId = (s: unknown): s is string =>
  typeof s === "string" && (/^W[0-9]{1,15}$/.test(s) || (!isConfigured() && /^W-example-[0-9]{1,3}$/.test(s)));

export type Paper = PubRow & { authorIds: string[] };

/** The member behind an author of the byline, where known (demo ids map to members). */
const memberOf = (authorId: string) => (authorId.startsWith("A-example-u-") ? authorId.slice("A-example-".length) : null);

export async function loadPaper(supabase: SupabaseClient<any, any, any>, workId: string): Promise<Paper | null> {
  if (!isWorkId(workId)) return null;
  if (workId.startsWith("W-example-")) {
    const p = examplePublications(DEMO_AUTHOR).find((x) => x.openalex_id === workId);
    if (!p) return null;
    const others = (p.authors ?? []).map((a) => memberOf(a.id)).filter((x): x is string => !!x);
    return { ...p, authorIds: [DEMO_AUTHOR, ...others] };
  }
  const { data } = await supabase.from("publications").select("*").eq("openalex_id", workId);
  const rows = (data ?? []) as PubRow[];
  if (!rows.length) return null;
  const best = rows.reduce((a, b) => (b.updated_at > a.updated_at ? b : a));
  return { ...best, cited_by_count: Math.max(...rows.map((r) => r.cited_by_count)), authorIds: [...new Set(rows.map((r) => r.user_id))] };
}

/** A member's papers for their CV and profile: as synced from OpenAlex, or the demo ORCID's examples. */
export async function papersOf(userId: string, orcid?: string | null): Promise<PubRow[]> {
  if (!isConfigured() && normaliseOrcid(orcid) === DEMO_ORCID) return examplePublications(userId);
  return readPublications(userId);
}

export const PAPER_FILE_BUCKET = "paper-files";
export const MAX_PAPER_BYTES = 3.5 * 1024 * 1024;
