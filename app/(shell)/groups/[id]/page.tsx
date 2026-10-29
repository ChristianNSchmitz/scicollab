import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRowId } from "@/lib/query";
import { peopleById } from "@/lib/people";
import { followingOf } from "@/lib/social/follows";
import { activityOf } from "@/lib/social/activity";
import { joinGroup, removeMember, addMember, addGroupProject, removeGroupProject, updateGroup, deleteGroup } from "@/app/actions/groups";
import { Page, Panel, PanelHead, Empty, Tag, btn, btnPrimary, field, fieldLabel, mono } from "@/components/ui";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/social/FollowButton";
import ActivityList from "@/components/social/ActivityList";

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  "saved=1":         { text: "Group saved." },
  "added=1":         { text: "Member added." },
  "error=closed":    { text: "This group is closed: ask an owner to add you.", error: true },
  "error=lastowner": { text: "You are the last owner. Make someone else an owner first, or delete the group.", error: true },
  "error=person":    { text: "Pick a person from the list.", error: true },
  "error=name":      { text: "A group needs a name of at least two characters.", error: true },
  "error=confirm":   { text: "Type DELETE to confirm deleting the group.", error: true },
};

const small = { ...btn, height: 28, padding: "0 10px" };

/** One group: who is in it, the projects they share and what they did lately. */
export default async function Group({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isRowId(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;

  const { data: g } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
  if (!g) notFound();

  const [{ data: members }, { data: gp }, following, { data: myProjects }] = await Promise.all([
    supabase.from("group_members").select("user_id, role, joined_at").eq("group_id", id),
    supabase.from("group_projects").select("project_id, added_by").eq("group_id", id),
    followingOf(supabase, me),
    supabase.from("project_members").select("project_id").eq("user_id", me),
  ]);
  const memberIds = (members ?? []).map((m: any) => m.user_id);
  const myRole = (members ?? []).find((m: any) => m.user_id === me)?.role as string | undefined;
  const isOwner = myRole === "owner";
  const projectIds = [...new Set([...(gp ?? []).map((p: any) => p.project_id), ...(myProjects ?? []).map((p: any) => p.project_id)])];

  const [people, { data: projects }, activity, { data: everyone }] = await Promise.all([
    peopleById(supabase, memberIds),
    projectIds.length ? supabase.from("projects").select("id, title, summary, status").in("id", projectIds) : Promise.resolve({ data: [] as any[] }),
    activityOf(supabase, memberIds, { viewer: me, limit: 12 }),
    isOwner ? supabase.from("profiles").select("id, display_name, institution").order("display_name").limit(1000) : Promise.resolve({ data: [] as any[] }),
  ]);
  const shared = (gp ?? []).map((p: any) => ({ ...p, project: (projects ?? []).find((x: any) => x.id === p.project_id) })).filter((p: any) => p.project);
  const addable = (myProjects ?? []).map((p: any) => (projects ?? []).find((x: any) => x.id === p.project_id))
    .filter((p: any) => p && !shared.some((s: any) => s.project_id === p.id));
  const sorted = [...(members ?? [])].sort((a: any, b: any) => (a.role === b.role ? 0 : a.role === "owner" ? -1 : 1));
  const flashKey = Object.keys(FLASH).find((k) => { const [key, v] = k.split("="); return sp[key] === v; });
  const flash = flashKey ? FLASH[flashKey] : null;

  return (
    <Page
      title={g.name}
      lede={[g.institution, `${g.access === "open" ? "Open group" : "Closed group"}, ${memberIds.length} member${memberIds.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/groups" style={btn}>All groups</Link>
          {!myRole && g.access === "open" && (
            <form action={joinGroup.bind(null, id)}><button type="submit" style={btnPrimary}>Join group</button></form>
          )}
          {myRole && (
            <form action={removeMember.bind(null, id, me)}><button type="submit" style={btn}>Leave</button></form>
          )}
        </div>
      }
    >
      {flash && (
        <p role={flash.error ? "alert" : "status"} style={{ font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: `1px solid ${flash.error ? "var(--err)" : "var(--ok)"}`, background: "var(--surface)" }}>{flash.text}</p>
      )}
      {g.description && <p style={{ font: "400 14px/1.7 var(--sans)", margin: "0 0 16px", maxWidth: "72ch", whiteSpace: "pre-wrap" }}>{g.description}</p>}
      {!myRole && g.access === "closed" && (
        <p style={{ font: "400 13px/1.6 var(--sans)", color: "var(--mute)", margin: "0 0 16px" }}>
          This group is closed. Owners add members; message one of them if you belong here.
        </p>
      )}

      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <PanelHead>Recent activity</PanelHead>
            <ActivityList items={activity} empty="Nothing from the members in the last 60 days." />
          </Panel>

          <Panel>
            <PanelHead>Shared projects · {shared.length}</PanelHead>
            {shared.length === 0 && <div style={{ padding: "12px 14px", font: "400 13px/1.6 var(--sans)", color: "var(--mute)" }}>No projects shared with the group yet.</div>}
            {shared.map((s: any) => (
              <div key={s.project_id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid var(--rule)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/projects/${s.project_id}`} style={{ font: mono(13, 600), color: "var(--ink)" }}>{s.project.title}</Link>
                  {s.project.summary && <div style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", marginTop: 3 }}>{String(s.project.summary).slice(0, 160)}</div>}
                </div>
                {(s.added_by === me || isOwner) && (
                  <form action={removeGroupProject.bind(null, id, s.project_id)}><button type="submit" style={small}>Remove</button></form>
                )}
              </div>
            ))}
            {myRole && addable.length > 0 && (
              <form action={addGroupProject.bind(null, id)} style={{ display: "flex", gap: 8, padding: 14, flexWrap: "wrap" }}>
                <label htmlFor="g-project" style={{ position: "absolute", left: -9999 }}>Project to share</label>
                <select id="g-project" name="project" style={{ ...field, flex: "1 1 220px", width: "auto" }}>
                  {addable.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <button type="submit" style={btn}>Share with the group</button>
              </form>
            )}
            {myRole && addable.length === 0 && (myProjects ?? []).length === 0 && (
              <div style={{ padding: "0 14px 12px", font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)" }}>
                <Link href="/projects/new" style={{ color: "var(--link)" }}>Start a project</Link> to share it here.
              </div>
            )}
          </Panel>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <div id="members" style={{ scrollMarginTop: 72 }}><PanelHead>Members · {memberIds.length}</PanelHead></div>
            {sorted.length === 0 && <Empty>No members.</Empty>}
            {sorted.map((m: any) => {
              const p = people.get(m.user_id);
              return (
                <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
                  <Avatar name={p?.display_name ?? ""} url={p?.avatar_url} size={26} />
                  <div style={{ flex: "1 1 120px", minWidth: 0 }}>
                    <Link href={`/people/${m.user_id}`} style={{ font: mono(12.5, 500), color: "var(--ink)" }}>{p?.display_name ?? "Someone"}</Link>
                    {m.role === "owner" && <span style={{ font: mono(10), color: "var(--mute)", marginLeft: 6 }}>owner</span>}
                  </div>
                  {m.user_id !== me && <FollowButton personId={m.user_id} following={following.has(m.user_id)} compact />}
                  {isOwner && m.user_id !== me && (
                    <form action={removeMember.bind(null, id, m.user_id)}><button type="submit" style={small} aria-label={`Remove ${p?.display_name ?? "member"}`}>×</button></form>
                  )}
                </div>
              );
            })}
            {isOwner && (
              <form action={addMember.bind(null, id)} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={fieldLabel} htmlFor="g-person">Add a member</label>
                <select id="g-person" name="person" required style={field} defaultValue="">
                  <option value="" disabled>Choose a person</option>
                  {(everyone ?? []).filter((p: any) => !memberIds.includes(p.id)).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.display_name}{p.institution ? `, ${p.institution}` : ""}</option>
                  ))}
                </select>
                <label style={{ display: "flex", gap: 8, font: "400 13px/1.5 var(--sans)" }}><input type="checkbox" name="owner" /> Also an owner</label>
                <div><button type="submit" style={btn}>Add</button></div>
              </form>
            )}
          </Panel>

          {isOwner && (
            <details id="settings" style={{ scrollMarginTop: 72 }}>
              <summary style={{ font: mono(12, 500), cursor: "pointer" }}>Group settings</summary>
              <Panel style={{ marginTop: 8 }}>
                <form action={updateGroup.bind(null, id)} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div><label style={fieldLabel} htmlFor="gs-name">Name</label><input id="gs-name" name="name" defaultValue={g.name} required minLength={2} maxLength={120} style={field} /></div>
                  <div><label style={fieldLabel} htmlFor="gs-inst">Institution</label><input id="gs-inst" name="institution" defaultValue={g.institution} maxLength={200} style={field} /></div>
                  <div><label style={fieldLabel} htmlFor="gs-desc">Description</label><textarea id="gs-desc" name="description" defaultValue={g.description} rows={3} maxLength={1000} style={field} /></div>
                  <fieldset style={{ border: 0, padding: 0, margin: 0, font: "400 13px/1.6 var(--sans)" }}>
                    <legend style={fieldLabel}>Who can join</legend>
                    <label style={{ display: "flex", gap: 8 }}><input type="radio" name="access" value="closed" defaultChecked={g.access === "closed"} /> Closed</label>
                    <label style={{ display: "flex", gap: 8 }}><input type="radio" name="access" value="open" defaultChecked={g.access === "open"} /> Open</label>
                  </fieldset>
                  <div><button type="submit" style={btnPrimary}>Save</button></div>
                </form>
                <form action={deleteGroup.bind(null, id)} style={{ padding: 14, borderTop: "1px solid var(--rule)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={fieldLabel} htmlFor="gs-confirm">Delete the group: type DELETE</label>
                  <input id="gs-confirm" name="confirm" autoComplete="off" style={{ ...field, maxWidth: 200 }} />
                  <div><button type="submit" style={{ ...btn, borderColor: "var(--err)", color: "var(--err)" }}>Delete group</button></div>
                  <span style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)" }}>Members and projects are not deleted, only the group.</span>
                </form>
              </Panel>
            </details>
          )}
        </aside>
      </div>
    </Page>
  );
}
