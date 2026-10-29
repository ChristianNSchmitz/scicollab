import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { peopleById } from "@/lib/people";
import { timeAgo } from "@/lib/format";
import { Page, Panel, PanelHead, Empty, Tag, btn, mono } from "@/components/ui";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

const WINDOW = 30 * 864e5;

type Item = { at: string; kind: string; who: string | null; text: string; href: string };

/**
 * Everything that happened to you in the last 30 days, newest first, each
 * linking to where you deal with it. Built from the same tables as "Waiting
 * on you" on Home. Delivery by email, per-category settings and quiet hours
 * (board G4) need a job queue and are not here yet.
 */
export default async function Notifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;
  const since = new Date(Date.now() - WINDOW).toISOString();
  const empty = Promise.resolve({ data: [] as any[] });

  const [{ data: unread }, { data: incoming }, { data: outgoing }, { data: myQuestions }, { data: myPosts }] = await Promise.all([
    supabase.from("messages").select("sender_id, created_at").eq("recipient_id", me).is("read_at", null),
    supabase.from("access_requests").select("id, attachment_id, requester_id, created_at").eq("owner_id", me).eq("status", "pending"),
    supabase.from("access_requests").select("id, attachment_id, owner_id, status, decided_at").eq("requester_id", me).neq("status", "pending").gte("decided_at", since),
    supabase.from("questions").select("id, title").eq("author_id", me),
    supabase.from("posts").select("id, title").eq("author_id", me),
  ]);

  const qIds = (myQuestions ?? []).map((q: any) => q.id);
  const postIds = (myPosts ?? []).map((p: any) => p.id);
  const attIds = [...new Set([...(incoming ?? []), ...(outgoing ?? [])].map((r: any) => r.attachment_id))];
  const [{ data: answers }, { data: replies }, { data: atts }] = await Promise.all([
    qIds.length ? supabase.from("answers").select("question_id, author_id, created_at").in("question_id", qIds).gte("created_at", since) : empty,
    postIds.length ? supabase.from("post_replies").select("post_id, author_id, created_at").in("post_id", postIds).gte("created_at", since) : empty,
    attIds.length ? supabase.from("post_attachments").select("id, post_id").in("id", attIds) : empty,
  ]);

  const titleOf = (rows: any[] | null, id: string) => (rows ?? []).find((r: any) => r.id === id)?.title ?? "your post";
  const postOfAtt = (id: string) => (atts ?? []).find((a: any) => a.id === id)?.post_id as string | undefined;

  // One row per person who wrote to you, not one per message.
  const bySender = new Map<string, { n: number; at: string }>();
  for (const m of unread ?? []) {
    const cur = bySender.get(m.sender_id);
    bySender.set(m.sender_id, { n: (cur?.n ?? 0) + 1, at: !cur || m.created_at > cur.at ? m.created_at : cur.at });
  }

  const items: Item[] = [
    ...[...bySender].map(([who, { n, at }]): Item => ({
      at, kind: "message", who, text: `sent you ${n} unread message${n > 1 ? "s" : ""}`, href: `/messages/${who}`,
    })),
    ...(incoming ?? []).map((r: any): Item => {
      const post = postOfAtt(r.attachment_id);
      return { at: r.created_at, kind: "data request", who: r.requester_id, text: "asked for access to data you attached", href: post ? `/posts/${post}` : "/requests" };
    }),
    ...(outgoing ?? []).map((r: any): Item => ({
      at: r.decided_at, kind: "data request", who: r.owner_id,
      text: r.status === "granted" ? "granted your data access request" : "declined your data access request", href: "/requests",
    })),
    ...(replies ?? []).filter((r: any) => r.author_id !== me).map((r: any): Item => ({
      at: r.created_at, kind: "reply", who: r.author_id, text: `replied to “${titleOf(myPosts, r.post_id)}”`, href: `/posts/${r.post_id}#replies`,
    })),
    ...(answers ?? []).filter((a: any) => a.author_id !== me).map((a: any): Item => ({
      at: a.created_at, kind: "answer", who: a.author_id, text: `answered “${titleOf(myQuestions, a.question_id)}”`, href: `/questions/${a.question_id}`,
    })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  const people = await peopleById(supabase, items.map((i) => i.who));

  return (
    <Page
      title="Notifications"
      lede="Messages, data requests, replies and answers from the last 30 days, newest first. Email delivery is not available yet; this page and Home are where you see them."
      actions={<div style={{ display: "flex", gap: 8 }}><Link href="/messages" style={btn}>Messages</Link><Link href="/requests" style={btn}>Data requests</Link></div>}
    >
      <Panel>
        <PanelHead>{items.length ? `${items.length} in the last 30 days` : "Last 30 days"}</PanelHead>
        {items.length === 0 ? (
          <Empty>
            Nothing new. Replies to your posts, answers to your questions and messages will show up here.
            <br /><Link href="/home" style={{ color: "var(--link)" }}>Back to Home</Link>
          </Empty>
        ) : items.map((i, n) => {
          const p = i.who ? people.get(i.who) : undefined;
          return (
            <Link key={n} href={i.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: "1px solid var(--rule)", textDecoration: "none", color: "var(--ink)" }}>
              <Avatar name={p?.display_name ?? "?"} url={p?.avatar_url ?? null} size={28} />
              <span style={{ flex: 1, minWidth: 0, font: "400 13.5px/1.5 var(--sans)" }}>
                <strong style={{ fontWeight: 600 }}>{p?.display_name ?? "Someone"}</strong> {i.text}
              </span>
              <Tag>{i.kind}</Tag>
              <span style={{ font: mono(11), color: "var(--mute)", whiteSpace: "nowrap" }}>{timeAgo(i.at)}</span>
            </Link>
          );
        })}
      </Panel>
    </Page>
  );
}
