import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRowId } from "@/lib/query";
import { peopleById } from "@/lib/people";
import { ROLE_LABEL, canManage, isCurrent, type GroupRole } from "@/lib/social/groups";
import { joinGroup, leaveGroup, requestToJoin, withdrawRequest } from "@/app/actions/groups";
import { Page, btn, btnPrimary, field, fieldLabel, mono } from "@/components/ui";
import type { GroupCtx } from "./_parts/ctx";
import GroupOverview, { type GroupPulse } from "./_parts/overview";
import GroupFeed from "./_parts/feed";
import GroupChat from "./_parts/chat";
import GroupBoard from "./_parts/board";
import GroupTasks from "./_parts/tasks";
import GroupShared from "./_parts/shared";
import GroupMembers from "./_parts/members";

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

/** The parts of a group. Feed, chat, board and tasks are for current members only. */
const TABS = [
  { id: "overview", label: "Overview", members: false },
  { id: "feed", label: "Feed", members: true },
  { id: "chat", label: "Chat", members: true },
  { id: "board", label: "Board", members: true },
  { id: "tasks", label: "Tasks", members: true },
  { id: "shared", label: "Shared", members: false },
  { id: "members", label: "Members", members: false },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** One group as a workspace: an overview, its feed and chat, a notice board,
 *  tasks, what members share with it, and who is in it. */
export default async function Group({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isRowId(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;

  const { data: g } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
  if (!g) notFound();

  const [{ data: members }, { data: requests }, { data: visit }] = await Promise.all([
    supabase.from("group_members").select("user_id, role, joined_at").eq("group_id", id),
    // Admins see every request; anyone else only their own (RLS, supabase/10-journeys.sql).
    supabase.from("group_requests").select("user_id").eq("group_id", id),
    supabase.from("group_visits").select("feed_seen_at, chat_seen_at").eq("group_id", id).eq("user_id", me).maybeSingle(),
  ]);
  const mine = (members ?? []).find((m: any) => m.user_id === me);
  const myRole = mine?.role as GroupRole | undefined;
  const member = isCurrent(myRole);
  const manage = canManage(myRole);
  const current = (members ?? []).filter((m: any) => m.role !== "alumni");
  const alumni = (members ?? []).filter((m: any) => m.role === "alumni");

  const visible = TABS.filter((t) => member || !t.members);
  const tab: Tab = (visible.find((t) => t.id === sp.tab)?.id ?? "overview") as Tab;

  // New since the member last opened the feed or the chat; before any visit, since they joined.
  const joined = mine?.joined_at ?? new Date().toISOString();
  const since = { feed: visit?.feed_seen_at ?? joined, chat: visit?.chat_seen_at ?? joined };
  const [people, pulse] = await Promise.all([
    peopleById(supabase, (members ?? []).map((m: any) => m.user_id)),
    member ? groupPulse(supabase, id, me, since, manage ? (requests ?? []).length : 0) : Promise.resolve({ newPosts: 0, newMessages: 0, myOpen: 0, requests: 0 }),
  ]);
  const ctx: GroupCtx = { supabase, id, g, me, myRole, member, manage, lead: myRole === "owner", members: members ?? [], current, alumni, people, sp, since };

  const flashKey = Object.keys(FLASH).find((k) => { const [key, v] = k.split("="); return sp[key] === v; });
  const flash = flashKey ? FLASH[flashKey] : null;
  const badge: Partial<Record<Tab, number>> = {
    feed: tab === "feed" ? 0 : pulse.newPosts,
    chat: tab === "chat" ? 0 : pulse.newMessages,
    tasks: pulse.myOpen,
    members: pulse.requests,
  };

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
      {tab === "overview" && g.description && <p style={{ font: "400 14px/1.7 var(--sans)", margin: "0 0 12px", maxWidth: "72ch", whiteSpace: "pre-wrap" }}>{g.description}</p>}
      {tab === "overview" && myRole && <p style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", margin: "0 0 14px" }}>You are {myRole === "alumni" ? "listed as alumni" : `a ${ROLE_LABEL[myRole].toLowerCase()}`} of this group.</p>}
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


      <nav aria-label="Parts of the group" className="sc-seg sc-group-tabs" style={{ display: "flex", gap: 0, margin: "0 0 16px", overflowX: "auto" }}>
        {visible.map((t) => (
          <Link key={t.id} href={t.id === "overview" ? `/groups/${id}` : `/groups/${id}?tab=${t.id}`} aria-current={tab === t.id ? "page" : undefined}
            style={{ flex: "1 0 auto", textAlign: "center", padding: "9px 12px", font: mono(12, 600), textDecoration: "none", whiteSpace: "nowrap", color: tab === t.id ? "var(--ink)" : "var(--mute)", borderBottom: tab === t.id ? "2px solid var(--signal)" : "1px solid var(--rule)" }}>
            {t.label}
            {(badge[t.id] ?? 0) > 0 && (
              <span aria-label={`, ${badge[t.id]} new or open`} style={{ marginLeft: 6, display: "inline-block", minWidth: 18, padding: "2px 5px", borderRadius: 999, background: t.id === "tasks" ? "var(--rule)" : "var(--signal)", color: t.id === "tasks" ? "var(--ink)" : "#fff", font: "700 10.5px/1.2 var(--sans)" }}>{badge[t.id]}</span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <GroupOverview ctx={ctx} pulse={pulse} />}
      {tab === "feed" && <GroupFeed ctx={ctx} />}
      {tab === "chat" && <GroupChat ctx={ctx} />}
      {tab === "board" && <GroupBoard ctx={ctx} />}
      {tab === "tasks" && <GroupTasks ctx={ctx} />}
      {tab === "shared" && <GroupShared ctx={ctx} />}
      {tab === "members" && <GroupMembers ctx={ctx} />}
    </Page>
  );
}

/** The counts on the tab bar and the overview tiles. */
async function groupPulse(supabase: GroupCtx["supabase"], id: string, me: string, since: GroupCtx["since"], requests: number): Promise<GroupPulse> {
  const [{ data: posts }, { data: messages }, { data: tasks }] = await Promise.all([
    supabase.from("posts").select("id, author_id").eq("group_id", id).gte("created_at", since.feed).limit(100),
    supabase.from("group_messages").select("id, author_id").eq("group_id", id).gte("created_at", since.chat).limit(100),
    supabase.from("group_tasks").select("id").eq("group_id", id).eq("assignee_id", me).is("done_at", null).limit(100),
  ]);
  return {
    newPosts: (posts ?? []).filter((p: any) => p.author_id !== me).length,
    newMessages: (messages ?? []).filter((m: any) => m.author_id !== me).length,
    myOpen: (tasks ?? []).length,
    requests,
  };
}
