import { peopleById } from "@/lib/people";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import PersonLink from "@/components/social/PersonLink";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, PanelHead, Empty, Outcome, Tag, btn, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { roomById, housesOfRoom, INTENTS, intentById } from "@/lib/taxonomy";
import { bibliometricsFor, loadSnapshots, recentChange } from "@/lib/record/bibliometrics";
import { citationProfile } from "@/lib/record/citations";
import { loadPublications, syncIfDue } from "@/lib/record/publications";
import CitationTracker from "@/components/record/CitationTracker";
import { SYNC_FLASH } from "@/lib/openalex/messages";
import { ensureRecordSeed } from "@/lib/record/demo-seed";
import { followingOf } from "@/lib/social/follows";
import { activityOf, activityOnMine } from "@/lib/social/activity";
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
      supabase.from("profiles").select("orcid").eq("id", me_).maybeSingle(),
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
    coauthorsOf(supabase, me_, me?.orcid, following),
  ]);

  const [
    { posts, people, cards, feedReplies, reactions, images },
    { biblio, pubs, change, citations },
    { data: atts }, { data: qAnswers }, { data: repliesToMe },
    [followActivity, onMine, co],
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
  const suggestions = co.members.filter((m) => !m.following).slice(0, 3);

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

  return (
    <Page
      title="Feed"
      lede="Your dashboard first: your citations, what is waiting on you and your groups. Then the posts from your topic groups and the people you follow."
      actions={<a href="#compose" style={btnPrimary}>New post</a>}
    >
      {sync && SYNC_FLASH[sync] && (
        <p role="status" style={{ font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--rule)", background: "var(--surface)" }}>{SYNC_FLASH[sync]}</p>
      )}

      {/* ── dashboard ─────────────────────────────────────────────────── */}
      <section aria-label="Dashboard" className="sc-dash">
        <CitationTracker biblio={biblio} change={change} c={citations} pubs={pubs} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <AttentionPanel
            unread={unread ?? 0}
            requests={(myRequests ?? []).length}
            requestPost={requestPosts[0] ?? null}
            answers={freshAnswers.length}
            answeredQuestion={answeredQ.length === 1 ? answeredQ[0] : null}
            replies={freshReplies.length}
            repliedPost={repliedPosts.length === 1 ? repliedPosts[0] : null}
          />
          <Panel>
            <PanelHead>Your groups · {groupList.length}</PanelHead>
            {groupList.length === 0 ? (
              <div style={{ padding: "12px 14px", font: "400 13px/1.6 var(--sans)", color: "var(--mute)" }}>
                No groups yet. <Link href="/groups" style={{ color: "var(--link)" }}>Join or start one</Link> for your lab or journal club.
              </div>
            ) : groupList.map((g: any) => (
              <Link key={g.id} href={`/groups/${g.id}`} style={{ display: "flex", gap: 8, padding: "9px 14px", borderBottom: "1px solid var(--rule)", font: mono(12, 500), color: "var(--ink)", textDecoration: "none" }}>
                <span style={{ flex: 1 }}>{g.name}</span>
                {joinable.get(g.id) ? <span style={{ color: "var(--signal-ink)" }}>{joinable.get(g.id)} project{joinable.get(g.id)! > 1 ? "s" : ""} to join</span> : null}
              </Link>
            ))}
          </Panel>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {onMine.length > 0 && (
            <Panel>
              <PanelHead>Your work, used by others</PanelHead>
              <ActivityList items={onMine.slice(0, 4)} empty="" />
            </Panel>
          )}
          {suggestions.length > 0 && (
            <Panel>
              <PanelHead>Co-authors on SciCollab</PanelHead>
              {suggestions.map((m) => (
                <div key={m.person.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderBottom: "1px solid var(--rule)" }}>
                  <Avatar name={m.person.display_name} url={m.person.avatar_url} size={24} />
                  <Link href={`/people/${m.person.id}`} style={{ flex: 1, minWidth: 0, font: mono(12, 500), color: "var(--ink)" }}>{m.person.display_name}</Link>
                  <FollowButton personId={m.person.id} following={false} compact />
                </div>
              ))}
              <Link href="/network" style={{ display: "block", padding: "9px 14px", font: mono(11, 500), color: "var(--link)" }}>All suggestions and invitations →</Link>
            </Panel>
          )}
          {onMine.length === 0 && suggestions.length === 0 && (
            <Panel>
              <PanelHead>Your record</PanelHead>
              <div style={{ padding: "12px 14px", font: "400 13px/1.6 var(--sans)", color: "var(--mute)" }}>
                When others reproduce or fork your method cards, it shows here. <Link href="/you" style={{ color: "var(--link)" }}>See your record →</Link>
              </div>
            </Panel>
          )}
        </div>
      </section>

      {/* ── feed ──────────────────────────────────────────────────────── */}
      <section id="feed" aria-label="Feed" style={{ maxWidth: 820, margin: "26px auto 0", display: "flex", flexDirection: "column", gap: 12, scrollMarginTop: 72 }}>
        {posted && <p role="status" style={{ font: "400 13.5px/1.5 var(--sans)", margin: 0, padding: "10px 12px", border: "1px solid var(--ok)", background: "var(--surface)" }}>Posted.</p>}
        <QuickPost topics={topics} cards={(myCards ?? []) as { id: string; code: string; title: string }[]} defaultTopic={room} />

        <nav aria-label="Which posts" style={{ display: "flex", gap: 0 }}>
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
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--mute)", marginRight: 4 }}>KIND</span>
            <Link href={qs({ intent: undefined })} style={pill(!intent)}>All</Link>
            {INTENTS.map((i) => (
              <Link key={i.id} href={qs({ intent: i.id })} style={pill(intent === i.id)}>{i.label}</Link>
            ))}
          </div>
          {feedMode === "topics" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--mute)", marginRight: 4 }}>TOPIC</span>
              <Link href={qs({ room: undefined })} style={pill(!room)}>All yours</Link>
              {myRooms.map((r) => (
                <Link key={r} href={qs({ room: r })} style={pill(room === r)}>#{r}</Link>
              ))}
              <Link href="/groups#topics" style={{ font: mono(11, 500), color: "var(--link)", marginLeft: 4 }}>more topic groups →</Link>
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
                    <span style={{ font: mono(9.5, 700), letterSpacing: ".08em", color: INTENT_COLOUR[p.intent] ?? "var(--mute)", border: `1px solid ${INTENT_COLOUR[p.intent] ?? "var(--rule)"}`, padding: "3px 7px" }}>
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
    </Page>
  );
}

/** Only what is waiting on you, each with the way to deal with it. */
function AttentionPanel({ unread, requests, requestPost, answers, answeredQuestion, replies, repliedPost }: {
  unread: number; requests: number; requestPost: string | null; answers: number; answeredQuestion: string | null;
  replies: number; repliedPost: string | null;
}) {
  const items = [
    unread > 0 && { href: "/messages", text: `${unread} unread message${unread > 1 ? "s" : ""}` },
    requests > 0 && { href: requests === 1 && requestPost ? `/posts/${requestPost}` : "/requests", text: `${requests} data access request${requests > 1 ? "s" : ""} to decide` },
    replies > 0 && { href: repliedPost ? `/posts/${repliedPost}#replies` : "/home", text: `${replies} new ${replies === 1 ? "reply" : "replies"} to your posts this week` },
    answers > 0 && { href: answeredQuestion ? `/questions/${answeredQuestion}` : "/ask#questions", text: `${answers} new answer${answers > 1 ? "s" : ""} to your questions this week` },
  ].filter(Boolean) as { href: string; text: string }[];
  return (
    <Panel>
      <PanelHead>Waiting on you</PanelHead>
      {items.length === 0 ? (
        <div style={{ padding: 14, font: "400 13px/1.6 var(--sans)", color: "var(--mute)" }}>Nothing right now.</div>
      ) : items.map((i) => (
        <Link key={i.text} href={i.href} style={{ display: "flex", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--rule)", font: "400 13.5px/1.5 var(--sans)", color: "var(--ink)", textDecoration: "none" }}>
          <span style={{ color: "var(--signal-ink)" }}>→</span>{i.text}
        </Link>
      ))}
    </Panel>
  );
}

/** The first `max` characters, cut at a word and marked as cut. */
function excerpt(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trimEnd() + "…";
}
