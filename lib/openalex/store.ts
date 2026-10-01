import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/mode";
import { tables } from "@/lib/demo/store";
import { ensureRecordTables } from "@/lib/record/demo-seed";
import type { OAAuthor, OAWork } from "@/lib/openalex/client";

/**
 * Where synced OpenAlex data is written. Against a real project this is the
 * service-role client — the tables have no write policy, so researchers
 * cannot edit their own citation counts. In demo mode it is the in-memory
 * store. Reads for the page go through the user's own client and RLS.
 */

export type PubRow = {
  user_id: string; openalex_id: string; doi: string | null; title: string; year: number | null;
  pub_date: string | null; venue: string; type: string; cited_by_count: number; prev_cited_by_count: number;
  first_seen_at: string; updated_at: string;
};
export type AuthorRow = {
  user_id: string; orcid: string; openalex_id: string; display_name: string; works_count: number;
  cited_by_count: number; h_index: number; i10_index: number;
  counts_by_year: { year: number; cited_by_count: number; works_count: number }[];
  source_updated: string | null; synced_at: string;
};
export type RunRow = {
  id: string; user_id: string; started_at: string; finished_at: string | null; trigger: string;
  status: string; initial: boolean; new_works: number; removed_works: number; citations_delta: number;
  changes: { openalex_id: string; title: string; delta?: number; new?: boolean }[]; error: string | null;
};

type Client = SupabaseClient<any, "public", any>;

/** Null when a real project is configured without the service-role key. */
function admin(): Client | null {
  if (!isConfigured()) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } }) as Client;
}

export function canWrite(): { ok: true } | { ok: false; reason: string } {
  if (!isConfigured()) return { ok: true };
  return process.env.SUPABASE_SERVICE_ROLE_KEY
    ? { ok: true }
    : { ok: false, reason: "Syncing needs SUPABASE_SERVICE_ROLE_KEY on the server." };
}

const demo = () => { ensureRecordTables(); return tables as Record<string, any[]>; };
/** A real project without the service-role key: nothing can be read or written here. */
const unavailable = () => isConfigured() && !process.env.SUPABASE_SERVICE_ROLE_KEY;
const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export async function readAuthor(userId: string): Promise<AuthorRow | null> {
  if (unavailable()) return null;
  const db = admin();
  if (!db) return (demo().openalex_authors.find((r) => r.user_id === userId) as AuthorRow) ?? null;
  const { data } = await db.from("openalex_authors").select("*").eq("user_id", userId).maybeSingle();
  return (data as AuthorRow) ?? null;
}

export async function readPublications(userId: string): Promise<PubRow[]> {
  if (unavailable()) return [];
  const db = admin();
  if (!db) return demo().publications.filter((r) => r.user_id === userId) as PubRow[];
  const out: PubRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("publications").select("*").eq("user_id", userId).range(from, from + 999);
    out.push(...((data ?? []) as PubRow[]));
    if ((data?.length ?? 0) < 1000) break;
  }
  return out;
}

export async function startRun(userId: string, trigger: string): Promise<string> {
  const row = { user_id: userId, trigger, status: "running", started_at: new Date().toISOString() };
  const db = admin();
  if (!db) {
    const id = "run-" + Math.random().toString(36).slice(2, 10);
    demo().sync_runs.unshift({ id, finished_at: null, initial: false, new_works: 0, removed_works: 0, citations_delta: 0, changes: [], error: null, ...row });
    return id;
  }
  const { data, error } = await db.from("sync_runs").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function finishRun(id: string, patch: Partial<RunRow>) {
  const row = { ...patch, finished_at: new Date().toISOString() };
  const db = admin();
  if (!db) { Object.assign(demo().sync_runs.find((r) => r.id === id) ?? {}, row); return; }
  await db.from("sync_runs").update(row).eq("id", id);
}

/** Persist one successful sync: author summary, publications, snapshot. */
export async function writeSync(userId: string, orcid: string, a: OAAuthor, works: OAWork[], previous: PubRow[]) {
  const now = new Date().toISOString();
  const before = new Map(previous.map((p) => [p.openalex_id, p]));
  const seen = new Set(works.map((w) => w.id));
  const removed = previous.filter((p) => !seen.has(p.openalex_id)).map((p) => p.openalex_id);

  const base = (w: OAWork) => ({
    user_id: userId, openalex_id: w.id, doi: w.doi, title: w.title, year: w.year, pub_date: w.pub_date,
    venue: w.venue, type: w.type, cited_by_count: w.cited_by_count, updated_at: now,
  });
  const fresh = works.filter((w) => !before.has(w.id)).map((w) => ({ ...base(w), prev_cited_by_count: w.cited_by_count, first_seen_at: now }));
  const known = works.filter((w) => before.has(w.id)).map((w) => ({ ...base(w), prev_cited_by_count: before.get(w.id)!.cited_by_count }));

  const author: AuthorRow = {
    user_id: userId, orcid, openalex_id: a.id, display_name: a.display_name, works_count: a.works_count,
    cited_by_count: a.cited_by_count, h_index: a.h_index, i10_index: a.i10_index,
    counts_by_year: a.counts_by_year, source_updated: a.updated_date, synced_at: now,
  };
  const snapshot = { user_id: userId, day: now.slice(0, 10), citations: a.cited_by_count, h_index: a.h_index };

  const db = admin();
  if (!db) {
    const t = demo();
    t.publications = t.publications.filter((p) => !(p.user_id === userId && removed.includes(p.openalex_id)));
    for (const k of known) Object.assign(t.publications.find((p) => p.user_id === userId && p.openalex_id === k.openalex_id)!, k);
    t.publications.push(...fresh);
    const ai = t.openalex_authors.findIndex((r) => r.user_id === userId);
    if (ai >= 0) t.openalex_authors[ai] = author; else t.openalex_authors.push(author);
    const si = t.citation_snapshots.findIndex((r) => r.user_id === userId && r.day === snapshot.day);
    if (si >= 0) t.citation_snapshots[si] = snapshot; else t.citation_snapshots.push(snapshot);
    return { removed: removed.length };
  }

  for (const c of chunks(fresh, 500)) { const { error } = await db.from("publications").insert(c); if (error) throw new Error(error.message); }
  for (const c of chunks(known, 500)) { const { error } = await db.from("publications").upsert(c, { onConflict: "user_id,openalex_id" }); if (error) throw new Error(error.message); }
  for (const c of chunks(removed, 200)) await db.from("publications").delete().eq("user_id", userId).in("openalex_id", c);
  { const { error } = await db.from("openalex_authors").upsert(author, { onConflict: "user_id" }); if (error) throw new Error(error.message); }
  await db.from("citation_snapshots").upsert(snapshot, { onConflict: "user_id,day" });
  return { removed: removed.length };
}

/** Researchers with an ORCID whose last sync is older than the cutoff. */
export async function staleResearchers(cutoff: Date, limit: number): Promise<{ userId: string; orcid: string }[]> {
  if (unavailable()) return [];
  const db = admin();
  const profiles = db
    ? ((await db.from("profiles").select("id, orcid").not("orcid", "is", null)).data ?? [])
    : demo().profiles.filter((p) => p.orcid);
  const authors = db
    ? ((await db.from("openalex_authors").select("user_id, orcid, synced_at")).data ?? [])
    : demo().openalex_authors;
  const last = new Map(authors.map((a: any) => [a.user_id, a]));
  return profiles
    .map((p: any) => ({ userId: p.id as string, orcid: String(p.orcid).trim() }))
    .filter(({ userId, orcid }) => {
      const a: any = last.get(userId);
      return !a || a.orcid !== orcid || new Date(a.synced_at) < cutoff;
    })
    .slice(0, limit);
}

export async function lastRuns(userId: string, n: number): Promise<RunRow[]> {
  if (unavailable()) return [];
  const db = admin();
  if (!db) return demo().sync_runs.filter((r) => r.user_id === userId).slice(0, n) as RunRow[];
  const { data } = await db.from("sync_runs").select("*").eq("user_id", userId).order("started_at", { ascending: false }).limit(n);
  return (data ?? []) as RunRow[];
}
