import { peopleById } from "@/lib/people";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel, PanelHead, Empty, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { roomById, INTENTS } from "@/lib/taxonomy";
import { bibliometricsFor, loadSnapshots, recentChange } from "@/lib/record/bibliometrics";
import { citationProfile } from "@/lib/record/citations";
import { loadPublications, syncIfDue } from "@/lib/record/publications";
import Highlights, { type NewPaper, type Nudge } from "@/components/dashboard/Highlights";
import PostCard from "@/components/feed/PostCard";
import GettingStarted, { type Step } from "@/components/dashboard/GettingStarted";
import { SYNC_FLASH } from "@/lib/openalex/messages";
import { ensureRecordSeed } from "@/lib/record/demo-seed";
import { followingOf } from "@/lib/social/follows";
import { activityOf, activityOnMine, newPapers } from "@/lib/social/activity";
import { peopleYouMayKnow } from "@/lib/social/contacts";
import { coauthorsOf } from "@/lib/social/coauthors";
import { reactionsFor } from "@/lib/social/reactions";
import ActivityList from "@/components/social/ActivityList";
import FollowButton from "@/components/social/FollowButton";
import QuickPost from "@/components/feed/QuickPost";
import { imageUrls } from "@/lib/posts/images";
import { postExtras, repostedBy } from "@/lib/posts/extras";
import { notForChosenPeople } from "@/lib/social/groups";
import SegTabs from "@/components/SegTabs";
import { forYou } from "@/lib/social/for-you";
import ForYouPanel from "@/components/dashboard/ForYouPanel";

export const dynamic = "force-dynamic";

/** Short names for the filter pills; the full name is the tooltip. */
const SHORT: Record<string, string> = { result: "Results", data_question: "Data questions", general: "Questions", collab: "Collaborators", feedback: "Feedback", update: "News" };


/**
 * The landing page: a dashboard (citations, what is waiting on you, your
 * groups, your work used by others), then the composer and the feed of
 * posts from your topic groups or from the people you follow.
 *
 * Filters are intent and room rather than a ranking algorithm, because the
 * useful question here is "who is stuck on what" and "who needs a
 * collaborator", not "what is popular".
 */
export default async function Home({
  searchParams,
}: { searchParams: Promise<{ intent?: string; room?: string; sync?: string; feed?: string; posted?: string; n?: string }> }) {
  const { intent, room: roomParam, sync, feed: feedParam, posted, n } = await searchParams;
  // Twenty posts first; "Show more" asks for twenty more, up to a hundred.
  const pageSize = Math.min(100, Math.max(20, Number(n) || 20));
  // "following": posts and activity from the people you follow, from any topic group.
  // "groups": the discussions of the groups you are in (members only).
  const feedMode = feedParam === "following" ? "following" : feedParam === "groups" ? "groups" : "topics";
  const room = feedMode === "topics" ? roomParam : undefined;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me_ = user!.id;

  // Everything below needs only the user, so it is fetched in chains that
  // run side by side: the feed, the citation tracker, "Waiting on you" and
  // the social panels. Against the real database each await is a network
  // round trip; the longest chain is about four.
  ensureRecordSeed();
  const empty = Promise.resolve({ data: [] as any[] });
  const [{ data: mine }, { data: me }, { count: unread }, { data: myRequests }, { data: myQuestions }, { data: myPosts }, following, { data: myCards }, { data: myGroups }] =
    await Promise.all([
      supabase.from("user_rooms").select("room_id").eq("user_id", me_),
      supabase.from("profiles").select("display_name, orcid, role_title, institution, bio, avatar_url, techniques").eq("id", me_).maybeSingle(),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", me_).is("read_at", null),
      supabase.from("access_requests").select("id, attachment_id, created_at").eq("owner_id", me_).eq("status", "pending"),
      supabase.from("questions").select("id, title").eq("author_id", me_),
      supabase.from("posts").select("id").eq("author_id", me_),
      followingOf(supabase, me_),
      supabase.from("method_cards").select("id, code, title").eq("author_id", me_).order("created_at", { ascending: false }),
      supabase.from("group_members").select("group_id, role").eq("user_id", me_),
    ]);
  const followed = [...following];
  const myGroupIds = (myGroups ?? []).filter((g: any) => g.role !== "alumni").map((g: any) => g.group_id);
  const myRooms = (mine ?? []).map((r: { room_id: string }) => r.room_id);

  // A new account with no topic groups gets the picker, never an empty page.
  if (myRooms.length === 0) redirect("/welcome");

  const feed = (async () => {
    if ((feedMode === "following" && !followed.length) || (feedMode === "groups" && !myGroupIds.length)) {
      return { posts: [] as any[], people: new Map() as Awaited<ReturnType<typeof peopleById>>, cards: [] as any[], feedReplies: [] as any[], reactions: new Map() as Awaited<ReturnType<typeof reactionsFor>>, images: new Map<string, string[]>(), extras: new Map() as Awaited<ReturnType<typeof postExtras>>, hasMore: false };
    }
    const cols = "id, author_id, room_id, group_id, intent, title, body, method_card_id, technique, organism, deadline, offer, images, link_preview, audience, feedback_kinds, call_status, created_at";
    // Following: what they posted, and what they reposted (at the time of the repost).
    const reposted = feedMode === "following" ? await repostedBy(supabase, followed) : [];
    let q = supabase.from("posts").select(cols);
    q = feedMode === "following" ? q.in("author_id", followed)
      : feedMode === "groups" ? q.in("group_id", myGroupIds)
      : q.in("room_id", room ? [room] : myRooms);
    q = q.order("created_at", { ascending: false }).limit(pageSize + 1);
    if (intent) q = q.eq("intent", intent);
    // A followed person's posts in a group you are not in stay in that group.
    const { data: own } = await q;
    const repostIds = reposted.map((r) => r.post_id).filter((id) => !(own ?? []).some((p: any) => p.id === id));
    const { data: shared } = repostIds.length ? await supabase.from("posts").select(cols).in("id", repostIds) : { data: [] as any[] };
    const when = (p: any) => reposted.find((r) => r.post_id === p.id && r.created_at > p.created_at)?.created_at ?? p.created_at;
    const all = [...(own ?? []), ...(intent ? (shared ?? []).filter((p: any) => p.intent === intent) : shared ?? [])]
      .sort((a: any, b: any) => when(b).localeCompare(when(a)));
    const hasMore = all.length > pageSize;
    all.splice(pageSize);
    const posts = all.filter((p: any) => (!p.group_id || myGroupIds.includes(p.group_id)) && notForChosenPeople(me_)(p));
    const cardIds = [...new Set((posts ?? []).map((p: any) => p.method_card_id).filter(Boolean))];
    const postIds = (posts ?? []).map((p: any) => p.id);
    const [authors, { data: cards }, { data: feedReplies }, reactions, images] = await Promise.all([
      peopleById(supabase, (posts ?? []).map((p: any) => p.author_id)),
      cardIds.length ? supabase.from("method_cards").select("id, code, title, outcome, system").in("id", cardIds) : empty,
      postIds.length ? supabase.from("post_replies").select("id, post_id, author_id, body, created_at, helped_at").in("post_id", postIds).order("created_at", { ascending: false }) : empty,
      reactionsFor(supabase, "post", postIds, me_),
      imageUrls(supabase, posts ?? []),
    ]);
    const extras = await postExtras(supabase, me_, postIds, following, reactions);
    const contextIds = [...[...extras.values()].map((e) => e.context?.personId), ...(feedReplies ?? []).map((r: any) => r.author_id)]
      .filter((x): x is string => !!x && !authors.has(x));
    const people = contextIds.length ? new Map([...authors, ...(await peopleById(supabase, contextIds))]) : authors;
    return { posts, people, cards, feedReplies, reactions, images, extras, hasMore };
  })();

  const research = (async () => {
    // An overdue OpenAlex sync runs after the page is sent; the next visit shows it.
    await syncIfDue(me_, me?.orcid, { waitForFirst: false });
    const [biblio, { pubs, runs }] = await Promise.all([
      bibliometricsFor(me_, me?.orcid),
      loadPublications(me_, me?.orcid, 20),
    ]);
    const snapshots = await loadSnapshots(supabase, me_, biblio);
    return { biblio, pubs, change: recentChange(biblio, snapshots, runs), citations: citationProfile(pubs) };
  })();

  // Your groups, and the projects shared in them that you are not on yet.
  const groupsPanel = (async () => {
    const ids = myGroupIds;
    if (!ids.length) return { groups: [] as any[], joinable: new Map<string, number>() };
    const [{ data: groups }, { data: shared }, { data: onProjects }] = await Promise.all([
      supabase.from("groups").select("id, name").in("id", ids),
      supabase.from("group_projects").select("group_id, project_id").in("group_id", ids),
      supabase.from("project_members").select("project_id").eq("user_id", me_),
    ]);
    const on = new Set((onProjects ?? []).map((p: any) => p.project_id));
    const joinable = new Map<string, number>();
    for (const s of shared ?? []) if (!on.has(s.project_id)) joinable.set(s.group_id, (joinable.get(s.group_id) ?? 0) + 1);
    return { groups: groups ?? [], joinable };
  })();

  const requestAtts = [...new Set((myRequests ?? []).map((r: any) => r.attachment_id))];
  const qIds = (myQuestions ?? []).map((q: any) => q.id);
  const myPostIds = (myPosts ?? []).map((p: any) => p.id);

  // What people you follow did besides posting, and what happened to your
  // own work; co-authors here you do not follow yet.
  const social = Promise.all([
    feedMode === "following" ? activityOf(supabase, followed, { viewer: me_, limit: 12 }) : Promise.resolve([]),
    activityOnMine(supabase, me_),
    coauthorsOf(supabase, me_, me?.orcid, following)
      .then((co) => peopleYouMayKnow(supabase, me_, { coauthors: co.members, following, myRooms, limit: 4 })),
    newPapers(supabase, followed.slice(0, 30), new Date(Date.now() - 30 * 864e5).toISOString()),
  ]);

  const [
    { posts, people, cards, feedReplies, reactions, images, extras, hasMore },
    { biblio, pubs, change, citations },
    { data: atts }, { data: qAnswers }, { data: repliesToMe },
    [followActivity, onMine, contacts, theirPapers],
    { groups: groupList, joinable },
    waiting,
  ] = await Promise.all([
    feed,
    research,
    requestAtts.length ? supabase.from("post_attachments").select("id, post_id").in("id", requestAtts) : empty,
    qIds.length ? supabase.from("answers").select("question_id, author_id, created_at").in("question_id", qIds) : empty,
    myPostIds.length ? supabase.from("post_replies").select("post_id, author_id, created_at").in("post_id", myPostIds) : empty,
    social,
    groupsPanel,
    forYou(supabase, me_),
  ]);
  const groupNames = new Map<string, { id: string; name: string }>(groupList.map((g: any) => [g.id, { id: g.id, name: g.name }]));
  // New papers: yours from the last syncs, then those of people you follow.
  const names = await peopleById(supabase, [...theirPapers.map((p) => p.user), ...waiting.feedback.map((f) => f.author_id)]);
  const year = new Date().getFullYear();
  const mineNew = [
    ...change.newPubs.map((n) => pubs.find((p) => p.openalex_id === n.openalex_id)).filter(Boolean),
    ...pubs.filter((p) => Date.now() - +new Date(p.first_seen_at) < 30 * 864e5 && (p.year ?? 0) >= year - 1),
  ].filter((p, i, all) => all.findIndex((x) => x!.openalex_id === p!.openalex_id) === i) as typeof pubs;
  const papers: NewPaper[] = [
    ...mineNew.map((p) => ({ title: p.title, who: null, href: p.doi ? `https://doi.org/${p.doi}` : "/you/publications" })),
    ...theirPapers.sort((a, b) => b.at.localeCompare(a.at)).map((p) => ({ title: p.title, who: names.get(p.user)?.display_name ?? null, href: p.href })),
  ];

  const who = (id: string) => people.get(id);
  const cardOf = (id: string | null) => (cards ?? []).find((c: any) => c.id === id);
  const replyCount = (id: string) => (feedReplies ?? []).filter((r: any) => r.post_id === id).length;
  // One reply under each post: the one that helped its author, else the latest.
  const topReply = (id: string) => {
    const rs = (feedReplies ?? []).filter((r: any) => r.post_id === id);
    const r = rs.find((x: any) => x.helped_at) ?? rs[0];
    return r ? { body: r.body, created_at: r.created_at, helped: !!r.helped_at, author: people.get(r.author_id) } : null;
  };
  // The rest of the thread, oldest first, to open in place.
  const moreReplies = (id: string) => {
    const rs = (feedReplies ?? []).filter((r: any) => r.post_id === id);
    const top = rs.find((x: any) => x.helped_at) ?? rs[0];
    return rs.filter((r: any) => r !== top).reverse().slice(0, 30)
      .map((r: any) => ({ body: r.body, created_at: r.created_at, helped: !!r.helped_at, author: people.get(r.author_id) }));
  };
  const filterLabel = [intent ? SHORT[intent] ?? intent : "All kinds", feedMode === "topics" ? (room ? `#${room}` : "all topics") : null].filter(Boolean).join(" · ");
  const requestPosts = [...new Set((atts ?? []).map((a: any) => a.post_id))];
  const week = 7 * 864e5;
  const freshAnswers = (qAnswers ?? []).filter((a: any) => a.author_id !== me_ && Date.now() - +new Date(a.created_at) < week);
  const answeredQ = [...new Set(freshAnswers.map((a: any) => a.question_id))];
  const freshReplies = (repliesToMe ?? []).filter((r: any) => r.author_id !== me_ && Date.now() - +new Date(r.created_at) < week);
  const repliedPosts = [...new Set(freshReplies.map((r: any) => r.post_id))];
  const topics = myRooms.map((r) => ({ id: r, name: roomById(r)?.name ?? r }));

  const qs = (patch: Record<string, string | undefined>, anchor = true) => {
    const sp = new URLSearchParams();
    const merged = { feed: feedMode === "topics" ? undefined : feedMode, intent, room, ...patch };
    Object.entries(merged).forEach(([k, v]) => { if (v) sp.set(k, v); });
    const s = sp.toString();
    return (s ? `/home?${s}` : "/home") + (anchor ? "#feed" : "");
  };

  const pill = (active: boolean): React.CSSProperties => ({
    font: "500 12px/1 var(--sans)", padding: "7px 11px", borderRadius: 999, border: "1px solid var(--rule)",
    background: active ? "var(--ink)" : "transparent",
    color: active ? "var(--bg)" : "var(--ink)", textDecoration: "none", whiteSpace: "nowrap",
  });

  // What is waiting on you, as one row of chips under the tiles.
  const nudges = [
    unread ? { href: "/messages", text: `${unread} unread message${unread > 1 ? "s" : ""}` } : null,
    (myRequests ?? []).length ? { href: (myRequests ?? []).length === 1 && requestPosts[0] ? `/posts/${requestPosts[0]}` : "/requests", text: `${(myRequests ?? []).length} data request${(myRequests ?? []).length > 1 ? "s" : ""} to decide` } : null,
    freshReplies.length ? { href: repliedPosts.length === 1 ? `/posts/${repliedPosts[0]}#replies` : "/notifications", text: `${freshReplies.length} new repl${freshReplies.length > 1 ? "ies" : "y"} to your posts` } : null,
    freshAnswers.length ? { href: answeredQ.length === 1 ? `/questions/${answeredQ[0]}` : "/notifications", text: `${freshAnswers.length} new answer${freshAnswers.length > 1 ? "s" : ""} to your questions` } : null,
    ...groupList.filter((g: any) => joinable.get(g.id)).map((g: any) => ({ href: `/groups/${g.id}`, text: `${g.name}: ${joinable.get(g.id)} project${joinable.get(g.id)! > 1 ? "s" : ""} to join` })),
    onMine.length ? { href: "/you/record", text: `${onMine.length} reproduction${onMine.length > 1 ? "s and forks" : " or fork"} of your work` } : null,
  ].filter(Boolean) as Nudge[];

  // First steps for new members, until done or hidden.
  const steps: Step[] = [
    { key: "profile", label: "Complete your profile", href: "/settings#profile", done: !!(me?.institution && me?.role_title && (me?.bio || (me?.techniques ?? []).length)) },
    { key: "picture", label: "Add a picture", href: "/settings#picture", done: !!me?.avatar_url },
    { key: "orcid", label: "Link your ORCID", href: "/settings#orcid", done: !!me?.orcid },
    { key: "follow", label: "Follow three people", href: "/network", done: followed.length >= 3 },
    { key: "group", label: "Join a group", href: "/groups", done: groupList.length > 0 },
    { key: "post", label: "Write your first post", href: "#compose", done: myPostIds.length > 0 },
  ];

  // No page heading: the dashboard is the top of the page, and the feed
  // starts right under it, on the first screen.
  return (
    <div style={{ padding: "18px 16px 64px" }}>
      <div style={{ maxWidth: "var(--content-max)", margin: "0 auto" }}>
      <h1 className="sr-only">Feed</h1>
      {sync && SYNC_FLASH[sync] && (
        <p role="status" style={{ font: "400 13.5px/1.6 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--rule)", background: "var(--surface)" }}>{SYNC_FLASH[sync]}</p>
      )}

      <GettingStarted steps={steps} />
      <Highlights biblio={biblio} change={change} pubs={pubs} papers={papers} contacts={contacts} nudges={nudges} />
      <ForYouPanel data={waiting} names={new Map([...names].map(([id, p]) => [id, p.display_name]))} />

      {/* ── feed ──────────────────────────────────────────────────────── */}
      <section id="feed" aria-label="Feed" style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, scrollMarginTop: 72 }}>
        {posted && <p role="status" style={{ font: "400 13.5px/1.6 var(--sans)", margin: 0, padding: "10px 12px", border: "1px solid var(--ok)", background: "var(--surface)" }}>Posted.</p>}
        <QuickPost topics={topics} cards={(myCards ?? []) as { id: string; code: string; title: string }[]} defaultTopic={room} meName={me?.display_name ?? ""} meAvatar={me?.avatar_url ?? null} />

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <SegTabs label="Which posts" style={{ flex: "1 1 360px", margin: 0 }} items={([["topics", "Topic groups"], ["groups", `My groups · ${myGroupIds.length}`], ["following", `Following · ${followed.length}`]] as const).map(([k, label]) => ({
          href: k === "topics" ? "/home" : `/home?feed=${k}`, label, active: feedMode === k,
        }))} />
        {/* Kind and topic behind one button: two rows of chips were too much on every visit. */}
        <details className="sc-feed-filter" style={{ position: "relative" }} open={false}>
          <summary style={{ listStyle: "none", cursor: "pointer", height: 36, padding: "0 14px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", display: "flex", alignItems: "center", gap: 6, font: "600 13px/1 var(--sans)", color: "var(--ink)", whiteSpace: "nowrap" }}>
            Filter <span style={{ fontWeight: 400, color: "var(--mute)" }}>{filterLabel}</span>
          </summary>
          <div style={{ position: "absolute", right: 0, top: 42, zIndex: 30, width: "min(420px, 90vw)", padding: 12, borderRadius: 16, border: "1px solid var(--rule)", background: "color-mix(in srgb, var(--bg) 94%, transparent)", boxShadow: "0 16px 40px rgba(31, 38, 60, .18)", WebkitBackdropFilter: "blur(27px) saturate(218%)", backdropFilter: "blur(27px) saturate(218%)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ font: "600 12px/1 var(--sans)", color: "var(--mute)", marginBottom: 6 }}>Kind</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Link href={qs({ intent: undefined }, false)} scroll={false} style={pill(!intent)}>All</Link>
                {INTENTS.map((i) => <Link key={i.id} href={qs({ intent: i.id }, false)} scroll={false} style={pill(intent === i.id)} title={i.label}>{SHORT[i.id] ?? i.label}</Link>)}
              </div>
            </div>
            {feedMode === "topics" && (
              <div>
                <div style={{ font: "600 12px/1 var(--sans)", color: "var(--mute)", marginBottom: 6 }}>Topic</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Link href={qs({ room: undefined }, false)} scroll={false} style={pill(!room)}>All yours</Link>
                  {myRooms.map((r) => <Link key={r} href={qs({ room: r }, false)} scroll={false} style={pill(room === r)}>#{r}</Link>)}
                  <Link href="/groups#topics" style={{ font: "500 12px/26px var(--sans)", color: "var(--link)", whiteSpace: "nowrap" }}>more →</Link>
                </div>
              </div>
            )}
          </div>
        </details>
        {(intent || room) && <Link href={qs({ intent: undefined, room: undefined }, false)} scroll={false} aria-label="Clear the filter" style={{ font: "500 12.5px/1 var(--sans)", color: "var(--mute)" }}>clear</Link>}
        </div>

        {feedMode === "following" && followed.length === 0 && (
          <Panel>
            <Empty>
              You do not follow anyone yet. Follow people from their profile or from the{" "}
              <Link href="/network" style={{ color: "var(--link)" }}>Network</Link> page; your co-authors are suggested there.
            </Empty>
          </Panel>
        )}

        {feedMode === "following" && followActivity.filter((a) => a.kind !== "post").length > 0 && (
          <Panel>
            <PanelHead>Papers, answers and methods</PanelHead>
            <ActivityList items={followActivity.filter((a) => a.kind !== "post").slice(0, 8)} empty="" />
          </Panel>
        )}

        {feedMode === "groups" && (
          <p style={{ font: "400 13px/1.6 var(--sans)", color: "var(--mute)", margin: 0 }}>
            Discussions inside your groups, seen only by their members. To post in one, open the group.
          </p>
        )}
        {(posts?.length ?? 0) === 0 && (feedMode === "topics" || (feedMode === "following" && followed.length > 0)) && (
          <Panel>
            <Empty>
              Nothing here yet. Post the first thing above, or{" "}
              <Link href="/groups#topics" style={{ color: "var(--link)" }}>join more topic groups</Link>.
            </Empty>
          </Panel>
        )}
        {(posts?.length ?? 0) === 0 && feedMode === "groups" && (
          <Panel>
            <Empty>
              {myGroupIds.length ? "No discussions in your groups yet." : "You are not in a group yet."}{" "}
              <Link href="/groups" style={{ color: "var(--link)" }}>{myGroupIds.length ? "Open a group to start one" : "Find or start one"}</Link>.
            </Empty>
          </Panel>
        )}

        <div key={`${feedMode}-${intent ?? ""}-${room ?? ""}`} className="sc-tabpane" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {(posts ?? []).map((p: any) => (
          <PostCard key={p.id} p={p} author={who(p.author_id)} card={cardOf(p.method_card_id)} images={images.get(p.id)}
            reaction={reactions.get(p.id)} replies={replyCount(p.id)} me={me_} path="/home"
            topicHref={(r) => qs({ room: r, feed: undefined })} group={groupNames.get(p.group_id) ?? null}
            extra={extras.get(p.id)} follows={following.has(p.author_id)} contextPerson={who(extras.get(p.id)?.context?.personId ?? "")}
            topReply={topReply(p.id)} moreReplies={moreReplies(p.id)} />
        ))}
        </div>
        {hasMore && (
          <Link href={qs({ n: String(pageSize + 20) }).replace("#feed", `#post-${posts[posts.length - 1].id}`)} scroll={false}
            style={{ alignSelf: "center", padding: "9px 18px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink)", font: "600 13px/1 var(--sans)", textDecoration: "none" }}>
            Show more
          </Link>
        )}
      </section>
      </div>
    </div>
  );
}

