import type { SupabaseClient } from "@supabase/supabase-js";

export type Person = { id: string; display_name: string; institution: string; avatar_url: string | null };

/**
 * The people behind a list of rows (authors, repliers, members…) in one
 * query, as a Map by id. Empty and repeated ids are fine.
 */
export async function peopleById(
  supabase: SupabaseClient<any, any, any>, ids: (string | null | undefined)[],
): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return new Map();
  const { data } = await supabase.from("profiles").select("id, display_name, institution, avatar_url").in("id", unique);
  return new Map(((data ?? []) as Person[]).map((p) => [p.id, p]));
}
