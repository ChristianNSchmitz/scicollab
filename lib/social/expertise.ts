import type { SupabaseClient } from "@supabase/supabase-js";
import { likeTerm } from "@/lib/query";

type Client = SupabaseClient<any, any, any>;

/**
 * Who knows a technique, and how we know: they list it, they recorded a
 * method card for it that worked, or they repeated someone's card and it
 * held. The evidence is shown, not a score: "MC-0602, it worked" says more
 * than a rank.
 */
export type Evidence = { kind: "listed" | "method" | "repeat"; text: string; href?: string };

export async function findExperts(supabase: Client, raw: string): Promise<Map<string, Evidence[]>> {
  const term = likeTerm(raw);
  const out = new Map<string, Evidence[]>();
  if (term.length < 2) return out;
  const like = `%${term}%`;
  const add = (who: string, e: Evidence) => out.set(who, [...(out.get(who) ?? []), e]);

  const [{ data: people }, { data: cards }] = await Promise.all([
    supabase.from("profiles").select("id, techniques").limit(2000),
    supabase.from("method_cards").select("id, code, title, author_id, outcome, visibility")
      .or(`title.ilike.${like},method.ilike.${like},system.ilike.${like},conditions.ilike.${like}`).neq("visibility", "private").limit(200),
  ]);
  const t = term.toLowerCase();
  for (const p of (people ?? []) as { id: string; techniques: string[] | null }[]) {
    const hit = (p.techniques ?? []).find((x) => x.toLowerCase().includes(t) || (t.includes(x.toLowerCase()) && x.length >= 3));
    if (hit) add(p.id, { kind: "listed", text: `lists ${hit}` });
  }
  const cardList = (cards ?? []) as { id: string; code: string; title: string; author_id: string; outcome: string | null }[];
  for (const c of cardList) {
    if (c.outcome === "success" || c.outcome === "partial") {
      add(c.author_id, { kind: "method", text: `${c.code} ${c.title}, ${c.outcome === "success" ? "it worked" : "it partly worked"}`, href: `/methods/${c.id}` });
    }
  }
  const ids = cardList.map((c) => c.id);
  const { data: repeats } = ids.length
    ? await supabase.from("reproductions").select("card_id, user_id, outcome").in("card_id", ids).eq("outcome", "held")
    : { data: [] as any[] };
  for (const r of (repeats ?? []) as { card_id: string; user_id: string }[]) {
    const c = cardList.find((x) => x.id === r.card_id);
    if (c && c.author_id !== r.user_id) add(r.user_id, { kind: "repeat", text: `repeated ${c.code} ${c.title}, it held`, href: `/methods/${c.id}` });
  }
  return out;
}
