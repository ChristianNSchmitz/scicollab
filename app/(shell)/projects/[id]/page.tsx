import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addEntry } from "@/app/actions/projects";
import { Page, Panel, PanelHead, Empty, Tag, Visibility, field, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Project overview — board D1 screen 2, with the append-only notebook from
 *  screen 5. Entries cannot be edited, and the board makes that visible. */
export default async function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [{ data: entries }, { data: members }] = await Promise.all([
    supabase.from("eln_entries").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("project_members").select("user_id, role").eq("project_id", id),
  ]);

  const ids = (members ?? []).map((m) => m.user_id);
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, display_name, institution").in("id", ids)
    : { data: [] as any[] };

  return (
    <Page title={p.title} lede={p.summary || undefined}>
      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <PanelHead>Notebook — append only</PanelHead>
            <form action={addEntry.bind(null, p.id)} style={{ padding: 14, borderBottom: "1px solid var(--rule)" }}>
              <textarea name="body" rows={4} required style={field} placeholder="What you did, what you observed, what you are doing next." />
              <button type="submit" style={{ ...btnPrimary, marginTop: 11 }}>Sign and add entry</button>
            </form>
            {(entries?.length ?? 0) === 0 ? (
              <Empty>No entries yet.</Empty>
            ) : entries!.map((e) => (
              <div key={e.id} style={{ padding: 14, borderBottom: "1px solid var(--rule)" }}>
                <div style={{ font: mono(10.5), color: "var(--mute)", marginBottom: 7 }}>
                  {new Date(e.created_at).toISOString().slice(0, 16).replace("T", " ")} · signed · {timeAgo(e.created_at)}
                </div>
                <p style={{ font: "400 13px/1.7 var(--sans)", margin: 0, whiteSpace: "pre-wrap" }}>{e.body}</p>
              </div>
            ))}
          </Panel>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <PanelHead>Status</PanelHead>
            <div style={{ padding: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Tag>{p.status}</Tag>
              <Visibility value={p.visibility} />
            </div>
          </Panel>
          <Panel>
            <PanelHead>People · {members?.length ?? 0}</PanelHead>
            <div style={{ padding: 14, font: mono(12, 400, 1.8) }}>
              {(members ?? []).map((m) => {
                const who = people?.find((x) => x.id === m.user_id);
                return (
                  <div key={m.user_id}>
                    {who?.display_name ?? "Member"} <span style={{ color: "var(--mute)" }}>· {m.role}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </aside>
      </div>
    </Page>
  );
}
