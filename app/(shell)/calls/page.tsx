import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { peopleById } from "@/lib/people";
import { likeTerm } from "@/lib/query";
import { roomById } from "@/lib/taxonomy";
import { timeAgo } from "@/lib/format";
import { expressInterest } from "@/app/actions/calls";
import { Page, Panel, Empty, btn, btnPrimary, field, mono } from "@/components/ui";
import Avatar from "@/components/Avatar";
import PersonLink from "@/components/social/PersonLink";

export const dynamic = "force-dynamic";

type Search = { q?: string; status?: string; due?: string; mine?: string; sent?: string };

/**
 * Calls for collaborators, as a board: filter by technique, system or any
 * word, by status and by deadline; say you are interested with a short
 * pitch, right here. The caller sees the answers on the call itself.
 */
export default async function Calls({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const status = sp.status === "filled" || sp.status === "closed" || sp.status === "all" ? sp.status : "open";
  const term = likeTerm(sp.q ?? "");
  const due = /^\d{4}-\d{2}-\d{2}$/.test(sp.due ?? "") ? sp.due! : "";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;

  let q = supabase.from("posts")
    .select("id, author_id, room_id, title, body, technique, organism, deadline, offer, call_status, created_at")
    .eq("intent", "collab").is("group_id", null).order("created_at", { ascending: false }).limit(100);
  if (status !== "all") q = q.eq("call_status", status);
  if (term) q = q.or(`title.ilike.%${term}%,body.ilike.%${term}%,technique.ilike.%${term}%,organism.ilike.%${term}%,offer.ilike.%${term}%`);
  if (due) q = q.lte("deadline", due);
  if (sp.mine === "1") q = q.eq("author_id", me);
  const { data: calls } = await q;
  const ids = (calls ?? []).map((c: any) => c.id);
  const [people, { data: interest }] = await Promise.all([
    peopleById(supabase, (calls ?? []).map((c: any) => c.author_id)),
    // Your own answers, and the answers to your calls (nobody else's).
    ids.length ? supabase.from("call_interest").select("post_id, user_id, shortlisted").in("post_id", ids) : Promise.resolve({ data: [] as any[] }),
  ]);
  const mineOn = (id: string) => (interest ?? []).find((i: any) => i.post_id === id && i.user_id === me);
  const answers = (id: string) => (interest ?? []).filter((i: any) => i.post_id === id && i.user_id !== me).length;
  const back = `/calls?${new URLSearchParams(Object.entries({ q: sp.q, status: sp.status, due: sp.due, mine: sp.mine }).filter(([, v]) => v) as [string, string][]).toString()}`;
  const seg = (key: string, label: string) => {
    const on = status === key;
    const params = new URLSearchParams(Object.entries({ q: sp.q, due: sp.due, mine: sp.mine, status: key === "open" ? undefined : key }).filter(([, v]) => v) as [string, string][]);
    return <Link key={key} href={`/calls${params.size ? `?${params}` : ""}`} aria-current={on ? "page" : undefined}
      style={{ flex: 1, textAlign: "center", padding: "8px 12px", font: mono(12, 600), textDecoration: "none", color: on ? "var(--ink)" : "var(--mute)", borderBottom: on ? "2px solid var(--signal)" : "1px solid var(--rule)" }}>{label}</Link>;
  };

  return (
    <Page title="Calls for collaborators" lede="Labs looking for a technique, a system or a second pair of hands, and what they offer back. Say you are interested in two or three sentences; only the caller sees it."
      actions={<Link href="/post?intent=collab" style={btnPrimary}>Post a call</Link>}>
      {sp.sent === "1" && <p role="status" style={{ font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--ok)", borderRadius: 12, background: "var(--surface)" }}>Sent. The caller sees your interest on the call and is notified.</p>}
      <form role="search" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12, maxWidth: 900 }}>
        <label style={{ flex: "2 1 260px", font: "600 12px/1.3 var(--sans)", color: "var(--mute)" }}>Technique, system or any word
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Seahorse, iPSC neurons, CRISPR…" style={{ ...field, marginTop: 4 }} />
        </label>
        <label style={{ flex: "1 1 150px", font: "600 12px/1.3 var(--sans)", color: "var(--mute)" }}>Deadline before
          <input name="due" type="date" defaultValue={due} style={{ ...field, marginTop: 4 }} />
        </label>
        {status !== "open" && <input type="hidden" name="status" value={status} />}
        <label style={{ display: "flex", gap: 6, alignItems: "center", font: "400 13px/1 var(--sans)", height: 38 }}>
          <input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} /> Only my calls
        </label>
        <button type="submit" style={{ ...btn, height: 38 }}>Filter</button>
        {(sp.q || due || sp.mine) && <Link href={status === "open" ? "/calls" : `/calls?status=${status}`} style={{ font: "400 12.5px/38px var(--sans)", color: "var(--mute)" }}>clear</Link>}
      </form>
      <nav aria-label="Status" className="sc-seg" style={{ display: "flex", gap: 0, marginBottom: 14, maxWidth: 900 }}>
        {seg("open", "Open")}{seg("filled", "Filled")}{seg("closed", "Closed")}{seg("all", "All")}
      </nav>

      <section style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
        {(calls ?? []).length === 0 && <Panel><Empty>No calls match. Change the filters, or <Link href="/post?intent=collab" style={{ color: "var(--link)" }}>post the first one</Link>.</Empty></Panel>}
        {(calls ?? []).map((c: any) => {
          const p = people.get(c.author_id);
          const mine = c.author_id === me;
          const my = mineOn(c.id);
          const open = (c.call_status ?? "open") === "open";
          return (
            <article key={c.id} id={`call-${c.id}`} style={{ scrollMarginTop: 72 }}>
              <Panel>
                <div style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <Avatar name={p?.display_name ?? ""} url={p?.avatar_url} size={30} />
                  <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                    <Link href={`/posts/${c.id}`} style={{ font: "650 15px/1.35 var(--sans)", color: "var(--ink)", textDecoration: "none" }}>{c.title}</Link>
                    <div style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", marginTop: 2 }}>
                      <PersonLink id={c.author_id}>{p?.display_name ?? "Someone"}</PersonLink>{p?.institution ? ` · ${p.institution}` : ""} · {timeAgo(c.created_at)}{roomById(c.room_id) ? ` · #${c.room_id}` : ""}
                    </div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 999, font: "600 11.5px/1.4 var(--sans)", color: open ? "var(--ok)" : "var(--mute)", border: `1px solid ${open ? "var(--ok)" : "var(--rule)"}` }}>
                    {open ? "Open" : c.call_status === "filled" ? "Filled" : "Closed"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, padding: "0 14px 12px" }}>
                  {[["Technique", c.technique], ["System", c.organism], ["By", c.deadline], ["Offered back", c.offer]].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k as string} className="sc-inset" style={{ padding: "8px 10px", borderRadius: 12, background: "var(--bg)", border: "1px solid var(--rule)" }}>
                      <div style={{ font: mono(9.5, 700), letterSpacing: ".08em", color: "var(--mute)" }}>{String(k).toUpperCase()}</div>
                      <div style={{ font: "500 13px/1.4 var(--sans)", marginTop: 3 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "10px 14px", borderTop: "1px solid var(--rule)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  {mine ? (
                    <Link href={`/posts/${c.id}#call`} style={{ ...btn, height: 32 }}>{answers(c.id)} interested · shortlist and status</Link>
                  ) : my ? (
                    <span style={{ font: "500 13px/1.4 var(--sans)", color: "var(--ok)" }}>✓ You said you are interested{my.shortlisted ? ", and you are on the shortlist" : ""}. <Link href={`/posts/${c.id}#call`} style={{ color: "var(--link)" }}>See or withdraw</Link></span>
                  ) : open ? (
                    <details style={{ flex: 1 }}>
                      <summary style={{ ...btnPrimary, height: 32, borderRadius: 999, display: "inline-flex", alignItems: "center", listStyle: "none", cursor: "pointer" }}>I&apos;m interested</summary>
                      <form action={expressInterest.bind(null, c.id)} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10, maxWidth: 560 }}>
                        <input type="hidden" name="back" value={back} />
                        <label htmlFor={`pitch-${c.id}`} style={{ font: "600 12px/1.3 var(--sans)", color: "var(--mute)" }}>Your pitch: what you can do, with which system, and when</label>
                        <textarea id={`pitch-${c.id}`} name="pitch" rows={3} maxLength={1000} required style={field} />
                        <div><button type="submit" style={btnPrimary}>Send to {p?.display_name?.split(" ")[0] ?? "the caller"}</button></div>
                      </form>
                    </details>
                  ) : (
                    <span style={{ font: "400 13px/1.4 var(--sans)", color: "var(--mute)" }}>This call is {c.call_status}.</span>
                  )}
                  <Link href={`/posts/${c.id}`} style={{ marginLeft: "auto", font: "500 12.5px/1 var(--sans)", color: "var(--mute)", textDecoration: "none" }}>Open the call →</Link>
                </div>
              </Panel>
            </article>
          );
        })}
      </section>
    </Page>
  );
}
