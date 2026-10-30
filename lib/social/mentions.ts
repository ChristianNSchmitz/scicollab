import type { SupabaseClient } from "@supabase/supabase-js";
import { peopleById } from "@/lib/people";

type Client = SupabaseClient<any, any, any>;
export type MentionKind = "post" | "reply" | "question" | "answer";
export type Mentioned = { id: string; name: string };

/**
 * @mentions. People are written as "@Display Name" (the composer offers the
 * names as you type). Names are matched against members, longest first, so
 * "@Maja Lindqvist" finds Maja and not someone called Maja Lind. Matching
 * happens once, when the text is saved, and is stored in `mentions`; the
 * text itself is never rewritten.
 */
export async function findMentions(supabase: Client, text: string): Promise<Mentioned[]> {
  const words = [...new Set([...text.matchAll(/(?:^|[^\w@])@([\p{L}][\p{L}'’-]*)/gu)].map((m) => m[1]))].slice(0, 10);
  if (!words.length) return [];
  const rows = (await Promise.all(words.map((w) =>
    supabase.from("profiles").select("id, display_name").ilike("display_name", `${w.replace(/[%_]/g, "")}%`).limit(20),
  ))).flatMap((r) => r.data ?? []) as { id: string; display_name: string }[];

  const lower = text.toLowerCase();
  const found = new Map<string, Mentioned>();
  for (const p of rows.sort((a, b) => b.display_name.length - a.display_name.length)) {
    const needle = "@" + p.display_name.toLowerCase();
    let at = lower.indexOf(needle);
    while (at >= 0) {
      const next = lower[at + needle.length] ?? " ";
      // a whole name, not the start of a longer one already taken
      if (!/[\p{L}\d]/u.test(next)) { found.set(p.id, { id: p.id, name: p.display_name }); break; }
      at = lower.indexOf(needle, at + 1);
    }
  }
  return [...found.values()];
}

/** Store who was mentioned in a piece of text just saved. The author is never notified about themself. */
export async function recordMentions(
  supabase: Client, authorId: string, kind: MentionKind, sourceId: string, href: string, text: string,
): Promise<void> {
  const found = (await findMentions(supabase, text)).filter((p) => p.id !== authorId).slice(0, 20);
  if (!found.length) return;
  // After an edit, only people newly mentioned are added (and notified).
  const { data: already } = await supabase.from("mentions").select("mentioned_id").eq("source_kind", kind).eq("source_id", sourceId);
  const known = new Set((already ?? []).map((m: { mentioned_id: string }) => m.mentioned_id));
  const people = found.filter((p) => !known.has(p.id));
  if (!people.length) return;
  await supabase.from("mentions").insert(people.map((p) => ({
    author_id: authorId, mentioned_id: p.id, source_kind: kind, source_id: sourceId, href,
  })));
}

/** The people mentioned in each of these texts, for rendering their names as links. */
export async function mentionsIn(supabase: Client, kind: MentionKind, ids: string[]): Promise<Map<string, Mentioned[]>> {
  const out = new Map<string, Mentioned[]>();
  if (!ids.length) return out;
  const { data } = await supabase.from("mentions").select("source_id, mentioned_id").eq("source_kind", kind).in("source_id", ids);
  const people = await peopleById(supabase, (data ?? []).map((m: any) => m.mentioned_id));
  for (const m of data ?? []) {
    const p = people.get(m.mentioned_id);
    if (!p) continue;
    out.set(m.source_id, [...(out.get(m.source_id) ?? []), { id: p.id, name: p.display_name }]);
  }
  return out;
}
