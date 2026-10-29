import type { SupabaseClient } from "@supabase/supabase-js";

export type Expert = { id: string; display_name: string; avatar_url: string | null; match: string[] };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();

/**
 * Members who list a technique this question is about: a tag that names
 * it, or the technique appearing in the title. Matching is on what people
 * said they do (their profile), not on activity, so a quiet expert is found
 * as easily as a loud one. At most four, best match first.
 */
export async function whoCouldAnswer(
  supabase: SupabaseClient<any, any, any>, q: { title?: string; body?: string; tags?: string[] }, exclude: string[],
): Promise<Expert[]> {
  const tags = (q.tags ?? []).map(norm).filter(Boolean);
  const title = ` ${norm(q.title ?? "")} `;
  const { data } = await supabase.from("profiles").select("id, display_name, avatar_url, techniques").limit(1000);
  const skip = new Set(exclude);
  return (data ?? [])
    .filter((p: any) => !skip.has(p.id) && (p.techniques ?? []).length)
    .map((p: any) => {
      const match = (p.techniques as string[]).filter((t) => {
        const n = norm(t);
        return n.length > 2 && (tags.some((g) => g === n || g.includes(n) || n.includes(g)) || title.includes(` ${n} `));
      });
      return { id: p.id, display_name: p.display_name, avatar_url: p.avatar_url ?? null, match };
    })
    .filter((p: Expert) => p.match.length)
    .sort((a: Expert, b: Expert) => b.match.length - a.match.length)
    .slice(0, 4);
}
