import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRowId } from "@/lib/query";
import { peopleById } from "@/lib/people";
import { followingOf } from "@/lib/social/follows";
import { activityOf } from "@/lib/social/activity";
import { reactionsFor } from "@/lib/social/reactions";
import { imageUrls } from "@/lib/posts/images";
import { ROLE_LABEL, canManage, isCurrent, type GroupRole } from "@/lib/social/groups";
import {
  joinGroup, leaveGroup, removeMember, addMember, setRole, addGroupProject, removeGroupProject, updateGroup, deleteGroup,
  requestToJoin, withdrawRequest, answerRequest, createInvite, revokeInvite,
} from "@/app/actions/groups";
import { joinProject } from "@/app/actions/projects";
import { Page, Panel, PanelHead, Empty, btn, btnPrimary, field, fieldLabel, mono } from "@/components/ui";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/social/FollowButton";
import ActivityList from "@/components/social/ActivityList";
import QuickPost from "@/components/feed/QuickPost";
import PostCard from "@/components/feed/PostCard";
import CopyLink from "@/components/CopyLink";

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  "saved=1":         { text: "Group saved." },
  "requested=1":     { text: "Request sent. The lead and admins see it on this page and in their notifications." },
  "added=1":         { text: "Member added." },
  "posted=1":        { text: "Posted to the group. Only members see it." },
  "welcome=1":       { text: "Welcome to the group." },
  "left=1":          { text: "You left the group. You are listed as alumni, so your work stays credited; ask to join again any time." },
  "mailed=1":        { text: "The invitation was e-mailed." },
  "mailed=0":        { text: "The invitation link is ready, but no e-mail could be sent from this server. Copy the link and send it yourself.", error: true },
  "error=closed":    { text: "This group is closed: ask to join below.", error: true },
  "error=lastowner": { text: "You are the last lead. Make someone else a lead first, or delete the group.", error: true },
  "error=leadonly":  { text: "Only a lead can make or change leads.", error: true },
  "error=person":    { text: "Pick a person from the list.", error: true },
  "error=name":      { text: "A group needs a name of at least two characters.", error: true },
  "error=email":     { text: "That does not look like an e-mail address.", error: true },
  "error=confirm":   { text: "Type DELETE to confirm deleting the group.", error: true },
};

const small = { ...btn, height: 28, padding: "0 10px" };
const ORDER: GroupRole[] = ["owner", "admin", "member", "guest", "alumni"];

/** One group: its discussion (members only), who is in it and in which role,
 *  the projects they share, invitations and requests, and what they did lately. */
export default async function Group({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isRowId(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;

  const { data: g } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
  if (!g) notFound();

  const [{ data: members }, { data: gp }, following, { data: myProjects }, { data: requests }] = await Promise.all([
    supabase.from("group_members").select("user_id, role, joined_at").eq("group_id", id),
    supabase.from("group_projects").select("project_id, added_by").eq("group_id", id),
    followingOf(supabase, me),
    supabase.from("project_members").select("project_id").eq("user_id", me),
    // Admins see every request; anyone else only their own (RLS, supabase/10-journeys.sql).
    supabase.from("group_requests").select("user_id, message, created_at").eq("group_id", id),
  ]);
  const myRole = (members ?? []).find((m: any) => m.user_id === me)?.role as GroupRole | undefined;
  const member = isCurrent(myRole);
  const manage = canManage(myRole);
  const lead = myRole === "owner";
  const current = (members ?? []).filter((m: any) => m.role !== "alumni");
  const alumni = (members ?? []).filter((m: any) => m.role === "alumni");
  const memberIds = (members ?? []).map((m: any) => m.user_id);
  const projectIds = [...new Set([...(gp ?? []).map((p: any) => p.project_id), ...(myProjects ?? []).map((p: any) => p.project_id)])];

  const [people, { data: projects }, activity, { data: everyone }, { data: posts }, { data: invites }] = await Promise.all([
    peopleById(supabase, [...memberIds, ...(requests ?? []).map((r: any) => r.user_id)]),
    projectIds.length ? supabase.from("projects").select("id, title, summary, status").in("id", projectIds) : Promise.resolve({ data: [] as any[] }),
    activityOf(supabase, current.map((m: any) => m.user_id), { viewer: me, limit: 8 }),
    manage ? supabase.from("profiles").select("id, display_name, institution").order("display_name").limit(1000) : Promise.resolve({ data: [] as any[] }),
    // The discussion is for current members only (the database enforces it too).
    member
      ? supabase.from("posts").select("id, author_id, room_id, group_id, intent, title, body, method_card_id, technique, organism, deadline, offer, images, link_preview, created_at")
          .eq("group_id", id).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] as any[] }),
    manage ? supabase.from("group_invites").select("token, role, email, max_uses, uses, expires_at").eq("group_id", id) : Promise.resolve({ data: [] as any[] }),
  ]);
  const postIds = (posts ?? []).map((p: any) => p.id);
  const [authors, reactions, images, { data: replies }] = await Promise.all([
    peopleById(supabase, (posts ?? []).map((p: any) => p.author_id)),
    reactionsFor(supabase, "post", postIds, me),
    imageUrls(supabase, posts ?? []),
    postIds.length ? supabase.from("post_replies").select("post_id").in("post_id", postIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const onProject = new Set((myProjects ?? []).map((p: any) => p.project_id));
  const shared = (gp ?? []).map((p: any) => ({ ...p, project: (projects ?? []).find((x: any) => x.id === p.project_id) })).filter((p: any) => p.project);
  const addable = (myProjects ?? []).map((p: any) => (projects ?? []).find((x: any) => x.id === p.project_id))
    .filter((p: any) => p && !shared.some((s: any) => s.project_id === p.id));
  const sorted = [...current].sort((a: any, b: any) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role));
  const liveInvites = (invites ?? []).filter((i: any) => new Date(i.expires_at) >= new Date() && i.uses < i.max_uses);
  const h = await headers();
  const origin = process.env.SCICOLLAB_SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const flashKey = Object.keys(FLASH).find((k) => { const [key, v] = k.split("="); return sp[key] === v; });
  const flash = flashKey ? FLASH[flashKey] : null;
  const newInvite = sp.invite && liveInvites.find((i: any) => i.token === sp.invite);

  return (
    <Page
      title={g.name}
      lede={[g.institution, `${g.access === "open" ? "Open group" : "Closed group"}, ${current.length} member${current.length === 1 ? "" : "s"}${alumni.length ? `, ${alumni.length} alumni` : ""}`].filter(Boolean).join(" · ")}
      actions={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/groups" style={btn}>All groups</Link>
          {!member && g.access === "open" && (
            <form action={joinGroup.bind(null, id)}><button type="submit" style={btnPrimary}>{myRole === "alumni" ? "Rejoin group" : "Join group"}</button></form>
          )}
          {member && (
            <form action={leaveGroup.bind(null, id)}><button type="submit" style={btn} title="You stay listed as alumni, so your work stays credited.">Leave</button></form>
          )}
        </div>
      }
    >
      {flash && (
        <p role={flash.error ? "alert" : "status"} style={{ font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: `1px solid ${flash.error ? "var(--err)" : "var(--ok)"}`, background: "var(--surface)" }}>{flash.text}</p>
      )}
      {g.description && <p style={{ font: "400 14px/1.7 var(--sans)", margin: "0 0 16px", maxWidth: "72ch", whiteSpace: "pre-wrap" }}>{g.description}</p>}
      {myRole && <p style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", margin: "-8px 0 14px" }}>You are {myRole === "alumni" ? "listed as alumni" : `a ${ROLE_LABEL[myRole].toLowerCase()}`} of this group.</p>}
      {!member && g.access === "closed" && (
        (requests ?? []).some((r: any) => r.user_id === me) ? (
          <form action={withdrawRequest.bind(null, id)} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 0 16px", font: "400 13.5px/1.6 var(--sans)" }}>
            <span>You asked to join. The lead and admins decide.</span>
            <button type="submit" style={{ ...btn, height: 30 }}>Withdraw request</button>
          </form>
        ) : (
          <form action={requestToJoin.bind(null, id)} className="sc-soft" style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", margin: "0 0 16px", padding: 12, border: "1px solid var(--rule)", background: "var(--surface)" }}>
            <div style={{ flex: "1 1 280px" }}>
              <label style={fieldLabel} htmlFor="join-msg">{myRole === "alumni" ? "Ask to rejoin" : "This group is closed. Ask to join"}, with a line for the lead (optional)</label>
              <input id="join-msg" name="message" maxLength={500} style={field} placeholder="I work on the passage comparison with Temi." />
            </div>
            <button type="submit" style={btnPrimary}>Ask to join</button>
          </form>
        )
      )}

      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {member ? (
            <section aria-label="Group discussion" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 style={{ font: mono(14, 700), margin: 0 }}>Discussion <span style={{ font: "400 12.5px/1 var(--sans)", color: "var(--mute)" }}>· members only</span></h2>
              <QuickPost topics={[]} cards={[]} groupId={id} groupName={g.name} />
              {(posts ?? []).length === 0 && <Panel><Empty>No posts yet. Start the conversation: an update, a question, a request for the lab.</Empty></Panel>}
              {(posts ?? []).map((p: any) => (
                <PostCard key={p.id} p={p} author={authors.get(p.author_id)} images={images.get(p.id)} reaction={reactions.get(p.id)}
                  replies={(replies ?? []).filter((r: any) => r.post_id === p.id).length} me={me} path={`/groups/${id}`}
                  topicHref={(r) => `/home?room=${r}`} group={null} />
              ))}
            </section>
          ) : (
            <Panel style={{ padding: 14 }}>
              <span style={{ font: "400 13.5px/1.6 var(--sans)", color: "var(--mute)" }}>The group&apos;s discussion is visible to its members only.</span>
            </Panel>
          )}

          <Panel>
            <PanelHead>Shared projects · {shared.length}</PanelHead>
            {shared.length === 0 && <div style={{ padding: "12px 14px", font: "400 13px/1.6 var(--sans)", color: "var(--mute)" }}>No projects shared with the group yet.</div>}
            {shared.map((s: any) => (
              <div key={s.project_id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid var(--rule)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/projects/${s.project_id}`} style={{ font: mono(13, 600), color: "var(--ink)" }}>{s.project.title}</Link>
                  {s.project.summary && <div style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", marginTop: 3 }}>{String(s.project.summary).slice(0, 160)}</div>}
                </div>
                {member && !onProject.has(s.project_id) && (
                  <form action={joinProject.bind(null, s.project_id)}><button type="submit" style={{ ...small, background: "var(--ink)", color: "var(--bg)" }}>Join project</button></form>
                )}
                {onProject.has(s.project_id) && <span style={{ font: mono(10.5), color: "var(--ok)" }}>you are on it</span>}
                {(s.added_by === me || manage) && (
                  <form action={removeGroupProject.bind(null, id, s.project_id)}><button type="submit" style={small}>Unshare</button></form>
                )}
              </div>
            ))}
            {member && addable.length > 0 && (
              <form action={addGroupProject.bind(null, id)} style={{ display: "flex", gap: 8, padding: 14, flexWrap: "wrap" }}>
                <label htmlFor="g-project" style={{ position: "absolute", left: -9999 }}>Project to share</label>
                <select id="g-project" name="project" style={{ ...field, flex: "1 1 220px", width: "auto" }}>
                  {addable.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <button type="submit" style={btn}>Share with the group</button>
                <span style={{ flexBasis: "100%", font: "400 12px/1.5 var(--sans)", color: "var(--mute)" }}>Members of the group can then see it and join it.</span>
              </form>
            )}
          </Panel>

          <Panel>
            <PanelHead>Recent activity</PanelHead>
            <ActivityList items={activity} empty="Nothing from the members in the last 60 days." />
          </Panel>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {manage && (requests?.length ?? 0) > 0 && (
            <Panel style={{ borderColor: "var(--signal)" }}>
              <div id="requests" style={{ scrollMarginTop: 72 }}><PanelHead>Requests to join · {requests!.length}</PanelHead></div>
              {requests!.map((r: any) => {
                const p = people.get(r.user_id);
                return (
                  <div key={r.user_id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Avatar name={p?.display_name ?? ""} url={p?.avatar_url} size={26} />
                      <Link href={`/people/${r.user_id}`} style={{ flex: 1, font: mono(12.5, 500), color: "var(--ink)" }}>{p?.display_name ?? "Someone"}</Link>
                    </div>
                    {r.message && <p style={{ font: "400 13px/1.5 var(--sans)", margin: "6px 0 0" }}>{r.message}</p>}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <form action={answerRequest.bind(null, id, r.user_id, true)}><button type="submit" style={{ ...small, background: "var(--ink)", color: "var(--bg)" }}>Let in</button></form>
                      <form action={answerRequest.bind(null, id, r.user_id, false)}><button type="submit" style={small}>Decline</button></form>
                    </div>
                  </div>
                );
              })}
            </Panel>
          )}

          <Panel>
            <div id="members" style={{ scrollMarginTop: 72 }}><PanelHead>Members · {current.length}</PanelHead></div>
            {sorted.length === 0 && <Empty>No members.</Empty>}
            {sorted.map((m: any) => {
              const p = people.get(m.user_id);
              const editable = manage && m.user_id !== me && (m.role !== "owner" || lead);
              return (
                <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
                  <Avatar name={p?.display_name ?? ""} url={p?.avatar_url} size={26} />
                  <div style={{ flex: "1 1 120px", minWidth: 0 }}>
                    <Link href={`/people/${m.user_id}`} style={{ font: mono(12.5, 500), color: "var(--ink)" }}>{p?.display_name ?? "Someone"}</Link>
                    {!editable && m.role !== "member" && <span className="sc-badge" style={{ font: mono(10), color: "var(--mute)", marginLeft: 6, padding: "1px 6px", border: "1px solid var(--rule)" }}>{ROLE_LABEL[m.role as GroupRole]}</span>}
                  </div>
                  {editable ? (
                    <form action={setRole.bind(null, id, m.user_id)} style={{ display: "flex", gap: 6 }}>
                      <label htmlFor={`role-${m.user_id}`} style={{ position: "absolute", left: -9999 }}>Role of {p?.display_name}</label>
                      <select id={`role-${m.user_id}`} name="role" defaultValue={m.role} style={{ ...field, width: "auto", height: 28, padding: "0 6px" }}>
                        {(lead ? ORDER : ORDER.filter((r) => r !== "owner")).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                      <button type="submit" style={small}>Set</button>
                    </form>
                  ) : m.user_id !== me ? <FollowButton personId={m.user_id} following={following.has(m.user_id)} compact /> : null}
                  {editable && (
                    <form action={removeMember.bind(null, id, m.user_id)}><button type="submit" style={small} aria-label={`Remove ${p?.display_name ?? "member"} entirely`} title="Remove entirely (to keep them credited, set them to Alumni instead)">×</button></form>
                  )}
                </div>
              );
            })}
            {manage && (
              <form action={addMember.bind(null, id)} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={fieldLabel} htmlFor="g-person">Add someone already on SciCollab</label>
                <select id="g-person" name="person" required style={field} defaultValue="">
                  <option value="" disabled>Choose a person</option>
                  {(everyone ?? []).filter((p: any) => !memberIds.includes(p.id) || alumni.some((a: any) => a.user_id === p.id)).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.display_name}{p.institution ? `, ${p.institution}` : ""}</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <label htmlFor="g-person-role" style={{ position: "absolute", left: -9999 }}>Role</label>
                  <select id="g-person-role" name="role" defaultValue="member" style={{ ...field, width: "auto" }}>
                    {(lead ? ["owner", "admin", "member", "guest"] : ["admin", "member", "guest"]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r as GroupRole]}</option>)}
                  </select>
                  <button type="submit" style={btn}>Add</button>
                </div>
              </form>
            )}
          </Panel>

          {alumni.length > 0 && (
            <Panel>
              <PanelHead>Alumni · {alumni.length}</PanelHead>
              <div style={{ padding: "8px 14px 4px", font: "400 12px/1.5 var(--sans)", color: "var(--mute)" }}>Former members. Their methods, data and posts stay with the group and credited to them.</div>
              {alumni.map((m: any) => {
                const p = people.get(m.user_id);
                return (
                  <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 14px", borderBottom: "1px solid var(--rule)" }}>
                    <Avatar name={p?.display_name ?? ""} url={p?.avatar_url} size={22} />
                    <Link href={`/people/${m.user_id}`} style={{ flex: 1, font: mono(12, 500), color: "var(--ink)" }}>{p?.display_name ?? "Someone"}</Link>
                    {manage && (
                      <form action={setRole.bind(null, id, m.user_id)}>
                        <input type="hidden" name="role" value="member" />
                        <button type="submit" style={small}>Make member again</button>
                      </form>
                    )}
                  </div>
                );
              })}
            </Panel>
          )}

          {manage && (
            <Panel>
              <div id="invite" style={{ scrollMarginTop: 72 }}><PanelHead>Invite people</PanelHead></div>
              {newInvite && (
                <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--rule)", background: "color-mix(in srgb, var(--ok) 8%, transparent)" }}>
                  <div style={{ font: "600 13px/1.4 var(--sans)", marginBottom: 6 }}>Your invitation link{newInvite.email ? ` for ${newInvite.email}` : ""}</div>
                  <CopyLink url={`${origin}/join/${newInvite.token}`} />
                </div>
              )}
              <form action={createInvite.bind(null, id)} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={fieldLabel} htmlFor="inv-email">E-mail (optional: leave empty for a link to share)</label>
                  <input id="inv-email" name="email" type="email" style={field} placeholder="new.phd@institution.edu" />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <label style={{ font: "400 12.5px/1.4 var(--sans)", display: "flex", flexDirection: "column", gap: 4 }}>As
                    <select name="role" defaultValue="member" style={{ ...field, width: "auto" }}>
                      {["member", "guest", "admin"].map((r) => <option key={r} value={r}>{ROLE_LABEL[r as GroupRole]}</option>)}
                    </select>
                  </label>
                  <label style={{ font: "400 12.5px/1.4 var(--sans)", display: "flex", flexDirection: "column", gap: 4 }}>Uses (link)
                    <input name="uses" type="number" min={1} max={500} defaultValue={25} style={{ ...field, width: 80 }} />
                  </label>
                  <label style={{ font: "400 12.5px/1.4 var(--sans)", display: "flex", flexDirection: "column", gap: 4 }}>Valid for days
                    <input name="days" type="number" min={1} max={90} defaultValue={14} style={{ ...field, width: 80 }} />
                  </label>
                </div>
                <div><button type="submit" style={btnPrimary}>Create invitation</button></div>
                <span style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)" }}>People without an account can sign up from the link; the invitation counts as their invite code.</span>
              </form>
              {liveInvites.length > 0 && (
                <div style={{ borderTop: "1px solid var(--rule)" }}>
                  {liveInvites.map((i: any) => (
                    <div key={i.token} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 14px", borderBottom: "1px solid var(--rule)", font: "400 12.5px/1.4 var(--sans)", flexWrap: "wrap" }}>
                      <span style={{ flex: "1 1 160px" }}>{i.email ?? "Link"} · {ROLE_LABEL[i.role as GroupRole]} · {i.uses}/{i.max_uses} used · until {String(i.expires_at).slice(0, 10)}</span>
                      <CopyLink url={`${origin}/join/${i.token}`} compact />
                      <form action={revokeInvite.bind(null, id, i.token)}><button type="submit" style={small}>Revoke</button></form>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {manage && (
            <details id="settings" style={{ scrollMarginTop: 72 }}>
              <summary style={{ font: mono(12, 500), cursor: "pointer" }}>Group settings</summary>
              <Panel style={{ marginTop: 8 }}>
                <form action={updateGroup.bind(null, id)} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div><label style={fieldLabel} htmlFor="gs-name">Name</label><input id="gs-name" name="name" defaultValue={g.name} required minLength={2} maxLength={120} style={field} /></div>
                  <div><label style={fieldLabel} htmlFor="gs-inst">Institution</label><input id="gs-inst" name="institution" defaultValue={g.institution} maxLength={200} style={field} /></div>
                  <div><label style={fieldLabel} htmlFor="gs-desc">Description</label><textarea id="gs-desc" name="description" defaultValue={g.description} rows={3} maxLength={1000} style={field} /></div>
                  <fieldset style={{ border: 0, padding: 0, margin: 0, font: "400 13px/1.6 var(--sans)" }}>
                    <legend style={fieldLabel}>Who can join</legend>
                    <label style={{ display: "flex", gap: 8 }}><input type="radio" name="access" value="closed" defaultChecked={g.access === "closed"} /> Closed: by request, invitation or being added</label>
                    <label style={{ display: "flex", gap: 8 }}><input type="radio" name="access" value="open" defaultChecked={g.access === "open"} /> Open: anyone can join</label>
                  </fieldset>
                  <div><button type="submit" style={btnPrimary}>Save</button></div>
                </form>
                {lead && (
                  <form action={deleteGroup.bind(null, id)} style={{ padding: 14, borderTop: "1px solid var(--rule)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={fieldLabel} htmlFor="gs-confirm">Delete the group: type DELETE</label>
                    <input id="gs-confirm" name="confirm" autoComplete="off" style={{ ...field, maxWidth: 200 }} />
                    <div><button type="submit" style={{ ...btn, borderColor: "var(--err)", color: "var(--err)" }}>Delete group</button></div>
                    <span style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)" }}>Members and projects are not deleted; the group&apos;s discussion is.</span>
                  </form>
                )}
              </Panel>
            </details>
          )}
        </aside>
      </div>
    </Page>
  );
}
