import Link from "next/link";
import { peopleById } from "@/lib/people";
import { fileSize, FILE_ACCEPT } from "@/lib/social/group-files";
import { timeAgo } from "@/lib/format";
import { addGroupProject, removeGroupProject, linkMethod, unlinkMethod } from "@/app/actions/groups";
import { linkDataset, unlinkDataset, uploadGroupFile, deleteGroupFile } from "@/app/actions/group-workspace";
import { joinProject } from "@/app/actions/projects";
import { Panel, PanelHead, Outcome, btn, field, mono } from "@/components/ui";
import { small, note, hidden, type GroupCtx } from "./ctx";

const FILE_FLASH: Record<string, string> = {
  nofile: "Choose a file first.",
  filesize: "That file is over 4 MB. Share larger data as a dataset instead.",
  filetype: "That kind of file cannot be shared here (documents, tables, slides, images, code and zip files can).",
  upload: "The upload did not go through. Try again.",
};

const row = { display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" } as const;
const emptyLine = { padding: "12px 14px", font: "400 13px/1.6 var(--sans)", color: "var(--mute)" } as const;
const vis = (v: string) => (v === "private" ? "private, shared with this group" : v === "lab" ? "lab" : "");

/** What the members share with the group: method cards, datasets, files and projects. */
export default async function GroupShared({ ctx }: { ctx: GroupCtx }) {
  const { supabase, id, me, member, manage, sp } = ctx;
  const [{ data: gp }, { data: myProjects }, { data: gm }, { data: myCards }, { data: gd }, { data: myData }, { data: files }] = await Promise.all([
    supabase.from("group_projects").select("project_id, added_by").eq("group_id", id),
    supabase.from("project_members").select("project_id").eq("user_id", me),
    // Members read linked cards and datasets even when private (supabase/12 and 13).
    supabase.from("group_methods").select("card_id, added_by, added_at").eq("group_id", id).order("added_at", { ascending: false }),
    member ? supabase.from("method_cards").select("id, code, title").eq("author_id", me).order("updated_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] as any[] }),
    member ? supabase.from("group_datasets").select("dataset_id, added_by, added_at").eq("group_id", id).order("added_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
    member ? supabase.from("datasets").select("id, title").eq("owner_id", me).order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] as any[] }),
    member ? supabase.from("group_files").select("id, name, size_bytes, note, uploaded_by, created_at").eq("group_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
  ]);
  const cardIds = (gm ?? []).map((m: any) => m.card_id);
  const dataIds = (gd ?? []).map((d: any) => d.dataset_id);
  const projectIds = [...new Set([...(gp ?? []).map((p: any) => p.project_id), ...(myProjects ?? []).map((p: any) => p.project_id)])];
  const [{ data: projects }, { data: cards }, { data: datasets }] = await Promise.all([
    projectIds.length ? supabase.from("projects").select("id, title, summary, status").in("id", projectIds) : Promise.resolve({ data: [] as any[] }),
    cardIds.length ? supabase.from("method_cards").select("id, code, title, outcome, visibility, author_id").in("id", cardIds) : Promise.resolve({ data: [] as any[] }),
    dataIds.length ? supabase.from("datasets").select("id, title, summary, licence, visibility, owner_id, project_id, size_bytes, doi").in("id", dataIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const people = new Map([...ctx.people, ...(await peopleById(supabase, [...(cards ?? []).map((c: any) => c.author_id), ...(datasets ?? []).map((d: any) => d.owner_id)]))]);
  const name = (uid: string) => people.get(uid)?.display_name ?? "a member";

  const onProject = new Set((myProjects ?? []).map((p: any) => p.project_id));
  const shared = (gp ?? []).map((p: any) => ({ ...p, project: (projects ?? []).find((x: any) => x.id === p.project_id) })).filter((p: any) => p.project);
  const addable = (myProjects ?? []).map((p: any) => (projects ?? []).find((x: any) => x.id === p.project_id))
    .filter((p: any) => p && !shared.some((s: any) => s.project_id === p.id));
  // Unreadable ones (a non-member and a private card) drop out here.
  const methods = (gm ?? []).map((m: any) => ({ ...m, card: (cards ?? []).find((c: any) => c.id === m.card_id) })).filter((m: any) => m.card);
  const linkable = (myCards ?? []).filter((c: any) => !cardIds.includes(c.id));
  const data = (gd ?? []).map((d: any) => ({ ...d, ds: (datasets ?? []).find((x: any) => x.id === d.dataset_id) })).filter((d: any) => d.ds);
  const linkableData = (myData ?? []).filter((d: any) => !dataIds.includes(d.id));
  const fileError = sp.error && FILE_FLASH[sp.error];

  return (
    <div className="sc-two-col">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <div id="methods" style={{ scrollMarginTop: 72 }}><PanelHead>Methods · {methods.length}</PanelHead></div>
            {methods.length === 0 && <div style={{ padding: "12px 14px", font: "400 13px/1.6 var(--sans)", color: "var(--mute)" }}>No method cards linked to the group yet.</div>}
            {methods.map((m: any) => (
              <div key={m.card_id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Outcome value={m.card.outcome} />
                    <span style={{ font: mono(10.5), color: "var(--mute)" }}>{m.card.code}</span>
                    {m.card.visibility !== "public" && <span style={{ font: mono(10.5), color: "var(--mute)" }}>· {m.card.visibility === "private" ? "private, shared with this group" : "lab"}</span>}
                  </div>
                  <Link href={`/methods/${m.card_id}`} style={{ display: "block", font: mono(13, 600, 1.4), color: "var(--ink)", marginTop: 5 }}>{m.card.title}</Link>
                  <div style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)", marginTop: 3 }}>by {name(m.card.author_id)}</div>
                </div>
                {(m.added_by === me || manage) && (
                  <form action={unlinkMethod.bind(null, id, m.card_id)}><button type="submit" style={small}>Unlink</button></form>
                )}
              </div>
            ))}
            {member && linkable.length > 0 && (
              <form action={linkMethod.bind(null, id)} style={{ display: "flex", gap: 8, padding: 14, flexWrap: "wrap" }}>
                <label htmlFor="g-method" style={{ position: "absolute", left: -9999 }}>Method card to link</label>
                <select id="g-method" name="card" style={{ ...field, flex: "1 1 220px", width: "auto" }}>
                  {linkable.map((c: any) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
                </select>
                <button type="submit" style={btn}>Link to the group</button>
                <span style={{ flexBasis: "100%", font: "400 12px/1.5 var(--sans)", color: "var(--mute)" }}>Optional. Members of the group can then read the card, also when it is private. Unlink any time.</span>
              </form>
            )}
          </Panel>

        {member && (
          <Panel>
            <div id="data" style={{ scrollMarginTop: 72 }}><PanelHead>Data · {data.length}</PanelHead></div>
            {data.length === 0 && <div style={emptyLine}>No datasets linked to the group yet.</div>}
            {data.map((d: any) => (
              <div key={d.dataset_id} style={row}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  {/* Datasets live inside projects; the link only helps those on the project. */}
                  {onProject.has(d.ds.project_id)
                    ? <Link href={`/projects/${d.ds.project_id}?tab=data`} style={{ display: "block", font: mono(13, 600, 1.4), color: "var(--ink)" }}>{d.ds.title}</Link>
                    : <div style={{ font: mono(13, 600, 1.4) }}>{d.ds.title}</div>}
                  {d.ds.summary && <div style={{ font: "400 12.5px/1.5 var(--sans)", marginTop: 3 }}>{String(d.ds.summary).slice(0, 240)}</div>}
                  <div style={{ ...note, marginTop: 3 }}>
                    by {name(d.ds.owner_id)}{d.ds.size_bytes ? ` · ${fileSize(d.ds.size_bytes)}` : ""}{d.ds.licence ? ` · ${d.ds.licence}` : ""}{vis(d.ds.visibility) ? ` · ${vis(d.ds.visibility)}` : ""}
                    {d.ds.doi && <> · <a href={String(d.ds.doi).startsWith("http") ? d.ds.doi : `https://doi.org/${d.ds.doi}`} rel="noreferrer" style={{ color: "var(--link)" }}>{d.ds.doi}</a></>}
                  </div>
                </div>
                {(d.added_by === me || manage) && (
                  <form action={unlinkDataset.bind(null, id, d.dataset_id)}><button type="submit" style={small}>Unlink</button></form>
                )}
              </div>
            ))}
            {linkableData.length > 0 && (
              <form action={linkDataset.bind(null, id)} style={{ display: "flex", gap: 8, padding: 14, flexWrap: "wrap" }}>
                <label htmlFor="g-data" style={hidden}>Dataset to link</label>
                <select id="g-data" name="dataset" style={{ ...field, flex: "1 1 220px", width: "auto" }}>
                  {linkableData.map((d: any) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
                <button type="submit" style={btn}>Link to the group</button>
                <span style={{ ...note, flexBasis: "100%" }}>Optional. Members of the group can then open the dataset, also when it is private. Unlink any time.</span>
              </form>
            )}
          </Panel>
        )}
      </div>

      <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {member && (
          <Panel>
            <div id="files" style={{ scrollMarginTop: 72 }}><PanelHead>Files · {(files ?? []).length}</PanelHead></div>
            {sp.uploaded === "1" && <p role="status" style={{ margin: 0, padding: "9px 14px", font: "400 12.5px/1.5 var(--sans)", borderBottom: "1px solid var(--rule)", color: "var(--ok)" }}>File shared with the group.</p>}
            {fileError && <p role="alert" style={{ margin: 0, padding: "9px 14px", font: "400 12.5px/1.5 var(--sans)", borderBottom: "1px solid var(--rule)", color: "var(--err)" }}>{fileError}</p>}
            {(files ?? []).length === 0 && <div style={emptyLine}>No files yet: protocols, SOPs, slides, booking sheets.</div>}
            {(files ?? []).map((f: any) => (
              <div key={f.id} style={{ ...row, padding: "10px 14px" }}>
                <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                  <a href={`/api/group-files/${f.id}`} download={f.name} style={{ display: "block", font: mono(12.5, 600, 1.4), color: "var(--ink)", overflowWrap: "anywhere" }}>{f.name}</a>
                  <div style={{ ...note, marginTop: 2 }}>{fileSize(f.size_bytes)} · {name(f.uploaded_by)} · {timeAgo(f.created_at)}</div>
                  {f.note && <div style={{ font: "400 12.5px/1.5 var(--sans)", marginTop: 3 }}>{f.note}</div>}
                </div>
                {(f.uploaded_by === me || manage) && (
                  <form action={deleteGroupFile.bind(null, id, f.id)}><button type="submit" style={small} aria-label={`Delete ${f.name}`}>Delete</button></form>
                )}
              </div>
            ))}
            <form action={uploadGroupFile.bind(null, id)} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14 }}>
              <label htmlFor="g-file" style={hidden}>File to share</label>
              <input id="g-file" name="file" type="file" required accept={FILE_ACCEPT} style={{ font: "400 12.5px/1.4 var(--sans)" }} />
              <label htmlFor="g-file-note" style={hidden}>What it is (optional)</label>
              <input id="g-file-note" name="note" maxLength={500} placeholder="What it is (optional)" style={field} />
              <div><button type="submit" style={btn}>Upload</button></div>
              <span style={note}>Up to 4 MB. Only members of the group can download it.</span>
            </form>
          </Panel>
        )}

          <Panel>
            <div id="projects" style={{ scrollMarginTop: 72 }}><PanelHead>Projects · {shared.length}</PanelHead></div>
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
      </aside>
    </div>
  );
}
