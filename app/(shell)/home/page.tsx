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
import { cookies } from "next/headers";
import { mutesOf } from "@/lib/posts/mutes";
import type { HelpStatus } from "@/components/feed/PostCard";
import { FeedVisit, FeedLive, AutoMore, FeedKeys, MutedList } from "@/components/feed/FeedClient";
import { VISIT_COOKIE, SESSION_COOKIE } from "@/lib/posts/visit";

export const dynamic = "force-dynamic";

/** Short names for the filter pills; the full name is the tooltip. */
const SHORT: Record<string, string> = { result: "Results", data_question: "Data questions", general: "Questions", collab: "Collaborators", feedback: "Feedback", update: "News" };
/** Kinds of post that ask for help, and so are open until someone answers. */
const HELP = new Set(["feedback", "general", "data_question"]);


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
}: { searchParams: Promise<{ intent?: string; room?: string; sync?: string; feed?: string; posted?: string; n?: string; open?: string; sort?: string }> }) {
  const { intent, room: roomParam, sync, feed: feedParam, posted, n, open: openParam, sort: sortParam } = await searchParams;
  // Twenty posts first; scrolling down asks for twenty more, up to two hundred.
  const pageSize = Math.min(200, Math.max(20, Number(n) || 20));
  const openOnly = openParam === "1";
  const relevant = sortParam === "relevant";
  // Your previous visit (components/feed/FeedClient.tsx keeps it): posts after it are new.
  const jar = await cookies();
  const lastVisit = [jar.get(SESSION_COOKIE)?.value, jar.get(VISIT_COOKIE)?.value].find((v) => v && !Number.isNaN(Date.parse(v))) ?? null;
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
  const [{ data: mine }, { data: me }, { count: unread }, { data: myRequests }, { data: myQuestions }, { data: myPosts }, following, { data: myCards }, { data: myGroups }, mutes] =
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
      mutesOf(supabase, me_),
    ]);
  const followed = [...following];
  const myGroupIds = (myGroups ?? []).filter((g: any) => g.role !== "alumni").map((g: any) => g.group_id);
  const myRooms = (mine ?? []).map((r: { room_id: string }) => r.room_id);

  // A new account with no topic groups gets the picker, never an empty page.
  if (myRooms.length === 0) redirect("/welcome");

  const feed = (async () => {
    const none = { posts: [] as any[], people: new Map() as Awaited<ReturnType<typeof peopleById>>, cards: [] as any[], feedReplies: [] as any[], reactions: new Map() as Awaited<ReturnType<typeof reactionsFor>>, images: new Map<string, string[]>(), extras: new Map() as Awaited<ReturnType<typeof postExtras>>, hasMore: false, status: new Map<string, HelpStatus>(), openCount: 0 };
    // Muted topic groups leave "all topics"; picked on their own in the Filter, they still show.
    const roomScope = room ? [room] : myRooms.filter((r) => !mutes.rooms.has(r));
    if ((feedMode === "following" && !followed.length) || (feedMode === "groups" && !myGroupIds.length) || (feedMode === "topics" && !roomScope.length)) return none;
    const cols = "id, author_id, room_id, group_id, intent, title, body, method_card_id, technique, organism, deadline, offer, images, link_preview, audience, feedback_kinds, call_status, created_at";
    // Following: what they posted, and what they reposted (at the time of the repost).
    const reposted = feedMode === "following" ? await repostedBy(supabase, followed) : [];
    let q = supabase.from("posts").select(cols);
    q = feedMode === "following" ? q.in("author_id", followed)
      : feedMode === "groups" ? q.in("group_id", myGroupIds)
      : q.in("room_id", roomScope);
    // A window of recent posts: enough to leave out what you muted, to find the
    // open requests and to rank by relevance, and still one query.
    q = q.order("created_at", { ascending: false }).limit(Math.max(200, pageSize + 1));
    if (intent) q = q.eq("intent", intent);
    const { data: own } = await q;
    const repostIds = reposted.map((r) => r.post_id).filter((id) => !(own ?? []).some((p: any) => p.id === id));
    const { data: shared } = repostIds.length ? await supabase.from("posts").select(cols).in("id", repostIds) : { data: [] as any[] };
    const when = (p: any) => reposted.find((r) => r.post_id === p.id && r.created_at > p.created_at)?.created_at ?? p.created_at;
    // A followed person's posts in a group you are not in stay in that group.
    const candidates = [...(own ?? []), ...(intent ? (shared ?? []).filter((p: any) => p.intent === intent) : shared ?? [])]
      .filter((p: any) => (!p.group_id || myGroupIds.includes(p.group_id)) && notForChosenPeople(me_)(p))
      .filter((p: any) => !mutes.posts.has(p.id) && !mutes.people.has(p.author_id) && (room || p.group_id || !mutes.rooms.has(p.room_id)))
      .sort((a: any, b: any) => when(b).localeCompare(when(a)));

    // Requests for help: open (no reply from anyone else), answered, or helped.
    const helpIds = candidates.filter((p: any) => HELP.has(p.intent)).map((p: any) => p.id);
    const { data: helpReplies } = helpIds.length ? await supabase.from("post_replies").select("post_id, author_id, helped_at").in("post_id", helpIds) : { data: [] as any[] };
    const status = new Map<string, HelpStatus>();
    for (const p of candidates.filter((p: any) => HELP.has(p.intent))) {
      const rs = (helpReplies ?? []).filter((r: any) => r.post_id === p.id && r.author_id !== p.author_id);
      status.set(p.id, rs.some((r: any) => r.helped_at) ? "helped" : rs.length ? "answered" : "open");
    }
    const openCount = [...status.values()].filter((v) => v === "open").length;
    let ranked = openOnly ? candidates.filter((p: any) => status.get(p.id) === "open") : candidates;
    if (relevant) {
      // Relevant: your techniques, people you follow, requests still waiting, then age.
      const mineT = ((me?.techniques ?? []) as string[]).map((t) => t.toLowerCase()).filter((t) => t.length > 2);
      const score = (p: any) => {
        const text = `${p.technique ?? ""} ${p.organism ?? ""} ${p.title ?? ""} ${p.body ?? ""}`.toLowerCase();
        const days = (Date.now() - +new Date(when(p))) / 864e5;
        return (mineT.some((t) => text.includes(t)) ? 4 : 0) + (following.has(p.author_id) ? 2 : 0)
          + (status.get(p.id) === "open" ? 2 : 0) + (p.intent === "collab" && (p.call_status ?? "open") === "open" ? 1 : 0)
          + (p.author_id === me_ ? -2 : 0) - days / 4;
      };
      ranked = [...ranked].sort((a, b) => score(b) - score(a));
    }
    const hasMore = ranked.length > pageSize;
    const posts = ranked.slice(0, pageSize);
    const cardIds = [...new Set(posts.map((p: any) => p.method_card_id).filter(Boolean))];
    const postIds = posts.map((p: any) => p.id);
    const [authors, { data: cards }, { data: feedReplies }, reactions, images] = await Promise.all([
      peopleById(supabase, posts.map((p: any) => p.author_id)),
      cardIds.length ? supabase.from("method_cards").select("id, code, title, outcome, system").in("id", cardIds) : empty,
      postIds.length ? supabase.from("post_replies").select("id, post_id, author_id, body, created_at, helped_at").in("post_id", postIds).order("created_at", { ascending: false }) : empty,
      reactionsFor(supabase, "post", postIds, me_),
      imageUrls(supabase, posts),
    ]);
    const extras = await postExtras(supabase, me_, postIds, following, reactions);
    const contextIds = [...[...extras.values()].map((e) => e.context?.personId), ...(feedReplies ?? []).map((r: any) => r.author_id)]
      .filter((x): x is string => !!x && !authors.has(x));
    const people = contextIds.length ? new Map([...authors, ...(await peopleById(supabase, contextIds))]) : authors;
    return { posts, people, cards, feedReplies, reactions, images, extras, hasMore, status, openCount };
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
    { posts, people, cards, feedReplies, reactions, images, extras, hasMore, status, openCount },
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
  // An empty "My groups": a few open groups to join instead of a sentence.
  const { data: suggestGroups } = feedMode === "groups" && !myGroupIds.length
    ? await supabase.from("groups").select("id, name, description, access").eq("access", "open").limit(3) : { data: [] as any[] };
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
  const filterLabel = [relevant ? "Relevant" : null, openOnly ? "Open only" : null, intent ? SHORT[intent] ?? intent : "All kinds", feedMode === "topics" ? (room ? `#${room}` : "all topics") : null].filter(Boolean).join(" · ");
  // Posts since your last visit; in the latest-first order a line marks where they end.
  const isNew = (p: any) => !!lastVisit && p.author_id !== me_ && p.created_at > lastVisit;
  const newCount = posts.filter(isNew).length;
  const lineAfter = !relevant && newCount > 0 && newCount < posts.length ? posts.findLastIndex((p: any) => isNew(p)) : -1;
  const [mutedPeople, { data: mutedPosts }] = await Promise.all([
    mutes.people.size ? peopleById(supabase, [...mutes.people]) : Promise.resolve(new Map()),
    mutes.posts.size ? supabase.from("posts").select("id, title").in("id", [...mutes.posts]) : empty,
  ]);
  const short = (t: string) => (t.length > 28 ? t.slice(0, 27) + "…" : t);
  const mutedItems = mutes.list.map((m) => ({ ...m, label: m.kind === "room" ? `#${m.target}`
    : m.kind === "person" ? mutedPeople.get(m.target)?.display_name ?? "A person"
    : `“${short((mutedPosts ?? []).find((x: any) => x.id === m.target)?.title ?? "A post")}”` }));
  const liveQuery = new URLSearchParams(Object.entries({ feed: feedMode === "topics" ? "" : feedMode, room: room ?? "", intent: intent ?? "" }).filter(([, v]) => v)).toString();
  const requestPosts = [...new Set((atts ?? []).map((a: any) => a.post_id))];
  const week = 7 * 864e5;
  const freshAnswers = (qAnswers ?? []).filter((a: any) => a.author_id !== me_ && Date.now() - +new Date(a.created_at) < week);
  const answeredQ = [...new Set(freshAnswers.map((a: any) => a.question_id))];
  const freshReplies = (repliesToMe ?? []).filter((r: any) => r.author_id !== me_ && Date.now() - +new Date(r.created_at) < week);
  const repliedPosts = [...new Set(freshReplies.map((r: any) => r.post_id))];
  const topics = myRooms.map((r) => ({ id: r, name: roomById(r)?.name ?? r }));

  const qs = (patch: Record<string, string | undefined>, anchor = true) => {
    const sp = new URLSearchParams();
    const merged = { feed: feedMode === "topics" ? undefined : feedMode, intent, room, open: openOnly ? "1" : undefined, sort: relevant ? "relevant" : undefined, ...patch };
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
        <details className="sc-feed-filter" data-keep-open style={{ position: "relative" }} open={false}>
          {/* A fixed width: the tabs beside it must not move when the label changes. */}
          <summary style={{ listStyle: "none", cursor: "pointer", width: 220, height: 36, padding: "0 14px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", display: "flex", alignItems: "center", gap: 6, font: "600 13px/1 var(--sans)", color: "var(--ink)", whiteSpace: "nowrap" }}>
            Filter <span title={filterLabel} style={{ flex: 1, fontWeight: 400, color: (intent || room || openOnly || relevant) ? "var(--ink)" : "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{filterLabel}</span>
            {openCount > 0 && <span title={`${openCount} request${openCount > 1 ? "s" : ""} for help without a reply`} style={{ flex: "0 0 auto", padding: "3px 7px", borderRadius: 999, background: "var(--signal)", color: "#fff", font: "700 11px/1 var(--sans)" }}>{openCount} open</span>}
          </summary>
          <div style={{ position: "absolute", right: 0, top: 42, zIndex: 30, width: "min(420px, 90vw)", padding: 12, borderRadius: 16, border: "1px solid var(--rule)", background: "color-mix(in srgb, var(--bg) 94%, transparent)", boxShadow: "0 16px 40px rgba(31, 38, 60, .18)", WebkitBackdropFilter: "blur(27px) saturate(218%)", backdropFilter: "blur(27px) saturate(218%)", display: "flex", flexDirection: "column", gap: 10 }}>
            {(intent || room || openOnly || relevant) && <Link href={qs({ intent: undefined, room: undefined, open: undefined, sort: undefined }, false)} scroll={false} style={{ alignSelf: "flex-end", font: "600 12.5px/1 var(--sans)", color: "var(--link)", textDecoration: "none" }}>Clear filter</Link>}
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <div>
                <div style={{ font: "600 12px/1 var(--sans)", color: "var(--mute)", marginBottom: 6 }}>Order</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Link href={qs({ sort: undefined }, false)} scroll={false} style={pill(!relevant)}>Latest</Link>
                  <Link href={qs({ sort: "relevant" }, false)} scroll={false} style={pill(relevant)} title="Your techniques, people you follow and open requests first">Relevant</Link>
                </div>
              </div>
              <div>
                <div style={{ font: "600 12px/1 var(--sans)", color: "var(--mute)", marginBottom: 6 }}>Show</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Link href={qs({ open: undefined }, false)} scroll={false} style={pill(!openOnly)}>All</Link>
                  <Link href={qs({ open: "1" }, false)} scroll={false} style={pill(openOnly)} title="Questions and feedback requests nobody has answered yet">Open only{openCount ? ` · ${openCount}` : ""}</Link>
                </div>
              </div>
            </div>
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
            <MutedList items={mutedItems} />
          </div>
        </details>
        </div>

        {feedMode === "following" && followed.length === 0 && (
          <Panel>
            <div style={{ padding: "14px 14px 6px", font: "600 13.5px/1.4 var(--sans)" }}>Follow a few people to fill this tab</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {contacts.slice(0, 3).map(({ person: c, reason }: any) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderTop: "1px solid var(--rule)" }}>
                  <Avatar name={c.display_name ?? ""} url={c.avatar_url} size={32} />
                  <Link href={`/people/${c.id}`} style={{ flex: 1, minWidth: 0, color: "var(--ink)", textDecoration: "none" }}>
                    <span style={{ display: "block", font: "600 13.5px/1.4 var(--sans)" }}>{c.display_name}</span>
                    <span style={{ display: "block", font: "400 12.5px/1.4 var(--sans)", color: "var(--mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{reason || c.institution || ""}</span>
                  </Link>
                  <FollowButton personId={c.id} following={false} inline />
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--rule)" }}><Link href="/network" style={{ font: "600 12.5px/1.4 var(--sans)", color: "var(--link)", textDecoration: "none" }}>More people →</Link></div>
          </Panel>
        )}

        {feedMode === "following" && followActivity.filter((a) => a.kind !== "post").length > 0 && (
          <Panel>
            <PanelHead>Papers, answers and methods</PanelHead>
            <ActivityList items={followActivity.filter((a) => a.kind !== "post").slice(0, 8)} empty="" />
          </Panel>
        )}

        {feedMode === "groups" && myGroupIds.length > 0 && (
          <p style={{ font: "400 13px/1.6 var(--sans)", color: "var(--mute)", margin: 0 }}>
            Discussions inside your groups, seen only by their members. To post in one, open the group.
          </p>
        )}
        {(posts?.length ?? 0) === 0 && (feedMode === "topics" || (feedMode === "following" && followed.length > 0)) && (
          <Panel>
            <Empty>
              {openOnly ? <>No open requests right now. <Link href={qs({ open: undefined }, false)} scroll={false} style={{ color: "var(--link)" }}>Show all posts</Link>.</>
                : <>Nothing here yet. Post the first thing above, or <Link href="/groups#topics" style={{ color: "var(--link)" }}>join more topic groups</Link>.</>}
            </Empty>
          </Panel>
        )}
        {(posts?.length ?? 0) === 0 && feedMode === "groups" && (
          <Panel>
            <Empty>
              {myGroupIds.length ? <>No discussions in your groups yet. <Link href="/groups" style={{ color: "var(--link)" }}>Open a group to start one</Link>.</> : "You are not in a group yet. Groups open to everyone:"}
            </Empty>
            {(suggestGroups ?? []).map((g: any) => (
              <Link key={g.id} href={`/groups/${g.id}`} style={{ display: "block", padding: "10px 14px", borderTop: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
                <span style={{ display: "block", font: "600 13.5px/1.4 var(--sans)" }}>{g.name} <span style={{ color: "var(--link)", fontWeight: 600 }}>· Join →</span></span>
                {g.description && <span style={{ display: "block", font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.description}</span>}
              </Link>
            ))}
            {!myGroupIds.length && <div style={{ padding: "10px 14px", borderTop: "1px solid var(--rule)" }}><Link href="/groups" style={{ font: "600 12.5px/1.4 var(--sans)", color: "var(--link)", textDecoration: "none" }}>All groups, or start one →</Link></div>}
          </Panel>
        )}

        <FeedVisit />
        <FeedKeys />
        <FeedLive since={posts.length ? posts.reduce((m: string, p: any) => (p.created_at > m ? p.created_at : m), posts[0].created_at) : null} query={liveQuery} />
        <div id="feed-posts" key={`${feedMode}-${intent ?? ""}-${room ?? ""}-${openOnly}-${relevant}`} className="sc-tabpane" style={{ display: "flex", flexDirection: "column", gap: 20, scrollMarginTop: 90 }}>
        {(posts ?? []).map((p: any, i: number) => (
          <div key={p.id} style={{ display: "contents" }}>
          <PostCard p={p} author={who(p.author_id)} card={cardOf(p.method_card_id)} images={images.get(p.id)}
            reaction={reactions.get(p.id)} replies={replyCount(p.id)} me={me_} path="/home"
            topicHref={(r) => qs({ room: r, feed: undefined })} group={groupNames.get(p.group_id) ?? null}
            extra={extras.get(p.id)} follows={following.has(p.author_id)} contextPerson={who(extras.get(p.id)?.context?.personId ?? "")}
            topReply={topReply(p.id)} moreReplies={moreReplies(p.id)} status={status.get(p.id)} isNew={isNew(p)} />
          {i === lineAfter && (
            <div role="separator" aria-label="Earlier posts" style={{ display: "flex", alignItems: "center", gap: 10, font: "600 12px/1 var(--sans)", color: "var(--mute)" }}>
              <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />You are up to date · earlier posts<span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
            </div>
          )}
          </div>
        ))}
        </div>
        {hasMore && <AutoMore href={qs({ n: String(pageSize + 20) }, false)} />}
      </section>
      </div>
    </div>
  );
}

