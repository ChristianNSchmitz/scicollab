import Link from "next/link";
import { headers } from "next/headers";
import { followingOf } from "@/lib/social/follows";
import { peopleById } from "@/lib/people";
import { ROLE_LABEL, type GroupRole } from "@/lib/social/groups";
import {
  removeMember, addMember, setRole, updateGroup, deleteGroup, answerRequest, createInvite, revokeInvite,
} from "@/app/actions/groups";
import { Panel, PanelHead, Empty, btn, btnPrimary, field, fieldLabel, mono } from "@/components/ui";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/social/FollowButton";
import CopyLink from "@/components/CopyLink";
import { small, type GroupCtx } from "./ctx";

const ORDER: GroupRole[] = ["owner", "admin", "member", "guest", "alumni"];

/** Who is in the group and in which role; for the lead and admins also
 *  requests to join, invitations and the group's settings. */
export default async function GroupMembers({ ctx }: { ctx: GroupCtx }) {
  const { supabase, id, g, me, manage, lead, members, current, alumni, sp } = ctx;
  const memberIds = members.map((m: any) => m.user_id);
  const [following, { data: requests }, { data: everyone }, { data: invites }] = await Promise.all([
    followingOf(supabase, me),
    // Admins see every request (RLS, supabase/10-journeys.sql).
    manage ? supabase.from("group_requests").select("user_id, message, created_at").eq("group_id", id) : Promise.resolve({ data: [] as any[] }),
    manage ? supabase.from("profiles").select("id, display_name, institution").order("display_name").limit(1000) : Promise.resolve({ data: [] as any[] }),
    manage ? supabase.from("group_invites").select("token, role, email, max_uses, uses, expires_at").eq("group_id", id) : Promise.resolve({ data: [] as any[] }),
  ]);
  const people = new Map([...ctx.people, ...(await peopleById(supabase, (requests ?? []).map((r: any) => r.user_id)))]);
  const sorted = [...current].sort((a: any, b: any) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role));
  const liveInvites = (invites ?? []).filter((i: any) => new Date(i.expires_at) >= new Date() && i.uses < i.max_uses);
  const newInvite = sp.invite && liveInvites.find((i: any) => i.token === sp.invite);
  const h = await headers();
  const origin = process.env.SCICOLLAB_SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  return (
    <div className="sc-two-col">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
  );
}
