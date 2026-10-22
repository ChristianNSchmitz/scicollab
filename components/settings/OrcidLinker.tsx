"use client";

import { useState, useTransition } from "react";
import { findOrcid, linkOrcid, lookupOrcid, unlinkOrcid, type OrcidPreview } from "@/app/actions/orcid";
import { normaliseOrcid, orcidProblem, orcidUrl } from "@/lib/orcid";
import { btn, btnPrimary, field, fieldLabel, mono } from "@/components/ui";

export type LinkedSummary = {
  orcid: string;
  name: string | null;
  works: number | null;
  citations: number | null;
  hIndex: number | null;
  syncedAt: string | null;
  state: string;
};

function PreviewCard({ p, action }: { p: OrcidPreview; action?: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--rule)", background: "var(--bg)", padding: "10px 12px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <div style={{ font: mono(13, 500) }}>{p.name || "Unnamed author"}</div>
        <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 4 }}>
          {[p.institution, `${p.works} works`, `${p.citations.toLocaleString("en-GB")} citations`, `h-index ${p.hIndex}`].filter(Boolean).join(" · ")}
        </div>
        <a href={orcidUrl(p.orcid)} target="_blank" rel="noreferrer" style={{ font: mono(10.5), color: "var(--link)" }}>{p.orcid} ↗</a>
      </div>
      {action}
    </div>
  );
}

export default function OrcidLinker({ linked, defaultName }: { linked: LinkedSummary | null; defaultName: string }) {
  const [editing, setEditing] = useState(!linked);
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState<OrcidPreview | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [name, setName] = useState(defaultName.replace(/\([^)]*\)/g, "").trim());
  const [results, setResults] = useState<OrcidPreview[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const problem = value ? orcidProblem(value) : null;
  const canonical = normaliseOrcid(value);

  const linkForm = (orcid: string, label: string, primary = true) => (
    <form action={linkOrcid}>
      <input type="hidden" name="orcid" value={orcid} />
      <button type="submit" style={primary ? btnPrimary : btn}>{label}</button>
    </form>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {linked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ font: mono(10, 700), letterSpacing: ".08em", color: "var(--ok)", border: "1px solid var(--ok)", padding: "2px 6px" }}>LINKED</span>
            <a href={orcidUrl(linked.orcid)} target="_blank" rel="noreferrer" style={{ font: mono(13, 500), color: "var(--ink)" }}>{linked.orcid} ↗</a>
          </div>
          <div style={{ font: "400 12px/1.6 var(--sans)", color: "var(--mute)" }}>
            {linked.state === "ok" ? (
              <>OpenAlex: <b style={{ color: "var(--ink)" }}>{linked.name}</b> · {linked.works} works · {linked.citations?.toLocaleString("en-GB")} citations · h-index {linked.hIndex}
                {linked.syncedAt && <> · checked {new Date(linked.syncedAt).toISOString().slice(0, 16).replace("T", " ")} UTC</>}</>
            ) : linked.state === "pending" ? "The first sync is running. Publications and citations appear on your profile in a moment."
              : linked.state === "not-found" ? "OpenAlex has no author for this ORCID yet. It is checked again on every sync."
              : "Not synced yet."}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href="/you" style={btn}>See publications</a>
            {!editing && <button type="button" style={btn} onClick={() => setEditing(true)}>Link a different ORCID</button>}
            <form action={unlinkOrcid} onSubmit={(e) => { if (!confirm("Unlink this ORCID? Synced publications and citation history are removed from SciCollab.")) e.preventDefault(); }}>
              <button type="submit" style={{ ...btn, borderColor: "var(--rule)", color: "var(--err)" }}>Unlink</button>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <>
          <div>
            <label style={fieldLabel} htmlFor="orcid-input">ORCID iD</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                id="orcid-input" value={value} inputMode="text" autoComplete="off" spellCheck={false}
                onChange={(e) => { setValue(e.target.value); setChecked(null); setLookupError(null); }}
                placeholder="0000-0002-1825-0097 or https://orcid.org/…"
                aria-invalid={problem ? true : undefined}
                style={{ ...field, flex: "1 1 260px", ...(problem ? { borderColor: "var(--err)" } : {}) }}
              />
              <button type="button" style={btn} disabled={!canonical || pending}
                      onClick={() => start(async () => {
                        const r = await lookupOrcid(value);
                        if (r.ok) { setChecked(r.preview); setLookupError(null); } else { setChecked(null); setLookupError(r.error); }
                      })}>
                {pending ? "Checking…" : "Check"}
              </button>
            </div>
            {problem && <p role="alert" style={{ font: "400 11.5px/1.5 var(--sans)", color: "var(--err)", margin: "6px 0 0" }}>{problem}</p>}
            {canonical && !checked && !lookupError && (
              <p style={{ font: "400 11.5px/1.5 var(--sans)", color: "var(--mute)", margin: "6px 0 0" }}>
                Valid iD. Check it to see whose record it is before linking.
              </p>
            )}
          </div>

          {checked && <PreviewCard p={checked} action={linkForm(checked.orcid, "Link this ORCID")} />}
          {lookupError && canonical && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <p style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)", margin: 0, flex: "1 1 260px" }}>{lookupError}</p>
              {linkForm(canonical, "Link anyway", false)}
            </div>
          )}

          <details>
            <summary style={{ font: mono(11.5), color: "var(--link)", cursor: "pointer" }}>Don&apos;t know your ORCID? Find it by name</summary>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name as it appears on papers"
                     style={{ ...field, flex: "1 1 260px" }} aria-label="Name to search" />
              <button type="button" style={btn} disabled={pending}
                      onClick={() => start(async () => {
                        const r = await findOrcid(name);
                        if (r.ok) { setResults(r.results); setSearchError(null); } else { setResults(null); setSearchError(r.error); }
                      })}>Search OpenAlex</button>
            </div>
            {searchError && <p role="alert" style={{ font: "400 11.5px/1.5 var(--sans)", color: "var(--err)", margin: "6px 0 0" }}>{searchError}</p>}
            {results && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {results.length === 0 ? (
                  <p style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)", margin: 0 }}>No authors with an ORCID match that name. You can register one free at orcid.org.</p>
                ) : results.map((r) => (
                  <PreviewCard key={r.orcid} p={r} action={linkForm(r.orcid, "This is me", false)} />
                ))}
              </div>
            )}
          </details>

          {linked && <div><button type="button" style={{ ...btn, borderColor: "var(--rule)" }} onClick={() => { setEditing(false); setValue(""); setChecked(null); }}>Cancel</button></div>}
        </>
      )}

      <p style={{ font: "400 11px/1.6 var(--sans)", color: "var(--mute)", margin: 0 }}>
        The link is self-declared for now: signing in with ORCID, which proves the iD is yours, is not connected yet.
        Publications, citations and the h-index come from OpenAlex, matched by your ORCID, and are checked every 12 hours.
        A change on OpenAlex usually shows here within a day. If a paper is missing, fix it in ORCID or OpenAlex; it follows on the next sync.
      </p>
    </div>
  );
}
