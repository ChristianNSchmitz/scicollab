import type { SupabaseClient } from "@supabase/supabase-js";
import { REACTIONS, type ReactionSummary } from "@/lib/social/reactions";

/**
 * What a post card shows besides the post itself: how often it was
 * reposted, whether you reposted or saved it, and the line on top when
 * someone you follow reposted it ("Maja reposted this", with her note).
 */
export type PostExtra = {
  reposts: number;
  reposted: boolean;
  saved: boolean;
  /** Files attached to a feedback request. */
  files: { id: string; name: string; mime: string; size_bytes: number }[];
  /** Someone you follow reposted it: the latest one, with their note. */
  context?: { personId: string; text: string; note?: string };
};

export async function postExtras(
  supabase: SupabaseClient<any, any, any>, me: string, postIds: string[],
  following: Set<string>, _reactions?: Map<string, ReactionSummary>,
): Promise<Map<string, PostExtra>> {
  const out = new Map<string, PostExtra>();
  if (!postIds.length) return out;
  const [{ data: reposts }, { data: saved }, { data: files }] = await Promise.all([
    supabase.from("post_reposts").select("post_id, user_id, note, created_at").in("post_id", postIds),
    supabase.from("saved_posts").select("post_id").eq("user_id", me).in("post_id", postIds),
    supabase.from("post_files").select("id, post_id, name, mime, size_bytes").in("post_id", postIds),
  ]);
  const savedSet = new Set((saved ?? []).map((s: any) => s.post_id));
  for (const id of postIds) {
    const rs = (reposts ?? []).filter((r: any) => r.post_id === id);
    const extra: PostExtra = {
      reposts: rs.length, reposted: rs.some((r: any) => r.user_id === me), saved: savedSet.has(id),
      files: (files ?? []).filter((f: any) => f.post_id === id),
    };
    // Several people you follow reposting the same post: one line, not one card each.
    const followedReposts = rs.filter((r: any) => following.has(r.user_id)).sort((a: any, b: any) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    const byFollowed = followedReposts.find((r: any) => r.note) ?? followedReposts[0];
    const others = followedReposts.length - 1;
    if (byFollowed) extra.context = {
      personId: byFollowed.user_id,
      text: others > 0 ? `and ${others} other${others > 1 ? "s" : ""} you follow reposted this` : "reposted this",
      note: byFollowed.note || undefined,
    };
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
