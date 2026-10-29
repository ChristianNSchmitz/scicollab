import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/mode";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDemoClient } from "@/lib/demo/shim";
import { ensureRecordSeed } from "@/lib/record/demo-seed";

/**
 * "Most active right now" for the public front page.
 *
 * The front page is seen by people who are not signed in, and every table is
 * readable by signed-in members only (row-level security). So this module
 * reads with the server's own key and is the only gate. It therefore:
 *
 * - takes only rows explicitly tagged visibility = 'public' — method cards,
 *   questions, datasets. Room posts carry no visibility tag (they are for
 *   members), so they are never shown here;
 * - selects named columns, never `*`, and sends the browser a small,
 *   already-shortened view model: no ids of anything that is not public, no
 *   e-mail, no file contents, nothing that can be written back;
 * - never names a project, fork parent or linked card unless that one is
 *   public too.
 *
 * Ranking is "rolling": activity in the last 30 days counts fully, older
 * activity a little, so the list moves as people use the site. At most five
 * items, at most three of one kind.
 */

export type ShowField = { label: string; value: string };
export type ShowItem =
  | {
      kind: "card"; id: string; href: string; score: number;
      title: string; code: string; version: number; outcome: "success" | "partial" | "negative" | null;
      byline: string; fields: ShowField[]; failsUnder: string; stats: string;
    }
  | {
      kind: "question"; id: string; href: string; score: number;
      title: string; byline: string; excerpt: string; tags: string[]; answers: number; accepted: boolean; stats: string;
    }
  | {
      kind: "dataset"; id: string; href: string; score: number;
      title: string; byline: string; summary: string; fields: ShowField[]; stats: string;
    };

const WINDOW_DAYS = 30;
const MAX_ITEMS = 5;
const MAX_PER_KIND = 3;
const CACHE_MS = 30_000;

type Row = Record<string, any>;
type Client = SupabaseClient<any, "public", any>;

/** Server-side reader for pages signed-out visitors see. Null when no safe
 *  reader exists (a live site without its service key). Whoever uses it is
 *  the only gate: select named columns and filter to what is public. */
export function publicReader(): Client | null {
  if (!isConfigured()) {
    ensureRecordSeed();                       // the demo store's record tables
    return createDemoClient(null) as unknown as Client;
  }
  // createAdminClient falls back to the demo store when the key is missing;
  // on a live site that would show example data, so refuse instead.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createAdminClient();
}

const cut = (s: unknown, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};
/** Code blocks read badly in a teaser; say that there is code instead. */
const prose = (s: unknown) => String(s ?? "").replace(/```[\s\S]*?```/g, " [code] ");
const day = (iso: unknown) => String(iso ?? "").slice(0, 10);
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const bytes = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${Math.round(n / 1e3)} kB` : `${n} B`;
const count = (rows: Row[] | null | undefined, key: string) => {
  const m = new Map<string, number>();
  for (const r of rows ?? []) m.set(r[key], (m.get(r[key]) ?? 0) + 1);
  return m;
};

async function compute(db: Client): Promise<ShowItem[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString();
  const sinceDay = since.slice(0, 10);

  const [{ data: cards }, { data: questions }, { data: datasets }] = await Promise.all([
    db.from("method_cards")
      .select("id, code, version, title, method, system, conditions, outcome, outcome_detail, fails_under, author_id, forked_from, created_at, updated_at, visibility")
      .eq("visibility", "public").order("created_at", { ascending: false }).limit(200),
    db.from("questions")
      .select("id, title, body, tags, views, author_id, created_at, visibility")
      .eq("visibility", "public").order("created_at", { ascending: false }).limit(200),
    db.from("datasets")
      .select("id, title, summary, licence, doi, size_bytes, owner_id, project_id, created_at, visibility")
      .eq("visibility", "public").order("created_at", { ascending: false }).limit(200),
  ]);
  const C = (cards ?? []).filter((r: Row) => r.visibility === "public");
  const Q = (questions ?? []).filter((r: Row) => r.visibility === "public");
  const D = (datasets ?? []).filter((r: Row) => r.visibility === "public");
  const cardIds = C.map((c: Row) => c.id), qIds = Q.map((q: Row) => q.id), dIds = D.map((d: Row) => d.id);

  const none = Promise.resolve({ data: [] as Row[] });
  const [recs, repro, reviews, reads, answers, atts, projects] = await Promise.all([
    cardIds.length ? db.from("recommendations").select("card_id, created_at").in("card_id", cardIds) : none,
    cardIds.length ? db.from("reproductions").select("card_id, created_at").in("card_id", cardIds) : none,
    cardIds.length ? db.from("reviews").select("card_id, created_at").in("card_id", cardIds) : none,
    cardIds.length ? db.from("card_reads").select("card_id, week").in("card_id", cardIds).gte("week", sinceDay) : none,
    qIds.length ? db.from("answers").select("question_id, accepted, votes, created_at").in("question_id", qIds) : none,
    dIds.length ? db.from("post_attachments").select("id, dataset_id, access").in("dataset_id", dIds) : none,
    D.length ? db.from("projects").select("id, title, visibility").in("id", D.map((d: Row) => d.project_id).filter(Boolean)) : none,
  ]);
  const attIds = (atts.data ?? []).map((a: Row) => a.id);
  const granted = attIds.length
    ? (await db.from("access_requests").select("attachment_id, status, decided_at").in("attachment_id", attIds).eq("status", "granted")).data ?? []
    : [];

  // Names of the people behind the public items, and nothing else about them.
  const people = new Set<string>([...C.map((c: Row) => c.author_id), ...Q.map((q: Row) => q.author_id), ...D.map((d: Row) => d.owner_id)].filter(Boolean));
  const { data: profiles } = people.size
    ? await db.from("profiles").select("id, display_name").in("id", [...people])
    : { data: [] as Row[] };
  const nameOf = (id: string) => cut((profiles ?? []).find((p: Row) => p.id === id)?.display_name ?? "A member", 60);

  const recent = (rows: Row[] | null | undefined, key: string) => count((rows ?? []).filter((r) => String(r.created_at ?? "") >= since), key);
  const recAll = count(recs.data, "card_id"), recNew = recent(recs.data, "card_id");
  const repAll = count(repro.data, "card_id"), repNew = recent(repro.data, "card_id");
  const revAll = count(reviews.data, "card_id"), revNew = recent(reviews.data, "card_id");
  const readNew = count(reads.data, "card_id");
  const publicCode = new Map(C.map((c: Row) => [c.id, c.code]));

  const items: ShowItem[] = [];

  for (const c of C) {
    const n = (m: Map<string, number>) => m.get(c.id) ?? 0;
    const score = 3 * n(recNew) + 5 * n(repNew) + 2 * n(revNew) + n(readNew)
      + 0.2 * (3 * n(recAll) + 5 * n(repAll) + 2 * n(revAll));
    const parent = c.forked_from ? publicCode.get(c.forked_from) : null;
    items.push({
      kind: "card", id: c.id, href: `/methods/${c.id}`, score,
      title: cut(c.title, 110), code: cut(c.code, 20), version: Number(c.version) || 1,
      outcome: ["success", "partial", "negative"].includes(c.outcome) ? c.outcome : null,
      byline: [nameOf(c.author_id), parent ? `forked from ${parent}` : "", `updated ${day(c.updated_at ?? c.created_at)}`].filter(Boolean).join(" · "),
      fields: [
        { label: "METHOD", value: cut(c.method, 70) },
        { label: "SYSTEM", value: cut(c.system, 70) },
        { label: "CONDITIONS", value: cut(c.conditions, 70) },
        { label: "OUTCOME", value: cut(c.outcome_detail, 70) },
      ].filter((f) => f.value),
      failsUnder: cut(c.fails_under, 240),
      stats: [plural(n(readNew), "read") + " this month", plural(n(repAll), "reproduction"), plural(n(recAll), "recommendation")].join(" · "),
    });
  }

  const ansAll = count(answers.data, "question_id"), ansNew = recent(answers.data, "question_id");
  for (const q of Q) {
    const mine = (answers.data ?? []).filter((a: Row) => a.question_id === q.id);
    const votes = mine.reduce((s: number, a: Row) => s + (Number(a.votes) || 0), 0);
    const accepted = mine.some((a: Row) => a.accepted);
    const score = 3 * (ansNew.get(q.id) ?? 0) + votes + (Number(q.views) || 0) / 10 + (String(q.created_at) >= since ? 2 : 0);
    items.push({
      kind: "question", id: q.id, href: `/questions/${q.id}`, score,
      title: cut(q.title, 140), byline: `asked by ${nameOf(q.author_id)} · ${day(q.created_at)}`,
      excerpt: cut(prose(q.body), 320), tags: (Array.isArray(q.tags) ? q.tags : []).slice(0, 4).map((t: unknown) => cut(t, 28)),
      answers: ansAll.get(q.id) ?? 0, accepted,
      stats: [plural(Number(q.views) || 0, "view"), plural(votes, "vote")].join(" · "),
    });
  }

  const openShares = count((atts.data ?? []).filter((a: Row) => a.access === "open"), "dataset_id");
  const attToData = new Map((atts.data ?? []).map((a: Row) => [a.id, a.dataset_id]));
  const grantsBy = new Map<string, number>();
  for (const g of granted as Row[]) {
    if (String(g.decided_at ?? "") < since) continue;
    const d = attToData.get(g.attachment_id);
    if (d) grantsBy.set(d, (grantsBy.get(d) ?? 0) + 1);
  }
  for (const d of D) {
    const shares = openShares.get(d.id) ?? 0, grants = grantsBy.get(d.id) ?? 0;
    const score = 3 * (shares + grants) + (String(d.created_at) >= since ? 5 : 0) + (d.doi ? 1 : 0);
    const project = (projects.data ?? []).find((p: Row) => p.id === d.project_id && p.visibility === "public");
    items.push({
      kind: "dataset", id: d.id, href: `/projects/${d.project_id}?tab=data`, score,
      title: cut(d.title, 120), byline: `deposited by ${nameOf(d.owner_id)} · ${day(d.created_at)}`,
      summary: cut(d.summary, 300),
      fields: [
        { label: "LICENCE", value: cut(d.licence, 30) },
        { label: "SIZE", value: d.size_bytes ? bytes(Number(d.size_bytes)) : "" },
        { label: "DOI", value: cut(d.doi, 40) },
        { label: "PROJECT", value: project ? cut(project.title, 60) : "" },
      ].filter((f) => f.value),
      stats: [plural(shares, "open share"), plural(grants, "access grant") + " this month"].join(" · "),
    });
  }

  items.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const out: ShowItem[] = [];
  const perKind: Record<string, number> = {};
  for (const it of items) {
    if ((perKind[it.kind] ?? 0) >= MAX_PER_KIND) continue;
    perKind[it.kind] = (perKind[it.kind] ?? 0) + 1;
    out.push({ ...it, score: Math.round(it.score * 10) / 10 });
    if (out.length === MAX_ITEMS) break;
  }
  return out;
}

const g = globalThis as { __scShowcase?: { at: number; items: ShowItem[] } };

/** The current top five, cached briefly so a busy front page costs a few queries a minute. */
export async function loadShowcase(): Promise<ShowItem[]> {
  const hit = g.__scShowcase;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;
  const db = publicReader();
  if (!db) return [];
  try {
    const items = await compute(db);
    g.__scShowcase = { at: Date.now(), items };
    return items;
  } catch {
    return hit?.items ?? [];               // the front page must render even if this fails
  }
}
