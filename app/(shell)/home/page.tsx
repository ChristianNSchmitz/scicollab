import { peopleById } from "@/lib/people";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import PersonLink from "@/components/social/PersonLink";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, PanelHead, Empty, Outcome, Tag, btn, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { ROOMS, roomById, housesOfRoom, INTENTS, intentById } from "@/lib/taxonomy";
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
import { ReactionCounts } from "@/components/social/Reactions";

export const dynamic = "force-dynamic";

const INTENT_COLOUR: Record<string, string> = {
  result: "var(--ok)", data_question: "var(--info)", general: "var(--mute)", collab: "var(--signal-ink)",
};

/**
 * The feed — posts from the rooms you have joined.
 *
 * Filters are intent and room rather than a ranking algorithm, because the
 * useful question here is "who is stuck on what" and "who needs a
 * collaborator", not "what is popular".
 */
export default async function Home({
  searchParams,
}: { searchParams: Promise<{ intent?: string; room?: string; sync?: string; feed?: string }> }) {
  const { intent, room: roomParam, sync, feed: feedParam } = await searchParams;
  // "following": posts and activity from the people you follow, from any room.
  const feedMode = feedParam === "following" ? "following" : "rooms";
  const room = feedMode === "rooms" ? roomParam : undefined;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Everything below needs only the user, so it is fetched in three chains
  // that run side by side: the feed, the citation tracker, and "Waiting on
  // you". Against the real database each await is a network round trip;
  // run one after another they were about eleven, now the longest chain is
  // about four.
  ensureRecordSeed();
  const empty = Promise.resolve({ data: [] as any[] });
  const [{ data: mine }, { data: me }, { count: unread }, { data: myRequests }, { data: myQuestions }, { data: myPosts }, following] =
    await Promise.all([
      supabase.from("user_rooms").select("room_id").eq("user_id", user!.id),
      supabase.from("profiles").select("orcid").eq("id", user!.id).maybeSingle(),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", user!.id).is("read_at", null),
      supabase.from("access_requests").select("id, attachment_id, created_at").eq("owner_id", user!.id).eq("status", "pending"),
      supabase.from("questions").select("id, title").eq("author_id", user!.id),
      supabase.from("posts").select("id").eq("author_id", user!.id),
      followingOf(supabase, user!.id),
    ]);
  const followed = [...following];
  const myRooms = (mine ?? []).map((r: { room_id: string }) => r.room_id);

  // A new account with no rooms gets the picker, never an empty page.
  if (myRooms.length === 0) redirect("/welcome");

  const feed = (async () => {
    if (feedMode === "following" && !followed.length) {
      return { posts: [] as any[], people: new Map() as Awaited<ReturnType<typeof peopleById>>, cards: [] as any[], feedReplies: [] as any[], reactions: new Map() as Awaited<ReturnType<typeof reactionsFor>> };
    }
    let q = supabase
      .from("posts")
      .select("id, author_id, room_id, intent, title, body, method_card_id, technique, organism, deadline, offer, created_at");
    q = feedMode === "following" ? q.in("author_id", followed) : q.in("room_id", room ? [room] : myRooms);
    q = q.order("created_at", { ascending: false }).limit(40);
    if (intent) q = q.eq("intent", intent);
    const { data: posts } = await q;
    const cardIds = [...new Set((posts ?? []).map((p: any) => p.method_card_id).filter(Boolean))];
    const postIds = (posts ?? []).map((p: any) => p.id);
    const [people, { data: cards }, { data: feedReplies }, reactions] = await Promise.all([
      peopleById(supabase, (posts ?? []).map((p: any) => p.author_id)),
      cardIds.length ? supabase.from("method_cards").select("id, code, title, outcome, system").in("id", cardIds) : empty,
      postIds.length ? supabase.from("post_replies").select("post_id").in("post_id", postIds) : empty,
      reactionsFor(supabase, "post", postIds, user!.id),
    ]);
    return { posts, people, cards, feedReplies, reactions };
  })();

  const research = (async () => {
    // An overdue OpenAlex sync runs after the page is sent; the next visit shows it.
    await syncIfDue(user!.id, me?.orcid, { waitForFirst: false });
    const [biblio, { pubs, runs }] = await Promise.all([
      bibliometricsFor(user!.id, me?.orcid),
      loadPublications(user!.id, me?.orcid, 20),
    ]);
    const snapshots = await loadSnapshots(supabase, user!.id, biblio);
    return { biblio, pubs, change: recentChange(biblio, snapshots, runs), citations: citationProfile(pubs) };
  })();

  const requestAtts = [...new Set((myRequests ?? []).map((r: any) => r.attachment_id))];
  const qIds = (myQuestions ?? []).map((q: any) => q.id);
  const myPostIds = (myPosts ?? []).map((p: any) => p.id);

  // What people you follow did besides posting, and what happened to your
  // own work; co-authors here you do not follow yet.
  const social = Promise.all([
    feedMode === "following" ? activityOf(supabase, followed, { viewer: user!.id, limit: 12 }) : Promise.resolve([]),
    activityOnMine(supabase, user!.id),
    coauthorsOf(supabase, user!.id, me?.orcid, following),
  ]);

  const [
    { posts, people, cards, feedReplies, reactions },
    { biblio, pubs, change, citations },
    { data: atts }, { data: qAnswers }, { data: repliesToMe },
    [followActivity, onMine, co],
  ] = await Promise.all([
    feed,
    research,
    requestAtts.length ? supabase.from("post_attachments").select("id, post_id").in("id", requestAtts) : empty,
    qIds.length ? supabase.from("answers").select("question_id, author_id, created_at").in("question_id", qIds) : empty,
    myPostIds.length ? supabase.from("post_replies").select("post_id, author_id, created_at").in("post_id", myPostIds) : empty,
    social,
  ]);
  const suggestions = co.members.filter((m) => !m.following).slice(0, 3);

  const who = (id: string) => people.get(id);
  const cardOf = (id: string | null) => (cards ?? []).find((c: any) => c.id === id);
  const replyCount = (id: string) => (feedReplies ?? []).filter((r: any) => r.post_id === id).length;
  const requestPosts = [...new Set((atts ?? []).map((a: any) => a.post_id))];
  const week = 7 * 864e5;
  const freshAnswers = (qAnswers ?? []).filter((a: any) => a.author_id !== user!.id && Date.now() - +new Date(a.created_at) < week);
  const answeredQ = [...new Set(freshAnswers.map((a: any) => a.question_id))];
  const freshReplies = (repliesToMe ?? []).filter((r: any) => r.author_id !== user!.id && Date.now() - +new Date(r.created_at) < week);
  const repliedPosts = [...new Set(freshReplies.map((r: any) => r.post_id))];

  const qs = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { feed: feedMode === "following" ? "following" : undefined, intent, room, ...patch };
    Object.entries(merged).forEach(([k, v]) => { if (v) sp.set(k, v); });
    const s = sp.toString();
    return s ? `/home?${s}` : "/home";
  };

  const pill = (active: boolean): React.CSSProperties => ({
    font: mono(11, 500), padding: "5px 10px", border: "1px solid var(--rule)",
    background: active ? "var(--ink)" : "transparent",
    color: active ? "var(--bg)" : "var(--ink)", textDecoration: "none", whiteSpace: "nowrap",
  });

  return (
    <Page
      title="Feed"
      lede={feedMode === "following"
        ? "Posts, papers, answers and methods from the people you follow, from every room."
        : "Posts from the rooms you have joined. Every post states what it is, and the two that carry evidence carry a method card."}
      actions={<Link href="/post" style={btnPrimary}>New post</Link>}
    >
      {sync && SYNC_FLASH[sync] && (
        <p role="status" style={{ font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--rule)", background: "var(--surface)" }}>{SYNC_FLASH[sync]}</p>
      )}
      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <nav aria-label="Feed" style={{ display: "flex", gap: 0 }}>
            {([["rooms", "Your rooms"], ["following", `Following · ${followed.length}`]] as const).map(([k, label]) => (
              <Link key={k} href={k === "rooms" ? "/home" : "/home?feed=following"} aria-current={feedMode === k ? "page" : undefined}
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

          {/* Filters sit directly under the composer entry, as designed. */}
          <Panel style={{ padding: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 9 }}>
              <span style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--mute)", marginRight: 4 }}>KIND</span>
              <Link href={qs({ intent: undefined })} style={pill(!intent)}>All</Link>
              {INTENTS.map((i) => (
                <Link key={i.id} href={qs({ intent: i.id })} style={pill(intent === i.id)}>{i.label}</Link>
              ))}
            </div>
            {feedMode === "rooms" && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--mute)", marginRight: 4 }}>ROOM</span>
              <Link href={qs({ room: undefined })} style={pill(!room)}>All yours</Link>
              {myRooms.map((r) => (
                <Link key={r} href={qs({ room: r })} style={pill(room === r)}>#{r}</Link>
              ))}
            </div>}
          </Panel>

          {(posts?.length ?? 0) === 0 && (feedMode === "rooms" || followed.length > 0) && (
            <Panel>
              <Empty>
                Nothing here yet. <Link href="/post" style={{ color: "var(--link)" }}>Post something</Link>, or{" "}
                <Link href="/rooms" style={{ color: "var(--link)" }}>join more rooms</Link>.
              </Empty>
            </Panel>
          )}

          {(posts ?? []).map((p: any) => {
            const card = cardOf(p.method_card_id);
            const author = who(p.author_id);
            const spec = intentById(p.intent);
            return (
              <Panel key={p.id}>
                <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 9, borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
                  <span style={{ font: mono(9.5, 700), letterSpacing: ".08em", color: INTENT_COLOUR[p.intent], border: `1px solid ${INTENT_COLOUR[p.intent]}`, padding: "3px 7px" }}>
                    {(spec?.label ?? p.intent).toUpperCase()}
                  </span>
                  <Link href={`/home?room=${p.room_id}`} style={{ font: mono(11, 500), color: "var(--ink)" }}>#{p.room_id}</Link>
                  <span style={{ font: mono(10.5), color: "var(--mute)" }}>
                    {housesOfRoom(p.room_id).length > 1 ? `shared across ${housesOfRoom(p.room_id).length} houses` : roomById(p.room_id)?.name}
                  </span>
                  <span style={{ marginLeft: "auto", font: mono(10.5), color: "var(--mute)" }}>{timeAgo(p.created_at)}</span>
                </div>

                <div style={{ padding: 14 }}>
                  <Link href={`/posts/${p.id}`} style={{ font: mono(15, 700, 1.35), color: "var(--ink)", textDecoration: "none" }}>{p.title}</Link>
                  <div style={{ font: mono(11), color: "var(--mute)", marginTop: 6, display: "flex", gap: 7, alignItems: "center" }}>
                    <Avatar name={author?.display_name ?? ""} url={author?.avatar_url} size={18} />
                    <span><PersonLink id={p.author_id}>{author?.display_name ?? "Someone"}</PersonLink>{author?.institution ? ` · ${author.institution}` : ""}</span>
                  </div>
                  {p.body && <p className="sc-prose" style={{ font: "400 13.5px/1.65 var(--sans)", margin: "10px 0 0" }}>{excerpt(p.body, 280)}</p>}

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
                <Link href={`/posts/${p.id}#replies`} style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "9px 14px", borderTop: "1px solid var(--rule)", font: mono(11, 500), color: "var(--mute)", textDecoration: "none" }}>
                  <span>{replyCount(p.id) === 0 ? "Reply →" : `${replyCount(p.id)} ${replyCount(p.id) === 1 ? "reply" : "replies"} →`}</span>
                  <ReactionCounts summary={reactions.get(p.id)} />
                </Link>
              </Panel>
            );
          })}
        </div>

        <aside className="sc-home-aside" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <CitationTracker biblio={biblio} change={change} c={citations} pubs={pubs} />
          <AttentionPanel
            unread={unread ?? 0}
            requests={(myRequests ?? []).length}
            requestPost={requestPosts[0] ?? null}
            answers={freshAnswers.length}
            answeredQuestion={answeredQ.length === 1 ? answeredQ[0] : null}
            replies={freshReplies.length}
            repliedPost={repliedPosts.length === 1 ? repliedPosts[0] : null}
          />
          {onMine.length > 0 && (
            <Panel>
              <PanelHead>Your work, used by others</PanelHead>
              <ActivityList items={onMine.slice(0, 5)} empty="" />
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
          <div className="sc-hide-narrow" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <PanelHead>Your rooms · {myRooms.length}</PanelHead>
            <div style={{ padding: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {myRooms.map((r) => <Tag key={r}>#{r}</Tag>)}
            </div>
          </Panel>
          <Panel>
            <PanelHead>Rooms you have not joined</PanelHead>
            <div style={{ padding: 14 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {ROOMS.filter((r) => !myRooms.includes(r.id)).slice(0, 8).map((r) => <Tag key={r.id}>#{r.id}</Tag>)}
              </div>
              <Link href="/rooms" style={{ ...btn, width: "100%", justifyContent: "center" }}>Browse all rooms</Link>
            </div>
          </Panel>
          </div>
        </aside>
      </div>
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
