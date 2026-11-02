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
import { replyToPost, deleteReply, deletePost, editPost, editReply, markHelped } from "@/app/actions/posts";
import { expressInterest, withdrawInterest, setShortlisted, setCallStatus } from "@/app/actions/calls";
import { feedbackLabel } from "@/lib/taxonomy";
import { fileSize } from "@/lib/social/group-files";
import RichText from "@/components/RichText";
import MentionTextarea from "@/components/social/MentionTextarea";
import Reactions from "@/components/social/Reactions";
import ReportButton from "@/components/ReportButton";
import PostActions from "@/components/feed/PostActions";
import { MarkSeen } from "@/components/feed/FeedClient";
import PostMenu from "@/components/feed/PostMenu";
import { postExtras } from "@/lib/posts/extras";
import { canReadPost } from "@/lib/social/groups";
import { PostImages, LinkCard } from "@/components/feed/PostMedia";
import { imageUrls } from "@/lib/posts/images";
import { mentionsIn } from "@/lib/social/mentions";
import { reactionsFor } from "@/lib/social/reactions";

export const dynamic = "force-dynamic";

/** The kind of post as one word, as in the feed. */
const KIND: Record<string, string> = { result: "Result", data_question: "Data question", general: "Question", collab: "Call", feedback: "Feedback", update: "News" };
const KIND_COLOUR: Record<string, string> = { result: "var(--ok)", data_question: "var(--info)", general: "var(--mute)", collab: "var(--signal-ink)", feedback: "var(--info)", update: "var(--ink)" };

export default async function PostDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ limited?: string; edit?: string; edited?: string; error?: string }> }) {
  const { limited, edit, edited, error } = await searchParams;
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: post } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
  if (!post) notFound();
  const { data: { user: viewer } } = await supabase.auth.getUser();
  if (!(await canReadPost(supabase, post, viewer!.id))) notFound();
  const { data: group } = post.group_id ? await supabase.from("groups").select("id, name").eq("id", post.group_id).maybeSingle() : { data: null };

  const [{ data: author }, { data: card }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, institution, role_title, avatar_url").eq("id", post.author_id).maybeSingle(),
    post.method_card_id
      ? supabase.from("method_cards").select("id, code, title, outcome, system, conditions, fails_under").eq("id", post.method_card_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const [attachments, pending, { data: replies }] = await Promise.all([
    attachmentsFor(post.id),
    pendingFor(post.id),
    supabase.from("post_replies").select("id, author_id, body, created_at, edited_at, anchor, helped_at").eq("post_id", post.id).order("created_at"),
  ]);
  const [repliers, postMentions, replyMentions, reactions] = await Promise.all([
    peopleById(supabase, (replies ?? []).map((r: any) => r.author_id)),
    mentionsIn(supabase, "post", [post.id]),
    mentionsIn(supabase, "reply", (replies ?? []).map((r: any) => r.id)),
    reactionsFor(supabase, "post", [post.id], user!.id),
  ]);
  const [images, extras] = await Promise.all([imageUrls(supabase, [post]), postExtras(supabase, user!.id, [post.id], new Set(), reactions)]);
  const extra = extras.get(post.id);
  const isMine = post.author_id === user!.id;
  const isFeedback = post.intent === "feedback";
  const isCall = post.intent === "collab";
  // Who a feedback request was sent to (the author sees them all, a person asked sees themselves),
  // and who answered a call (the caller sees everyone, others only their own answer).
  const [{ data: asked }, { data: interest }] = await Promise.all([
    post.audience === "people" ? supabase.from("post_audience").select("user_id").eq("post_id", post.id) : Promise.resolve({ data: [] as any[] }),
    isCall ? supabase.from("call_interest").select("user_id, pitch, shortlisted, created_at").eq("post_id", post.id).order("created_at") : Promise.resolve({ data: [] as any[] }),
  ]);
  const visibleAsked = (asked ?? []).filter((a: any) => isMine || a.user_id === user!.id);
  const visibleInterest = (interest ?? []).filter((i: any) => isMine || i.user_id === user!.id);
  const people2 = await peopleById(supabase, [...visibleAsked.map((a: any) => a.user_id), ...visibleInterest.map((i: any) => i.user_id)]);
  const myInterest = visibleInterest.find((i: any) => i.user_id === user!.id);
  const callStatus = post.call_status ?? "open";
  const helpedCount = (replies ?? []).filter((r: any) => r.helped_at).length;
  const replier = (id: string) => repliers.get(id);

  const room = roomById(post.room_id);
  const spec = intentById(post.intent);

  return (
    <div style={{ padding: "20px 16px 64px" }}>
    <MarkSeen id={post.id} />
    <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Where it lives, as a way back: the feed and its topic, or the group. */}
      <div style={{ font: "400 13px/1.5 var(--sans)", color: "var(--mute)" }}>
        {group ? <Link href={`/groups/${group.id}?tab=feed`} style={{ color: "var(--mute)", textDecoration: "none" }}>← {group.name}</Link>
          : <><Link href="/home" style={{ color: "var(--mute)", textDecoration: "none" }}>← Feed</Link>{room && <> · <Link href={`/home?room=${room.id}`} style={{ color: "var(--mute)" }}>#{room.id}</Link></>}</>}
      </div>
      <LimitNotice show={limited} />
      {edited && <p role="status" style={{ font: "400 13.5px/1.6 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--ok)", background: "var(--surface)" }}>Your changes are saved.</p>}
      {error === "title" && <p role="alert" style={{ font: "400 13.5px/1.6 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--err)", color: "var(--err)", background: "var(--surface)" }}>A post needs a title.</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <div style={{ padding: "14px 16px 0", display: "flex", gap: 10, alignItems: "center" }}>
              <Avatar name={author?.display_name ?? ""} url={author?.avatar_url} size={32} />
              <div style={{ flex: 1, minWidth: 0, font: "400 12.5px/1.55 var(--sans)", color: "var(--mute)" }}>
                <PersonLink id={post.author_id} style={{ font: "600 13.5px/1.55 var(--sans)", color: "var(--ink)" }}>{author?.display_name ?? "Someone"}</PersonLink>
                {author?.institution && <> · <span title={author.institution}>{author.institution.includes(",") ? author.institution.slice(author.institution.lastIndexOf(",") + 1).trim() : author.institution}</span></>}
                {" · "}{timeAgo(post.created_at)}{post.edited_at ? " · edited" : ""}
                {" · "}<span style={{ fontWeight: 600, color: KIND_COLOUR[post.intent] ?? "var(--mute)" }}>{KIND[post.intent] ?? spec?.label}</span>
                {" · "}{group ? group.name : post.audience === "people" ? "only for the people asked" : room ? `#${room.id}` : ""}
              </div>
              {!isMine && <Link href={`/messages/${post.author_id}`} style={{ font: "600 12.5px/1 var(--sans)", color: "var(--link)", textDecoration: "none" }}>Message</Link>}
              <PostMenu postId={post.id} saved={extra?.saved ?? false} own={isMine} />
            </div>
            <h1 style={{ font: "700 21px/1.4 var(--sans)", letterSpacing: "-.01em", margin: 0, padding: "12px 16px 0" }}>{post.title}</h1>
            {post.body && (
              <div style={{ padding: "8px 16px 14px" }}>
                <RichText body={post.body} mentions={postMentions.get(post.id)} />
              </div>
            )}
            {isFeedback && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: "0 16px 14px", font: "500 12.5px/1.4 var(--sans)", color: "var(--mute)" }}>
                {(post.feedback_kinds ?? []).map((k: string) => <span key={k} style={{ padding: "5px 10px", borderRadius: 999, background: "color-mix(in srgb, var(--info) 10%, transparent)", color: "var(--ink)" }}>{feedbackLabel(k)}</span>)}
                {post.deadline && <span>by {post.deadline}</span>}
                {(extra?.files ?? []).map((f) => (
                  <a key={f.id} href={`/api/post-files/${f.id}`} target="_blank" rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--bg)", color: "var(--ink)", textDecoration: "none" }}>
                    <span aria-hidden="true" style={{ font: mono(9, 700), color: "var(--err)" }}>{f.mime === "application/pdf" ? "PDF" : "IMG"}</span>{f.name}
                    <span style={{ color: "var(--mute)" }}>{fileSize(f.size_bytes)}</span>
                  </a>
                ))}
              </div>
            )}
            {(images.get(post.id) || post.link_preview) && (
              <div style={{ padding: "0 14px 14px" }}>
                <PostImages urls={images.get(post.id)} title={post.title} />
                <LinkCard preview={post.link_preview} />
              </div>
            )}
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--rule)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Reactions kind="post" targetId={post.id} summary={reactions.get(post.id)} own={isMine} path={`/posts/${post.id}`} />
              <span style={{ flex: 1 }} />
              <PostActions postId={post.id} inGroup={!!post.group_id} own={isMine} reposted={extra?.reposted ?? false} replyInPlace={false} />
              {(extra?.reposts ?? 0) > 0 && <span style={{ flexBasis: "100%", font: "400 12px/1.5 var(--sans)", color: "var(--mute)" }}>{extra!.reposts} {extra!.reposts === 1 ? "repost" : "reposts"}</span>}
            </div>
            {isMine && (
              <details id="edit" style={{ padding: "0 14px 12px" }} open={edit === "1" ? true : undefined}>
                <summary style={{ listStyle: "none", cursor: "pointer", width: "fit-content", height: 32, padding: "0 14px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", display: "flex", alignItems: "center", font: "600 12.5px/1 var(--sans)", color: "var(--ink)" }}>Edit this post</summary>
                <form action={editPost.bind(null, post.id)} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  <label htmlFor="edit-title" style={{ position: "absolute", left: -9999 }}>Title</label>
                  <input id="edit-title" name="title" required maxLength={200} defaultValue={post.title} style={field} />
                  <label htmlFor="edit-body" style={{ position: "absolute", left: -9999 }}>Text</label>
                  <MentionTextarea id="edit-body" name="body" rows={6} maxLength={10000} defaultValue={post.body ?? ""} style={field} />
                  <div><button type="submit" style={btnPrimary}>Save changes</button></div>
                </form>
              </details>
            )}

            {post.intent === "collab" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: "0 16px 14px", font: "500 12.5px/1.4 var(--sans)", color: "var(--mute)" }}>
                {post.technique && <span style={{ padding: "5px 10px", borderRadius: 999, background: "color-mix(in srgb, var(--signal) 10%, transparent)", color: "var(--ink)" }}>{post.technique}</span>}
                {post.organism && <span style={{ padding: "5px 10px", borderRadius: 999, background: "color-mix(in srgb, var(--signal) 10%, transparent)", color: "var(--ink)" }}>{post.organism}</span>}
                {post.deadline && <span>by {post.deadline}</span>}
                {post.offer && <span>· offers {post.offer}</span>}
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
                    <p style={{ font: "400 13px/1.7 var(--sans)", margin: 0 }}>{card.fails_under}</p>
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
                <div style={{ font: mono(14, 500, 1.45) }}>{a.title}</div>
                <div style={{ font: mono(11), color: "var(--mute)", marginTop: 5 }}>{a.meta}</div>

                {a.unlocked ? (
                  <>
                    {a.detail && (
                      <p style={{ font: "400 13.5px/1.75 var(--sans)", margin: "10px 0 0" }}>{a.detail}</p>
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
                    <p style={{ font: "400 13.5px/1.75 var(--sans)", color: "var(--mute)", margin: "10px 0 0" }}>
                      The author decides who gets access. </p>
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
                    <p style={{ font: "400 13.5px/1.7 var(--sans)", margin: "9px 0 0" }}>{r.message}</p>
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
              <Empty>No replies yet. Seen this before? Say what you saw.</Empty>
            ) : replies!.map((r: any) => {
              const who = replier(r.author_id);
              return (
                <div key={r.id} id={`reply-${r.id}`} style={{ padding: 14, borderBottom: "1px solid var(--rule)", scrollMarginTop: 72 }}>
                  <div style={{ display: "flex", gap: 9, alignItems: "center", font: "400 12.5px/1.55 var(--sans)", color: "var(--mute)", marginBottom: 6 }}>
                    <Avatar name={who?.display_name ?? ""} url={who?.avatar_url} size={26} />
                    <span style={{ flex: 1 }}>
                      <PersonLink id={r.author_id} style={{ font: "600 13px/1.55 var(--sans)", color: "var(--ink)" }}>{who?.display_name ?? "Someone"}</PersonLink> · {timeAgo(r.created_at)}
                      {r.anchor && <span style={{ marginLeft: 8, padding: "2px 9px", borderRadius: 999, background: "color-mix(in srgb, var(--info) 12%, transparent)", color: "var(--ink)", font: "600 11.5px/1.5 var(--sans)" }}>{r.anchor}</span>}
                      {r.helped_at && <span style={{ marginLeft: 6, padding: "2px 9px", borderRadius: 999, background: "color-mix(in srgb, var(--ok) 14%, transparent)", color: "var(--ok)", font: "600 11.5px/1.5 var(--sans)" }}>✓ Helped the author</span>}
                      {r.author_id === post.author_id && <span style={{ marginLeft: 6, color: "var(--ink)" }}>· author</span>}
                      {r.edited_at && <span> · edited</span>}
                    </span>
                    {/* Edit and delete (yours) or report (others') behind one ··· per reply. */}
                    <details style={{ position: "relative" }}>
                      <summary aria-label="More for this reply" style={{ listStyle: "none", cursor: "pointer", width: 28, height: 28, borderRadius: 999, display: "grid", placeItems: "center", color: "var(--mute)", font: "700 15px/1 var(--sans)" }}>···</summary>
                      <div style={{ position: "absolute", right: 0, top: 32, zIndex: 20, width: "min(320px, 80vw)", padding: 10, borderRadius: 14, border: "1px solid var(--rule)", background: "color-mix(in srgb, var(--bg) 94%, transparent)", boxShadow: "0 12px 36px rgba(31, 38, 60, .16)", display: "flex", flexDirection: "column", gap: 8 }}>
                        {r.author_id === user!.id ? (
                          <>
                            <form action={editReply.bind(null, r.id, post.id)} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <MentionTextarea name="body" rows={3} required maxLength={5000} defaultValue={r.body} style={field} aria-label="Edit your reply" />
                              <div><button type="submit" style={{ ...btn, height: 30, borderRadius: 999 }}>Save</button></div>
                            </form>
                            <form action={deleteReply.bind(null, r.id, post.id)}>
                              <button type="submit" style={{ border: 0, background: "none", padding: 0, color: "var(--err)", font: "500 13px/1.5 var(--sans)", cursor: "pointer" }}>Delete this reply</button>
                            </form>
                          </>
                        ) : <ReportButton kind="reply" targetId={r.id} label="Report this reply" />}
                      </div>
                    </details>
                  </div>
                  <RichText body={r.body} mentions={replyMentions.get(r.id)} />
                  {isMine && r.author_id !== user!.id && (
                    <form action={markHelped.bind(null, post.id, r.id, !r.helped_at)} style={{ marginTop: 8 }}>
                      <button type="submit" style={{ ...btn, height: 28, padding: "0 12px", ...(r.helped_at ? { border: "1px solid var(--ok)", color: "var(--ok)" } : {}) }}>
                        {r.helped_at ? "✓ This helped (undo)" : "This helped"}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
            <form action={replyToPost.bind(null, post.id)} style={{ padding: 14 }}>
              {isFeedback && (
                <div style={{ marginBottom: 8 }}>
                  <label htmlFor="reply-anchor" style={{ font: "600 12px/1.4 var(--sans)", color: "var(--mute)" }}>Where (optional)</label>
                  <input id="reply-anchor" name="anchor" maxLength={80} placeholder="Page 3, Fig. 2C, line 40, methods" style={{ ...field, marginTop: 4, maxWidth: 320 }} />
                </div>
              )}
              <MentionTextarea name="body" rows={3} required maxLength={5000} style={field} aria-label="Your reply"
                        placeholder={isMine ? "Add to your post, or answer someone below. Type @ to mention someone." : "What you saw, and under which conditions. Type @ to mention someone."} />
              <button type="submit" style={{ ...btnPrimary, marginTop: 10 }}>Reply</button>
            </form>
          </Panel>



          {isCall && (
            <Panel style={callStatus === "open" ? { border: "1px solid var(--signal)" } : undefined}>
              <div id="call" style={{ scrollMarginTop: 72 }}><PanelHead>Call for collaborators · {callStatus === "open" ? "open" : callStatus}</PanelHead></div>
              {isMine ? (
                <>
                  <form action={setCallStatus.bind(null, post.id)} style={{ display: "flex", gap: 8, padding: 14, borderBottom: "1px solid var(--rule)", alignItems: "center", flexWrap: "wrap" }}>
                    <label htmlFor="call-status" style={{ font: "600 12px/1.4 var(--sans)", color: "var(--mute)" }}>Status</label>
                    <select id="call-status" name="status" defaultValue={callStatus} style={{ ...field, width: "auto", height: 32 }}>
                      <option value="open">Open</option><option value="filled">Filled</option><option value="closed">Closed</option>
                    </select>
                    <button type="submit" style={{ ...btn, height: 32 }}>Save</button>
                  </form>
                  <div style={{ padding: "10px 14px 4px", font: mono(9.5, 700), letterSpacing: ".09em", color: "var(--mute)" }}>INTERESTED · {visibleInterest.length}</div>
                  {visibleInterest.length === 0 && <div style={{ padding: "4px 14px 14px", font: "400 13px/1.6 var(--sans)", color: "var(--mute)" }}>Nobody yet. Only you see who answers.</div>}
                  {[...visibleInterest].sort((a: any, b: any) => Number(b.shortlisted) - Number(a.shortlisted)).map((i: any) => {
                    const p = people2.get(i.user_id);
                    return (
                      <div key={i.user_id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <Avatar name={p?.display_name ?? ""} url={p?.avatar_url} size={22} />
                          <PersonLink id={i.user_id} style={{ flex: 1, font: "600 13px/1.4 var(--sans)" }}>{p?.display_name ?? "Someone"}</PersonLink>
                          {i.shortlisted && <span style={{ font: "600 11px/1 var(--sans)", color: "var(--ok)" }}>Shortlisted</span>}
                        </div>
                        {p?.institution && <div style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)", marginTop: 3 }}>{p.institution}</div>}
                        {i.pitch && <p style={{ font: "400 13px/1.65 var(--sans)", margin: "6px 0 0" }}>{i.pitch}</p>}
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <form action={setShortlisted.bind(null, post.id, i.user_id, !i.shortlisted)}><button type="submit" style={{ ...btn, height: 28, padding: "0 12px" }}>{i.shortlisted ? "Remove from shortlist" : "Shortlist"}</button></form>
                          <Link href={`/messages/${i.user_id}`} style={{ ...btn, height: 28, padding: "0 12px" }}>Message</Link>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : myInterest ? (
                <div style={{ padding: 14, font: "400 13px/1.65 var(--sans)" }}>
                  <div style={{ fontWeight: 600 }}>You said you are interested{myInterest.shortlisted ? ", and you are on the shortlist." : "."}</div>
                  {myInterest.pitch && <p style={{ margin: "6px 0 0", color: "var(--mute)" }}>{myInterest.pitch}</p>}
                  <form action={withdrawInterest.bind(null, post.id)} style={{ marginTop: 10 }}><button type="submit" style={{ ...btn, height: 30 }}>Withdraw</button></form>
                </div>
              ) : callStatus === "open" ? (
                <form action={expressInterest.bind(null, post.id)} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14 }}>
                  <label htmlFor="call-pitch" style={{ font: "600 12.5px/1.4 var(--sans)" }}>I&apos;m interested</label>
                  <textarea id="call-pitch" name="pitch" rows={4} maxLength={1000} style={field} placeholder="What you can do, with which system, and when. Two or three sentences." />
                  <div><button type="submit" style={btnPrimary}>Send my interest</button></div>
                  <span style={{ font: "400 12px/1.6 var(--sans)", color: "var(--mute)" }}>Only the caller sees it.</span>
                </form>
              ) : (
                <div style={{ padding: 14, font: "400 13px/1.65 var(--sans)", color: "var(--mute)" }}>This call is {callStatus}. <Link href="/calls" style={{ color: "var(--link)" }}>See open calls</Link>.</div>
              )}
            </Panel>
          )}
          {post.audience === "people" && (
            <Panel>
              <PanelHead>{isMine ? `Asked for feedback · ${visibleAsked.length}` : "You were asked for feedback"}</PanelHead>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {isMine && visibleAsked.map((a: any) => {
                  const p = people2.get(a.user_id);
                  const answered = (replies ?? []).some((r: any) => r.author_id === a.user_id);
                  return (
                    <div key={a.user_id} style={{ display: "flex", gap: 8, alignItems: "center", font: "400 13px/1.5 var(--sans)" }}>
                      <Avatar name={p?.display_name ?? ""} url={p?.avatar_url} size={22} />
                      <PersonLink id={a.user_id} style={{ flex: 1 }}>{p?.display_name ?? "Someone"}</PersonLink>
                      <span style={{ color: answered ? "var(--ok)" : "var(--mute)", fontSize: 12 }}>{answered ? "commented" : "not yet"}</span>
                    </div>
                  );
                })}
                <p style={{ font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)", margin: 0 }}>Only {isMine ? "you and these people" : "the author and the people asked"} see this post, its files and the comments.{helpedCount ? ` ${helpedCount} comment${helpedCount === 1 ? "" : "s"} marked as helpful.` : ""}</p>
              </div>
            </Panel>
          )}
          {isMine && (
            <details>
              <summary style={{ listStyle: "none", cursor: "pointer", width: "fit-content", height: 32, padding: "0 14px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", display: "flex", alignItems: "center", font: "600 12.5px/1 var(--sans)", color: "var(--err)" }}>Delete this post</summary>
              <form action={deletePost.bind(null, post.id)} style={{ marginTop: 8 }}>
                <p style={{ font: "400 13px/1.6 var(--sans)", margin: "0 0 8px", color: "var(--mute)" }}>The post and its replies are removed for everyone.</p>
                <button type="submit" style={{ ...btn, borderColor: "var(--err)", color: "var(--err)" }}>Delete post and replies</button>
              </form>
            </details>
          )}
        </div>
    </div>
    </div>
  );
}
