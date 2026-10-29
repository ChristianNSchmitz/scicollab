"use server";

import { bytes } from "@/lib/format";
import { overLimit } from "@/lib/ratelimit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";

/**
 * Graduated disclosure for data and code attached to a post.
 *
 * The rule that matters: whether you may open an attachment is decided here,
 * on the server, from the attachment's access mode and your own granted
 * request. The page never decides it, and a client cannot assert it.
 */

export type AttachmentView = {
  id: string;
  kind: "dataset" | "code";
  access: "open" | "on_request";
  owner_id: string;
  projectTitle: string;
  /** Always shown: this is the advertisement that evidence exists. */
  title: string;
  meta: string;
  /** Only when unlocked. */
  detail: string | null;
  unlocked: boolean;
  myRequest: "pending" | "granted" | "denied" | null;
  /** Where to open it, when unlocked and the demo store holds its file. */
  href: string | null;
};



/** Everything a post's attachments should show to *this* viewer. */
export async function attachmentsFor(postId: string): Promise<AttachmentView[]> {
  const { supabase, user } = await requireUser();

  const { data: rows } = await supabase
    .from("post_attachments").select("*").eq("post_id", postId);
  if (!rows?.length) return [];

  const datasetIds = rows.filter((r: any) => r.dataset_id).map((r: any) => r.dataset_id);
  const codeIds    = rows.filter((r: any) => r.code_file_id).map((r: any) => r.code_file_id);
  const projectIds = rows.map((r: any) => r.project_id).filter(Boolean);

  const [{ data: datasets }, { data: files }, { data: projects }, { data: requests }] = await Promise.all([
    datasetIds.length ? supabase.from("datasets").select("*").in("id", datasetIds) : Promise.resolve({ data: [] as any[] }),
    codeIds.length    ? supabase.from("code_files").select("*").in("id", codeIds)  : Promise.resolve({ data: [] as any[] }),
    projectIds.length ? supabase.from("projects").select("id, title").in("id", projectIds) : Promise.resolve({ data: [] as any[] }),
    supabase.from("access_requests").select("attachment_id, status").eq("requester_id", user.id),
  ]);

  return rows.map((r: any): AttachmentView => {
    const mine = r.owner_id === user.id;
    const req = (requests ?? []).find((q: any) => q.attachment_id === r.id);
    const granted = req?.status === "granted";
    // The author always sees their own; everyone else needs open access or a
    // granted request. This is the whole access decision, in one place.
    const unlocked = mine || r.access === "open" || granted;

    const project = (projects ?? []).find((p: any) => p.id === r.project_id);
    const d = r.dataset_id   ? (datasets ?? []).find((x: any) => x.id === r.dataset_id) : null;
    const f = r.code_file_id ? (files ?? []).find((x: any) => x.id === r.code_file_id)   : null;

    return {
      id: r.id,
      kind: r.kind,
      access: r.access,
      owner_id: r.owner_id,
      projectTitle: project?.title ?? "a project",
      title: d?.title ?? f?.path ?? "Attachment",
      meta: d
        ? [bytes(d.size_bytes), d.licence].filter(Boolean).join(" · ")
        : f ? [f.language, bytes(f.size_bytes)].filter(Boolean).join(" · ") : "",
      detail: unlocked ? (d?.summary || f?.last_change || "") : null,
      unlocked,
      myRequest: (req?.status as AttachmentView["myRequest"]) ?? null,
      href: unlocked && (d?.file_path || f?.file_path) && r.project_id
        ? `/projects/${r.project_id}/files/${d?.id ?? f?.id}` : null,
    };
  });
}

export async function requestAccess(attachmentId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const { data: att } = await supabase
    .from("post_attachments").select("id, owner_id, post_id").eq("id", attachmentId).maybeSingle();
  if (!att) throw new Error("No such attachment.");
  if (att.owner_id === user.id) return;
  if (await overLimit(supabase, "request", user.id)) redirect(`/posts/${att.post_id}?limited=1`);

  // status is written explicitly rather than left to the column default:
  // the demo store has no defaults, and a request that lands without a status
  // is invisible to both sides — it looks sent and never arrives.
  await supabase.from("access_requests").insert({
    attachment_id: attachmentId,
    requester_id: user.id,
    owner_id: att.owner_id,
    status: "pending",
    message: String(formData.get("message") ?? "").trim(),
    decided_at: null,
  });
  revalidatePath(`/posts/${att.post_id}`);
}

/** Only the owner decides, and the policy enforces that independently. */
export async function decideRequest(requestId: string, decision: "granted" | "denied") {
  const { supabase, user } = await requireUser();
  const { data: req } = await supabase
    .from("access_requests").select("id, owner_id, attachment_id").eq("id", requestId).maybeSingle();
  if (!req || req.owner_id !== user.id) throw new Error("Not yours to decide.");

  await supabase
    .from("access_requests")
    .update({ status: decision, decided_at: new Date().toISOString() })
    .eq("id", requestId);

  const { data: att } = await supabase
    .from("post_attachments").select("post_id").eq("id", req.attachment_id).maybeSingle();
  if (att) revalidatePath(`/posts/${att.post_id}`);
  revalidatePath("/requests");
}

/** Pending requests on a given post, for its author. */
export async function pendingFor(postId: string) {
  const { supabase, user } = await requireUser();
  const { data: atts } = await supabase
    .from("post_attachments").select("id").eq("post_id", postId).eq("owner_id", user.id);
  const ids = (atts ?? []).map((a: any) => a.id);
  if (!ids.length) return [];

  const { data: reqs } = await supabase
    .from("access_requests").select("*").in("attachment_id", ids).eq("status", "pending");
  if (!reqs?.length) return [];

  const { data: people } = await supabase
    .from("profiles").select("id, display_name, institution")
    .in("id", reqs.map((r: any) => r.requester_id));

  return reqs.map((r: any) => ({
    id: r.id,
    message: r.message as string,
    created_at: r.created_at as string,
    requester_id: r.requester_id as string,
    who: (people ?? []).find((p: any) => p.id === r.requester_id) ?? { display_name: "Someone", institution: "" },
  }));
}
