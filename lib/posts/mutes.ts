import type { SupabaseClient } from "@supabase/supabase-js";

export const MUTE_KINDS = ["post", "room", "person"] as const;
export type MuteKind = (typeof MUTE_KINDS)[number];
export type Mutes = { posts: Set<string>; rooms: Set<string>; people: Set<string>; list: { kind: MuteKind; target: string }[] };

/** What you took out of your feed: posts, topic groups and people. */
export async function mutesOf(supabase: SupabaseClient<any, any, any>, me: string): Promise<Mutes> {
  const { data } = await supabase.from("feed_mutes").select("kind, target, created_at").eq("user_id", me);
  const list = ((data ?? []) as { kind: MuteKind; target: string; created_at: string }[])
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  const of = (k: MuteKind) => new Set(list.filter((m) => m.kind === k).map((m) => m.target));
  return { posts: of("post"), rooms: of("room"), people: of("person"), list: list.map(({ kind, target }) => ({ kind, target })) };
}
