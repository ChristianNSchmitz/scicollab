"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isConfigured } from "@/lib/mode";
import { isRowId } from "@/lib/query";
import { loadPaper, PAPER_FILE_BUCKET, MAX_PAPER_BYTES } from "@/lib/papers";
import { notifyNow, nameOf, quote, snippet } from "@/lib/notify";

/** Paper pages: full text, private requests, comments, following (supabase/21). */

const page = (w: string, extra = "") => `/papers/${w}${extra}`;

async function paperFor(supabase: any, workId: string) {
  const p = await loadPaper(supabase, workId);
  if (!p) throw new Error("That paper is not on SciCollab.");
  return p;
}

/** An author adds the full text: the version the publisher allows to share, or a private copy for requests. */
export async function uploadPaperFile(workId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const paper = await paperFor(supabase, workId);
  if (!paper.authorIds.includes(user.id)) throw new Error("Only the paper's authors can add its full text.");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(page(workId, "?ft=nofile#fulltext"));
  if (file.type !== "application/pdf") redirect(page(workId, "?ft=type#fulltext"));
  if (file.size > MAX_PAPER_BYTES) redirect(page(workId, "?ft=size#fulltext"));
  const access = form.get("access") === "public" ? "public" : "private";
  const version = ["preprint", "accepted", "published"].includes(String(form.get("version"))) ? String(form.get("version")) : "accepted";
  if (access === "public" && form.get("rights") !== "on") redirect(page(workId, "?ft=rights#fulltext"));
  const id = randomUUID();
  const name = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 200) || "paper.pdf";
  let path: string;
  if (isConfigured()) {
    path = `${workId}/${id}/${name}`;
    const { error } = await supabase.storage.from(PAPER_FILE_BUCKET).upload(path, file, { contentType: "application/pdf", upsert: false });
    if (error) redirect(page(workId, "?ft=upload#fulltext"));
  } else {
    path = `data:application/pdf;base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  }
  await supabase.from("paper_files").insert({ id, work_id: workId, uploaded_by: user.id, name, mime: "application/pdf", size_bytes: file.size, path, access, version, created_at: new Date().toISOString() });
  const { data: followers } = await supabase.from("paper_follows").select("user_id").eq("work_id", workId);
  if (access === "public") await notifyNow((followers ?? []).map((f: any) => f.user_id), { kind: "paper", title: `Full text added: ${quote(paper.title)}`, href: page(workId) }, user.id);
  revalidatePath(page(workId));
  redirect(page(workId, "?ft=added#fulltext"));
}

export async function deletePaperFile(workId: string, fileId: string) {
  const { supabase, user } = await requireUser();
  const paper = await paperFor(supabase, workId);
  if (!paper.authorIds.includes(user.id) || !isRowId(fileId)) return;
  const { data: f } = await supabase.from("paper_files").select("path").eq("id", fileId).eq("work_id", workId).maybeSingle();
  if (!f) return;
  await supabase.from("paper_files").delete().eq("id", fileId);
  if (isConfigured()) await supabase.storage.from(PAPER_FILE_BUCKET).remove([f.path]);
  revalidatePath(page(workId));
}

/** Ask the authors for the full text; they send a private copy, or decline. */
export async function requestFullText(workId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const paper = await paperFor(supabase, workId);
  if (paper.authorIds.includes(user.id)) return;
  const message = String(form.get("message") ?? "").trim().slice(0, 1000);
  const { data: had } = await supabase.from("paper_requests").select("id").eq("work_id", workId).eq("requester_id", user.id).maybeSingle();
  if (!had) {
    await supabase.from("paper_requests").insert({ work_id: workId, requester_id: user.id, message, status: "open", decided_by: null, created_at: new Date().toISOString(), decided_at: null });
    await notifyNow(paper.authorIds, { kind: "request", title: `${await nameOf(supabase, user.id)} asks for the full text of ${quote(paper.title)}`, body: snippet(message), href: page(workId, "#requests") }, user.id);
  }
  revalidatePath(page(workId));
  redirect(page(workId, "?ft=asked#fulltext"));
}

export async function decideFullText(workId: string, requestId: string, decision: "sent" | "declined") {
  const { supabase, user } = await requireUser();
  const paper = await paperFor(supabase, workId);
  if (!paper.authorIds.includes(user.id)) throw new Error("Only the paper's authors decide.");
  if (decision === "sent") {
    const { data: files } = await supabase.from("paper_files").select("id").eq("work_id", workId);
    if (!(files ?? []).length) redirect(page(workId, "?ft=needfile#fulltext"));
  }
  const { data: r } = await supabase.from("paper_requests").select("requester_id").eq("id", requestId).eq("work_id", workId).maybeSingle();
  if (!r) return;
  await supabase.from("paper_requests").update({ status: decision, decided_by: user.id, decided_at: new Date().toISOString() }).eq("id", requestId);
  await notifyNow([r.requester_id], decision === "sent"
    ? { kind: "paper", title: `You can now read ${quote(paper.title)}`, body: "An author shared the full text with you.", href: page(workId, "#fulltext") }
    : { kind: "paper", title: `Your request for ${quote(paper.title)} was declined`, href: page(workId) }, user.id);
  revalidatePath(page(workId));
}

export async function withdrawFullText(workId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("paper_requests").delete().eq("work_id", workId).eq("requester_id", user.id).eq("status", "open");
  revalidatePath(page(workId));
}

export async function commentOnPaper(workId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const paper = await paperFor(supabase, workId);
  const body = String(form.get("body") ?? "").trim().slice(0, 4000);
  if (!body) redirect(page(workId, "#comments"));
  await supabase.from("paper_comments").insert({ work_id: workId, author_id: user.id, body, created_at: new Date().toISOString() });
  const { data: followers } = await supabase.from("paper_follows").select("user_id").eq("work_id", workId);
  await notifyNow([...paper.authorIds, ...(followers ?? []).map((f: any) => f.user_id)],
    { kind: "paper", title: `${await nameOf(supabase, user.id)} commented on ${quote(paper.title)}`, body: snippet(body), href: page(workId, "#comments") }, user.id);
  revalidatePath(page(workId));
  redirect(page(workId, "#comments"));
}

export async function deletePaperComment(workId: string, commentId: string) {
  const { supabase, user } = await requireUser();
  const paper = await paperFor(supabase, workId);
  const { data: c } = await supabase.from("paper_comments").select("author_id").eq("id", commentId).eq("work_id", workId).maybeSingle();
  if (!c || (c.author_id !== user.id && !paper.authorIds.includes(user.id))) return;
  await supabase.from("paper_comments").delete().eq("id", commentId);
  revalidatePath(page(workId));
}

export async function followPaper(workId: string, on: boolean) {
  const { supabase, user } = await requireUser();
  await paperFor(supabase, workId);
  await supabase.from("paper_follows").delete().eq("work_id", workId).eq("user_id", user.id);
  if (on) await supabase.from("paper_follows").insert({ work_id: workId, user_id: user.id, created_at: new Date().toISOString() });
  revalidatePath(page(workId));
}
