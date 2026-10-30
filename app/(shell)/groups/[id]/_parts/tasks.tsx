import { timeAgo } from "@/lib/format";
import { addTask, toggleTask, takeTask, deleteTask } from "@/app/actions/group-workspace";
import { Panel, PanelHead, Empty, btn, field, fieldLabel } from "@/components/ui";
import Avatar from "@/components/Avatar";
import { small, note, type GroupCtx } from "./ctx";

const today = () => new Date().toISOString().slice(0, 10);

export function dueLabel(due: string | null): { text: string; late: boolean } | null {
  if (!due) return null;
  const t = today();
  if (due < t) return { text: `overdue since ${due}`, late: true };
  if (due === t) return { text: "due today", late: true };
  return { text: `due ${due}`, late: false };
}

/** A shared to-do list: who does what by when. */
export default async function GroupTasks({ ctx }: { ctx: GroupCtx }) {
  const { supabase, id, me, manage, current, people, sp } = ctx;
  const { data: rows } = await supabase.from("group_tasks").select("id, title, assignee_id, due_on, done_at, done_by, created_by, created_at")
    .eq("group_id", id).order("created_at", { ascending: false }).limit(300);
  const open = (rows ?? []).filter((t: any) => !t.done_at)
    .sort((a: any, b: any) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"));
  const done = (rows ?? []).filter((t: any) => t.done_at).sort((a: any, b: any) => b.done_at.localeCompare(a.done_at)).slice(0, 15);
  const name = (uid: string | null) => (uid ? people.get(uid)?.display_name ?? "a former member" : null);

  const Task = ({ t }: { t: any }) => {
    const due = dueLabel(t.due_on);
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
        <form action={toggleTask.bind(null, id, t.id, !t.done_at)}>
          <button type="submit" aria-label={t.done_at ? `Mark "${t.title}" as not done` : `Mark "${t.title}" as done`} title={t.done_at ? "Not done after all" : "Done"}
            style={{ width: 22, height: 22, borderRadius: 999, border: `1.5px solid ${t.done_at ? "var(--ok)" : "var(--mute)"}`, background: t.done_at ? "var(--ok)" : "transparent", color: "var(--bg)", font: "700 12px/1 var(--sans)", cursor: "pointer", padding: 0 }}>
            {t.done_at ? "✓" : ""}
          </button>
        </form>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ font: "500 13.5px/1.45 var(--sans)", textDecoration: t.done_at ? "line-through" : "none", color: t.done_at ? "var(--mute)" : "var(--ink)" }}>{t.title}</div>
          <div style={{ ...note, marginTop: 2 }}>
            {t.done_at
              ? `done ${timeAgo(t.done_at)}${t.done_by ? ` by ${t.done_by === me ? "you" : name(t.done_by)}` : ""}`
              : <>
                  {t.assignee_id ? (t.assignee_id === me ? "yours" : name(t.assignee_id)) : "nobody yet"}
                  {due && <> · <span style={{ color: due.late ? "var(--err)" : "var(--mute)" }}>{due.text}</span></>}
                </>}
          </div>
        </div>
        {!t.done_at && t.assignee_id && <Avatar name={name(t.assignee_id) ?? ""} url={people.get(t.assignee_id)?.avatar_url} size={22} />}
        {!t.done_at && t.assignee_id !== me && (
          <form action={takeTask.bind(null, id, t.id)}><button type="submit" style={small}>{t.assignee_id ? "Take over" : "I'll do it"}</button></form>
        )}
        {(t.created_by === me || manage) && (
          <form action={deleteTask.bind(null, id, t.id)}><button type="submit" style={small} aria-label={`Delete "${t.title}"`}>×</button></form>
        )}
      </div>
    );
  };

  return (
    <div className="sc-two-col">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Panel>
          <PanelHead>Open · {open.length}</PanelHead>
          {open.length === 0 && <Empty>Nothing open. Add what needs doing on the right.</Empty>}
          {open.map((t: any) => <Task key={t.id} t={t} />)}
        </Panel>
        {done.length > 0 && (
          <Panel>
            <PanelHead>Done lately</PanelHead>
            {done.map((t: any) => <Task key={t.id} t={t} />)}
          </Panel>
        )}
      </div>
      <aside>
        <Panel>
          <PanelHead>New task</PanelHead>
          {sp.error === "task" && <p role="alert" style={{ margin: 0, padding: "9px 14px", font: "400 12.5px/1.5 var(--sans)", color: "var(--err)" }}>A task needs a title.</p>}
          <form action={addTask.bind(null, id)} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14 }}>
            <label style={fieldLabel} htmlFor="task-title">What needs doing</label>
            <input id="task-title" name="title" required maxLength={300} style={field} placeholder="Order a new lot of TransLipo-3" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ font: "400 12.5px/1.4 var(--sans)", display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>Who
                <select name="assignee" defaultValue="" style={field}>
                  <option value="">Nobody yet</option>
                  {current.map((m: any) => <option key={m.user_id} value={m.user_id}>{m.user_id === me ? "Me" : people.get(m.user_id)?.display_name ?? "Member"}</option>)}
                </select>
              </label>
              <label style={{ font: "400 12.5px/1.4 var(--sans)", display: "flex", flexDirection: "column", gap: 4 }}>By
                <input name="due" type="date" style={{ ...field, width: "auto" }} />
              </label>
            </div>
            <div><button type="submit" style={btn}>Add task</button></div>
          </form>
        </Panel>
      </aside>
    </div>
  );
}
