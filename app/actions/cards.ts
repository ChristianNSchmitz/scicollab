"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";

/* The owner is always resolved from the session on the server. A client-supplied
   id is never trusted, so a card cannot be written on another account's behalf. */

const arr = (s: FormDataEntryValue | null) =>
  String(s ?? "").split(",").map((t) => t.trim()).filter(Boolean);

export async function createCard(form: FormData) {
  const { supabase, user } = await requireUser();

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
  const { supabase, user } = await requireUser();

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

export async function setVisibility(id: string, visibility: "private" | "lab" | "public") {
  const { supabase, user } = await requireUser();
  // Bound arguments arrive from the browser, so both are checked here, and
  // only the author's own card matches. Row-level security says the same.
  if (!["private", "lab", "public"].includes(visibility)) throw new Error("Unknown visibility.");
  const { data, error } = await supabase.from("method_cards").update({ visibility })
    .eq("id", id).eq("author_id", user.id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Only the author can change who sees this card.");
  revalidatePath(`/methods/${id}`);
  revalidatePath("/home");
}

export async function deleteCard(id: string) {
  const { supabase, user } = await requireUser();
  // Without the author filter a refused delete looked like a successful one:
  // the policy matched no rows, no error came back, and the page moved on.
  const { data, error } = await supabase.from("method_cards").delete()
    .eq("id", id).eq("author_id", user.id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Only the author can delete this card.");
  revalidatePath("/methods");
  redirect("/methods");
}
