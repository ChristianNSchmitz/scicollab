import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { peopleById } from "@/lib/people";
import { followingOf } from "@/lib/social/follows";
import { reactionsFor } from "@/lib/social/reactions";
import { imageUrls } from "@/lib/posts/images";
import { postExtras } from "@/lib/posts/extras";
import { Page, Panel, Empty, btn } from "@/components/ui";
import PostCard from "@/components/feed/PostCard";

export const dynamic = "force-dynamic";

/** Posts you saved for later, newest saved first (supabase/14). */
export default async function SavedPosts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;
  const { data: saved } = await supabase.from("saved_posts").select("post_id, created_at").eq("user_id", me).order("created_at", { ascending: false }).limit(100);
  const ids = (saved ?? []).map((s: any) => s.post_id);
  const { data: rows } = ids.length
    ? await supabase.from("posts").select("id, author_id, room_id, group_id, intent, title, body, method_card_id, technique, organism, deadline, offer, images, link_preview, created_at").in("id", ids)
    : { data: [] as any[] };
  // Saved order; a post that is gone, or in a group you left, drops out.
  const posts = ids.map((id) => (rows ?? []).find((p: any) => p.id === id)).filter(Boolean) as any[];
  const cardIds = [...new Set(posts.map((p) => p.method_card_id).filter(Boolean))];
  const groupIds = [...new Set(posts.map((p) => p.group_id).filter(Boolean))];
  const [people, following, reactions, images, { data: replies }, { data: cards }, { data: groups }] = await Promise.all([
    peopleById(supabase, posts.map((p) => p.author_id)),
    followingOf(supabase, me),
    reactionsFor(supabase, "post", posts.map((p) => p.id), me),
    imageUrls(supabase, posts),
    posts.length ? supabase.from("post_replies").select("post_id").in("post_id", posts.map((p) => p.id)) : Promise.resolve({ data: [] as any[] }),
    cardIds.length ? supabase.from("method_cards").select("id, code, title, outcome").in("id", cardIds) : Promise.resolve({ data: [] as any[] }),
    groupIds.length ? supabase.from("groups").select("id, name").in("id", groupIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const extras = await postExtras(supabase, me, posts.map((p) => p.id), new Set(), reactions);

  return (
    <Page title="Saved posts" lede="Posts you kept for later. Only you see this list." actions={<Link href="/home" style={btn}>Back to the feed</Link>}>
      <section style={{ maxWidth: 820, display: "flex", flexDirection: "column", gap: 12 }}>
        {posts.length === 0 && <Panel><Empty>Nothing saved yet. Use the ··· on a post and choose Save for later.</Empty></Panel>}
        {posts.map((p) => (
          <PostCard key={p.id} p={p} author={people.get(p.author_id)} card={(cards ?? []).find((c: any) => c.id === p.method_card_id) ?? null}
            images={images.get(p.id)} reaction={reactions.get(p.id)} replies={(replies ?? []).filter((r: any) => r.post_id === p.id).length}
            me={me} path="/you/saved" topicHref={(r) => `/home?room=${r}`} group={(groups ?? []).find((g: any) => g.id === p.group_id) ?? null}
            extra={extras.get(p.id)} follows={following.has(p.author_id)} />
        ))}
      </section>
    </Page>
  );
}
