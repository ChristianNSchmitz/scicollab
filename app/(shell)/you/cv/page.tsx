import YouShell from "@/components/you/YouShell";
import { createClient } from "@/lib/supabase/server";
import { Panel, PanelHead, Empty, btn, btnPrimary, field, fieldLabel } from "@/components/ui";
import { CV_KINDS, CV_LABEL, span, sortCv, type CvEntry } from "@/lib/cv";
import { papersOf } from "@/lib/papers";
import { addCvEntry, updateCvEntry, deleteCvEntry, saveCvProfile } from "@/app/actions/cv";

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  "saved=1": { text: "Saved." },
  "saved=profile": { text: "Research profile and papers saved." },
  "error=title": { text: "Every entry needs a title.", error: true },
  "error=dates": { text: "Dates as 2019 or 2019-04, and the end not before the start.", error: true },
};
const small = { font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)" } as const;

/** One form for adding and editing an entry. */
function EntryFields({ e, kind }: { e?: CvEntry; kind?: string }) {
  const k = (e?.kind ?? kind ?? "position") as keyof typeof CV_LABEL;
  return (
    <>
      {!e && (
        <label style={fieldLabel}>Kind
          <select name="kind" defaultValue={k} style={{ ...field, marginTop: 4 }}>{CV_KINDS.map((x) => <option key={x} value={x}>{CV_LABEL[x].label}</option>)}</select>
        </label>
      )}
      {e && <input type="hidden" name="kind" value={e.kind} />}
      <label style={fieldLabel}>Title<input name="title" required maxLength={300} defaultValue={e?.title} placeholder={CV_LABEL[k].title} style={{ ...field, marginTop: 4 }} /></label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ ...fieldLabel, flex: "2 1 220px" }}>Where<input name="org" maxLength={300} defaultValue={e?.org} placeholder={CV_LABEL[k].org || "Institution"} style={{ ...field, marginTop: 4 }} /></label>
        <label style={{ ...fieldLabel, flex: "1 1 120px" }}>City<input name="place" maxLength={120} defaultValue={e?.place} style={{ ...field, marginTop: 4 }} /></label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ ...fieldLabel, flex: "1 1 120px" }}>From<input name="start_on" defaultValue={e?.start_on} placeholder="2019-04" pattern="\d{4}(-\d{2})?" style={{ ...field, marginTop: 4 }} /></label>
        <label style={{ ...fieldLabel, flex: "1 1 120px" }}>Until<input name="end_on" defaultValue={e?.end_on} placeholder="empty for today" pattern="\d{4}(-\d{2})?" style={{ ...field, marginTop: 4 }} /></label>
      </div>
      <label style={fieldLabel}>Details (optional)<textarea name="detail" rows={2} maxLength={2000} defaultValue={e?.detail} style={{ ...field, marginTop: 4 }} /></label>
    </>
  );
}

/**
 * Your CV: positions, education, grants and the rest, a short research
 * profile, and up to ten papers. Shown on your profile, and exported in the
 * order of the DFG and the ERC CV.
 */
export default async function CvPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;
  const [{ data: rows }, { data: p }] = await Promise.all([
    supabase.from("cv_entries").select("*").eq("user_id", me),
    supabase.from("profiles").select("orcid, cv_summary, cv_papers").eq("id", me).maybeSingle(),
  ]);
  const entries = ((rows ?? []) as CvEntry[]).sort(sortCv);
  const pubs = (await papersOf(me, p?.orcid)).sort((a, b) => b.cited_by_count - a.cited_by_count);
  const chosen = new Set<string>((p?.cv_papers ?? []) as string[]);
  const flash = Object.entries(FLASH).find(([k]) => { const [a, b] = k.split("="); return sp[a] === b; })?.[1];
  const used = CV_KINDS.filter((k) => entries.some((e) => e.kind === k));

  return (
    <YouShell active="cv">
      {flash && <p role={flash.error ? "alert" : "status"} style={{ font: "400 13.5px/1.6 var(--sans)", margin: "0 0 12px", padding: "10px 12px", borderRadius: 12, border: `1px solid ${flash.error ? "var(--err)" : "var(--ok)"}`, background: "var(--surface)" }}>{flash.text}</p>}
      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {used.length === 0 && <Panel><Empty>Your CV is empty. Start with your current position and your degrees; everything else can follow.</Empty></Panel>}
          {used.map((k) => (
            <Panel key={k}>
              <div id={k} style={{ scrollMarginTop: 72 }}><PanelHead>{CV_LABEL[k].label}</PanelHead></div>
              {entries.filter((e) => e.kind === k).map((e) => (
                <div key={e.id} id={`e-${e.id}`} style={{ padding: "11px 14px", borderBottom: "1px solid var(--rule)", scrollMarginTop: 72 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ ...small, minWidth: 110 }}>{span(e)}</span>
                    <span style={{ flex: "1 1 240px", minWidth: 0, font: "400 13.5px/1.6 var(--sans)" }}>
                      <b style={{ fontWeight: 600 }}>{e.title}</b>{e.org && <>, {e.org}</>}{e.place && <span style={{ color: "var(--mute)" }}>, {e.place}</span>}
                      {e.detail && <span style={{ display: "block", ...small }}>{e.detail}</span>}
                    </span>
                  </div>
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ listStyle: "none", cursor: "pointer", width: "fit-content", ...small, fontWeight: 600 }}>Edit</summary>
                    <form action={updateCvEntry.bind(null, e.id)} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      <EntryFields e={e} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="submit" style={btnPrimary}>Save</button>
                        <button type="submit" formAction={deleteCvEntry.bind(null, e.id)} style={{ ...btn, borderColor: "var(--err)", color: "var(--err)" }}>Delete</button>
                      </div>
                    </form>
                  </details>
                </div>
              ))}
            </Panel>
          ))}

          <Panel>
            <div id="add" style={{ scrollMarginTop: 72 }}><PanelHead>Add to your CV</PanelHead></div>
            <form action={addCvEntry} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <EntryFields kind={sp.kind} />
              <div><button type="submit" style={btnPrimary}>Add</button></div>
            </form>
          </Panel>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <PanelHead>Export</PanelHead>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ ...small, margin: 0 }}>In the order funders ask for. Opens a page you can print or save as PDF, or download for Word.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href="/you/cv/export?format=dfg" target="_blank" rel="noreferrer" style={btnPrimary}>DFG CV</a>
                <a href="/you/cv/export?format=erc" target="_blank" rel="noreferrer" style={btn}>ERC CV</a>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", ...small }}>
                <a href="/you/cv/export?format=dfg&as=doc" style={{ color: "var(--link)" }}>DFG for Word</a>
                <a href="/you/cv/export?format=erc&as=doc" style={{ color: "var(--link)" }}>ERC for Word</a>
              </div>
            </div>
          </Panel>

          <Panel>
            <div id="profile" style={{ scrollMarginTop: 72 }}><PanelHead>Research profile and papers</PanelHead></div>
            <form action={saveCvProfile} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={fieldLabel}>Research profile (a few lines; the CV puts it under &quot;Scientific profile&quot;)
                <textarea name="summary" rows={5} maxLength={3000} defaultValue={p?.cv_summary ?? ""} style={{ ...field, marginTop: 4 }} />
              </label>
              <div style={fieldLabel}>Papers for the CV (up to ten)</div>
              {pubs.length === 0 && <span style={small}>Link your ORCID in Settings, and your publications appear here to choose from.</span>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
                {pubs.slice(0, 80).map((x) => (
                  <label key={x.openalex_id} style={{ display: "flex", gap: 8, alignItems: "flex-start", font: "400 12.5px/1.5 var(--sans)" }}>
                    <input type="checkbox" name="papers" value={x.openalex_id} defaultChecked={chosen.has(x.openalex_id)} style={{ marginTop: 3 }} />
                    <span>{x.title}<span style={{ color: "var(--mute)" }}> · {[x.venue, x.year, `${x.cited_by_count} cit.`].filter(Boolean).join(" · ")}</span></span>
                  </label>
                ))}
              </div>
              <span style={small}>None chosen: the export takes your ten most cited.</span>
              <div><button type="submit" style={btnPrimary}>Save</button></div>
            </form>
          </Panel>
        </aside>
      </div>
    </YouShell>
  );
}
