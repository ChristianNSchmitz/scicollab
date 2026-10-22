import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, PanelHead, Empty, btn, field, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { bibliometricsFor } from "@/lib/record/bibliometrics";
import { citationProfile } from "@/lib/record/citations";
import { loadPublications, syncIfDue, sortPublications, newIds, pubSort, PUB_SORTS, thisYearOf } from "@/lib/record/publications";
import { SYNC_INTERVAL_MS } from "@/lib/openalex/sync";
import { syncNow } from "@/app/actions/openalex";
import { ensureRecordSeed } from "@/lib/record/demo-seed";
import PublicationRow from "@/components/record/PublicationRow";
import YearBars from "@/components/record/YearBars";

export const dynamic = "force-dynamic";

const FLASH: Record<string, string> = {
  ok: "Synced just now.", cooldown: "Synced less than 10 minutes ago; try again shortly.",
  "rate-limited": "OpenAlex's daily allowance is used up; the next scheduled sync will retry.",
  "not-found": "OpenAlex has no record for this ORCID.", error: "OpenAlex could not be reached; the next sync will retry.",
  skipped: "Nothing to sync for this account.",
};

/**
 * Your publications — every work OpenAlex attributes to your ORCID, with the
 * current numbers for each: total citations, this year and last year, the
 * change since the last sync, and a six-year trend. Searchable and sortable.
 */
export default async function Publications({
  searchParams,
}: { searchParams: Promise<{ sort?: string; q?: string; type?: string; sync?: string }> }) {
  ensureRecordSeed();
  const sp = await searchParams;
  const sort = pubSort(sp.sort);
  const q = (sp.q ?? "").trim().toLowerCase();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("orcid").eq("id", user!.id).maybeSingle();

  await syncIfDue(user!.id, profile?.orcid, { waitForFirst: true });
  const [biblio, data] = await Promise.all([
    bibliometricsFor(user!.id, profile?.orcid),
    loadPublications(user!.id, profile?.orcid, 10),
  ]);
  const { pubs, runs, example } = data;
  const c = citationProfile(pubs);
  const fresh = newIds(runs, example, pubs);

  const types = [...new Set(pubs.map((p) => p.type).filter(Boolean))].sort();
  const type = types.includes(sp.type ?? "") ? sp.type! : "";
  const shown = sortPublications(pubs, sort, c).filter((p) =>
    (!type || p.type === type) &&
    (!q || `${p.title} ${p.venue} ${p.doi ?? ""}`.toLowerCase().includes(q)));

  const href = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { sort: sort === "new" ? undefined : sort, q: sp.q, type: type || undefined, ...patch };
    Object.entries(merged).forEach(([k, v]) => { if (v) u.set(k, v); });
    const s = u.toString();
    return s ? `/you/publications?${s}` : "/you/publications";
  };

  if (biblio.state === "no-orcid" || biblio.state === "invalid-orcid") {
    return (
      <Page title="Your publications" lede="Publications and citations come from OpenAlex, matched by your ORCID.">
        <Panel><Empty>
          {biblio.state === "no-orcid" ? "No ORCID linked yet." : `“${biblio.orcid}” is not a valid ORCID iD.`}{" "}
          <Link href="/settings#orcid" style={{ color: "var(--link)" }}>Link your ORCID in Settings</Link> and your publications appear here, updated automatically.
        </Empty></Panel>
      </Page>
    );
  }

  const ok = biblio.state === "ok" ? biblio : null;
  const synced = ok?.updated ?? runs.find((r) => r.status === "ok")?.finished_at ?? null;
  const nextIn = synced ? Math.max(0, +new Date(synced) + SYNC_INTERVAL_MS - Date.now()) : 0;
  const hours = (ms: number) => (ms < 3600e3 ? `${Math.max(1, Math.round(ms / 60e3))} min` : `${Math.round(ms / 3600e3)} h`);
  const h = c.hIndexByYear;
  const hDelta = h.length > 1 ? h.at(-1)!.value - h.at(-2)!.value : null;
  const lastYearCites = ok?.countsByYear.find((x) => x.year === c.year - 1)?.cited_by_count ?? 0;
  const sinceSync = pubs.reduce((n, p) => n + (p.cited_by_count - p.prev_cited_by_count), 0);

  const stats: [string, string | number, string][] = ok ? [
    ["Publications", ok.works, `${pubs.length} listed here`],
    ["Citations", ok.citations.toLocaleString("en-GB"), sinceSync ? `${sinceSync > 0 ? "+" : ""}${sinceSync} since last sync` : "no change since last sync"],
    [`Citations in ${c.year}`, ok.citationsThisYear, `${lastYearCites} in ${c.year - 1}`],
    ["h-index", ok.hIndex, hDelta === null ? "history after the next full sync" : `${hDelta >= 0 ? "+" : ""}${hDelta} since ${c.year - 1}`],
    ["i10-index", ok.i10, "works with 10+ citations"],
  ] : [];

  const pill = (on: boolean): React.CSSProperties => ({
    font: mono(11, 500), padding: "4px 9px", border: "1px solid var(--rule)", textDecoration: "none", whiteSpace: "nowrap",
    background: on ? "var(--ink)" : "transparent", color: on ? "var(--bg)" : "var(--ink)",
  });

  return (
    <Page
      title="Your publications"
      lede="Every work OpenAlex attributes to your ORCID, with its current citations. Checked every 12 hours; nothing here is entered by hand."
      actions={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <a href="/you/publications/export" download style={btn}>BibTeX</a>
          <a href="/you/publications/export?format=csv" download style={btn}>CSV</a>
          {!example && <form action={syncNow.bind(null, "/you/publications")}><button type="submit" style={btn}>Sync now</button></form>}
        </div>
      }
    >
      {sp.sync && FLASH[sp.sync] && (
        <p role="status" style={{ font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--rule)", background: "var(--surface)" }}>{FLASH[sp.sync]}</p>
      )}

      {ok ? (
        <Panel style={{ marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 1, background: "var(--rule)" }}>
            {stats.map(([label, value, sub]) => (
              <div key={label} style={{ padding: "14px 16px", background: "var(--surface)" }}>
                <div style={{ font: mono(26, 700), letterSpacing: "-.02em" }}>{value}</div>
                <div style={{ font: mono(11, 500), marginTop: 5 }}>{label}</div>
                <div style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)", marginTop: 3 }}>{sub}</div>
              </div>
            ))}
          </div>
          <div className="sc-pair" style={{ gap: 1, background: "var(--rule)", borderTop: "1px solid var(--rule)" }}>
            <div style={{ padding: "12px 16px", background: "var(--surface)" }}>
              <div style={{ font: mono(10, 700), letterSpacing: ".1em", color: "var(--mute)", marginBottom: 8 }}>CITATIONS PER YEAR</div>
              <YearBars points={ok.countsByYear.filter((x) => x.year > c.year - 10).map((x) => ({ year: x.year, value: x.cited_by_count }))} unit="citations" current={c.year} height={48} />
            </div>
            <div style={{ padding: "12px 16px", background: "var(--surface)" }}>
              <div style={{ font: mono(10, 700), letterSpacing: ".1em", color: "var(--mute)", marginBottom: 8 }}>H-INDEX BY YEAR</div>
              {h.length ? <YearBars points={h} unit="h-index" current={c.year} height={48} />
                : <p style={{ font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)", margin: 0 }}>Appears after the next full sync.</p>}
            </div>
          </div>
          <div style={{ padding: "8px 16px", borderTop: "1px solid var(--rule)", font: mono(10.5), color: "var(--mute)", display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span>{example ? "example values · demo account, not synced" : synced ? `checked ${timeAgo(synced)} · next check in ~${hours(nextIn)}` : "first sync pending"}</span>
            {ok.url && !ok.example && <a href={ok.url} target="_blank" rel="noreferrer" style={{ color: "var(--link)" }}>your OpenAlex record ↗</a>}
          </div>
        </Panel>
      ) : (
        <Panel style={{ marginBottom: 14 }}>
          <div style={{ padding: 14, font: "400 13.5px/1.6 var(--sans)", color: "var(--mute)" }}>
            {biblio.state === "pending" ? "Fetching your record from OpenAlex for the first time. Reload in a moment."
              : biblio.state === "not-found" ? "OpenAlex has no author for your ORCID yet. It is checked again on every sync."
              : `${biblio.state === "unreachable" && biblio.message ? biblio.message : "OpenAlex could not be reached."} The next sync will try again.`}
          </div>
        </Panel>
      )}

      <Panel>
        <form action="/you/publications" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--rule)" }}>
          {sort !== "new" && <input type="hidden" name="sort" value={sort} />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search title, journal or DOI" aria-label="Search publications"
                 style={{ ...field, flex: "1 1 220px", height: 32, padding: "5px 9px" }} />
          {types.length > 1 && (
            <select name="type" defaultValue={type} aria-label="Type" style={{ ...field, width: "auto", height: 32, padding: "4px 8px" }}>
              <option value="">All types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <button type="submit" style={{ ...btn, height: 32 }}>Filter</button>
          {(q || type) && <Link href={href({ q: undefined, type: undefined })} style={{ font: mono(11), color: "var(--link)" }}>clear</Link>}
        </form>
        <div role="group" aria-label="Sort" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: "8px 14px", borderBottom: "1px solid var(--rule)" }}>
          {PUB_SORTS.map((s) => (
            <Link key={s.key} href={href({ sort: s.key === "new" ? undefined : s.key })} aria-current={s.key === sort ? "true" : undefined} style={pill(s.key === sort)}>{s.label}</Link>
          ))}
          <span style={{ marginLeft: "auto", font: mono(10.5), color: "var(--mute)" }}>
            {shown.length === pubs.length ? `${pubs.length} publications` : `${shown.length} of ${pubs.length}`}
            {sort === "year" && ` · ${shown.filter((p) => thisYearOf(p, c) > 0).length} cited in ${c.year}`}
          </span>
        </div>
        {shown.length === 0 ? (
          <Empty>{pubs.length === 0 ? "No publications in OpenAlex for this ORCID yet." : "Nothing matches that filter."}</Empty>
        ) : shown.map((p) => <PublicationRow key={p.openalex_id} p={p} c={c} isNew={fresh.has(p.openalex_id)} detailed />)}
        <div style={{ padding: "9px 14px", font: "400 12px/1.6 var(--sans)", color: "var(--mute)" }}>
          From <a href="https://openalex.org" target="_blank" rel="noreferrer" style={{ color: "var(--link)" }}>OpenAlex</a> by your ORCID.
          Per-year counts cover about the last ten years. A missing or wrongly attributed paper needs fixing in ORCID or OpenAlex; it follows on the next sync.
        </div>
      </Panel>

      {runs.length > 0 && !example && (
        <Panel style={{ marginTop: 14 }}>
          <PanelHead>Sync history · last {runs.length}</PanelHead>
          {runs.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "7px 14px", borderTop: "1px solid var(--rule)", font: mono(11, 400, 1.5) }}>
              <span style={{ color: "var(--mute)", minWidth: 150 }}>{new Date(r.started_at).toISOString().slice(0, 16).replace("T", " ")} UTC</span>
              <span style={{ color: "var(--mute)", minWidth: 64 }}>{r.trigger}</span>
              <span style={{ flex: 1, minWidth: 200, color: r.status === "ok" || r.status === "running" ? "var(--ink)" : "var(--err)" }}>
                {r.status === "running" ? "running…"
                  : r.status !== "ok" ? (r.error ?? r.status)
                  : r.initial ? "first import"
                  : [r.citations_delta ? `${r.citations_delta > 0 ? "+" : ""}${r.citations_delta} citations` : null,
                     r.new_works ? `${r.new_works} new publication${r.new_works > 1 ? "s" : ""}` : null,
                     r.removed_works ? `${r.removed_works} removed` : null].filter(Boolean).join(" · ") || "no change"}
              </span>
            </div>
          ))}
        </Panel>
      )}
    </Page>
  );
}
