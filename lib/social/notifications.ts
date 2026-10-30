import type { SupabaseClient } from "@supabase/supabase-js";
import { REACTIONS } from "@/lib/social/reactions";

type Client = SupabaseClient<any, any, any>;
export type Notice = { at: string; kind: string; who: string | null; text: string; href: string };

/**
 * Everything that happened to someone in a window, newest first, each with
 * the place to deal with it. One loader for the Notifications page, the
 * unread badge on the bell and the weekly e-mail digest, so all three count
 * the same things.
 */
export async function loadNotices(supabase: Client, me: string, windowDays = 30): Promise<Notice[]> {
  const since = new Date(Date.now() - windowDays * 864e5).toISOString();
  const empty = Promise.resolve({ data: [] as any[] });

  const [
    { data: unread }, { data: incoming }, { data: outgoing }, { data: myQuestions }, { data: myPosts },
    { data: myAnswers }, { data: mentions }, { data: followers }, { data: owned },
  ] = await Promise.all([
    supabase.from("messages").select("sender_id, created_at").eq("recipient_id", me).is("read_at", null),
    supabase.from("access_requests").select("id, attachment_id, requester_id, created_at").eq("owner_id", me).eq("status", "pending"),
    supabase.from("access_requests").select("id, attachment_id, owner_id, status, decided_at").eq("requester_id", me).neq("status", "pending").gte("decided_at", since),
    supabase.from("questions").select("id, title").eq("author_id", me),
    supabase.from("posts").select("id, title").eq("author_id", me),
    supabase.from("answers").select("id, question_id").eq("author_id", me),
    supabase.from("mentions").select("author_id, source_kind, href, created_at").eq("mentioned_id", me).gte("created_at", since),
    supabase.from("follows").select("follower_id, created_at").eq("followee_id", me).gte("created_at", since),
    // Groups you manage (lead or admin): their join requests are yours to answer.
    supabase.from("group_members").select("group_id").eq("user_id", me).in("role", ["owner", "admin"]),
  ]);
  const ownedIds = (owned ?? []).map((g: any) => g.group_id);

  const qIds = (myQuestions ?? []).map((q: any) => q.id);
  const postIds = (myPosts ?? []).map((p: any) => p.id);
  const answerIds = (myAnswers ?? []).map((a: any) => a.id);
  const attIds = [...new Set([...(incoming ?? []), ...(outgoing ?? [])].map((r: any) => r.attachment_id))];
  const [{ data: answers }, { data: replies }, { data: atts }, { data: onPosts }, { data: onAnswers }, { data: joinRequests }, { data: ownedGroups }] = await Promise.all([
    qIds.length ? supabase.from("answers").select("question_id, author_id, created_at").in("question_id", qIds).gte("created_at", since) : empty,
    postIds.length ? supabase.from("post_replies").select("post_id, author_id, created_at").in("post_id", postIds).gte("created_at", since) : empty,
    attIds.length ? supabase.from("post_attachments").select("id, post_id").in("id", attIds) : empty,
    postIds.length ? supabase.from("reactions").select("target_id, user_id, kind, created_at").eq("target_kind", "post").in("target_id", postIds).gte("created_at", since) : empty,
    answerIds.length ? supabase.from("reactions").select("target_id, user_id, kind, created_at").eq("target_kind", "answer").in("target_id", answerIds).gte("created_at", since) : empty,
    ownedIds.length ? supabase.from("group_requests").select("group_id, user_id, created_at").in("group_id", ownedIds) : empty,
    ownedIds.length ? supabase.from("groups").select("id, name").in("id", ownedIds) : empty,
  ]);

  const titleOf = (rows: any[] | null, id: string, fallback: string) => (rows ?? []).find((r: any) => r.id === id)?.title ?? fallback;
  const postOfAtt = (id: string) => (atts ?? []).find((a: any) => a.id === id)?.post_id as string | undefined;
  const questionOfAnswer = (id: string) => (myAnswers ?? []).find((a: any) => a.id === id)?.question_id as string | undefined;
  const label = (k: string) => REACTIONS.find((r) => r.key === k)?.label.toLowerCase() ?? k;
  const where: Record<string, string> = { post: "a post", reply: "a reply", question: "a question", answer: "an answer" };

  // One row per person who wrote to you, not one per message.
  const bySender = new Map<string, { n: number; at: string }>();
  for (const m of unread ?? []) {
    const cur = bySender.get(m.sender_id);
    bySender.set(m.sender_id, { n: (cur?.n ?? 0) + 1, at: !cur || m.created_at > cur.at ? m.created_at : cur.at });
  }

  return [
    ...[...bySender].map(([who, { n, at }]): Notice => ({
      at, kind: "message", who, text: `sent you ${n} unread message${n > 1 ? "s" : ""}`, href: `/messages/${who}`,
    })),
    ...(incoming ?? []).map((r: any): Notice => {
      const post = postOfAtt(r.attachment_id);
      return { at: r.created_at, kind: "data request", who: r.requester_id, text: "asked for access to data you attached", href: post ? `/posts/${post}` : "/requests" };
    }),
    ...(outgoing ?? []).map((r: any): Notice => ({
      at: r.decided_at, kind: "data request", who: r.owner_id,
      text: r.status === "granted" ? "granted your data access request" : "declined your data access request", href: "/requests",
    })),
    ...(replies ?? []).filter((r: any) => r.author_id !== me).map((r: any): Notice => ({
      at: r.created_at, kind: "reply", who: r.author_id, text: `replied to “${titleOf(myPosts, r.post_id, "your post")}”`, href: `/posts/${r.post_id}#replies`,
    })),
    ...(answers ?? []).filter((a: any) => a.author_id !== me).map((a: any): Notice => ({
      at: a.created_at, kind: "answer", who: a.author_id, text: `answered “${titleOf(myQuestions, a.question_id, "your question")}”`, href: `/questions/${a.question_id}`,
    })),
    ...(mentions ?? []).map((m: any): Notice => ({
      at: m.created_at, kind: "mention", who: m.author_id, text: `mentioned you in ${where[m.source_kind] ?? "a post"}`, href: m.href,
    })),
    ...(joinRequests ?? []).map((r: any): Notice => ({
      at: r.created_at, kind: "join request", who: r.user_id,
      text: `asked to join ${(ownedGroups ?? []).find((g: any) => g.id === r.group_id)?.name ?? "your group"}`, href: `/groups/${r.group_id}#requests`,
    })),
    ...(followers ?? []).map((f: any): Notice => ({
      at: f.created_at, kind: "follow", who: f.follower_id, text: "started following you", href: `/people/${f.follower_id}`,
    })),
    ...(onPosts ?? []).filter((r: any) => r.user_id !== me).map((r: any): Notice => ({
      at: r.created_at, kind: "reaction", who: r.user_id, text: `marked “${titleOf(myPosts, r.target_id, "your post")}” as ${label(r.kind)}`, href: `/posts/${r.target_id}`,
    })),
    ...(onAnswers ?? []).filter((r: any) => r.user_id !== me).map((r: any): Notice => {
      const q = questionOfAnswer(r.target_id);
      return { at: r.created_at, kind: "reaction", who: r.user_id, text: `marked your answer as ${label(r.kind)}`, href: q ? `/questions/${q}` : "/ask" };
    }),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

/** How many notices arrived since the person last opened Notifications. */
export async function unseenCount(supabase: Client, me: string, seenAt: string | null | undefined): Promise<number> {
  const notices = await loadNotices(supabase, me, 30);
  return seenAt ? notices.filter((n) => n.at > seenAt).length : notices.length;
}
