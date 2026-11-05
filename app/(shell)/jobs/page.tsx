import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { peopleById } from "@/lib/people";
import { likeTerm } from "@/lib/query";
import { ROOMS, roomById } from "@/lib/taxonomy";
import { timeAgo } from "@/lib/format";
import { postOpportunity, setOpportunityStatus, deleteOpportunity, saveOpportunity } from "@/app/actions/opportunities";
import { Page, Panel, Empty, btn, btnPrimary, field, fieldLabel } from "@/components/ui";
import SegTabs from "@/components/SegTabs";
import PersonLink from "@/components/social/PersonLink";

export const dynamic = "force-dynamic";

type Search = { kind?: string; q?: string; level?: string; due?: string; show?: string; posted?: string; error?: string };

const LEVELS = { job: ["PhD", "Postdoc", "Clinician scientist", "Group leader", "Professor", "Technician", "Data scientist", "Student assistant"], funding: ["Fellowship", "Project grant", "Starting grant", "Networking", "Travel grant", "Prize"] };
const ERRORS: Record<string, string> = {
  title: "A title of at least three characters.", url: "The link must start with http:// or https://.", deadline: "The deadline as a date.",
  limit: "That is a lot of posts in a day. Try again tomorrow.", save: "That did not go through. Try again.",
};
const small = { font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)" } as const;
const days = (d: string) => Math.ceil((+new Date(d + "T23:59:59") - Date.now()) / 864e5);

/**
 * Jobs and funding calls, posted by members: positions from PhD to group
 * leader, and fellowships and grants with their deadlines. "For you" puts
 * first what matches your techniques and topic groups. Saved ones stay at
 * hand; a funding call can turn into a call for a partner.
 */
export default async function Jobs({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const kind = sp.kind === "funding" ? "funding" : "job";
  const show = sp.show === "saved" || sp.show === "mine" || sp.show === "foryou" ? sp.show : "all";
  const term = likeTerm(sp.q ?? "");
  const due = /^\d{4}-\d{2}-\d{2}$/.test(sp.due ?? "") ? sp.due! : "";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;
  const today = new Date().toISOString().slice(0, 10);

  let q = supabase.from("opportunities").select("*").eq("kind", kind).order("created_at", { ascending: false }).limit(200);
  if (show !== "mine") q = q.eq("status", "open");
  if (term) q = q.or(`title.ilike.%${term}%,org.ilike.%${term}%,body.ilike.%${term}%,place.ilike.%${term}%,level.ilike.%${term}%`);
  if (sp.level) q = q.eq("level", sp.level);
  if (due) q = q.lte("deadline", due);
  if (show === "mine") q = q.eq("posted_by", me);
  const [{ data: rows }, { data: saves }, { data: profile }, { data: rooms }] = await Promise.all([
    q,
    supabase.from("opportunity_saves").select("opportunity_id").eq("user_id", me),
    supabase.from("profiles").select("techniques").eq("id", me).maybeSingle(),
    supabase.from("user_rooms").select("room_id").eq("user_id", me),
  ]);
  const saved = new Set((saves ?? []).map((s: any) => s.opportunity_id));
  const myT = ((profile?.techniques ?? []) as string[]).map((t) => t.toLowerCase());
  const myRooms = new Set((rooms ?? []).map((r: any) => r.room_id));
  const matchOf = (o: any) => {
    const t = (o.techniques ?? []).filter((x: string) => myT.some((m) => x.toLowerCase().includes(m) || m.includes(x.toLowerCase())));
    const r = (o.topics ?? []).filter((x: string) => myRooms.has(x));
    return { t, r, score: t.length * 2 + r.length };
  };
  let list = ((rows ?? []) as any[]).filter((o) => show === "mine" || !o.deadline || o.deadline >= today);
  if (show === "saved") list = list.filter((o) => saved.has(o.id));
  if (show === "foryou") list = list.filter((o) => matchOf(o).score > 0).sort((a, b) => matchOf(b).score - matchOf(a).score);
  else list.sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  const people = await peopleById(supabase, list.map((o) => o.posted_by));
  const base = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ kind, q: sp.q, level: sp.level, due: sp.due, show: show === "all" ? undefined : show, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/jobs?${p}`;
  };
  const pill = (on: boolean) => ({ font: "500 12.5px/1 var(--sans)", padding: "8px 12px", borderRadius: 999, border: "1px solid var(--rule)", background: on ? "var(--ink)" : "var(--surface)", color: on ? "var(--bg)" : "var(--ink)", textDecoration: "none", whiteSpace: "nowrap" as const });

  return (
    <Page title="Jobs and funding" ad lede={kind === "job" ? "Positions from PhD to group leader, posted by the labs themselves." : "Fellowships and grants, sorted by deadline."}
      actions={<a href="#post" style={btnPrimary}>{kind === "job" ? "Post a position" : "Post a funding call"}</a>}>
      <SegTabs label="Open positions or funding" items={[{ href: "/jobs", label: "Open positions", active: kind === "job" }, { href: "/jobs?kind=funding", label: "Funding", active: kind === "funding" }]} />
      {sp.posted === "1" && <p role="status" style={{ font: "400 13.5px/1.6 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--ok)", borderRadius: 12, background: "var(--surface)" }}>Posted.</p>}

      <form role="search" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <input type="hidden" name="kind" value={kind} />
        {show !== "all" && <input type="hidden" name="show" value={show} />}
        <label style={{ ...fieldLabel, flex: "2 1 240px" }}>Any word<input name="q" defaultValue={sp.q ?? ""} placeholder={kind === "job" ? "fMRI, Mannheim, psychiatry…" : "DFG, ERC, Walter Benjamin…"} style={{ ...field, marginTop: 4 }} /></label>
        <label style={{ ...fieldLabel, flex: "1 1 150px" }}>{kind === "job" ? "Level" : "Kind"}
          <select name="level" defaultValue={sp.level ?? ""} style={{ ...field, marginTop: 4 }}><option value="">Any</option>{LEVELS[kind].map((l) => <option key={l}>{l}</option>)}</select>
        </label>
        <label style={{ ...fieldLabel, flex: "1 1 140px" }}>Deadline before<input name="due" type="date" defaultValue={due} style={{ ...field, marginTop: 4 }} /></label>
        <button type="submit" style={{ ...btn, height: 38 }}>Search</button>
      </form>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <Link href={base({ show: undefined })} style={pill(show === "all")}>All open</Link>
        <Link href={base({ show: "foryou" })} style={pill(show === "foryou")} title="Matches your techniques or topic groups">For you</Link>
        <Link href={base({ show: "saved" })} style={pill(show === "saved")}>Saved · {saved.size}</Link>
        <Link href={base({ show: "mine" })} style={pill(show === "mine")}>Posted by you</Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
        {list.length === 0 && <Panel><Empty>{show === "foryou" ? "Nothing matches your techniques or topic groups yet. Add techniques in Settings, or look at all open ones." : show === "saved" ? "Nothing saved yet." : "Nothing here yet. Post the first one below."}</Empty></Panel>}
        {list.map((o) => {
          const m = matchOf(o);
          const left = o.deadline ? days(o.deadline) : null;
          return (
            <article key={o.id} id={`o-${o.id}`} style={{ scrollMarginTop: 72 }}>
              <Panel>
                <div style={{ padding: "13px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                      <div style={{ font: "700 15px/1.4 var(--sans)" }}>{o.url ? <a href={o.url} target="_blank" rel="noopener noreferrer nofollow ugc" style={{ color: "var(--ink)" }}>{o.title} ↗</a> : o.title}</div>
                      <div style={small}>{[o.level, o.org, o.place].filter(Boolean).join(" · ")}</div>
                    </div>
                    {o.deadline && <span style={{ padding: "3px 10px", borderRadius: 999, font: "600 12px/1.5 var(--sans)", whiteSpace: "nowrap",
                      color: left !== null && left <= 14 ? "var(--err)" : "var(--ink)", border: `1px solid ${left !== null && left <= 14 ? "var(--err)" : "var(--rule)"}` }}>
                      {o.status === "closed" ? "closed" : left === 0 ? "deadline today" : `deadline ${o.deadline}${left !== null && left <= 30 ? ` · ${left} d` : ""}`}</span>}
                  </div>
                  {o.body && <p style={{ margin: 0, font: "400 13.5px/1.65 var(--sans)", whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{o.body}</p>}
                  {((o.techniques ?? []).length > 0 || (o.topics ?? []).length > 0) && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(o.techniques ?? []).map((t: string) => <span key={t} style={{ padding: "2px 9px", borderRadius: 999, font: "500 12px/1.6 var(--sans)", background: m.t.includes(t) ? "color-mix(in srgb, var(--ok) 16%, transparent)" : "color-mix(in srgb, var(--ink) 6%, transparent)" }}>{t}</span>)}
                      {(o.topics ?? []).map((t: string) => <span key={t} title={roomById(t)?.name} style={{ padding: "2px 9px", borderRadius: 999, font: "500 12px/1.6 var(--sans)", color: m.r.includes(t) ? "var(--ok)" : "var(--mute)" }}>#{t}</span>)}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                    <span style={{ ...small, flex: 1 }}>Posted by <PersonLink id={o.posted_by} style={{ color: "var(--ink)" }}>{people.get(o.posted_by)?.display_name ?? "a member"}</PersonLink> · {timeAgo(o.created_at)}
                      {m.score > 0 && <span style={{ color: "var(--ok)" }}> · matches your {m.t.length ? "techniques" : "topics"}</span>}</span>
                    <form action={saveOpportunity.bind(null, o.id, !saved.has(o.id))}><button type="submit" style={{ ...btn, height: 30, ...(saved.has(o.id) ? { background: "var(--ink)", color: "var(--bg)" } : {}) }}>{saved.has(o.id) ? "Saved ✓" : "Save"}</button></form>
                    {kind === "funding" && o.posted_by !== me && <Link href={`/post?intent=collab&title=${encodeURIComponent(`Partner wanted for ${o.title}`)}`} style={{ ...btn, height: 30 }} title="Post a call for collaborators about this funding">Find a partner</Link>}
                    {o.posted_by === me && <form action={setOpportunityStatus.bind(null, o.id, o.status === "open" ? "closed" : "open")}><button type="submit" style={{ ...btn, height: 30 }}>{o.status === "open" ? "Close" : "Reopen"}</button></form>}
                    {o.posted_by === me && <form action={deleteOpportunity.bind(null, o.id)}><button type="submit" style={{ ...btn, height: 30, borderColor: "var(--err)", color: "var(--err)" }}>Delete</button></form>}
                  </div>
                </div>
              </Panel>
            </article>
          );
        })}

        <Panel>
          <div id="post" style={{ scrollMarginTop: 72, padding: "12px 14px 0", font: "700 14px/1.4 var(--sans)" }}>{kind === "job" ? "Post a position" : "Post a funding call"}</div>
          {sp.error && ERRORS[sp.error] && <p role="alert" style={{ margin: "8px 14px 0", font: "400 13px/1.6 var(--sans)", color: "var(--err)" }}>{ERRORS[sp.error]}</p>}
          <form action={postOpportunity} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <input type="hidden" name="kind" value={kind} />
            <label style={fieldLabel}>Title<input name="title" required minLength={3} maxLength={200} placeholder={kind === "job" ? "Postdoc in computational psychiatry (100%)" : "Walter Benjamin Programme"} style={{ ...field, marginTop: 4 }} /></label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ ...fieldLabel, flex: "2 1 200px" }}>{kind === "job" ? "Institution" : "Funder"}<input name="org" maxLength={200} style={{ ...field, marginTop: 4 }} /></label>
              <label style={{ ...fieldLabel, flex: "1 1 120px" }}>{kind === "job" ? "City" : "Region"}<input name="place" maxLength={120} style={{ ...field, marginTop: 4 }} /></label>
              <label style={{ ...fieldLabel, flex: "1 1 140px" }}>{kind === "job" ? "Level" : "Kind"}
                <select name="level" style={{ ...field, marginTop: 4 }}><option value="">–</option>{LEVELS[kind].map((l) => <option key={l}>{l}</option>)}</select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ ...fieldLabel, flex: "2 1 240px" }}>Link to the full call<input name="url" type="url" maxLength={500} placeholder="https://" style={{ ...field, marginTop: 4 }} /></label>
              <label style={{ ...fieldLabel, flex: "1 1 140px" }}>Deadline<input name="deadline" type="date" min={today} style={{ ...field, marginTop: 4 }} /></label>
            </div>
            <label style={fieldLabel}>Techniques (comma separated, used to match people)<input name="techniques" maxLength={600} placeholder="fMRI, EEG, R, Bayesian modelling" style={{ ...field, marginTop: 4 }} /></label>
            <details>
              <summary style={{ cursor: "pointer", ...fieldLabel }}>Topic groups (optional)</summary>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                {ROOMS.map((r) => <label key={r.id} style={{ display: "flex", gap: 5, alignItems: "center", font: "400 12.5px/1.4 var(--sans)" }}><input type="checkbox" name="topics" value={r.id} />#{r.id}</label>)}
              </div>
            </details>
            <label style={fieldLabel}>Description<textarea name="body" rows={5} maxLength={6000} placeholder={kind === "job" ? "The project, what you offer, what you look for, how to apply." : "Who can apply, what it funds, how much and how long."} style={{ ...field, marginTop: 4 }} /></label>
            <div><button type="submit" style={btnPrimary}>Post</button></div>
          </form>
        </Panel>
      </div>
    </Page>
  );
}
