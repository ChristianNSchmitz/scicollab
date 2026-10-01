import { createHmac, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/mode";
import { tables } from "@/lib/demo/store";
import { ensureRecordTables, weekOf } from "@/lib/record/demo-seed";

/**
 * Reads, per board J2. Who read your work is never stored: a read is a week,
 * the reader's institution, where they came from, and a keyed hash that only
 * deduplicates the same reader within that week. Against a real database both
 * halves run inside security-definer functions (supabase/schema.sql); in demo
 * mode the same rules run here.
 */

type Client = SupabaseClient<any, "public", any>;

export type ReadStats = {
  weekly: { week: string; readers: number }[];
  via: { via: string; readers: number }[];
  institutions: { institution: string; readers: number }[];
  below_threshold: number;
};

export const MIN_READERS_PER_INSTITUTION = 3;

/** Turn the Referer path into a coarse "came from". Never the full URL. */
export function viaFrom(referer: string | null): string {
  if (!referer) return "direct";
  try {
    const p = new URL(referer).pathname;
    if (p.startsWith("/search")) return "search";
    if (p.startsWith("/questions") || p.startsWith("/ask")) return "a question";
    if (p.startsWith("/messages")) return "a message";
    if (p.startsWith("/methods/")) return "another card";
    if (p.startsWith("/methods")) return "methods list";
    if (p.startsWith("/home")) return "home feed";
    if (p.startsWith("/projects")) return "a project";
    return "elsewhere on SciCollab";
  } catch {
    return "direct";
  }
}

// Demo only: a per-process key, so keys mean nothing after a restart.
const demoKey = randomBytes(32);

export async function recordCardRead(supabase: Client, cardId: string, userId: string, via: string) {
  if (isConfigured()) {
    await supabase.rpc("record_card_read", { p_card: cardId, p_via: via });
    return;
  }
  ensureRecordTables();
  const card = (tables.method_cards as any[]).find((c) => c.id === cardId);
  if (!card || card.author_id === userId || card.visibility === "private") return;
  const week = weekOf(new Date());
  const reader_key = createHmac("sha256", demoKey).update(userId + cardId + week).digest("hex");
  const reads = tables.card_reads as any[];
  if (reads.some((r) => r.card_id === cardId && r.week === week && r.reader_key === reader_key)) return;
  const institution = (tables.profiles as any[]).find((p) => p.id === userId)?.institution ?? "";
  reads.push({ card_id: cardId, week, institution, via, reader_key });
}

/** Aggregates for the card's author, or null for anyone else. */
export async function cardReadStats(supabase: Client, cardId: string, userId: string): Promise<ReadStats | null> {
  if (isConfigured()) {
    const { data } = await supabase.rpc("card_read_stats", { p_card: cardId });
    return (data as ReadStats | null) ?? null;
  }
  ensureRecordTables();
  const card = (tables.method_cards as any[]).find((c) => c.id === cardId);
  if (!card || card.author_id !== userId) return null;
  const rows = (tables.card_reads as any[]).filter((r) => r.card_id === cardId);

  const count = <K extends string>(key: (r: any) => string, name: K) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m].map(([k, n]) => ({ [name]: k, readers: n }) as Record<K, string> & { readers: number });
  };

  // Reader keys change weekly, so readers are provably distinct people only
  // within one week: the three-reader threshold is applied per week.
  const byInstWeek = new Map<string, { institution: string; n: number }>();
  for (const r of rows) {
    const k = r.institution + "\u0000" + r.week;
    const e = byInstWeek.get(k) ?? { institution: r.institution, n: 0 };
    e.n++; byInstWeek.set(k, e);
  }
  const shown = new Map<string, number>();
  let below = 0;
  for (const { institution, n } of byInstWeek.values()) {
    if (institution && n >= MIN_READERS_PER_INSTITUTION) shown.set(institution, (shown.get(institution) ?? 0) + n);
    else below += n;
  }

  return {
    weekly: count((r) => r.week, "week").sort((a, b) => a.week.localeCompare(b.week)),
    via: count((r) => r.via, "via").sort((a, b) => b.readers - a.readers),
    institutions: [...shown].map(([institution, readers]) => ({ institution, readers })).sort((a, b) => b.readers - a.readers),
    below_threshold: below,
  };
}
