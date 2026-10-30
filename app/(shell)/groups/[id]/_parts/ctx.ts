import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupRole } from "@/lib/social/groups";
import type { Person } from "@/lib/people";
import { btn } from "@/components/ui";

/** What every tab of a group page knows: the group, who is looking, and who is in it. */
export type GroupCtx = {
  supabase: SupabaseClient<any, any, any>;
  id: string;
  g: any;
  me: string;
  myRole?: GroupRole;
  member: boolean;
  manage: boolean;
  lead: boolean;
  members: any[];
  current: any[];
  alumni: any[];
  people: Map<string, Person>;
  sp: Record<string, string | undefined>;
  /** Since when things count as new for this member, per part. */
  since: { feed: string; chat: string };
};

export const small = { ...btn, height: 28, padding: "0 10px" };
export const note = { font: "400 12px/1.5 var(--sans)", color: "var(--mute)" } as const;
export const hidden = { position: "absolute", left: -9999 } as const;

/** Remember that this member has seen the feed or the chat up to now. */
export async function markSeen(supabase: GroupCtx["supabase"], groupId: string, userId: string, part: "feed" | "chat") {
  const col = part === "feed" ? "feed_seen_at" : "chat_seen_at";
  const now = new Date().toISOString();
  const { data: row } = await supabase.from("group_visits").select("user_id").eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  if (row) await supabase.from("group_visits").update({ [col]: now }).eq("group_id", groupId).eq("user_id", userId);
  else await supabase.from("group_visits").insert({ group_id: groupId, user_id: userId, [col]: now });
}
