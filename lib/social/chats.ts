import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<any, any, any>;

/**
 * Small chats (supabase/15): three to five people from any lab, outside any
 * group. A writing-buddy pair plus one, a mini collaboration, a few PhD
 * students comparing protocols.
 */
export const MAX_CHAT_PEOPLE = 5;

export type ChatSummary = { id: string; title: string; members: string[]; last: string; lastAuthor: string | null; at: string; unread: number };

export async function myChats(supabase: Client, me: string): Promise<ChatSummary[]> {
  const { data: mine } = await supabase.from("chat_room_members").select("room_id, last_read_at").eq("user_id", me);
  const ids = (mine ?? []).map((m: any) => m.room_id);
  if (!ids.length) return [];
  const [{ data: rooms }, { data: members }, { data: messages }] = await Promise.all([
    supabase.from("chat_rooms").select("id, title, created_at").in("id", ids),
    supabase.from("chat_room_members").select("room_id, user_id").in("room_id", ids),
    supabase.from("chat_room_messages").select("room_id, author_id, body, created_at").in("room_id", ids).order("created_at", { ascending: false }).limit(500),
  ]);
  return (rooms ?? []).map((r: any) => {
    const read = (mine ?? []).find((m: any) => m.room_id === r.id)?.last_read_at ?? "";
    const msgs = (messages ?? []).filter((m: any) => m.room_id === r.id);
    return {
      id: r.id, title: r.title,
      members: (members ?? []).filter((m: any) => m.room_id === r.id).map((m: any) => m.user_id),
      last: msgs[0]?.body ?? "No messages yet", lastAuthor: msgs[0]?.author_id ?? null, at: msgs[0]?.created_at ?? r.created_at,
      unread: msgs.filter((m: any) => m.author_id !== me && m.created_at > read).length,
    };
  }).sort((a, b) => b.at.localeCompare(a.at));
}
