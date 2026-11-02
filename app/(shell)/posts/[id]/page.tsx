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
import PostMenu from "@/components/feed/PostMenu";
import { postExtras } from "@/lib/posts/extras";
import { canReadPost } from "@/lib/social/groups";
import { PostImages, LinkCard } from "@/components/feed/PostMedia";
import { imageUrls } from "@/lib/posts/images";
import { mentionsIn } from "@/lib/social/mentions";
import { reactionsFor } from "@/lib/social/reactions";

export const dynamic = "force-dynamic";

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
    <Page
      title={post.title}
      lede={[spec?.label, room ? `#${room.id}` : group ? `${group.name}, members only` : null].filter(Boolean).join(" · ")}
      actions={
        !isMine ? <Link href={`/messages/${post.author_id}`} style={btn}>Message the author</Link> : undefined
      }
    >
      <LimitNotice show={limited} />
      {edited && <p role="status" style={{ font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--ok)", background: "var(--surface)" }}>Your changes are saved.</p>}
      {error === "title" && <p role="alert" style={{ font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--err)", color: "var(--err)", background: "var(--surface)" }}>A post needs a title.</p>}
      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)", font: mono(11), color: "var(--mute)", display: "flex", gap: 9, alignItems: "center" }}>
              <Avatar name={author?.display_name ?? ""} url={author?.avatar_url} size={24} />
              <span>
                <PersonLink id={post.author_id}>{author?.display_name ?? "Someone"}</PersonLink>
                {author?.role_title ? ` · ${author.role_title}` : ""}
                {author?.institution ? ` · ${author.institution}` : ""} · {timeAgo(post.created_at)}
                {post.edited_at && <span title={`Edited ${String(post.edited_at).slice(0, 16).replace("T", " ")}`}> · edited</span>}
              </span>
            </div>
            {post.body && (
              <div style={{ padding: 14 }}>
                <RichText body={post.body} mentions={postMentions.get(post.id)} />
              </div>
            )}
            {isFeedback && (
              <div style={{ margin: "0 14px 14px", padding: "10px 12px", border: "1px solid var(--info)", borderRadius: 12 }}>
                <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--info)", marginBottom: 6 }}>FEEDBACK WANTED</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", font: "400 13px/1.5 var(--sans)" }}>
                  {(post.feedback_kinds ?? []).map((k: string) => <span key={k} style={{ padding: "2px 10px", borderRadius: 999, background: "color-mix(in srgb, var(--info) 10%, transparent)" }}>{feedbackLabel(k)}</span>)}
                  {(post.feedback_kinds ?? []).length === 0 && <span>Any feedback</span>}
                  {post.deadline && <span style={{ color: "var(--mute)" }}>by {post.deadline}</span>}
                </div>
                {(extra?.files ?? []).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                    {extra!.files.map((f) => (
                      <a key={f.id} href={`/api/post-files/${f.id}`} target="_blank" rel="noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 12, border: "1px solid var(--rule)", background: "var(--bg)", color: "var(--ink)", textDecoration: "none", font: "500 13px/1.3 var(--sans)" }}>
                        <span aria-hidden="true" style={{ font: mono(10, 700), color: "var(--err)" }}>{f.mime === "application/pdf" ? "PDF" : "IMG"}</span>
                        <span style={{ flex: 1, overflowWrap: "anywhere" }}>{f.name}</span>
                        <span style={{ color: "var(--mute)", fontSize: 12 }}>{fileSize(f.size_bytes)} · open</span>
                      </a>
                    ))}
                  </div>
                )}
                <p style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", margin: "10px 0 0" }}>
                  Comment below and say where: a page, a figure panel, a line. {isMine ? "Mark the comments that helped you; it counts in the helper's record." : "The author can mark your comment as the one that helped; it counts in your record."}
                </p>
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
              <PostActions postId={post.id} inGroup={!!post.group_id} own={isMine} reposted={extra?.reposted ?? false} />
              <PostMenu postId={post.id} saved={extra?.saved ?? false} own={isMine} />
              {(extra?.reposts ?? 0) > 0 && <span style={{ flexBasis: "100%", font: "400 12px/1.4 var(--sans)", color: "var(--mute)" }}>{extra!.reposts} {extra!.reposts === 1 ? "repost" : "reposts"}</span>}
            </div>
            {isMine && (
              <details id="edit" style={{ padding: "0 14px 12px" }} open={edit === "1" ? true : undefined}>
                <summary style={{ font: "500 12.5px/1.4 var(--sans)", color: "var(--link)", cursor: "pointer" }}>Edit this post</summary>
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
              <Empty>No replies yet. If you have run into this, say what you saw: the topic group keeps the answer next to the question.</Empty>
            ) : replies!.map((r: any) => {
              const who = replier(r.author_id);
              return (
                <div key={r.id} id={`reply-${r.id}`} style={{ padding: 14, borderBottom: "1px solid var(--rule)", scrollMarginTop: 72 }}>
                  <div style={{ display: "flex", gap: 9, alignItems: "center", font: mono(11), color: "var(--mute)", marginBottom: 7 }}>
                    <Avatar name={who?.display_name ?? ""} url={who?.avatar_url} size={22} />
                    <span style={{ flex: 1 }}>
                      <PersonLink id={r.author_id}>{who?.display_name ?? "Someone"}</PersonLink>{who?.institution ? ` · ${who.institution}` : ""} · {timeAgo(r.created_at)}
                      {r.anchor && <span style={{ marginLeft: 8, padding: "2px 9px", borderRadius: 999, background: "color-mix(in srgb, var(--info) 12%, transparent)", color: "var(--ink)", font: "600 11.5px/1.4 var(--sans)" }}>{r.anchor}</span>}
                      {r.helped_at && <span style={{ marginLeft: 6, padding: "2px 9px", borderRadius: 999, background: "color-mix(in srgb, var(--ok) 14%, transparent)", color: "var(--ok)", font: "600 11.5px/1.4 var(--sans)" }}>✓ Helped the author</span>}
                      {r.author_id === post.author_id && <span style={{ marginLeft: 6, color: "var(--ink)" }}>· author</span>}
                      {r.edited_at && <span> · edited</span>}
                    </span>
                    {r.author_id === user!.id && (
                      <form action={deleteReply.bind(null, r.id, post.id)}>
                        <button type="submit" style={{ background: "transparent", border: 0, padding: 0, font: mono(11), color: "var(--mute)", cursor: "pointer" }}>delete</button>
                      </form>
                    )}
                  </div>
                  <RichText body={r.body} mentions={replyMentions.get(r.id)} />
                  {isMine && r.author_id !== user!.id && (
                    <form action={markHelped.bind(null, post.id, r.id, !r.helped_at)} style={{ marginTop: 8 }}>
                      <button type="submit" style={{ ...btn, height: 28, padding: "0 12px", ...(r.helped_at ? { border: "1px solid var(--ok)", color: "var(--ok)" } : {}) }}>
                        {r.helped_at ? "✓ This helped (undo)" : "This helped"}
                      </button>
                    </form>
                  )}
                  {r.author_id === user!.id ? (
                    <details style={{ marginTop: 6 }}>
                      <summary style={{ font: "400 12px/1.4 var(--sans)", color: "var(--mute)", cursor: "pointer" }}>edit</summary>
                      <form action={editReply.bind(null, r.id, post.id)} style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                        <MentionTextarea name="body" rows={3} required maxLength={5000} defaultValue={r.body} style={field} aria-label="Edit your reply" />
                        <div><button type="submit" style={{ ...btn, height: 30 }}>Save</button></div>
                      </form>
                    </details>
                  ) : (
                    <div style={{ marginTop: 6 }}><ReportButton kind="reply" targetId={r.id} /></div>
                  )}
                </div>
              );
            })}
            <form action={replyToPost.bind(null, post.id)} style={{ padding: 14 }}>
              {isFeedback && (
                <div style={{ marginBottom: 8 }}>
                  <label htmlFor="reply-anchor" style={{ font: "600 12px/1.3 var(--sans)", color: "var(--mute)" }}>Where (optional)</label>
                  <input id="reply-anchor" name="anchor" maxLength={80} placeholder="Page 3, Fig. 2C, line 40, methods" style={{ ...field, marginTop: 4, maxWidth: 320 }} />
                </div>
              )}
              <MentionTextarea name="body" rows={3} required maxLength={5000} style={field} aria-label="Your reply"
                        placeholder={isMine ? "Add to your post, or answer someone below. Type @ to mention someone." : "What you saw, and under which conditions. Type @ to mention someone."} />
              <button type="submit" style={{ ...btnPrimary, marginTop: 10 }}>Reply</button>
            </form>
          </Panel>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {isCall && (
            <Panel style={callStatus === "open" ? { border: "1px solid var(--signal)" } : undefined}>
              <div id="call" style={{ scrollMarginTop: 72 }}><PanelHead>Call for collaborators · {callStatus === "open" ? "open" : callStatus}</PanelHead></div>
              {isMine ? (
                <>
                  <form action={setCallStatus.bind(null, post.id)} style={{ display: "flex", gap: 8, padding: 14, borderBottom: "1px solid var(--rule)", alignItems: "center", flexWrap: "wrap" }}>
                    <label htmlFor="call-status" style={{ font: "600 12px/1.3 var(--sans)", color: "var(--mute)" }}>Status</label>
                    <select id="call-status" name="status" defaultValue={callStatus} style={{ ...field, width: "auto", height: 32 }}>
                      <option value="open">Open</option><option value="filled">Filled</option><option value="closed">Closed</option>
                    </select>
                    <button type="submit" style={{ ...btn, height: 32 }}>Save</button>
                  </form>
                  <div style={{ padding: "10px 14px 4px", font: mono(9.5, 700), letterSpacing: ".09em", color: "var(--mute)" }}>INTERESTED · {visibleInterest.length}</div>
                  {visibleInterest.length === 0 && <div style={{ padding: "4px 14px 14px", font: "400 13px/1.5 var(--sans)", color: "var(--mute)" }}>Nobody yet. Only you see who answers.</div>}
                  {[...visibleInterest].sort((a: any, b: any) => Number(b.shortlisted) - Number(a.shortlisted)).map((i: any) => {
                    const p = people2.get(i.user_id);
                    return (
                      <div key={i.user_id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <Avatar name={p?.display_name ?? ""} url={p?.avatar_url} size={22} />
                          <PersonLink id={i.user_id} style={{ flex: 1, font: "600 13px/1.3 var(--sans)" }}>{p?.display_name ?? "Someone"}</PersonLink>
                          {i.shortlisted && <span style={{ font: "600 11px/1 var(--sans)", color: "var(--ok)" }}>Shortlisted</span>}
                        </div>
                        {p?.institution && <div style={{ font: "400 12px/1.4 var(--sans)", color: "var(--mute)", marginTop: 3 }}>{p.institution}</div>}
                        {i.pitch && <p style={{ font: "400 13px/1.55 var(--sans)", margin: "6px 0 0" }}>{i.pitch}</p>}
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <form action={setShortlisted.bind(null, post.id, i.user_id, !i.shortlisted)}><button type="submit" style={{ ...btn, height: 28, padding: "0 12px" }}>{i.shortlisted ? "Remove from shortlist" : "Shortlist"}</button></form>
                          <Link href={`/messages/${i.user_id}`} style={{ ...btn, height: 28, padding: "0 12px" }}>Message</Link>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : myInterest ? (
                <div style={{ padding: 14, font: "400 13px/1.55 var(--sans)" }}>
                  <div style={{ fontWeight: 600 }}>You said you are interested{myInterest.shortlisted ? ", and you are on the shortlist." : "."}</div>
                  {myInterest.pitch && <p style={{ margin: "6px 0 0", color: "var(--mute)" }}>{myInterest.pitch}</p>}
                  <form action={withdrawInterest.bind(null, post.id)} style={{ marginTop: 10 }}><button type="submit" style={{ ...btn, height: 30 }}>Withdraw</button></form>
                </div>
              ) : callStatus === "open" ? (
                <form action={expressInterest.bind(null, post.id)} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14 }}>
                  <label htmlFor="call-pitch" style={{ font: "600 12.5px/1.3 var(--sans)" }}>I&apos;m interested</label>
                  <textarea id="call-pitch" name="pitch" rows={4} maxLength={1000} style={field} placeholder="What you can do, with which system, and when. Two or three sentences." />
                  <div><button type="submit" style={btnPrimary}>Send my interest</button></div>
                  <span style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)" }}>Only the caller sees it.</span>
                </form>
              ) : (
                <div style={{ padding: 14, font: "400 13px/1.55 var(--sans)", color: "var(--mute)" }}>This call is {callStatus}. <Link href="/calls" style={{ color: "var(--link)" }}>See open calls</Link>.</div>
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
                    <div key={a.user_id} style={{ display: "flex", gap: 8, alignItems: "center", font: "400 13px/1.4 var(--sans)" }}>
                      <Avatar name={p?.display_name ?? ""} url={p?.avatar_url} size={22} />
                      <PersonLink id={a.user_id} style={{ flex: 1 }}>{p?.display_name ?? "Someone"}</PersonLink>
                      <span style={{ color: answered ? "var(--ok)" : "var(--mute)", fontSize: 12 }}>{answered ? "commented" : "not yet"}</span>
                    </div>
                  );
                })}
                <p style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", margin: 0 }}>Only {isMine ? "you and these people" : "the author and the people asked"} see this post, its files and the comments.{helpedCount ? ` ${helpedCount} comment${helpedCount === 1 ? "" : "s"} marked as helpful.` : ""}</p>
              </div>
            </Panel>
          )}
          {post.audience === "people" ? null : group ? (
            <Panel>
              <PanelHead>Group discussion</PanelHead>
              <div style={{ padding: 14 }}>
                <Link href={`/groups/${group.id}`} style={{ font: mono(13.5, 500), color: "var(--ink)" }}>{group.name}</Link>
                <p style={{ font: "400 13px/1.55 var(--sans)", color: "var(--mute)", margin: "6px 0 0" }}>Only the group&apos;s members can see this post and its replies.</p>
              </div>
            </Panel>
          ) : (
          <Panel>
            <PanelHead>Topic group</PanelHead>
            <div style={{ padding: 14 }}>
              <Link href={`/home?room=${post.room_id}`} style={{ font: mono(13.5, 500), color: "var(--ink)" }}>#{post.room_id}</Link>
              <p style={{ font: "400 13px/1.55 var(--sans)", color: "var(--mute)", margin: "6px 0 10px" }}>{room?.blurb}</p>
              <div style={{ font: mono(9.5, 700), letterSpacing: ".09em", color: "var(--mute)", marginBottom: 6 }}>APPEARS IN</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {housesOfRoom(post.room_id).map((h) => <Tag key={h.id}>{h.name}</Tag>)}
              </div>
            </div>
          </Panel>
          )}
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
