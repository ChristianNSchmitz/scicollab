"use server";

import { overLimit } from "@/lib/ratelimit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { recordMentions } from "@/lib/social/mentions";


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
  await recordMentions(supabase, user.id, "question", data.id, `/questions/${data.id}`, String(form.get("body") ?? ""));
  revalidatePath("/home");
  redirect(`/questions/${data.id}`);
}

export async function postAnswer(questionId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const body = String(form.get("body") ?? "").trim();
  if (!body) return;
  if (await overLimit(supabase, "answer", user.id)) redirect(`/questions/${questionId}?limited=1`);
  const { data, error } = await supabase
    .from("answers")
    .insert({ question_id: questionId, author_id: user.id, body })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await recordMentions(supabase, user.id, "answer", data.id, `/questions/${questionId}`, body);
  revalidatePath(`/questions/${questionId}`);
}

/** Only the person who asked can accept, and only one answer can hold it. */
export async function acceptAnswer(questionId: string, answerId: string) {
  const { supabase, user } = await requireUser();
  const { data: q } = await supabase.from("questions").select("author_id").eq("id", questionId).maybeSingle();
  if (q?.author_id !== user.id) throw new Error("Only the person who asked can accept an answer.");
  await supabase.from("answers").update({ accepted: false }).eq("question_id", questionId);
  await supabase.from("answers").update({ accepted: true }).eq("id", answerId);
  revalidatePath(`/questions/${questionId}`);
}

export async function editAnswer(answerId: string, questionId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const body = String(form.get("body") ?? "").trim().slice(0, 20000);
  if (!body) return;
  await supabase.from("answers").update({ body, edited_at: new Date().toISOString() }).eq("id", answerId).eq("author_id", user.id);
  await recordMentions(supabase, user.id, "answer", answerId, `/questions/${questionId}`, body);
  revalidatePath(`/questions/${questionId}`);
  redirect(`/questions/${questionId}#answer-${answerId}`);
}
