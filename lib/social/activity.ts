import type { SupabaseClient } from "@supabase/supabase-js";
import { peopleById, type Person } from "@/lib/people";
import { loadPublications } from "@/lib/record/publications";
import { ROOMS } from "@/lib/taxonomy";

type Client = SupabaseClient<any, any, any>;

export type Activity = {
  at: string; actor: Person | null; kind: "post" | "answer" | "question" | "card" | "paper" | "reproduction" | "group" | "fork";
  text: string; title: string; href: string;
};

const DAY = 864e5;
/** How many people's publications are read for one feed; each is one query. */
const MAX_PAPER_AUTHORS = 30;

/**
 * What people did, as a stream, so the network feels alive without anyone
 * having to post: a paper that came out, a card recorded, a question
 * answered, a method reproduced. Only what the viewer may read anyway (RLS
 * applies to every query; private cards are left out explicitly).
 */
export async function activityOf(
  supabase: Client, actors: string[], opts: { viewer: string; limit?: number; days?: number },
): Promise<Activity[]> {
  if (!actors.length) return [];
  const since = new Date(Date.now() - (opts.days ?? 60) * DAY).toISOString();
  const [{ data: posts }, { data: answers }, { data: questions }, { data: cards }, { data: repros }, { data: joins }] = await Promise.all([
    supabase.from("posts").select("id, author_id, room_id, title, created_at").in("author_id", actors).gte("created_at", since),
    supabase.from("answers").select("id, author_id, question_id, created_at").in("author_id", actors).gte("created_at", since),
    supabase.from("questions").select("id, author_id, title, created_at").in("author_id", actors).gte("created_at", since),
    supabase.from("method_cards").select("id, author_id, code, title, visibility, outcome, created_at").in("author_id", actors).gte("created_at", since),
    supabase.from("reproductions").select("card_id, user_id, outcome, created_at").in("user_id", actors).gte("created_at", since),
    supabase.from("group_members").select("group_id, user_id, role, joined_at").in("user_id", actors).gte("joined_at", since),
  ]);

  const qIds = [...new Set((answers ?? []).map((a: any) => a.question_id))];
  const cIds = [...new Set((repros ?? []).map((r: any) => r.card_id))];
  const gIds = [...new Set((joins ?? []).map((j: any) => j.group_id))];
  const empty = Promise.resolve({ data: [] as any[] });
  const [people, { data: qs }, { data: rc }, { data: gs }, papers] = await Promise.all([
    peopleById(supabase, actors),
    qIds.length ? supabase.from("questions").select("id, title").in("id", qIds) : empty,
    cIds.length ? supabase.from("method_cards").select("id, code, title").in("id", cIds) : empty,
    gIds.length ? supabase.from("groups").select("id, name").in("id", gIds) : empty,
    newPapers(supabase, actors.slice(0, MAX_PAPER_AUTHORS), since),
  ]);
  const who = (id: string) => people.get(id) ?? null;
  const roomName = (id: string) => ROOMS.find((r) => r.id === id)?.name ?? id;

  const out: Activity[] = [
    ...(posts ?? []).map((p: any): Activity => ({ at: p.created_at, actor: who(p.author_id), kind: "post", text: `posted in #${roomName(p.room_id)}`, title: p.title, href: `/posts/${p.id}` })),
    ...(answers ?? []).filter((a: any) => (qs ?? []).some((q: any) => q.id === a.question_id)).map((a: any): Activity => ({
      at: a.created_at, actor: who(a.author_id), kind: "answer", text: "answered", title: (qs ?? []).find((q: any) => q.id === a.question_id)?.title ?? "", href: `/questions/${a.question_id}`,
    })),
    ...(questions ?? []).map((q: any): Activity => ({ at: q.created_at, actor: who(q.author_id), kind: "question", text: "asked", title: q.title, href: `/questions/${q.id}` })),
    ...(cards ?? []).filter((c: any) => c.visibility !== "private" || c.author_id === opts.viewer).map((c: any): Activity => ({
      at: c.created_at, actor: who(c.author_id), kind: "card",
      text: c.outcome === "negative" ? `recorded a null result, ${c.code}` : `recorded a method, ${c.code}`, title: c.title, href: `/methods/${c.id}`,
    })),
    ...(repros ?? []).filter((r: any) => (rc ?? []).some((c: any) => c.id === r.card_id)).map((r: any): Activity => {
      const c = (rc ?? []).find((x: any) => x.id === r.card_id);
      return { at: r.created_at, actor: who(r.user_id), kind: "reproduction", text: `reproduced ${c.code}, ${r.outcome === "held" ? "it held" : "it failed"}`, title: c.title, href: `/methods/${c.id}` };
    }),
    ...(joins ?? []).filter((j: any) => j.role !== "owner" && (gs ?? []).some((g: any) => g.id === j.group_id)).map((j: any): Activity => ({
      at: j.joined_at, actor: who(j.user_id), kind: "group", text: "joined the group", title: (gs ?? []).find((g: any) => g.id === j.group_id)?.name ?? "", href: `/groups/${j.group_id}`,
    })),
    ...papers.map((p): Activity => ({ at: p.at, actor: who(p.user), kind: "paper", text: "has a new publication", title: p.title, href: p.href })),
  ];
  return out.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, opts.limit ?? 40);
}

/** Things that happened to your own work: your cards reproduced or forked by others. */
export async function activityOnMine(supabase: Client, me: string, days = 60): Promise<Activity[]> {
  const since = new Date(Date.now() - days * DAY).toISOString();
  const { data: mine } = await supabase.from("method_cards").select("id, code, title").eq("author_id", me);
  const ids = (mine ?? []).map((c: any) => c.id);
  if (!ids.length) return [];
  const [{ data: repros }, { data: forks }] = await Promise.all([
    supabase.from("reproductions").select("card_id, user_id, outcome, created_at").in("card_id", ids).neq("user_id", me).gte("created_at", since),
    supabase.from("method_cards").select("id, author_id, forked_from, code, created_at, visibility").in("forked_from", ids).neq("author_id", me).gte("created_at", since),
  ]);
  const people = await peopleById(supabase, [...(repros ?? []).map((r: any) => r.user_id), ...(forks ?? []).map((f: any) => f.author_id)]);
  const card = (id: string) => (mine ?? []).find((c: any) => c.id === id);
  return [
    ...(repros ?? []).map((r: any): Activity => ({
      at: r.created_at, actor: people.get(r.user_id) ?? null, kind: "reproduction",
      text: `reproduced your ${card(r.card_id)?.code}, ${r.outcome === "held" ? "it held" : "it failed"}`, title: card(r.card_id)?.title ?? "", href: `/methods/${r.card_id}`,
    })),
    ...(forks ?? []).filter((f: any) => f.visibility !== "private").map((f: any): Activity => ({
      at: f.created_at, actor: people.get(f.author_id) ?? null, kind: "fork",
      text: `forked your ${card(f.forked_from)?.code} into ${f.code}`, title: card(f.forked_from)?.title ?? "", href: `/methods/${f.id}`,
    })),
  ];
}

/** Publications that are new: first seen recently and published this year
 *  or last, so the first sync of an old record is not reported as news. */
export async function newPapers(supabase: Client, people: string[], since: string) {
  const { data: profiles } = people.length ? await supabase.from("profiles").select("id, orcid").in("id", people) : { data: [] };
  const withOrcid = (profiles ?? []).filter((p: any) => p.orcid);
  const year = new Date().getFullYear();
  const lists = await Promise.all(withOrcid.map(async (p: any) => {
    const { pubs } = await loadPublications(p.id, p.orcid, 1);
    return pubs
      .filter((w) => w.first_seen_at >= since && (w.year ?? 0) >= year - 1)
      .map((w) => ({
        user: p.id as string, at: w.first_seen_at, title: w.title,
        href: w.doi ? `https://doi.org/${w.doi}` : w.openalex_id.startsWith("W-example") ? `/people/${p.id}` : `https://openalex.org/${w.openalex_id}`,
      }));
  }));
  return lists.flat();
}
