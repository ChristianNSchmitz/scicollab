import { peopleById } from "@/lib/people";
import { timeAgo } from "@/lib/format";
import { addNote, editNote, pinNote, deleteNote } from "@/app/actions/group-workspace";
import { Panel, PanelHead, Empty, btn, btnPrimary, field, fieldLabel, mono } from "@/components/ui";
import RichText from "@/components/RichText";
import { small, note, type GroupCtx } from "./ctx";

/** The notice board: notes that should stay visible, the pinned ones first. */
export default async function GroupBoard({ ctx }: { ctx: GroupCtx }) {
  const { supabase, id, me, manage, sp } = ctx;
  const { data: rows } = await supabase.from("group_notes").select("id, author_id, title, body, pinned, created_at, updated_at")
    .eq("group_id", id).order("updated_at", { ascending: false }).limit(100);
  const notes = [...(rows ?? [])].sort((a: any, b: any) => Number(b.pinned) - Number(a.pinned));
  const people = await peopleById(supabase, notes.map((n: any) => n.author_id));

  return (
    <div className="sc-two-col">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {notes.length === 0 && <Panel><Empty>No notes yet. Lab rules, protocols in use, booking info: whatever everyone should be able to find.</Empty></Panel>}
        {notes.map((n: any) => {
          const editable = n.author_id === me || manage;
          return (
            <article key={n.id} id={`note-${n.id}`} style={{ scrollMarginTop: 72 }}>
              <Panel style={n.pinned ? { borderColor: "var(--signal)" } : undefined}>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    {n.pinned && <span className="sc-badge" style={{ font: mono(9.5, 700), letterSpacing: ".08em", color: "var(--signal-ink)", border: "1px solid var(--signal)", padding: "2px 7px" }}>PINNED</span>}
                    <h3 style={{ font: mono(14.5, 700, 1.35), margin: 0, flex: 1 }}>{n.title}</h3>
                  </div>
                  {n.body && <div style={{ marginTop: 8 }}><RichText body={n.body} style={{ font: "400 13.5px/1.65 var(--sans)", whiteSpace: "pre-wrap" }} /></div>}
                  <div style={{ ...note, marginTop: 8 }}>
                    {people.get(n.author_id)?.display_name ?? "A member"} · {n.updated_at !== n.created_at ? `edited ${timeAgo(n.updated_at)}` : timeAgo(n.created_at)}
                  </div>
                </div>
                {editable && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "9px 14px", borderTop: "1px solid var(--rule)" }}>
                    {manage && (
                      <form action={pinNote.bind(null, id, n.id, !n.pinned)}><button type="submit" style={small}>{n.pinned ? "Unpin" : "Pin to the top"}</button></form>
                    )}
                    <details style={{ flex: "1 1 100%" , order: 3 }}>
                      <summary style={{ font: mono(11.5, 500), cursor: "pointer", color: "var(--mute)" }}>Edit</summary>
                      <form action={editNote.bind(null, id, n.id)} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        <label style={fieldLabel} htmlFor={`nt-${n.id}`}>Title</label>
                        <input id={`nt-${n.id}`} name="title" defaultValue={n.title} required maxLength={200} style={field} />
                        <label style={fieldLabel} htmlFor={`nb-${n.id}`}>Text</label>
                        <textarea id={`nb-${n.id}`} name="body" defaultValue={n.body} rows={5} maxLength={8000} style={field} />
                        <div><button type="submit" style={btnPrimary}>Save</button></div>
                      </form>
                    </details>
                    <form action={deleteNote.bind(null, id, n.id)} style={{ marginLeft: "auto" }}><button type="submit" style={small}>Delete</button></form>
                  </div>
                )}
              </Panel>
            </article>
          );
        })}
      </div>

      <aside>
        <Panel>
          <PanelHead>New note</PanelHead>
          {sp.error === "note" && <p role="alert" style={{ margin: 0, padding: "9px 14px", font: "400 12.5px/1.5 var(--sans)", color: "var(--err)" }}>A note needs a title.</p>}
          <form action={addNote.bind(null, id)} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14 }}>
            <label style={fieldLabel} htmlFor="note-title">Title</label>
            <input id="note-title" name="title" required maxLength={200} style={field} placeholder="Booking the confocal" />
            <label style={fieldLabel} htmlFor="note-body">Text</label>
            <textarea id="note-body" name="body" rows={6} maxLength={8000} style={field} placeholder="Who to ask, where the sheet is, what to log." />
            {manage && (
              <label style={{ display: "flex", gap: 8, alignItems: "center", font: "400 13px/1.4 var(--sans)" }}>
                <input type="checkbox" name="pinned" /> Pin to the top
              </label>
            )}
            <div><button type="submit" style={btn}>Add to the board</button></div>
            <span style={note}>Every member can add notes. The lead and admins pin the ones that should stay on top.</span>
          </form>
        </Panel>
      </aside>
    </div>
  );
}
