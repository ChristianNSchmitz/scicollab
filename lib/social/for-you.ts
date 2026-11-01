import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<any, any, any>;

/**
 * What is waiting for someone's expertise: feedback requests sent to them
 * that they have not answered, and open questions that match what they know
 * (their techniques, and the tags of their method cards). Shown on the feed's
 * dashboard and in the weekly e-mail.
 */
export type ForYou = {
  feedback: { id: string; title: string; author_id: string; deadline: string | null }[];
  questions: { id: string; title: string; match: string; created_at: string }[];
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9α-ω]+/g, " ").trim();

export async function forYou(supabase: Client, me: string, opts: { days?: number; limit?: number } = {}): Promise<ForYou> {
  const since = new Date(Date.now() - (opts.days ?? 60) * 864e5).toISOString();
  const limit = opts.limit ?? 5;
  const [{ data: asked }, { data: profile }, { data: cards }, { data: questions }] = await Promise.all([
    supabase.from("post_audience").select("post_id").eq("user_id", me),
    supabase.from("profiles").select("techniques").eq("id", me).maybeSingle(),
    supabase.from("method_cards").select("tags").eq("author_id", me),
    supabase.from("questions").select("id, title, tags, author_id, created_at").neq("author_id", me).gte("created_at", since)
      .order("created_at", { ascending: false }).limit(200),
  ]);

  // Feedback requests to me that I have not commented on yet.
  const askedIds = (asked ?? []).map((a: any) => a.post_id);
  const [{ data: posts }, { data: myReplies }] = askedIds.length ? await Promise.all([
    supabase.from("posts").select("id, title, author_id, deadline, created_at").in("id", askedIds).gte("created_at", since),
    supabase.from("post_replies").select("post_id").eq("author_id", me).in("post_id", askedIds),
  ]) : [{ data: [] as any[] }, { data: [] as any[] }];
  const done = new Set((myReplies ?? []).map((r: any) => r.post_id));
  const feedback = (posts ?? []).filter((p: any) => !done.has(p.id))
    .sort((a: any, b: any) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999")).slice(0, limit)
    .map((p: any) => ({ id: p.id, title: p.title, author_id: p.author_id, deadline: p.deadline ?? null }));

  // Open questions (no answer yet) that match a technique or a tag I use.
  const skills = [...new Set([...(profile?.techniques ?? []), ...(cards ?? []).flatMap((c: any) => c.tags ?? [])].map(norm).filter((s) => s.length >= 3))];
  const qIds = (questions ?? []).map((q: any) => q.id);
  const { data: answers } = qIds.length && skills.length
    ? await supabase.from("answers").select("question_id").in("question_id", qIds)
    : { data: [] as any[] };
  const answered = new Set((answers ?? []).map((a: any) => a.question_id));
  const matched: ForYou["questions"] = [];
  for (const q of (questions ?? []) as any[]) {
    if (!skills.length || answered.has(q.id)) continue;
    const hay = [q.title, ...(q.tags ?? [])].map(norm);
    const hit = skills.find((s) => hay.some((h) => h === s || h.includes(s) || (s.includes(h) && h.length >= 4)));
    if (hit) matched.push({ id: q.id, title: q.title, match: hit, created_at: q.created_at });
    if (matched.length === limit) break;
  }
  return { feedback, questions: matched };
}
