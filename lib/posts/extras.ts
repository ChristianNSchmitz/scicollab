import type { SupabaseClient } from "@supabase/supabase-js";
import { REACTIONS, type ReactionSummary } from "@/lib/social/reactions";

/**
 * What a post card shows besides the post itself: how often it was
 * reposted, whether you reposted or saved it, and the line on top that says
 * why it is in your feed ("Maja reposted this", "Temi found this useful").
 */
export type PostExtra = {
  reposts: number;
  reposted: boolean;
  saved: boolean;
  /** Who you follow did something with it, and what; first one wins. */
  context?: { personId: string; text: string; note?: string };
};

export async function postExtras(
  supabase: SupabaseClient<any, any, any>, me: string, postIds: string[],
  following: Set<string>, reactions: Map<string, ReactionSummary>,
): Promise<Map<string, PostExtra>> {
  const out = new Map<string, PostExtra>();
  if (!postIds.length) return out;
  const [{ data: reposts }, { data: saved }] = await Promise.all([
    supabase.from("post_reposts").select("post_id, user_id, note, created_at").in("post_id", postIds),
    supabase.from("saved_posts").select("post_id").eq("user_id", me).in("post_id", postIds),
  ]);
  const savedSet = new Set((saved ?? []).map((s: any) => s.post_id));
  for (const id of postIds) {
    const rs = (reposts ?? []).filter((r: any) => r.post_id === id);
    const extra: PostExtra = { reposts: rs.length, reposted: rs.some((r: any) => r.user_id === me), saved: savedSet.has(id) };
    const byFollowed = rs.filter((r: any) => following.has(r.user_id)).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))[0];
    if (byFollowed) extra.context = { personId: byFollowed.user_id, text: "reposted this", note: byFollowed.note || undefined };
    else {
      const s = reactions.get(id);
      for (const r of REACTIONS) {
        const who = s?.who[r.key].find((u) => following.has(u));
        if (who) { extra.context = { personId: who, text: r.key === "useful" ? "found this useful" : r.key === "seen" ? "has seen this too" : "can help with this" }; break; }
      }
    }
    out.set(id, extra);
  }
  return out;
}

/** Posts reposted by these people lately, newest first: for the Following feed. */
export async function repostedBy(supabase: SupabaseClient<any, any, any>, people: string[], limit = 40): Promise<{ post_id: string; created_at: string }[]> {
  if (!people.length) return [];
  const { data } = await supabase.from("post_reposts").select("post_id, created_at").in("user_id", people)
    .order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as { post_id: string; created_at: string }[];
}
