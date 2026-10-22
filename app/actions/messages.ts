"use server";

import { overLimit } from "@/lib/ratelimit";
import { isRowId } from "@/lib/query";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";


/**
 * The reputation gate — board G4 screen 16.
 *
 * It applies only to an unsolicited first message. Anyone who has already
 * written to you, or whom you have written to, is never gated. The unlock is
 * any one contribution: a method card, a question, an answer or a reply to a post.
 */
export async function canMessage(recipientId: string) {
  const { supabase, user } = await requireUser();
  if (recipientId === user.id) return { allowed: false, reason: "self" as const };
  // The id goes into a filter string below; anything but an id is refused.
  if (!isRowId(recipientId)) return { allowed: false, reason: "gated" as const, contributions: 0 };

  const { count: priorCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`);
  if ((priorCount ?? 0) > 0) return { allowed: true, reason: "existing" as const };

  // A reply in a room is the same kind of help as an answer, so it counts.
  const counted = ["method_cards", "questions", "answers", "post_replies"] as const;
  const counts = await Promise.all(counted.map((t) =>
    supabase.from(t).select("id", { count: "exact", head: true }).eq("author_id", user.id)));
  const contributions = counts.reduce((n, r) => n + (r.count ?? 0), 0);

  return contributions > 0
    ? { allowed: true, reason: "contributed" as const, contributions }
    : { allowed: false, reason: "gated" as const, contributions: 0 };
}

const MAX_MESSAGE = 4000;

export type MessageProblem = "empty" | "long" | "gated" | "limited" | "card";

/**
 * Everything a message must pass before it is written, for both the full
 * thread page and the chat dock: the gate, the rate limit, a length cap, and
 * an attached card that is the sender's own.
 */
export async function checkMessage(recipientId: string, body: string, cardId: string | null): Promise<MessageProblem | null> {
  const { supabase, user } = await requireUser();
  if (!body) return "empty";
  if (body.length > MAX_MESSAGE) return "long";
  if (!(await canMessage(recipientId)).allowed) return "gated";
  if (await overLimit(supabase, "message", user.id)) return "limited";
  if (cardId) {
    const { data: card } = await supabase.from("method_cards").select("id").eq("id", cardId).eq("author_id", user.id).maybeSingle();
    if (!card) return "card";
  }
  return null;
}

export async function sendMessage(recipientId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const body = String(form.get("body") ?? "").trim();
  const card = String(form.get("method_card_id") ?? "") || null;
  const problem = await checkMessage(recipientId, body, card);
  if (problem) redirect(`/messages/${recipientId}?error=${problem}`);

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id, recipient_id: recipientId, body, method_card_id: card,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/messages/${recipientId}`);
  revalidatePath("/messages");
}

export async function markRead(otherId: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", otherId)
    .eq("recipient_id", user.id)
    .is("read_at", null);
}
