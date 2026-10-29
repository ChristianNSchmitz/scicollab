import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Three reactions, each saying something a heart cannot. "Seen this too" is
 * the important one: the same result in another lab turns one person's
 * failed run into a pattern.
 */
export const REACTIONS = [
  { key: "useful",   label: "Useful",         hint: "This helped me" },
  { key: "seen",     label: "Seen this too",  hint: "I got the same result" },
  { key: "can_help", label: "I can help",     hint: "I have experience with this" },
] as const;
export type ReactionKey = (typeof REACTIONS)[number]["key"];
export type ReactionTarget = "post" | "answer";
export type ReactionSummary = { counts: Record<ReactionKey, number>; mine: ReactionKey[]; who: Record<ReactionKey, string[]> };

export const isReaction = (v: string): v is ReactionKey => REACTIONS.some((r) => r.key === v);

export async function reactionsFor(
  supabase: SupabaseClient<any, any, any>, kind: ReactionTarget, ids: string[], me: string,
): Promise<Map<string, ReactionSummary>> {
  const out = new Map<string, ReactionSummary>();
  if (!ids.length) return out;
  const { data } = await supabase.from("reactions").select("target_id, user_id, kind").eq("target_kind", kind).in("target_id", ids);
  for (const r of (data ?? []) as { target_id: string; user_id: string; kind: ReactionKey }[]) {
    const s = out.get(r.target_id) ?? { counts: { useful: 0, seen: 0, can_help: 0 }, mine: [], who: { useful: [], seen: [], can_help: [] } };
    s.counts[r.kind]++;
    s.who[r.kind].push(r.user_id);
    if (r.user_id === me) s.mine.push(r.kind);
    out.set(r.target_id, s);
  }
  return out;
}
