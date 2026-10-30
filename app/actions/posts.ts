"use server";

import { overLimit } from "@/lib/ratelimit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { intentById, roomById } from "@/lib/taxonomy";
import { isRowId } from "@/lib/query";
import { recordMentions } from "@/lib/social/mentions";
import { roleIn, isCurrent, canReadPost } from "@/lib/social/groups";
import { storeImages, removeImages, MAX_IMAGES, IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/posts/images";
import { firstUrl, linkPreview } from "@/lib/posts/link-preview";

export type PostState = { error: string } | null;

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

/** Returns a message rather than throwing: a validation failure belongs on
 *  the form next to the field, not in an error boundary. Everything the form
 *  offers is checked again here, because the values arrive from the browser. */
export async function createPost(_prev: PostState, form: FormData): Promise<PostState> {
  const { supabase, user } = await requireUser();

  const limited = await overLimit(supabase, "post", user.id);
  if (limited) return { error: limited };

  const intent = String(form.get("intent") ?? "");
  const spec = intentById(intent);
  if (!spec) return { error: "Pick what kind of post this is." };

  // Either a group's own discussion (members only), or a topic group the
  // author has joined: the composer only offers those, and a post anywhere
  // else would land in a feed nobody reads.
  const groupId = String(form.get("group_id") ?? "");
  let room = "";
  if (groupId) {
    if (!isRowId(groupId) || !isCurrent(await roleIn(supabase, groupId, user.id))) return { error: "You can only post in groups you are a member of." };
  } else {
    room = String(form.get("room_id") ?? "");
    if (!roomById(room)) return { error: "Choose a topic group to post in." };
    const { data: joined } = await supabase
      .from("user_rooms").select("room_id").eq("user_id", user.id).eq("room_id", room).maybeSingle();
    if (!joined) return { error: "You can only post in topic groups you have joined." };
  }

  const title = text(form, "title", 200);
  if (!title) return { error: "Give the post a title." };

  const images = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (images.length > MAX_IMAGES) return { error: `At most ${MAX_IMAGES} images per post.` };
  if (images.some((f) => !IMAGE_TYPES.includes(f.type))) return { error: "Images must be JPEG, PNG or WebP." };
  if (images.some((f) => f.size > MAX_IMAGE_BYTES)) return { error: "An image is too large even after scaling. Try a smaller one." };

  // The intents that exist to carry evidence must carry it, and it must be
  // the author's own card. This keeps the feed anchored to artifacts.
  const card = String(form.get("method_card_id") ?? "");
  if (spec.needsArtifact && !card) {
    return { error: `“${spec.label}” needs a method card attached. Pick one in the method card field, or choose a different kind of post.` };
  }
  if (card) {
    const { data: own } = await supabase.from("method_cards").select("id").eq("id", card).eq("author_id", user.id).maybeSingle();
    if (!own) return { error: "You can only attach your own method cards." };
  }

  // Optional project evidence, "<kind>:<id>". Only data or code from a
  // project the author is on: re-sharing someone else's dataset as "open"
  // would hand out what its owner had not.
  const attach = String(form.get("attach") ?? "");
  let attachment: { kind: "dataset" | "code"; id: string; project_id: string } | null = null;
  if (attach) {
    const [kind, refId] = attach.split(":");
    if ((kind === "dataset" || kind === "code") && isRowId(refId)) {
      const { data: ref } = await supabase
        .from(kind === "dataset" ? "datasets" : "code_files").select("id, project_id").eq("id", refId).maybeSingle();
      const { data: member } = ref?.project_id
        ? await supabase.from("project_members").select("user_id").eq("project_id", ref.project_id).eq("user_id", user.id).maybeSingle()
        : { data: null };
      if (!ref || !member) return { error: "You can only attach data or code from your own projects." };
      attachment = { kind, id: ref.id, project_id: ref.project_id };
    }
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      room_id: room,
      group_id: groupId || null,
      intent,
      title,
      body: text(form, "body", 10000),
      method_card_id: card || null,
      technique: text(form, "technique", 200),
      organism: text(form, "organism", 200),
      deadline: String(form.get("deadline") ?? "") || null,
      offer: text(form, "offer", 300),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (attachment) {
    await supabase.from("post_attachments").insert({
      post_id: data.id,
      kind: attachment.kind,
      dataset_id:   attachment.kind === "dataset" ? attachment.id : null,
      code_file_id: attachment.kind === "code"    ? attachment.id : null,
      project_id:   attachment.project_id,
      access: String(form.get("access") ?? "on_request") === "open" ? "open" : "on_request",
      owner_id: user.id,
    });
  }

  // Images and the preview of the first link are added once the post exists:
  // the image paths include its id, and a slow website must not lose the post.
  const body = text(form, "body", 10000);
  const url = firstUrl(body);
  const [stored, preview] = await Promise.all([
    images.length ? storeImages(supabase, user.id, data.id, images) : Promise.resolve([]),
    url ? linkPreview(url).catch(() => null) : Promise.resolve(null),
  ]);
  if (stored.length || preview) {
    await supabase.from("posts").update({ ...(stored.length ? { images: stored } : {}), ...(preview ? { link_preview: preview } : {}) }).eq("id", data.id);
  }

  await recordMentions(supabase, user.id, "post", data.id, `/posts/${data.id}`, `${title}\n${body}`);
  revalidatePath("/home");
  // Posted from the feed or a group page: stay there, at the new post.
  if (groupId) { revalidatePath(`/groups/${groupId}`); redirect(`/groups/${groupId}?tab=feed&posted=1#post-${data.id}`); }
  if (form.get("return_to") === "feed") redirect(`/home?posted=1#post-${data.id}`);
  redirect(`/posts/${data.id}`);
}

/** Only the author removes a post; its replies and attachments go with it. */
export async function deletePost(postId: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("posts").delete().eq("id", postId).eq("author_id", user.id).select("id, images");
  if (!data?.length) throw new Error("Only the author can delete this post.");
  await removeImages(supabase, data[0].images);
  // The demo store has no cascade; the database does this itself.
  await supabase.from("post_replies").delete().eq("post_id", postId);
  revalidatePath("/home");
  redirect("/home");
}

/** A reply stays next to the post, where the next person with the same
 *  problem will find it — unlike a private message. */
export async function replyToPost(postId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const body = text(form, "body", 5000);
  if (!body) return;
  if (await overLimit(supabase, "reply", user.id)) redirect(`/posts/${postId}?limited=1#replies`);
  const { data: post } = await supabase.from("posts").select("id, group_id").eq("id", postId).maybeSingle();
  if (!post || !(await canReadPost(supabase, post, user.id))) throw new Error("That post no longer exists.");
  const { data: reply, error } = await supabase.from("post_replies").insert({ post_id: postId, author_id: user.id, body }).select("id").single();
  if (error) throw new Error(error.message);
  await recordMentions(supabase, user.id, "reply", reply.id, `/posts/${postId}#replies`, body);
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/home");
  redirect(`/posts/${postId}#replies`);
}

export async function deleteReply(replyId: string, postId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("post_replies").delete().eq("id", replyId).eq("author_id", user.id);
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/home");
}

/** The author corrects a post. Kind, topic group and attachments stay as they were. */
export async function editPost(postId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const title = text(form, "title", 200);
  if (!title) redirect(`/posts/${postId}?error=title`);
  const body = text(form, "body", 10000);
  const { data } = await supabase.from("posts").update({ title, body, edited_at: new Date().toISOString() })
    .eq("id", postId).eq("author_id", user.id).select("id");
  if (!data?.length) throw new Error("Only the author can edit this post.");
  await recordMentions(supabase, user.id, "post", postId, `/posts/${postId}`, `${title}\n${body}`);
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/home");
  redirect(`/posts/${postId}?edited=1`);
}

export async function editReply(replyId: string, postId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const body = text(form, "body", 5000);
  if (!body) return;
  await supabase.from("post_replies").update({ body, edited_at: new Date().toISOString() }).eq("id", replyId).eq("author_id", user.id);
  await recordMentions(supabase, user.id, "reply", replyId, `/posts/${postId}#replies`, body);
  revalidatePath(`/posts/${postId}`);
  redirect(`/posts/${postId}#reply-${replyId}`);
}
