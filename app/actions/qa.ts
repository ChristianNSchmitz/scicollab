"use server";

import { overLimit } from "@/lib/ratelimit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";


export async function askQuestion(form: FormData) {
  const { supabase, user } = await requireUser();
  if (await overLimit(supabase, "question", user.id)) redirect("/ask?limited=1");
  const card = String(form.get("method_card_id") ?? "");
  const { data, error } = await supabase
    .from("questions")
    .insert({
      author_id: user.id,
      title: String(form.get("title") ?? "").trim(),
      body: String(form.get("body") ?? "").trim(),
      tags: String(form.get("tags") ?? "").split(",").map(t => t.trim()).filter(Boolean),
      method_card_id: card || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/home");
  redirect(`/questions/${data.id}`);
}

export async function postAnswer(questionId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const body = String(form.get("body") ?? "").trim();
  if (!body) return;
  if (await overLimit(supabase, "answer", user.id)) redirect(`/questions/${questionId}?limited=1`);
  const { error } = await supabase
    .from("answers")
    .insert({ question_id: questionId, author_id: user.id, body });
  if (error) throw new Error(error.message);
  revalidatePath(`/questions/${questionId}`);
}

/** Only the person who asked can accept, and only one answer can hold it. */
export async function acceptAnswer(questionId: string, answerId: string) {
  const { supabase } = await requireUser();
  await supabase.from("answers").update({ accepted: false }).eq("question_id", questionId);
  await supabase.from("answers").update({ accepted: true }).eq("id", answerId);
  revalidatePath(`/questions/${questionId}`);
}
