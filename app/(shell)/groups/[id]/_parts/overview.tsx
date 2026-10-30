import Link from "next/link";
import type { ReactNode } from "react";
import { activityOf } from "@/lib/social/activity";
import { timeAgo } from "@/lib/format";
import { ROLE_LABEL, type GroupRole } from "@/lib/social/groups";
import { Panel, PanelHead, Empty, mono } from "@/components/ui";
import Avatar from "@/components/Avatar";
import ActivityList from "@/components/social/ActivityList";
import { dueLabel } from "./tasks";
import { note, type GroupCtx } from "./ctx";

/** What the counts on the overview and the tab bar are built from. */
export type GroupPulse = { newPosts: number; newMessages: number; myOpen: number; requests: number };

const tabHref = (id: string, tab: string) => `/groups/${id}?tab=${tab}`;
const line = { display: "block", padding: "10px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" } as const;
const more = (href: string, text: string) => (
  <Link href={href} style={{ display: "block", padding: "9px 14px", font: mono(11.5, 500), color: "var(--mute)", textDecoration: "none" }}>{text} →</Link>
);

function Tile({ href, kicker, big, unit, fresh, children }: { href: string; kicker: string; big: number; unit: string; fresh: boolean; children?: ReactNode }) {
  return (
    <div className="sc-hl-tile">
      <Link href={href} className="sc-hl-main" aria-label={`${kicker}: ${big} ${unit}`}>
        <span className="sc-hl-kicker">{fresh && <span className="sc-hl-dot" aria-hidden="true" />}{kicker}</span>
        <span className="sc-hl-num">
          <span className="sc-hl-big" style={{ color: fresh ? "var(--signal-ink)" : "var(--ink)" }}>{big}</span>
          <span className="sc-hl-unit">{unit}</span>
        </span>
        <span className="sc-hl-detail">{children}</span>
      </Link>
    </div>
  );
}

/** The group's dashboard: what is new, what is pinned, what is yours to do. */
export default async function GroupOverview({ ctx, pulse }: { ctx: GroupCtx; pulse: GroupPulse }) {
  const { supabase, id, me, member, current, people } = ctx;
  const name = (uid: string) => people.get(uid)?.display_name ?? "A member";
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
  const newMembers = current.filter((m: any) => m.joined_at > monthAgo && m.user_id !== me)
    .sort((a: any, b: any) => b.joined_at.localeCompare(a.joined_at)).slice(0, 5);

  if (!member) {
    const activity = await activityOf(supabase, current.map((m: any) => m.user_id), { viewer: me, limit: 8 });
    return (
      <div className="sc-two-col">
        <Panel>
          <PanelHead>Recent activity of the members</PanelHead>
          <ActivityList items={activity} empty="Nothing public from the members in the last 60 days." />
        </Panel>
        <Panel style={{ padding: 14 }}>
          <div style={{ font: "400 13px/1.6 var(--sans)", color: "var(--mute)" }}>
            The group&apos;s feed, chat, notice board, tasks and files are for its members. Shared methods and projects are under <Link href={tabHref(id, "shared")} style={{ color: "var(--link)" }}>Shared</Link>.
          </div>
        </Panel>
      </div>
    );
  }

  const [{ data: pinned }, { data: posts }, { data: chat }, { data: tasks }, { data: methods }, { data: data }, { data: files }, activity] = await Promise.all([
    supabase.from("group_notes").select("id, title, body, author_id, updated_at").eq("group_id", id).eq("pinned", true).order("updated_at", { ascending: false }).limit(3),
    supabase.from("posts").select("id, title, author_id, created_at").eq("group_id", id).order("created_at", { ascending: false }).limit(4),
    supabase.from("group_messages").select("id, author_id, body, created_at").eq("group_id", id).order("created_at", { ascending: false }).limit(4),
    supabase.from("group_tasks").select("id, title, assignee_id, due_on").eq("group_id", id).is("done_at", null).limit(200),
    supabase.from("group_methods").select("card_id, added_by, added_at").eq("group_id", id).order("added_at", { ascending: false }).limit(5),
    supabase.from("group_datasets").select("dataset_id, added_by, added_at").eq("group_id", id).order("added_at", { ascending: false }).limit(5),
    supabase.from("group_files").select("id, name, uploaded_by, created_at").eq("group_id", id).order("created_at", { ascending: false }).limit(5),
    activityOf(supabase, current.map((m: any) => m.user_id), { viewer: me, limit: 6 }),
  ]);
  const cardIds = (methods ?? []).map((m: any) => m.card_id), dataIds = (data ?? []).map((d: any) => d.dataset_id);
  const [{ data: cards }, { data: sets }] = await Promise.all([
    cardIds.length ? supabase.from("method_cards").select("id, code, title").in("id", cardIds) : Promise.resolve({ data: [] as any[] }),
    dataIds.length ? supabase.from("datasets").select("id, title").in("id", dataIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const recent = [
    ...(methods ?? []).map((m: any) => ({ at: m.added_at, kind: "Method", title: (cards ?? []).find((c: any) => c.id === m.card_id)?.title, by: m.added_by, href: `/methods/${m.card_id}` })),
    ...(data ?? []).map((d: any) => ({ at: d.added_at, kind: "Data", title: (sets ?? []).find((s: any) => s.id === d.dataset_id)?.title, by: d.added_by, href: `${tabHref(id, "shared")}#data` })),
    ...(files ?? []).map((f: any) => ({ at: f.created_at, kind: "File", title: f.name, by: f.uploaded_by, href: `${tabHref(id, "shared")}#files` })),
  ].filter((r) => r.title).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);

  const mine = (tasks ?? []).filter((t: any) => t.assignee_id === me);
  const toPick = (tasks ?? []).filter((t: any) => !t.assignee_id);
  const shownTasks = [...mine, ...toPick].sort((a: any, b: any) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999")).slice(0, 6);
  const overdue = mine.filter((t: any) => dueLabel(t.due_on)?.late).length;
  const lastChat = (chat ?? [])[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section aria-label="Group at a glance" className="sc-hl sc-hl-4">
        <Tile href={tabHref(id, "feed")} kicker="Feed" big={pulse.newPosts} unit={pulse.newPosts === 1 ? "new post" : "new posts"} fresh={pulse.newPosts > 0}>
          {(posts ?? [])[0] ? `Latest: ${(posts ?? [])[0].title}` : "No posts yet"}
        </Tile>
        <Tile href={`${tabHref(id, "chat")}#latest`} kicker="Chat" big={pulse.newMessages} unit={pulse.newMessages === 1 ? "new message" : "new messages"} fresh={pulse.newMessages > 0}>
          {lastChat ? `${name(lastChat.author_id)}: ${lastChat.body}` : "No messages yet"}
        </Tile>
        <Tile href={tabHref(id, "tasks")} kicker="Your tasks" big={pulse.myOpen} unit="open" fresh={overdue > 0}>
          {overdue ? `${overdue} overdue` : toPick.length ? `${toPick.length} nobody has taken yet` : "Nothing waiting"}
        </Tile>
        <Tile href={tabHref(id, "shared")} kicker="Shared" big={recent.length} unit="lately" fresh={false}>
          {recent[0] ? `${recent[0].kind}: ${recent[0].title}` : "Methods, data and files"}
        </Tile>
      </section>

      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel style={(pinned ?? []).length ? { borderColor: "var(--signal)" } : undefined}>
            <PanelHead>Pinned on the board</PanelHead>
            {(pinned ?? []).length === 0 && <Empty>Nothing pinned. The lead and admins pin lab rules, protocols and booking info on the board.</Empty>}
            {(pinned ?? []).map((n: any) => (
              <Link key={n.id} href={`${tabHref(id, "board")}#note-${n.id}`} style={line}>
                <div style={{ font: mono(13, 600, 1.4) }}>{n.title}</div>
                {n.body && <div style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", marginTop: 3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{n.body}</div>}
              </Link>
            ))}
            {more(tabHref(id, "board"), "The whole board")}
          </Panel>

          <Panel>
            <PanelHead>Latest in the feed</PanelHead>
            {(posts ?? []).length === 0 && <Empty>No posts yet.</Empty>}
            {(posts ?? []).map((p: any) => (
              <Link key={p.id} href={`/posts/${p.id}`} style={line}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  {p.created_at > ctx.since.feed && p.author_id !== me && <span style={{ font: mono(9.5, 700), color: "var(--signal-ink)", letterSpacing: ".08em" }}>NEW</span>}
                  <span style={{ font: mono(13, 600, 1.4), flex: 1 }}>{p.title}</span>
                </div>
                <div style={{ ...note, marginTop: 2 }}>{name(p.author_id)} · {timeAgo(p.created_at)}</div>
              </Link>
            ))}
            {more(tabHref(id, "feed"), "Open the feed")}
          </Panel>

          <Panel>
            <PanelHead>Latest in the chat</PanelHead>
            {(chat ?? []).length === 0 && <Empty>No messages yet.</Empty>}
            {[...(chat ?? [])].reverse().map((m: any) => (
              <div key={m.id} style={{ display: "flex", gap: 9, padding: "9px 14px", borderBottom: "1px solid var(--rule)" }}>
                <Avatar name={name(m.author_id)} url={people.get(m.author_id)?.avatar_url} size={22} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ font: "400 13px/1.5 var(--sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <b style={{ fontWeight: 600 }}>{m.author_id === me ? "You" : name(m.author_id)}</b> {m.body}
                  </div>
                  <div style={note}>{timeAgo(m.created_at)}</div>
                </div>
              </div>
            ))}
            {more(`${tabHref(id, "chat")}#latest`, "Open the chat")}
          </Panel>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <PanelHead>To do</PanelHead>
            {shownTasks.length === 0 && <Empty>Nothing for you, and nothing waiting for someone to take it.</Empty>}
            {shownTasks.map((t: any) => {
              const due = dueLabel(t.due_on);
              return (
                <Link key={t.id} href={tabHref(id, "tasks")} style={line}>
                  <div style={{ font: "500 13px/1.45 var(--sans)" }}>{t.title}</div>
                  <div style={{ ...note, marginTop: 2 }}>
                    {t.assignee_id === me ? "yours" : "nobody yet"}{due && <> · <span style={{ color: due.late ? "var(--err)" : "var(--mute)" }}>{due.text}</span></>}
                  </div>
                </Link>
              );
            })}
            {more(tabHref(id, "tasks"), "All tasks")}
          </Panel>

          <Panel>
            <PanelHead>Shared lately</PanelHead>
            {recent.length === 0 && <Empty>No methods, data or files shared yet.</Empty>}
            {recent.map((r, i) => (
              <Link key={i} href={r.href} style={line}>
                <div style={{ font: mono(9.5, 700), letterSpacing: ".08em", color: "var(--mute)" }}>{r.kind.toUpperCase()}</div>
                <div style={{ font: mono(12.5, 600, 1.4), marginTop: 3, overflowWrap: "anywhere" }}>{r.title}</div>
                <div style={{ ...note, marginTop: 2 }}>{name(r.by)} · {timeAgo(r.at)}</div>
              </Link>
            ))}
          </Panel>

          {newMembers.length > 0 && (
            <Panel>
              <PanelHead>New in the group</PanelHead>
              {newMembers.map((m: any) => (
                <Link key={m.user_id} href={`/people/${m.user_id}`} style={{ ...line, display: "flex", gap: 9, alignItems: "center" }}>
                  <Avatar name={name(m.user_id)} url={people.get(m.user_id)?.avatar_url} size={24} />
                  <span style={{ flex: 1, font: mono(12.5, 500) }}>{name(m.user_id)}</span>
                  <span style={note}>{ROLE_LABEL[m.role as GroupRole]} · {timeAgo(m.joined_at)}</span>
                </Link>
              ))}
            </Panel>
          )}

          <Panel>
            <PanelHead>What members did lately</PanelHead>
            <ActivityList items={activity} empty="Nothing from the members in the last 60 days." />
          </Panel>
        </aside>
      </div>
    </div>
  );
}
