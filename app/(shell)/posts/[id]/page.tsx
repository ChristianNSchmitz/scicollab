import { peopleById } from "@/lib/people";
import Avatar from "@/components/Avatar";
import PersonLink from "@/components/social/PersonLink";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Page, LimitNotice, Panel, PanelHead, Empty, Outcome, Tag, field, btn, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { roomById, housesOfRoom, intentById } from "@/lib/taxonomy";
import { attachmentsFor, pendingFor, requestAccess, decideRequest } from "@/app/actions/attachments";
import { replyToPost, deleteReply, deletePost } from "@/app/actions/posts";
import RichText from "@/components/RichText";
import MentionTextarea from "@/components/social/MentionTextarea";
import Reactions from "@/components/social/Reactions";
import { mentionsIn } from "@/lib/social/mentions";
import { reactionsFor } from "@/lib/social/reactions";

export const dynamic = "force-dynamic";

export default async function PostDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ limited?: string }> }) {
  const { limited } = await searchParams;
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: post } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
  if (!post) notFound();

  const [{ data: author }, { data: card }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, institution, role_title, avatar_url").eq("id", post.author_id).maybeSingle(),
    post.method_card_id
      ? supabase.from("method_cards").select("id, code, title, outcome, system, conditions, fails_under").eq("id", post.method_card_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const [attachments, pending, { data: replies }] = await Promise.all([
    attachmentsFor(post.id),
    pendingFor(post.id),
    supabase.from("post_replies").select("id, author_id, body, created_at").eq("post_id", post.id).order("created_at"),
  ]);
  const [repliers, postMentions, replyMentions, reactions] = await Promise.all([
    peopleById(supabase, (replies ?? []).map((r: any) => r.author_id)),
    mentionsIn(supabase, "post", [post.id]),
    mentionsIn(supabase, "reply", (replies ?? []).map((r: any) => r.id)),
    reactionsFor(supabase, "post", [post.id], user!.id),
  ]);
  const replier = (id: string) => repliers.get(id);

  const room = roomById(post.room_id);
  const spec = intentById(post.intent);
  const isMine = post.author_id === user!.id;

  return (
    <Page
      title={post.title}
      lede={[spec?.label, room ? `#${room.id}` : null].filter(Boolean).join(" · ")}
      actions={
        !isMine ? <Link href={`/messages/${post.author_id}`} style={btn}>Message the author</Link> : undefined
      }
    >
      <LimitNotice show={limited} />
      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)", font: mono(11), color: "var(--mute)", display: "flex", gap: 9, alignItems: "center" }}>
              <Avatar name={author?.display_name ?? ""} url={author?.avatar_url} size={24} />
              <span>
                <PersonLink id={post.author_id}>{author?.display_name ?? "Someone"}</PersonLink>
                {author?.role_title ? ` · ${author.role_title}` : ""}
                {author?.institution ? ` · ${author.institution}` : ""} · {timeAgo(post.created_at)}
              </span>
            </div>
            {post.body && (
              <div style={{ padding: 14 }}>
                <RichText body={post.body} mentions={postMentions.get(post.id)} />
              </div>
            )}
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--rule)" }}>
              <Reactions kind="post" targetId={post.id} summary={reactions.get(post.id)} own={isMine} path={`/posts/${post.id}`} />
            </div>

            {post.intent === "collab" && (
              <div style={{ padding: 14, borderTop: "1px solid var(--rule)" }}>
                <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--signal-ink)", marginBottom: 8 }}>THE ASK</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, font: mono(12, 400, 1.6) }}>
                  <div><span style={{ color: "var(--mute)" }}>technique</span><br />{post.technique || "—"}</div>
                  <div><span style={{ color: "var(--mute)" }}>system</span><br />{post.organism || "—"}</div>
                  <div><span style={{ color: "var(--mute)" }}>by</span><br />{post.deadline || "—"}</div>
                  <div><span style={{ color: "var(--mute)" }}>offered back</span><br />{post.offer || "—"}</div>
                </div>
              </div>
            )}
          </Panel>

          {card && (
            <Panel>
              <PanelHead>Attached method card</PanelHead>
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <Outcome value={card.outcome} />
                  <span style={{ font: mono(10.5), color: "var(--mute)" }}>{card.code}</span>
                </div>
                <Link href={`/methods/${card.id}`} style={{ font: mono(14, 500), color: "var(--ink)" }}>{card.title}</Link>
                <div style={{ font: mono(11), color: "var(--mute)", marginTop: 6 }}>
                  {[card.system, card.conditions].filter(Boolean).join(" · ") || "—"}
                </div>
                {card.fails_under && (
                  <div style={{ marginTop: 11, borderLeft: "3px solid var(--signal)", background: "var(--bg)", padding: "9px 12px" }}>
                    <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--signal-ink)", marginBottom: 4 }}>FAILS UNDER</div>
                    <p style={{ font: "400 13px/1.6 var(--sans)", margin: 0 }}>{card.fails_under}</p>
                  </div>
                )}
              </div>
            </Panel>
          )}
          {attachments.map((a) => (
            <Panel key={a.id} style={a.unlocked ? undefined : { borderColor: "var(--flag)" }}>
              <PanelHead>
                {a.kind === "dataset" ? "Dataset" : "Code"} from {a.projectTitle}
                {a.unlocked ? "" : " · access on request"}
              </PanelHead>
              <div style={{ padding: 14 }}>
                <div style={{ font: mono(14, 500, 1.35) }}>{a.title}</div>
                <div style={{ font: mono(11), color: "var(--mute)", marginTop: 5 }}>{a.meta}</div>

                {a.unlocked ? (
                  <>
                    {a.detail && (
                      <p style={{ font: "400 13.5px/1.65 var(--sans)", margin: "10px 0 0" }}>{a.detail}</p>
                    )}
                    <div style={{ marginTop: 11, font: mono(10.5), color: "var(--ok)" }}>
                      {a.access === "open" ? "OPEN — anyone reading this post can open it" : "YOU HAVE ACCESS"}
                    </div>
                    {a.href && (
                      <Link href={a.href} style={{ ...btn, marginTop: 11, textDecoration: "none" }}>
                        Open {a.kind === "dataset" ? "the data" : "the code"}
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <p style={{ font: "400 13.5px/1.65 var(--sans)", color: "var(--mute)", margin: "10px 0 0" }}>
                      You can see that this exists and what shape it is. The contents stay with the author
                      until they grant you access.
                    </p>
                    {a.myRequest === "pending" ? (
                      <div style={{ marginTop: 11, font: mono(11), color: "var(--flag-ink)" }}>REQUESTED — waiting on the author</div>
                    ) : a.myRequest === "denied" ? (
                      <div style={{ marginTop: 11, font: mono(11), color: "var(--err)" }}>NOT GRANTED</div>
                    ) : (
                      <form action={requestAccess.bind(null, a.id)} style={{ marginTop: 12 }}>
                        <input
                          name="message" style={field}
                          placeholder="Why you want it — one line is enough"
                        />
                        <button type="submit" style={{ ...btnPrimary, marginTop: 9 }}>Request access</button>
                      </form>
                    )}
                  </>
                )}
              </div>
            </Panel>
          ))}

          {pending.length > 0 && (
            <Panel style={{ borderColor: "var(--signal)" }}>
              <PanelHead>Access requests · {pending.length}</PanelHead>
              {pending.map((r) => (
                <div key={r.id} style={{ padding: 14, borderBottom: "1px solid var(--rule)" }}>
                  <div style={{ font: mono(12.5, 500) }}><PersonLink id={r.requester_id}>{r.who.display_name}</PersonLink></div>
                  <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 3 }}>
                    {r.who.institution || "—"} · {timeAgo(r.created_at)}
                  </div>
                  {r.message && (
                    <p style={{ font: "400 13.5px/1.6 var(--sans)", margin: "9px 0 0" }}>{r.message}</p>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                    <form action={decideRequest.bind(null, r.id, "granted")}>
                      <button type="submit" style={{ ...btn, borderColor: "var(--ok)", color: "var(--ok)" }}>Grant access</button>
                    </form>
                    <form action={decideRequest.bind(null, r.id, "denied")}>
                      <button type="submit" style={{ ...btn, borderColor: "var(--err)", color: "var(--err)" }}>Decline</button>
                    </form>
                  </div>
                </div>
              ))}
            </Panel>
          )}
          <Panel>
            <div id="replies" style={{ scrollMarginTop: 72 }}><PanelHead>Replies · {replies?.length ?? 0}</PanelHead></div>
            {(replies?.length ?? 0) === 0 ? (
              <Empty>No replies yet. If you have run into this, say what you saw: the room keeps the answer next to the question.</Empty>
            ) : replies!.map((r: any) => {
              const who = replier(r.author_id);
              return (
                <div key={r.id} style={{ padding: 14, borderBottom: "1px solid var(--rule)" }}>
                  <div style={{ display: "flex", gap: 9, alignItems: "center", font: mono(11), color: "var(--mute)", marginBottom: 7 }}>
                    <Avatar name={who?.display_name ?? ""} url={who?.avatar_url} size={22} />
                    <span style={{ flex: 1 }}>
                      <PersonLink id={r.author_id}>{who?.display_name ?? "Someone"}</PersonLink>{who?.institution ? ` · ${who.institution}` : ""} · {timeAgo(r.created_at)}
                      {r.author_id === post.author_id && <span style={{ marginLeft: 6, color: "var(--ink)" }}>· author</span>}
                    </span>
                    {r.author_id === user!.id && (
                      <form action={deleteReply.bind(null, r.id, post.id)}>
                        <button type="submit" style={{ background: "transparent", border: 0, padding: 0, font: mono(11), color: "var(--mute)", cursor: "pointer" }}>delete</button>
                      </form>
                    )}
                  </div>
                  <RichText body={r.body} mentions={replyMentions.get(r.id)} />
                </div>
              );
            })}
            <form action={replyToPost.bind(null, post.id)} style={{ padding: 14 }}>
              <MentionTextarea name="body" rows={3} required maxLength={5000} style={field} aria-label="Your reply"
                        placeholder={isMine ? "Add to your post, or answer someone below. Type @ to mention someone." : "What you saw, and under which conditions. Type @ to mention someone."} />
              <button type="submit" style={{ ...btnPrimary, marginTop: 10 }}>Reply</button>
            </form>
          </Panel>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <PanelHead>Room</PanelHead>
            <div style={{ padding: 14 }}>
              <Link href={`/home?room=${post.room_id}`} style={{ font: mono(13.5, 500), color: "var(--ink)" }}>#{post.room_id}</Link>
              <p style={{ font: "400 13px/1.55 var(--sans)", color: "var(--mute)", margin: "6px 0 10px" }}>{room?.blurb}</p>
              <div style={{ font: mono(9.5, 700), letterSpacing: ".09em", color: "var(--mute)", marginBottom: 6 }}>APPEARS IN</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {housesOfRoom(post.room_id).map((h) => <Tag key={h.id}>{h.name}</Tag>)}
              </div>
            </div>
          </Panel>
          {isMine && (
            <details>
              <summary style={{ font: mono(11.5), color: "var(--err)", cursor: "pointer" }}>Delete this post</summary>
              <form action={deletePost.bind(null, post.id)} style={{ marginTop: 8 }}>
                <p style={{ font: "400 13px/1.5 var(--sans)", margin: "0 0 8px", color: "var(--mute)" }}>The post and its replies are removed for everyone.</p>
                <button type="submit" style={{ ...btn, borderColor: "var(--err)", color: "var(--err)" }}>Delete post and replies</button>
              </form>
            </details>
          )}
          {post.intent === "collab" && !isMine && (
            <Link href={`/messages/${post.author_id}`} style={{ ...btnPrimary, justifyContent: "center" }}>
              Offer to collaborate
            </Link>
          )}
        </aside>
      </div>
    </Page>
  );
}
