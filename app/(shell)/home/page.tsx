import { peopleById } from "@/lib/people";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import PersonLink from "@/components/social/PersonLink";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel, PanelHead, Empty, Outcome, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { roomById, housesOfRoom, INTENTS, intentById } from "@/lib/taxonomy";
import { bibliometricsFor, loadSnapshots, recentChange } from "@/lib/record/bibliometrics";
import { citationProfile } from "@/lib/record/citations";
import { loadPublications, syncIfDue } from "@/lib/record/publications";
import Highlights, { type NewPaper, type Nudge } from "@/components/dashboard/Highlights";
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
import Reactions from "@/components/social/Reactions";
import QuickPost from "@/components/feed/QuickPost";
import { PostImages, LinkCard } from "@/components/feed/PostMedia";
import RichText from "@/components/RichText";
import { imageUrls } from "@/lib/posts/images";

export const dynamic = "force-dynamic";

/** Short names for the filter pills; the full name is the tooltip. */
const SHORT: Record<string, string> = { result: "Results", data_question: "Data questions", general: "Questions", collab: "Collaborators", update: "News" };

const INTENT_COLOUR: Record<string, string> = {
  result: "var(--ok)", data_question: "var(--info)", general: "var(--mute)", collab: "var(--signal-ink)", update: "var(--ink)",
};

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
}: { searchParams: Promise<{ intent?: string; room?: string; sync?: string; feed?: string; posted?: string }> }) {
  const { intent, room: roomParam, sync, feed: feedParam, posted } = await searchParams;
  // "following": posts and activity from the people you follow, from any topic group.
  const feedMode = feedParam === "following" ? "following" : "topics";
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
      supabase.from("profiles").select("orcid, role_title, institution, bio, avatar_url, techniques").eq("id", me_).maybeSingle(),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", me_).is("read_at", null),
      supabase.from("access_requests").select("id, attachment_id, created_at").eq("owner_id", me_).eq("status", "pending"),
      supabase.from("questions").select("id, title").eq("author_id", me_),
      supabase.from("posts").select("id").eq("author_id", me_),
      followingOf(supabase, me_),
      supabase.from("method_cards").select("id, code, title").eq("author_id", me_).order("created_at", { ascending: false }),
      supabase.from("group_members").select("group_id, role").eq("user_id", me_),
    ]);
  const followed = [...following];
  const myRooms = (mine ?? []).map((r: { room_id: string }) => r.room_id);

  // A new account with no topic groups gets the picker, never an empty page.
  if (myRooms.length === 0) redirect("/welcome");

  const feed = (async () => {
    if (feedMode === "following" && !followed.length) {
      return { posts: [] as any[], people: new Map() as Awaited<ReturnType<typeof peopleById>>, cards: [] as any[], feedReplies: [] as any[], reactions: new Map() as Awaited<ReturnType<typeof reactionsFor>>, images: new Map<string, string[]>() };
    }
    let q = supabase
      .from("posts")
      .select("id, author_id, room_id, intent, title, body, method_card_id, technique, organism, deadline, offer, images, link_preview, created_at");
    q = feedMode === "following" ? q.in("author_id", followed) : q.in("room_id", room ? [room] : myRooms);
    q = q.order("created_at", { ascending: false }).limit(40);
    if (intent) q = q.eq("intent", intent);
    const { data: posts } = await q;
    const cardIds = [...new Set((posts ?? []).map((p: any) => p.method_card_id).filter(Boolean))];
    const postIds = (posts ?? []).map((p: any) => p.id);
    const [people, { data: cards }, { data: feedReplies }, reactions, images] = await Promise.all([
      peopleById(supabase, (posts ?? []).map((p: any) => p.author_id)),
      cardIds.length ? supabase.from("method_cards").select("id, code, title, outcome, system").in("id", cardIds) : empty,
      postIds.length ? supabase.from("post_replies").select("post_id").in("post_id", postIds) : empty,
      reactionsFor(supabase, "post", postIds, me_),
      imageUrls(supabase, posts ?? []),
    ]);
    return { posts, people, cards, feedReplies, reactions, images };
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
    const ids = (myGroups ?? []).map((g: any) => g.group_id);
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
    { posts, people, cards, feedReplies, reactions, images },
    { biblio, pubs, change, citations },
    { data: atts }, { data: qAnswers }, { data: repliesToMe },
    [followActivity, onMine, contacts, theirPapers],
    { groups: groupList, joinable },
  ] = await Promise.all([
    feed,
    research,
    requestAtts.length ? supabase.from("post_attachments").select("id, post_id").in("id", requestAtts) : empty,
    qIds.length ? supabase.from("answers").select("question_id, author_id, created_at").in("question_id", qIds) : empty,
    myPostIds.length ? supabase.from("post_replies").select("post_id, author_id, created_at").in("post_id", myPostIds) : empty,
    social,
    groupsPanel,
  ]);
  // New papers: yours from the last syncs, then those of people you follow.
  const names = await peopleById(supabase, theirPapers.map((p) => p.user));
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
  const requestPosts = [...new Set((atts ?? []).map((a: any) => a.post_id))];
  const week = 7 * 864e5;
  const freshAnswers = (qAnswers ?? []).filter((a: any) => a.author_id !== me_ && Date.now() - +new Date(a.created_at) < week);
  const answeredQ = [...new Set(freshAnswers.map((a: any) => a.question_id))];
  const freshReplies = (repliesToMe ?? []).filter((r: any) => r.author_id !== me_ && Date.now() - +new Date(r.created_at) < week);
  const repliedPosts = [...new Set(freshReplies.map((r: any) => r.post_id))];
  const topics = myRooms.map((r) => ({ id: r, name: roomById(r)?.name ?? r }));

  const qs = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { feed: feedMode === "following" ? "following" : undefined, intent, room, ...patch };
    Object.entries(merged).forEach(([k, v]) => { if (v) sp.set(k, v); });
    const s = sp.toString();
    return s ? `/home?${s}#feed` : "/home#feed";
  };

  const pill = (active: boolean): React.CSSProperties => ({
    font: mono(11, 500), padding: "5px 10px", border: "1px solid var(--rule)",
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
        <p role="status" style={{ font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--rule)", background: "var(--surface)" }}>{SYNC_FLASH[sync]}</p>
      )}

      <GettingStarted steps={steps} />
      <Highlights biblio={biblio} change={change} pubs={pubs} papers={papers} contacts={contacts} nudges={nudges} />

      {/* ── feed ──────────────────────────────────────────────────────── */}
      <section id="feed" aria-label="Feed" style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12, scrollMarginTop: 72 }}>
        {posted && <p role="status" style={{ font: "400 13.5px/1.5 var(--sans)", margin: 0, padding: "10px 12px", border: "1px solid var(--ok)", background: "var(--surface)" }}>Posted.</p>}
        <QuickPost topics={topics} cards={(myCards ?? []) as { id: string; code: string; title: string }[]} defaultTopic={room} />

        <nav aria-label="Which posts" className="sc-seg" style={{ display: "flex", gap: 0 }}>
          {([["topics", "Your topic groups"], ["following", `Following · ${followed.length}`]] as const).map(([k, label]) => (
            <Link key={k} href={k === "topics" ? "/home#feed" : "/home?feed=following#feed"} aria-current={feedMode === k ? "page" : undefined}
              style={{ flex: 1, textAlign: "center", padding: "9px 12px", font: mono(12, 600), textDecoration: "none", color: feedMode === k ? "var(--ink)" : "var(--mute)", borderBottom: feedMode === k ? "2px solid var(--signal)" : "1px solid var(--rule)" }}>
              {label}
            </Link>
          ))}
        </nav>

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

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="sc-filter" role="group" aria-label="Kind of post">
            <span style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--mute)", marginRight: 4 }}>KIND</span>
            <Link href={qs({ intent: undefined })} style={pill(!intent)}>All</Link>
            {INTENTS.map((i) => (
              <Link key={i.id} href={qs({ intent: i.id })} style={pill(intent === i.id)} title={i.label}>{SHORT[i.id] ?? i.label}</Link>
            ))}
          </div>
          {feedMode === "topics" && (
            <div className="sc-filter" role="group" aria-label="Topic group">
              <span style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--mute)", marginRight: 4 }}>TOPIC</span>
              <Link href={qs({ room: undefined })} style={pill(!room)}>All yours</Link>
              {myRooms.map((r) => (
                <Link key={r} href={qs({ room: r })} style={pill(room === r)}>#{r}</Link>
              ))}
              <Link href="/groups#topics" style={{ font: mono(11, 500), color: "var(--link)", marginLeft: 4, whiteSpace: "nowrap" }}>more →</Link>
            </div>
          )}
        </div>

        {(posts?.length ?? 0) === 0 && (feedMode === "topics" || followed.length > 0) && (
          <Panel>
            <Empty>
              Nothing here yet. Post the first thing above, or{" "}
              <Link href="/groups#topics" style={{ color: "var(--link)" }}>join more topic groups</Link>.
            </Empty>
          </Panel>
        )}

        {(posts ?? []).map((p: any) => {
          const card = cardOf(p.method_card_id);
          const author = who(p.author_id);
          const spec = intentById(p.intent);
          return (
            <article key={p.id} id={`post-${p.id}`} style={{ scrollMarginTop: 72 }}>
              <Panel>
                <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 9, borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
                  <Avatar name={author?.display_name ?? ""} url={author?.avatar_url} size={28} />
                  <div style={{ minWidth: 0 }}>
                    <PersonLink id={p.author_id} style={{ font: mono(12.5, 600) }}>{author?.display_name ?? "Someone"}</PersonLink>
                    <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 2 }}>
                      {author?.institution ? `${author.institution} · ` : ""}{timeAgo(p.created_at)}
                    </div>
                  </div>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="sc-badge" style={{ font: mono(9.5, 700), letterSpacing: ".08em", color: INTENT_COLOUR[p.intent] ?? "var(--mute)", border: `1px solid ${INTENT_COLOUR[p.intent] ?? "var(--rule)"}`, padding: "3px 7px" }}>
                      {(spec?.label ?? p.intent).toUpperCase()}
                    </span>
                    <Link href={qs({ room: p.room_id, feed: undefined })} title={housesOfRoom(p.room_id).length > 1 ? `shared across ${housesOfRoom(p.room_id).length} fields` : roomById(p.room_id)?.name} style={{ font: mono(11, 500), color: "var(--ink)" }}>#{p.room_id}</Link>
                  </span>
                </div>

                <div style={{ padding: 14 }}>
                  <Link href={`/posts/${p.id}`} style={{ font: mono(15, 700, 1.35), color: "var(--ink)", textDecoration: "none" }}>{p.title}</Link>
                  {p.body && <div style={{ marginTop: 8 }}><RichText body={excerpt(p.body, 400)} style={{ font: "400 13.5px/1.65 var(--sans)" }} /></div>}
                  <PostImages urls={images.get(p.id)} title={p.title} />
                  <LinkCard preview={p.link_preview} />

                  {card && (
                    <Link href={`/methods/${card.id}`} style={{ display: "block", marginTop: 11, border: "1px solid var(--rule)", background: "var(--bg)", padding: "10px 12px", color: "var(--ink)" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Outcome value={card.outcome} />
                        <span style={{ font: mono(10.5), color: "var(--mute)" }}>{card.code}</span>
                      </div>
                      <div style={{ font: mono(12.5, 500), marginTop: 6 }}>{card.title}</div>
                    </Link>
                  )}

                  {p.intent === "collab" && (p.technique || p.offer || p.deadline) && (
                    <div style={{ marginTop: 11, border: "1px solid var(--signal)", padding: "10px 12px" }}>
                      <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--signal-ink)", marginBottom: 6 }}>WHAT IS NEEDED</div>
                      <div style={{ font: mono(11.5, 400, 1.7) }}>
                        {p.technique && <div>technique · {p.technique}</div>}
                        {p.organism && <div>system · {p.organism}</div>}
                        {p.deadline && <div>by · {p.deadline}</div>}
                        {p.offer && <div>offered back · {p.offer}</div>}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "9px 14px", borderTop: "1px solid var(--rule)" }}>
                  <Reactions kind="post" targetId={p.id} summary={reactions.get(p.id)} own={p.author_id === me_} path="/home" />
                  <Link href={`/posts/${p.id}#replies`} style={{ marginLeft: "auto", font: mono(11, 500), color: "var(--mute)", textDecoration: "none" }}>
                    {replyCount(p.id) === 0 ? "Reply →" : `${replyCount(p.id)} ${replyCount(p.id) === 1 ? "reply" : "replies"} →`}
                  </Link>
                </div>
              </Panel>
            </article>
          );
        })}
      </section>
      </div>
    </div>
  );
}

/** The first `max` characters, cut at a word and marked as cut. */
function excerpt(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trimEnd() + "…";
}
