"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/mode";
import { ensureRecordTables } from "@/lib/record/demo-seed";

/* Everything the research record counts is written here. The actor is always
   the session user; nobody can credit themselves for their own card, and a
   mentorship is recorded by the person who was helped. The database enforces
   the same rules (supabase/schema.sql); these checks give a clear message. */

async function me() {
  ensureRecordTables();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function notMine(supabase: Awaited<ReturnType<typeof createClient>>, cardId: string, userId: string) {
  const { data: card } = await supabase.from("method_cards").select("id, author_id, reproductions").eq("id", cardId).maybeSingle();
  if (!card) throw new Error("That card does not exist or is not visible to you.");
  if (card.author_id === userId) throw new Error("You cannot record this on your own card.");
  return card;
}

export async function recordReproduction(cardId: string, form: FormData) {
  const { supabase, user } = await me();
  const card = await notMine(supabase, cardId, user.id);
  const outcome = form.get("outcome") === "failed" ? "failed" : "held";
  const note = String(form.get("note") ?? "").trim().slice(0, 500);

  const { error } = await supabase.from("reproductions").insert({ card_id: cardId, user_id: user.id, outcome, note });
  if (error) throw new Error(error.message);
  // A database trigger keeps the counter in step; the demo store has none.
  if (!isConfigured()) {
    await supabase.from("method_cards").update({ reproductions: (card.reproductions ?? 0) + 1 }).eq("id", cardId);
  }
  revalidatePath(`/methods/${cardId}`);
}

export async function writeReview(cardId: string, form: FormData) {
  const { supabase, user } = await me();
  await notMine(supabase, cardId, user.id);
  const allowed = ["clear", "unclear", "incomplete", "does_not_hold"];
  const verdict = String(form.get("verdict") ?? "");
  if (!allowed.includes(verdict)) throw new Error("Choose a verdict.");
  const body = String(form.get("body") ?? "").trim().slice(0, 2000);

  const { count } = await supabase.from("reviews").select("id", { count: "exact", head: true })
    .eq("card_id", cardId).eq("reviewer_id", user.id);
  if ((count ?? 0) > 0) throw new Error("You have already reviewed this card.");

  const { error } = await supabase.from("reviews").insert({ card_id: cardId, reviewer_id: user.id, verdict, body });
  if (error) throw new Error(error.message);
  revalidatePath(`/methods/${cardId}`);
}

export async function nameGuide(mentorId: string, form: FormData) {
  const { supabase, user } = await me();
  if (mentorId === user.id) throw new Error("You cannot name yourself.");
  const note = String(form.get("note") ?? "").trim().slice(0, 300);
  const { count } = await supabase.from("mentorships").select("id", { count: "exact", head: true })
    .eq("mentor_id", mentorId).eq("mentee_id", user.id);
  if ((count ?? 0) === 0) {
    const { error } = await supabase.from("mentorships").insert({ mentor_id: mentorId, mentee_id: user.id, note });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/network");
}

export async function unnameGuide(mentorId: string) {
  const { supabase, user } = await me();
  await supabase.from("mentorships").delete().eq("mentor_id", mentorId).eq("mentee_id", user.id);
  revalidatePath("/network");
}
