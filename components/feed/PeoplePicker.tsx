"use client";

import { useEffect, useState } from "react";
import { findPeople } from "@/app/actions/chat";

type Person = { id: string; name: string; institution: string };

/**
 * Choose a few people by name: chips with ×, a search field, and one hidden
 * input per person (named `name`) so the form submits them like any field.
 */
export default function PeoplePicker({ name, max, label, initial = [] }: { name: string; max: number; label: string; initial?: Person[] }) {
  const [chosen, setChosen] = useState<Person[]>(initial);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Person[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = window.setTimeout(async () => setHits((await findPeople(q)).filter((p) => !chosen.some((c) => c.id === p.id))), 200);
    return () => window.clearTimeout(t);
  }, [q, chosen]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {chosen.map((p) => (
          <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 4px 0 10px", borderRadius: 999, background: "color-mix(in srgb, var(--ink) 7%, transparent)", font: "500 12.5px/1 var(--sans)" }}>
            {p.name}
            <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setChosen(chosen.filter((c) => c.id !== p.id))}
              style={{ width: 20, height: 20, borderRadius: 999, border: 0, background: "transparent", color: "var(--mute)", cursor: "pointer", font: "600 13px/1 var(--sans)" }}>×</button>
            <input type="hidden" name={name} value={p.id} />
          </span>
        ))}
        {chosen.length < max && (
          <input aria-label={label} value={q} onChange={(e) => setQ(e.target.value)} placeholder={chosen.length ? "Add someone" : label} autoComplete="off"
            style={{ flex: "1 1 180px", height: 32, padding: "0 12px", border: "1px solid var(--rule)", borderRadius: 999, background: "var(--bg)", color: "var(--ink)", font: "400 13px/1 var(--sans)" }} />
        )}
      </div>
      {hits.length > 0 && (
        <div role="listbox" aria-label="People found" style={{ border: "1px solid var(--rule)", borderRadius: 12, background: "var(--surface)", padding: 4 }}>
          {hits.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected={false} className="sc-menu-item"
              onClick={() => { setChosen([...chosen, p]); setQ(""); setHits([]); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: 0, borderRadius: 10, background: "transparent", color: "var(--ink)", font: "400 13px/1.4 var(--sans)", cursor: "pointer" }}>
              <b style={{ fontWeight: 600 }}>{p.name}</b>{p.institution && <span style={{ color: "var(--mute)" }}> · {p.institution}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
