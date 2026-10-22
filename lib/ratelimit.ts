import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-researcher limits on writes that reach other people: messages, posts,
 * questions, answers and data access requests.
 *
 * Counted from the rows themselves, so the limit holds across server
 * instances and restarts without another store. Generous enough that nobody
 * working normally meets them; they exist to stop a script or a stuck key.
 */

type Limit = { table: string; column: string; max: number; minutes: number; noun: string };

export const LIMITS = {
  message:  { table: "messages",        column: "sender_id",    max: 30, minutes: 10, noun: "messages" },
  post:     { table: "posts",           column: "author_id",    max: 10, minutes: 60, noun: "posts" },
  question: { table: "questions",       column: "author_id",    max: 10, minutes: 60, noun: "questions" },
  answer:   { table: "answers",         column: "author_id",    max: 30, minutes: 60, noun: "answers" },
  request:  { table: "access_requests", column: "requester_id", max: 20, minutes: 60, noun: "access requests" },
} satisfies Record<string, Limit>;

/** Null when the write may go ahead, otherwise a sentence saying why not. */
export async function overLimit(
  supabase: SupabaseClient<any, any, any>, kind: keyof typeof LIMITS, userId: string,
): Promise<string | null> {
  const l = LIMITS[kind];
  const since = new Date(Date.now() - l.minutes * 60e3).toISOString();
  const { count, error } = await supabase
    .from(l.table)
    .select("id", { count: "exact", head: true })
    .eq(l.column, userId)
    .gte("created_at", since);
  if (error) return null;   // never block a write because the count itself failed
  if ((count ?? 0) < l.max) return null;
  const span = l.minutes >= 60 ? `${l.minutes / 60} hour${l.minutes > 60 ? "s" : ""}` : `${l.minutes} minutes`;
  return `That is ${l.max} ${l.noun} in the last ${span}, the most allowed. Please wait a little and try again.`;
}
