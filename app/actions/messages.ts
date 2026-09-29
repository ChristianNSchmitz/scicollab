"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/**
 * The reputation gate — board G4 screen 16.
 *
 * It applies only to an unsolicited first message. Anyone who has already
 * written to you, or whom you have written to, is never gated. The unlock is
 * any one contribution: a method card, a question or an answer.
 */
export async function canMessage(recipientId: string) {
  const { supabase, user } = await me();
  if (recipientId === user.id) return { allowed: false, reason: "self" as const };

  const { count: priorCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`);
  if ((priorCount ?? 0) > 0) return { allowed: true, reason: "existing" as const };

  const [cards, questions, answers] = await Promise.all([
    supabase.from("method_cards").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    supabase.from("answers").select("id", { count: "exact", head: true }).eq("author_id", user.id),
  ]);
  const contributions = (cards.count ?? 0) + (questions.count ?? 0) + (answers.count ?? 0);

  return contributions > 0
    ? { allowed: true, reason: "contributed" as const, contributions }
    : { allowed: false, reason: "gated" as const, contributions: 0 };
}

export async function sendMessage(recipientId: string, form: FormData) {
  const { supabase, user } = await me();
  const body = String(form.get("body") ?? "").trim();
  if (!body) return;

  const gate = await canMessage(recipientId);
  if (!gate.allowed) throw new Error("You cannot message this person yet.");

  const card = String(form.get("method_card_id") ?? "");
  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: recipientId,
    body,
    method_card_id: card || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/messages/${recipientId}`);
  revalidatePath("/messages");
}

export async function markRead(otherId: string) {
  const { supabase, user } = await me();
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", otherId)
    .eq("recipient_id", user.id)
    .is("read_at", null);
}
