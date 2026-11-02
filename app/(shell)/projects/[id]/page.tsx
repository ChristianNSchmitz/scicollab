import { peopleById } from "@/lib/people";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addEntry, depositDataset, joinProject, leaveProject, addProjectMember, removeProjectMember,
  updateProject, setProjectRole, linkProjectMethod, unlinkProjectMethod, addMilestone, toggleMilestone, deleteMilestone,
} from "@/app/actions/projects";
import { PROJECT_STATUSES, PROJECT_ROLES } from "@/lib/projects";
import SegTabs from "@/components/SegTabs";
import Repositories from "@/components/code/Repositories";
import { repoLinks } from "@/lib/repos";
import { Page, Panel, PanelHead, Empty, Tag, Visibility, Outcome, field, fieldLabel, btn, btnPrimary, mono } from "@/components/ui";
import { timeAgo, bytes } from "@/lib/format";
import Avatar from "@/components/Avatar";
import RichText from "@/components/RichText";

export const dynamic = "force-dynamic";

/**
 * A project: an overview (aims, milestones, what happened lately, the
 * owner's settings) and the things inside it: notebook, data, code and the
 * method cards linked to it.
 *
 * Data and Code used to be top-level rail destinations, which made them look
 * like separate products and left the rail with thirteen items. They are not
 * separate: a dataset and a repository only mean anything in the context of
 * the work that produced them. So the project is the container — notebook,
 * data and code — which is also what board D1 argues when it calls the
 * project "the thing testers named".
 */

type Tab = "overview" | "notebook" | "data" | "code" | "methods";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "notebook", label: "Notebook" },
  { id: "data",     label: "Data" },
  { id: "code",     label: "Code" },
  { id: "methods",  label: "Methods" },
];
const today = () => new Date().toISOString().slice(0, 10);


export default async function Project({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; saved?: string; error?: string; repo?: string }>;
}) {
  const { id } = await params;
  const { tab, saved, error, repo } = await searchParams;
  const active: Tab = TABS.some((t) => t.id === tab) ? (tab as Tab) : "overview";

  const supabase = await createClient();
  const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [{ data: entries }, { data: members }, { data: datasets }, { data: files }, { data: commits }, { data: linked }, { data: milestones }] =
    await Promise.all([
      supabase.from("eln_entries").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("project_members").select("user_id, role").eq("project_id", id),
      supabase.from("datasets").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("code_files").select("*").eq("project_id", id).order("path"),
      supabase.from("code_commits").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(10),
      supabase.from("project_methods").select("card_id, added_by, added_at").eq("project_id", id).order("added_at", { ascending: false }),
      supabase.from("project_milestones").select("*").eq("project_id", id),
    ]);
  const repos = await repoLinks(supabase, { projectId: id });

  const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
  const { data: { user } } = await supabase.auth.getUser();
  const isMember = !!user && ids.includes(user.id);
  const cardIds = (linked ?? []).map((l: any) => l.card_id);
  const [people, { data: cards }, { data: myCards }] = await Promise.all([
    peopleById(supabase, [...ids, ...(commits ?? []).map((c: any) => c.author_id), ...(entries ?? []).map((e: any) => e.author_id)]),
    cardIds.length ? supabase.from("method_cards").select("id, code, title, outcome, visibility, author_id, system").in("id", cardIds) : Promise.resolve({ data: [] as any[] }),
    isMember ? supabase.from("method_cards").select("id, code, title").eq("author_id", user!.id).order("updated_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] as any[] }),
  ]);
  // Authors of linked cards who are not on the project.
  for (const [k, v] of await peopleById(supabase, (cards ?? []).map((c: any) => c.author_id).filter((a: string) => !people.has(a)))) people.set(k, v);
  const methods = (linked ?? []).map((l: any) => ({ ...l, card: (cards ?? []).find((c: any) => c.id === l.card_id) })).filter((l: any) => l.card);
  const linkable = (myCards ?? []).filter((c: any) => !cardIds.includes(c.id));
  const ms = [...(milestones ?? [])].sort((a: any, b: any) => Number(!!a.done_at) - Number(!!b.done_at) || (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"));
  const msDone = ms.filter((m: any) => m.done_at).length;
  // What happened lately, across the whole project.
  const recent = [
    ...(entries ?? []).map((e: any) => ({ at: e.created_at, text: `${people.get(e.author_id)?.display_name ?? "Someone"} added a notebook entry`, href: `/projects/${id}?tab=notebook` })),
    ...(datasets ?? []).map((d: any) => ({ at: d.created_at, text: `Dataset deposited: ${d.title}`, href: `/projects/${id}?tab=data` })),
    ...(commits ?? []).map((c: any) => ({ at: c.created_at, text: `Commit ${c.sha.slice(0, 7)}: ${c.message}`, href: `/projects/${id}?tab=code` })),
    ...methods.map((m: any) => ({ at: m.added_at, text: `Method linked: ${m.card.code} ${m.card.title}`, href: `/methods/${m.card_id}` })),
    ...ms.filter((m: any) => m.done_at).map((m: any) => ({ at: m.done_at, text: `Milestone reached: ${m.title}`, href: `/projects/${id}#milestones` })),
  ].sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? ""))).slice(0, 10);
  const nameOf = (uid: string) => people.get(uid)?.display_name ?? "Someone";

  // Shared with a group you are in: you may join it from here.
  const { data: shares } = await supabase.from("group_projects").select("group_id").eq("project_id", id);
  const shareIds = (shares ?? []).map((s: { group_id: string }) => s.group_id);
  const [{ data: myShareGroups }, { data: shareGroups }] = shareIds.length
    ? await Promise.all([
        supabase.from("group_members").select("group_id").eq("user_id", user!.id).neq("role", "alumni").in("group_id", shareIds),
        supabase.from("groups").select("id, name").in("id", shareIds),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];
  const canJoin = !isMember && (myShareGroups?.length ?? 0) > 0;
  const isOwner = p.owner_id === user?.id;
  const { data: everyone } = isOwner
    ? await supabase.from("profiles").select("id, display_name, institution").order("display_name").limit(1000)
    : { data: [] as any[] };

  const counts: Record<Tab, number> = {
    overview: ms.length - msDone,
    methods: methods.length,
    notebook: entries?.length ?? 0,
    data: datasets?.length ?? 0,
    code: (files?.length ?? 0) + repos.length,
  };

  return (
    <Page
      // On a tab, the heading names the tab; the project is the line above it.
      title={active === "overview" ? p.title : TABS.find((t) => t.id === active)!.label}
      eyebrow={active === "overview" ? undefined : <Link href={`/projects/${p.id}`} style={{ color: "var(--mute)", textDecoration: "none" }}>{p.title}</Link>}
      lede={active === "overview" ? p.summary || undefined : undefined}
      actions={canJoin ? (
        <form action={joinProject.bind(null, p.id)}><button type="submit" style={btnPrimary}>Join this project</button></form>
      ) : isMember && !isOwner ? (
        <form action={leaveProject.bind(null, p.id)}><button type="submit" style={btn}>Leave project</button></form>
      ) : undefined}
    >
      {canJoin && (
        <p style={{ font: "400 13.5px/1.7 var(--sans)", margin: "0 0 14px", padding: "10px 12px", border: "1px solid var(--signal)", background: "var(--surface)" }}>
          Shared with {(shareGroups ?? []).filter((g: any) => (myShareGroups ?? []).some((m: any) => m.group_id === g.id)).map((g: any) => g.name).join(", ")}.
          Join to read and add to its notebook, data and code.
        </p>
      )}
      {saved === "1" && <p role="status" style={{ font: "400 13.5px/1.6 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--ok)", borderRadius: 12, background: "var(--surface)" }}>Project saved.</p>}
      {error === "title" && <p role="alert" style={{ font: "400 13.5px/1.6 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--err)", borderRadius: 12, color: "var(--err)", background: "var(--surface)" }}>A project needs a title.</p>}
      {/* The ways into a project, as one segmented control: no rule runs under it. */}
      <SegTabs label="Project sections" items={TABS.map((t) => ({
        href: t.id === "overview" ? `/projects/${p.id}` : `/projects/${p.id}?tab=${t.id}`, active: t.id === active,
        label: t.id === "overview" ? t.label : `${t.label} ${counts[t.id]}`,
        badge: t.id === "overview" ? counts.overview : undefined, quiet: true,
      }))} />

      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {active === "overview" && (
            <>
              <Panel>
                <PanelHead>Aims</PanelHead>
                <div style={{ padding: 14 }}>
                  {p.aims ? <div style={{ font: "400 14px/1.8 var(--sans)", whiteSpace: "pre-wrap" }}>{p.aims}</div>
                    : <span style={{ font: "400 13px/1.7 var(--sans)", color: "var(--mute)" }}>No aims written yet.{isOwner ? " Add them under Settings below: two or three lines on what the project sets out to show." : ""}</span>}
                  {(p.tags ?? []).length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>{p.tags.map((t: string) => <Tag key={t}>{t}</Tag>)}</div>}
                </div>
              </Panel>

              <Panel>
                <div id="milestones" style={{ scrollMarginTop: 72 }}><PanelHead>Milestones · {msDone} of {ms.length} reached</PanelHead></div>
                {ms.length > 0 && (
                  <div style={{ padding: "12px 14px 4px" }} aria-hidden="true">
                    <div style={{ height: 6, borderRadius: 999, background: "var(--rule)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((msDone / ms.length) * 100)}%`, height: "100%", borderRadius: 999, background: "var(--ok)" }} />
                    </div>
                  </div>
                )}
                {ms.length === 0 && <Empty>No milestones yet. What has to be done, by when?</Empty>}
                {ms.map((m: any) => {
                  const late = !m.done_at && m.due_on && m.due_on <= today();
                  return (
                    <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--rule)" }}>
                      {isMember ? (
                        <form action={toggleMilestone.bind(null, p.id, m.id, !m.done_at)}>
                          <button type="submit" aria-label={m.done_at ? `Mark "${m.title}" as not reached` : `Mark "${m.title}" as reached`}
                            style={{ width: 22, height: 22, borderRadius: 999, padding: 0, cursor: "pointer", border: `1.5px solid ${m.done_at ? "var(--ok)" : "var(--mute)"}`, background: m.done_at ? "var(--ok)" : "transparent", color: "var(--bg)", font: "700 12px/1 var(--sans)" }}>{m.done_at ? "✓" : ""}</button>
                        </form>
                      ) : <span aria-hidden="true" style={{ width: 22, textAlign: "center", color: m.done_at ? "var(--ok)" : "var(--mute)" }}>{m.done_at ? "✓" : "○"}</span>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ font: "500 13.5px/1.5 var(--sans)", textDecoration: m.done_at ? "line-through" : "none", color: m.done_at ? "var(--mute)" : "var(--ink)" }}>{m.title}</div>
                        <div style={{ font: "400 12px/1.5 var(--sans)", color: late ? "var(--err)" : "var(--mute)" }}>
                          {m.done_at ? `reached ${timeAgo(m.done_at)}` : m.due_on ? (late ? `due ${m.due_on}, overdue` : `due ${m.due_on}`) : "no date"}
                        </div>
                      </div>
                      {isMember && (m.created_by === user?.id || isOwner) && (
                        <form action={deleteMilestone.bind(null, p.id, m.id)}><button type="submit" aria-label={`Delete "${m.title}"`} style={{ ...btn, height: 26, padding: "0 9px", borderRadius: 999 }}>×</button></form>
                      )}
                    </div>
                  );
                })}
                {isMember && (
                  <form action={addMilestone.bind(null, p.id)} style={{ display: "flex", gap: 8, padding: 14, flexWrap: "wrap" }}>
                    <label htmlFor="ms-title" style={{ position: "absolute", left: -9999 }}>Milestone</label>
                    <input id="ms-title" name="title" required maxLength={200} placeholder="Next milestone, e.g. day 60 plates run" style={{ ...field, flex: "1 1 240px", width: "auto" }} />
                    <label htmlFor="ms-due" style={{ position: "absolute", left: -9999 }}>Due</label>
                    <input id="ms-due" name="due" type="date" style={{ ...field, width: "auto" }} />
                    <button type="submit" style={{ ...btn, borderRadius: 999 }}>Add</button>
                  </form>
                )}
              </Panel>

              <Panel>
                <PanelHead>What happened lately</PanelHead>
                {recent.length === 0 && <Empty>Nothing yet.</Empty>}
                {recent.map((r, i) => (
                  <Link key={i} href={r.href} style={{ display: "flex", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none", font: "400 13px/1.55 var(--sans)" }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{r.text}</span>
                    <span style={{ color: "var(--mute)", fontSize: 12, whiteSpace: "nowrap" }}>{timeAgo(r.at)}</span>
                  </Link>
                ))}
              </Panel>

              {isOwner && (
                <details id="settings" style={{ scrollMarginTop: 72 }} open={error === "title"}>
                  <summary style={{ listStyle: "none", cursor: "pointer", width: "fit-content", height: 32, padding: "0 14px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", display: "flex", alignItems: "center", font: "600 12.5px/1 var(--sans)", color: "var(--ink)" }}>Project settings</summary>
                  <Panel style={{ marginTop: 8 }}>
                    <form action={updateProject.bind(null, p.id)} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div><label style={fieldLabel} htmlFor="pj-title">Title</label><input id="pj-title" name="title" defaultValue={p.title} required maxLength={200} style={field} /></div>
                      <div><label style={fieldLabel} htmlFor="pj-summary">Summary</label><textarea id="pj-summary" name="summary" rows={2} maxLength={1000} defaultValue={p.summary ?? ""} style={field} /></div>
                      <div><label style={fieldLabel} htmlFor="pj-aims">Aims, one per line</label><textarea id="pj-aims" name="aims" rows={4} maxLength={3000} defaultValue={p.aims ?? ""} style={field} /></div>
                      <div><label style={fieldLabel} htmlFor="pj-tags">Tags, comma separated</label><input id="pj-tags" name="tags" defaultValue={(p.tags ?? []).join(", ")} style={field} /></div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <label style={{ ...fieldLabel, display: "flex", flexDirection: "column", gap: 4 }}>Status
                          <select name="status" defaultValue={p.status} style={{ ...field, width: "auto" }}>{PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                        </label>
                        <label style={{ ...fieldLabel, display: "flex", flexDirection: "column", gap: 4 }}>Who can see it
                          <select name="visibility" defaultValue={p.visibility} style={{ ...field, width: "auto" }}>
                            <option value="private">Only the people on it</option><option value="lab">Lab</option><option value="public">Everyone</option>
                          </select>
                        </label>
                      </div>
                      <div><button type="submit" style={btnPrimary}>Save</button></div>
                    </form>
                  </Panel>
                </details>
              )}
            </>
          )}

          {active === "methods" && (
            <Panel>
              <PanelHead>Method cards · {methods.length}</PanelHead>
              {methods.length === 0 && <Empty>No method cards linked yet.</Empty>}
              {methods.map((m: any) => (
                <div key={m.card_id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Outcome value={m.card.outcome} />
                      <span style={{ font: mono(10.5), color: "var(--mute)" }}>{m.card.code}</span>
                      {m.card.visibility !== "public" && <span style={{ font: mono(10.5), color: "var(--mute)" }}>· {m.card.visibility === "private" ? "private, shared with the project" : "lab"}</span>}
                    </div>
                    <Link href={`/methods/${m.card_id}`} style={{ display: "block", font: mono(13.5, 600, 1.5), color: "var(--ink)", marginTop: 5 }}>{m.card.title}</Link>
                    <div style={{ font: "400 12px/1.6 var(--sans)", color: "var(--mute)", marginTop: 3 }}>by {nameOf(m.card.author_id)}{m.card.system ? ` · ${m.card.system}` : ""} · linked {timeAgo(m.added_at)}</div>
                  </div>
                  {(m.added_by === user?.id || isOwner) && (
                    <form action={unlinkProjectMethod.bind(null, p.id, m.card_id)}><button type="submit" style={{ ...btn, height: 28, padding: "0 12px", borderRadius: 999 }}>Unlink</button></form>
                  )}
                </div>
              ))}
              {isMember && (
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  {linkable.length > 0 && (
                    <form action={linkProjectMethod.bind(null, p.id)} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <label htmlFor="pj-card" style={{ position: "absolute", left: -9999 }}>Method card to link</label>
                      <select id="pj-card" name="card" style={{ ...field, flex: "1 1 240px", width: "auto" }}>
                        {linkable.map((c: any) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
                      </select>
                      <button type="submit" style={{ ...btn, borderRadius: 999 }}>Link to the project</button>
                    </form>
                  )}
                  <span style={{ font: "400 12px/1.6 var(--sans)", color: "var(--mute)" }}>
                    Everyone on the project can read it. <Link href="/methods/new" style={{ color: "var(--link)" }}>Record a new method</Link>.
                  </span>
                </div>
              )}
            </Panel>
          )}

          {active === "notebook" && (
            <Panel>
              <PanelHead>Notebook — append only</PanelHead>
              {isMember ? (
                <form action={addEntry.bind(null, p.id)} style={{ padding: 14, borderBottom: "1px solid var(--rule)" }}>
                  <textarea name="body" rows={4} required style={field} placeholder="What you did, what you observed, what you are doing next." />
                  <button type="submit" style={{ ...btnPrimary, marginTop: 11 }}>Sign and add entry</button>
                </form>
              ) : (
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)", font: "400 13px/1.6 var(--sans)", color: "var(--mute)" }}>
                  Only the people on this project can add to its notebook.
                </div>
              )}
              {(entries?.length ?? 0) === 0 ? (
                <Empty>No entries yet.</Empty>
              ) : entries!.map((e: any) => (
                <div key={e.id} style={{ padding: 14, borderBottom: "1px solid var(--rule)" }}>
                  <div style={{ font: mono(10.5), color: "var(--mute)", marginBottom: 7 }}>
                    {new Date(e.created_at).toISOString().slice(0, 16).replace("T", " ")} · signed · {timeAgo(e.created_at)}
                  </div>
                  <RichText body={e.body} />
                </div>
              ))}
            </Panel>
          )}

          {active === "data" && (
            <Panel>
              <PanelHead>Datasets · {datasets?.length ?? 0}</PanelHead>
              {(datasets?.length ?? 0) === 0 ? (
                <Empty>No datasets deposited in this project yet.</Empty>
              ) : datasets!.map((d: any) => (
                <div key={d.id} style={{ padding: 14, borderBottom: "1px solid var(--rule)" }}>
                  <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                    <Visibility value={d.visibility} />
                    {d.doi && <span style={{ font: mono(10.5), color: "var(--mute)" }}>{d.doi}</span>}
                    <span style={{ marginLeft: "auto", font: mono(10.5), color: "var(--mute)" }}>
                      {bytes(d.size_bytes)} · {timeAgo(d.created_at)}
                    </span>
                  </div>
                  <div style={{ font: mono(14, 500, 1.45) }}>
                    {d.file_path ? (
                      <Link href={`/projects/${p.id}/files/${d.id}`} style={{ color: "var(--ink)" }}>{d.title}</Link>
                    ) : d.title}
                  </div>
                  {d.summary && (
                    <p style={{ font: "400 13.5px/1.7 var(--sans)", color: "var(--mute)", margin: "6px 0 0" }}>{d.summary}</p>
                  )}
                  <div style={{ marginTop: 9 }}><Tag>{d.licence}</Tag></div>
                </div>
              ))}
              {isMember && <details style={{ padding: 14 }}>
                <summary style={{ ...btn, width: "100%", justifyContent: "center", cursor: "pointer", listStyle: "none", borderRadius: 999 }}>Deposit a dataset</summary>
                <form action={depositDataset.bind(null, p.id)} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
                  <div>
                    <label style={fieldLabel} htmlFor="ds-title">Title</label>
                    <input id="ds-title" name="title" required style={field} placeholder="Transfection efficiency by passage number (p8–p24)" />
                  </div>
                  <div>
                    <label style={fieldLabel} htmlFor="ds-summary">What it contains</label>
                    <textarea id="ds-summary" name="summary" rows={3} style={field} placeholder="Three biological replicates per passage, raw counts and normalised values." />
                  </div>
                  <div className="sc-pair" style={{ gap: 12 }}>
                    <div>
                      <label style={fieldLabel} htmlFor="ds-doi">DOI or repository link</label>
                      <input id="ds-doi" name="doi" style={field} placeholder="10.5281/zenodo.1234567" />
                    </div>
                    <div>
                      <label style={fieldLabel} htmlFor="ds-licence">Licence</label>
                      <input id="ds-licence" name="licence" defaultValue="CC BY 4.0" style={field} />
                    </div>
                  </div>
                  <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend style={{ ...fieldLabel, padding: 0 }}>Who can see it</legend>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", font: mono(12) }}>
                      {(["private", "lab", "public"] as const).map((v) => (
                        <label key={v} style={{ cursor: "pointer" }}>
                          <input type="radio" name="visibility" value={v} defaultChecked={v === "private"} style={{ marginRight: 6 }} />{v}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <p style={{ font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)", margin: 0 }}>
                    This records the dataset and where it lives. The files stay in your repository.
                  </p>
                  <button type="submit" style={{ ...btnPrimary, justifyContent: "center", borderRadius: 999 }}>Deposit</button>
                </form>
              </details>}
            </Panel>
          )}

          {active === "code" && (
            <>
              <Repositories scope="project" id={p.id} links={repos} canEdit={isMember || isOwner} canManage={isOwner} me={user!.id} flash={repo} />
              <Panel>
                <PanelHead>Files · {files?.length ?? 0}</PanelHead>
                {(files?.length ?? 0) === 0 ? (
                  <Empty>No code in this project yet.</Empty>
                ) : files!.map((f: any) => (
                  <div key={f.id} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "10px 14px", borderBottom: "1px solid var(--rule)" }}>
                    <span style={{ font: mono(12.5, 500), minWidth: 0, flex: 1, wordBreak: "break-all" }}>
                      {f.file_path ? (
                        <Link href={`/projects/${p.id}/files/${f.id}`} style={{ color: "var(--ink)" }}>{f.path}</Link>
                      ) : f.path}
                    </span>
                    {f.language && <Tag>{f.language}</Tag>}
                    <span style={{ font: mono(10.5), color: "var(--mute)", whiteSpace: "nowrap" }}>{bytes(f.size_bytes)}</span>
                    <span style={{ font: mono(10.5), color: "var(--mute)", whiteSpace: "nowrap" }}>{timeAgo(f.updated_at)}</span>
                  </div>
                ))}
              </Panel>

              <Panel>
                <PanelHead>Recent commits</PanelHead>
                {(commits?.length ?? 0) === 0 ? (
                  <Empty>No commits recorded.</Empty>
                ) : commits!.map((c: any) => (
                  <div key={c.id} style={{ padding: "11px 14px", borderBottom: "1px solid var(--rule)" }}>
                    <div style={{ display: "flex", gap: 9, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ font: mono(11, 700), color: "var(--signal-ink)" }}>{c.sha.slice(0, 7)}</span>
                      <span style={{ font: mono(12.5, 500), flex: 1, minWidth: 0 }}>{c.message}</span>
                      <span style={{ font: mono(10.5), color: "var(--mute)" }}>{timeAgo(c.created_at)}</span>
                    </div>
                    <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 4 }}>
                      {c.author_id ? nameOf(c.author_id) : "Unknown"} · {c.files} file{c.files === 1 ? "" : "s"} changed
                    </div>
                  </div>
                ))}
              </Panel>
            </>
          )}
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
            <PanelHead>Contents</PanelHead>
            <div style={{ padding: 14, font: mono(12, 400, 2) }}>
              <div>{counts.notebook} notebook {counts.notebook === 1 ? "entry" : "entries"}</div>
              <div>{counts.data} dataset{counts.data === 1 ? "" : "s"}</div>
              <div>{counts.code} code file{counts.code === 1 ? "" : "s"}</div>
              <div>{counts.methods} method card{counts.methods === 1 ? "" : "s"}</div>
              <div>{msDone} of {ms.length} milestones reached</div>
            </div>
          </Panel>

          {(shareGroups?.length ?? 0) > 0 && (
            <Panel>
              <PanelHead>Shared with</PanelHead>
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                {shareGroups!.map((g: any) => <Link key={g.id} href={`/groups/${g.id}`} style={{ font: mono(12, 500), color: "var(--ink)" }}>{g.name}</Link>)}
              </div>
            </Panel>
          )}
          <Panel>
            <PanelHead>People · {members?.length ?? 0}</PanelHead>
            <div style={{ padding: 14, font: mono(12, 400, 1.9), display: "flex", flexDirection: "column", gap: 6 }}>
              {(members ?? []).map((m: any) => (
                <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={nameOf(m.user_id)} url={people.get(m.user_id)?.avatar_url} size={22} />
                  <span style={{ flex: 1, minWidth: 0 }}><Link href={`/people/${m.user_id}`} style={{ color: "var(--ink)" }}>{nameOf(m.user_id)}</Link>{!(isOwner && m.user_id !== user?.id) && <span style={{ color: "var(--mute)" }}> · {m.role}</span>}</span>
                  {isOwner && m.user_id !== user?.id && (
                    <form action={setProjectRole.bind(null, p.id, m.user_id)} style={{ display: "flex", gap: 4 }}>
                      <label htmlFor={`pr-${m.user_id}`} style={{ position: "absolute", left: -9999 }}>Role of {nameOf(m.user_id)}</label>
                      <select id={`pr-${m.user_id}`} name="role" defaultValue={m.role} style={{ ...field, width: "auto", height: 28, padding: "0 6px", fontSize: 12 }}>
                        {[...new Set([m.role, ...PROJECT_ROLES])].map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button type="submit" style={{ ...btn, height: 28, padding: "0 9px", borderRadius: 999 }}>Set</button>
                    </form>
                  )}
                  {isOwner && m.user_id !== user?.id && (
                    <form action={removeProjectMember.bind(null, p.id, m.user_id)}>
                      <button type="submit" aria-label={`Remove ${nameOf(m.user_id)} from the project`} style={{ background: "transparent", border: 0, color: "var(--mute)", cursor: "pointer", font: "400 13px/1 var(--sans)" }}>×</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
            {isOwner && (
              <form action={addProjectMember.bind(null, p.id)} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 14px 14px" }}>
                <label htmlFor="pm-person" style={{ position: "absolute", left: -9999 }}>Person to add</label>
                <select id="pm-person" name="person" required defaultValue="" style={{ ...field, width: "100%", minWidth: 0, maxWidth: "100%", boxSizing: "border-box", height: 36, padding: "0 10px" }}>
                  <option value="" disabled>Add a person…</option>
                  {(everyone ?? []).filter((x: any) => !ids.includes(x.id)).map((x: any) => (
                    <option key={x.id} value={x.id}>{x.display_name}{x.institution ? `, ${x.institution}` : ""}</option>
                  ))}
                </select>
                <div><button type="submit" style={{ ...btn, height: 32, borderRadius: 999 }}>Add to the project</button></div>
              </form>
            )}
          </Panel>
        </aside>
      </div>
    </Page>
  );
}
