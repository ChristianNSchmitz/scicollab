import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addEntry, depositDataset } from "@/app/actions/projects";
import { Page, Panel, PanelHead, Empty, Tag, Visibility, field, fieldLabel, btn, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

/**
 * A project and the three things inside it.
 *
 * Data and Code used to be top-level rail destinations, which made them look
 * like separate products and left the rail with thirteen items. They are not
 * separate: a dataset and a repository only mean anything in the context of
 * the work that produced them. So the project is the container — notebook,
 * data and code — which is also what board D1 argues when it calls the
 * project "the thing testers named".
 */

type Tab = "notebook" | "data" | "code";
const TABS: { id: Tab; label: string }[] = [
  { id: "notebook", label: "Notebook" },
  { id: "data",     label: "Data" },
  { id: "code",     label: "Code" },
];

const kb = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB`
  : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB`
  : n >= 1e3 ? `${Math.round(n / 1e3)} kB`
  : `${n} B`;

export default async function Project({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const active: Tab = TABS.some((t) => t.id === tab) ? (tab as Tab) : "notebook";

  const supabase = await createClient();
  const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [{ data: entries }, { data: members }, { data: datasets }, { data: files }, { data: commits }] =
    await Promise.all([
      supabase.from("eln_entries").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("project_members").select("user_id, role").eq("project_id", id),
      supabase.from("datasets").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("code_files").select("*").eq("project_id", id).order("path"),
      supabase.from("code_commits").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(10),
    ]);

  const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
  const { data: { user } } = await supabase.auth.getUser();
  const isMember = !!user && ids.includes(user.id);
  const authorIds = [...new Set((commits ?? []).map((c: any) => c.author_id).filter(Boolean))];
  const { data: people } = [...ids, ...authorIds].length
    ? await supabase.from("profiles").select("id, display_name, institution, avatar_url").in("id", [...new Set([...ids, ...authorIds])])
    : { data: [] as any[] };
  const nameOf = (uid: string) => (people ?? []).find((x: any) => x.id === uid)?.display_name ?? "Someone";

  const counts: Record<Tab, number> = {
    notebook: entries?.length ?? 0,
    data: datasets?.length ?? 0,
    code: files?.length ?? 0,
  };

  return (
    <Page title={p.title} lede={p.summary || undefined}>
      {/* The three ways into a project. */}
      <nav
        aria-label="Project sections"
        style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--ink)", marginBottom: 16, flexWrap: "wrap" }}
      >
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <Link
              key={t.id}
              href={`/projects/${p.id}?tab=${t.id}`}
              aria-current={on ? "page" : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 16px", marginBottom: -1,
                font: mono(12.5, on ? 700 : 500),
                color: on ? "var(--bg)" : "var(--ink)",
                background: on ? "var(--ink)" : "transparent",
                border: "1px solid", borderColor: on ? "var(--ink)" : "transparent",
                borderBottomColor: on ? "var(--ink)" : "transparent",
                textDecoration: "none",
              }}
            >
              {t.label}
              <span style={{ font: mono(10.5, 500), opacity: .7 }}>{counts[t.id]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {active === "notebook" && (
            <Panel>
              <PanelHead>Notebook — append only</PanelHead>
              <form action={addEntry.bind(null, p.id)} style={{ padding: 14, borderBottom: "1px solid var(--rule)" }}>
                <textarea name="body" rows={4} required style={field} placeholder="What you did, what you observed, what you are doing next." />
                <button type="submit" style={{ ...btnPrimary, marginTop: 11 }}>Sign and add entry</button>
              </form>
              {(entries?.length ?? 0) === 0 ? (
                <Empty>No entries yet.</Empty>
              ) : entries!.map((e: any) => (
                <div key={e.id} style={{ padding: 14, borderBottom: "1px solid var(--rule)" }}>
                  <div style={{ font: mono(10.5), color: "var(--mute)", marginBottom: 7 }}>
                    {new Date(e.created_at).toISOString().slice(0, 16).replace("T", " ")} · signed · {timeAgo(e.created_at)}
                  </div>
                  <p style={{ font: "400 13px/1.7 var(--sans)", margin: 0, whiteSpace: "pre-wrap" }}>{e.body}</p>
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
                      {kb(d.size_bytes)} · {timeAgo(d.created_at)}
                    </span>
                  </div>
                  <div style={{ font: mono(14, 500, 1.35) }}>{d.title}</div>
                  {d.summary && (
                    <p style={{ font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)", margin: "6px 0 0" }}>{d.summary}</p>
                  )}
                  <div style={{ marginTop: 9 }}><Tag>{d.licence}</Tag></div>
                </div>
              ))}
              {isMember && <details style={{ padding: 14 }}>
                <summary style={{ ...btn, width: "100%", justifyContent: "center", cursor: "pointer", listStyle: "none" }}>Deposit a dataset</summary>
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
                  <p style={{ font: "400 11.5px/1.5 var(--sans)", color: "var(--mute)", margin: 0 }}>
                    This records the dataset and where it lives. The files stay in your repository.
                  </p>
                  <button type="submit" style={{ ...btnPrimary, justifyContent: "center" }}>Deposit</button>
                </form>
              </details>}
            </Panel>
          )}

          {active === "code" && (
            <>
              <Panel>
                <PanelHead>Files · {files?.length ?? 0}</PanelHead>
                {(files?.length ?? 0) === 0 ? (
                  <Empty>No code in this project yet.</Empty>
                ) : files!.map((f: any) => (
                  <div key={f.id} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "10px 14px", borderBottom: "1px solid var(--rule)" }}>
                    <span style={{ font: mono(12.5, 500), minWidth: 0, flex: 1, wordBreak: "break-all" }}>{f.path}</span>
                    {f.language && <Tag>{f.language}</Tag>}
                    <span style={{ font: mono(10.5), color: "var(--mute)", whiteSpace: "nowrap" }}>{kb(f.size_bytes)}</span>
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
                      <span style={{ font: mono(11, 700), color: "var(--signal)" }}>{c.sha.slice(0, 7)}</span>
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
            <div style={{ padding: 14, font: mono(12, 400, 1.9) }}>
              <div>{counts.notebook} notebook {counts.notebook === 1 ? "entry" : "entries"}</div>
              <div>{counts.data} dataset{counts.data === 1 ? "" : "s"}</div>
              <div>{counts.code} code file{counts.code === 1 ? "" : "s"}</div>
            </div>
          </Panel>

          <Panel>
            <PanelHead>People · {members?.length ?? 0}</PanelHead>
            <div style={{ padding: 14, font: mono(12, 400, 1.8), display: "flex", flexDirection: "column", gap: 6 }}>
              {(members ?? []).map((m: any) => (
                <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={nameOf(m.user_id)} url={(people ?? []).find((x: any) => x.id === m.user_id)?.avatar_url} size={22} />
                  <span>{nameOf(m.user_id)} <span style={{ color: "var(--mute)" }}>· {m.role}</span></span>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </Page>
  );
}
