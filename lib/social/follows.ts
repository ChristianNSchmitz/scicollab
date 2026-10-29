import type { SupabaseClient } from "@supabase/supabase-js";

/** The people you follow. Only you and they can see that you do (supabase/08-social.sql). */
export async function followingOf(supabase: SupabaseClient<any, any, any>, userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("follows").select("followee_id").eq("follower_id", userId);
  return new Set((data ?? []).map((r: { followee_id: string }) => r.followee_id));
}
