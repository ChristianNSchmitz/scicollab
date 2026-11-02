import { reactionsFor } from "@/lib/social/reactions";
import { imageUrls } from "@/lib/posts/images";
import { peopleById } from "@/lib/people";
import { postExtras } from "@/lib/posts/extras";
import { Panel, Empty } from "@/components/ui";
import QuickPost from "@/components/feed/QuickPost";
import PostCard from "@/components/feed/PostCard";
import { markSeen, type GroupCtx } from "./ctx";

/** The group's own feed: posts only its current members see (supabase/11). */
export default async function GroupFeed({ ctx }: { ctx: GroupCtx }) {
  const { supabase, id, g, me } = ctx;
  const { data: posts } = await supabase.from("posts")
    .select("id, author_id, room_id, group_id, intent, title, body, method_card_id, technique, organism, deadline, offer, images, link_preview, audience, feedback_kinds, call_status, created_at")
    .eq("group_id", id).order("created_at", { ascending: false }).limit(30);
  const postIds = (posts ?? []).map((p: any) => p.id);
  const [authors, reactions, images, { data: replies }] = await Promise.all([
    peopleById(supabase, (posts ?? []).map((p: any) => p.author_id)),
    reactionsFor(supabase, "post", postIds, me),
    imageUrls(supabase, posts ?? []),
    postIds.length ? supabase.from("post_replies").select("id, post_id, author_id, body, created_at, helped_at").in("post_id", postIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
    markSeen(supabase, id, me, "feed"),
  ]);
  const extras = await postExtras(supabase, me, postIds, new Set(), reactions);
  const repliers = await peopleById(supabase, (replies ?? []).map((r: any) => r.author_id));
  const topReply = (id: string) => {
    const rs = (replies ?? []).filter((r: any) => r.post_id === id);
    const r = rs.find((x: any) => x.helped_at) ?? rs[0];
    return r ? { body: r.body, created_at: r.created_at, helped: !!r.helped_at, author: repliers.get(r.author_id) } : null;
  };
  // The rest of the thread, oldest first, to open in place.
  const moreReplies = (id: string) => {
    const rs = (replies ?? []).filter((r: any) => r.post_id === id);
    const top = rs.find((x: any) => x.helped_at) ?? rs[0];
    return rs.filter((r: any) => r !== top).reverse().slice(0, 30)
      .map((r: any) => ({ body: r.body, created_at: r.created_at, helped: !!r.helped_at, author: repliers.get(r.author_id) }));
  };
  return (
    <section aria-label="Group feed" style={{ maxWidth: 820, display: "flex", flexDirection: "column", gap: 20 }}>
      <QuickPost topics={[]} cards={[]} groupId={id} groupName={g.name} />
      {(posts ?? []).length === 0 && <Panel><Empty>No posts yet.</Empty></Panel>}
      {(posts ?? []).map((p: any) => (
        <PostCard key={p.id} p={p} author={authors.get(p.author_id)} images={images.get(p.id)} reaction={reactions.get(p.id)}
          replies={(replies ?? []).filter((r: any) => r.post_id === p.id).length} me={me} path={`/groups/${id}?tab=feed`}
          topicHref={(r) => `/home?room=${r}`} group={null} extra={extras.get(p.id)} topReply={topReply(p.id)} moreReplies={moreReplies(p.id)} />
      ))}
    </section>
  );
}
