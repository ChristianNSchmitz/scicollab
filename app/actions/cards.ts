"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/* The owner is always resolved from the session on the server. A client-supplied
   id is never trusted, so a card cannot be written on another account's behalf. */
async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const arr = (s: FormDataEntryValue | null) =>
  String(s ?? "").split(",").map((t) => t.trim()).filter(Boolean);

export async function createCard(form: FormData) {
  const { supabase, user } = await me();

  const outcome = String(form.get("outcome") ?? "");
  const { data, error } = await supabase
    .from("method_cards")
    .insert({
      author_id: user.id,
      title: String(form.get("title") ?? "").trim(),
      method: String(form.get("method") ?? "").trim(),
      system: String(form.get("system") ?? "").trim(),
      conditions: String(form.get("conditions") ?? "").trim(),
      outcome: outcome || null,
      outcome_detail: String(form.get("outcome_detail") ?? "").trim(),
      fails_under: String(form.get("fails_under") ?? "").trim(),
      tags: arr(form.get("tags")),
      visibility: String(form.get("visibility") ?? "private"),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/methods");
  revalidatePath("/home");
  redirect(`/methods/${data.id}`);
}

/** Forking records lineage; it never copies silently. */
export async function forkCard(id: string) {
  const { supabase, user } = await me();

  const { data: src, error: readErr } = await supabase
    .from("method_cards")
    .select("*")
    .eq("id", id)
    .single();
  if (readErr) throw new Error(readErr.message);

  const { data, error } = await supabase
    .from("method_cards")
    .insert({
      author_id: user.id,
      forked_from: src.id,
      title: src.title,
      method: src.method,
      system: src.system,
      conditions: src.conditions,
      outcome: null,                 // the fork has not been run yet
      outcome_detail: "",
      fails_under: src.fails_under,
      tags: src.tags,
      visibility: "private",         // a fork starts private
      version: 1,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/methods");
  redirect(`/methods/${data.id}`);
}

export async function markReproduced(id: string) {
  const { supabase } = await me();
  const { data } = await supabase.from("method_cards").select("reproductions").eq("id", id).single();
  await supabase.from("method_cards").update({ reproductions: (data?.reproductions ?? 0) + 1 }).eq("id", id);
  revalidatePath(`/methods/${id}`);
}

export async function setVisibility(id: string, visibility: "private" | "lab" | "public") {
  const { supabase } = await me();
  const { error } = await supabase.from("method_cards").update({ visibility }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/methods/${id}`);
  revalidatePath("/home");
}

export async function deleteCard(id: string) {
  const { supabase } = await me();
  const { error } = await supabase.from("method_cards").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/methods");
  redirect("/methods");
}
