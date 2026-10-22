import { peopleById } from "@/lib/people";
import Link from "next/link";
import Avatar from "@/components/Avatar";
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
}: { searchParams: Promise<{ intent?: string; room?: string; sync?: string }> }) {
  const { intent, room, sync } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: mine } = await supabase
    .from("user_rooms").select("room_id").eq("user_id", user!.id);
  const myRooms = (mine ?? []).map((r: { room_id: string }) => r.room_id);

  // A new account with no rooms gets the picker, never an empty page.
  if (myRooms.length === 0) redirect("/welcome");

  let q = supabase
    .from("posts")
    .select("id, author_id, room_id, intent, title, body, method_card_id, technique, organism, deadline, offer, created_at")
    .in("room_id", room ? [room] : myRooms)
    .order("created_at", { ascending: false })
    .limit(40);
  if (intent) q = q.eq("intent", intent);
  const { data: posts } = await q;

  const cardIds = [...new Set((posts ?? []).map((p: any) => p.method_card_id).filter(Boolean))];
  const [people, { data: cards }] = await Promise.all([
    peopleById(supabase, (posts ?? []).map((p: any) => p.author_id)),
    cardIds.length ? supabase.from("method_cards").select("id, code, title, outcome, system").in("id", cardIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const who = (id: string) => people.get(id);

  // ── the dashboard column: your research, and what is waiting on you ──
  ensureRecordSeed();
  const [{ data: me }, { count: unread }, { data: myRequests }, { data: myQuestions }] = await Promise.all([
    supabase.from("profiles").select("orcid").eq("id", user!.id).maybeSingle(),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", user!.id).is("read_at", null),
    supabase.from("access_requests").select("id, attachment_id, created_at").eq("owner_id", user!.id).eq("status", "pending"),
    supabase.from("questions").select("id, title").eq("author_id", user!.id),
  ]);
  // An overdue OpenAlex sync runs after the page is sent; the next visit shows it.
  await syncIfDue(user!.id, me?.orcid, { waitForFirst: false });
  const [biblio, { pubs, runs }] = await Promise.all([
    bibliometricsFor(user!.id, me?.orcid),
    loadPublications(user!.id, me?.orcid, 20),
  ]);
  const snapshots = await loadSnapshots(supabase, user!.id, biblio);
  const change = recentChange(biblio, snapshots, runs);
  const citations = citationProfile(pubs);

  const requestAtts = [...new Set((myRequests ?? []).map((r: any) => r.attachment_id))];
  const { data: atts } = requestAtts.length
    ? await supabase.from("post_attachments").select("id, post_id").in("id", requestAtts)
    : { data: [] as any[] };
  const requestPosts = [...new Set((atts ?? []).map((a: any) => a.post_id))];

  const qIds = (myQuestions ?? []).map((q: any) => q.id);
  const { data: qAnswers } = qIds.length
    ? await supabase.from("answers").select("question_id, author_id, created_at").in("question_id", qIds)
    : { data: [] as any[] };
  const freshAnswers = (qAnswers ?? []).filter((a: any) => a.author_id !== user!.id && Date.now() - +new Date(a.created_at) < 7 * 864e5);
  const answeredQ = [...new Set(freshAnswers.map((a: any) => a.question_id))];
  const cardOf = (id: string | null) => (cards ?? []).find((c: any) => c.id === id);

  // Reply counts for the posts on screen, and replies by others to my posts.
  const postIds = (posts ?? []).map((p: any) => p.id);
  const [{ data: feedReplies }, { data: myPosts }] = await Promise.all([
    postIds.length ? supabase.from("post_replies").select("post_id").in("post_id", postIds) : Promise.resolve({ data: [] as any[] }),
    supabase.from("posts").select("id").eq("author_id", user!.id),
  ]);
  const replyCount = (id: string) => (feedReplies ?? []).filter((r: any) => r.post_id === id).length;
  const myPostIds = (myPosts ?? []).map((p: any) => p.id);
  const { data: repliesToMe } = myPostIds.length
    ? await supabase.from("post_replies").select("post_id, author_id, created_at").in("post_id", myPostIds)
    : { data: [] as any[] };
  const freshReplies = (repliesToMe ?? []).filter((r: any) => r.author_id !== user!.id && Date.now() - +new Date(r.created_at) < 7 * 864e5);
  const repliedPosts = [...new Set(freshReplies.map((r: any) => r.post_id))];

  const qs = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { intent, room, ...patch };
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
      lede="Posts from the rooms you have joined. Every post states what it is, and the two that carry evidence carry a method card."
      actions={<Link href="/post" style={btnPrimary}>New post</Link>}
    >
      {sync && SYNC_FLASH[sync] && (
        <p role="status" style={{ font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--rule)", background: "var(--surface)" }}>{SYNC_FLASH[sync]}</p>
      )}
      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Filters sit directly under the composer entry, as designed. */}
          <Panel style={{ padding: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 9 }}>
              <span style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--mute)", marginRight: 4 }}>KIND</span>
              <Link href={qs({ intent: undefined })} style={pill(!intent)}>All</Link>
              {INTENTS.map((i) => (
                <Link key={i.id} href={qs({ intent: i.id })} style={pill(intent === i.id)}>{i.label}</Link>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--mute)", marginRight: 4 }}>ROOM</span>
              <Link href={qs({ room: undefined })} style={pill(!room)}>All yours</Link>
              {myRooms.map((r) => (
                <Link key={r} href={qs({ room: r })} style={pill(room === r)}>#{r}</Link>
              ))}
            </div>
          </Panel>

          {(posts?.length ?? 0) === 0 && (
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
                    <span>{author?.display_name ?? "Someone"}{author?.institution ? ` · ${author.institution}` : ""}</span>
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
                <Link href={`/posts/${p.id}#replies`} style={{ display: "block", padding: "9px 14px", borderTop: "1px solid var(--rule)", font: mono(11, 500), color: "var(--mute)", textDecoration: "none" }}>
                  {replyCount(p.id) === 0 ? "Reply →" : `${replyCount(p.id)} ${replyCount(p.id) === 1 ? "reply" : "replies"} →`}
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
