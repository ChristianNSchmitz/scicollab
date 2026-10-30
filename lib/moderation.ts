import type { SupabaseClient } from "@supabase/supabase-js";

/** Moderators are listed by the team in `moderators` (supabase/11); members cannot add themselves. */
export async function isModerator(supabase: SupabaseClient<any, any, any>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("moderators").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}
