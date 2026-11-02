import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, PanelHead, Empty, Tag, btn, field, mono } from "@/components/ui";
import { OPEN_TO } from "@/lib/taxonomy";
import SegTabs from "@/components/SegTabs";
import { findExperts, type Evidence } from "@/lib/social/expertise";
import { OpenToChips } from "@/components/social/ProfileBody";
import Avatar from "@/components/Avatar";
import { nameGuide, unnameGuide } from "@/app/actions/record";
import { ensureRecordTables } from "@/lib/record/demo-seed";
import { followingOf } from "@/lib/social/follows";
import { coauthorsOf, inviteText } from "@/lib/social/coauthors";
import FollowButton from "@/components/social/FollowButton";
import InviteButton from "@/components/social/InviteButton";

export const dynamic = "force-dynamic";

type Filter = "all" | "following" | "followers";

/** Network — board G1. Your co-authors first (the people you already know),
 *  then everyone, each with the actions open to you: follow, message, and
 *  naming someone as a guide who helped you. */
export default async function Network({ searchParams }: { searchParams: Promise<{ show?: string; q?: string; open?: string }> }) {
  ensureRecordTables();
  const { show, q: rawQ, open } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 80);
  const openTo = OPEN_TO.some((o) => o.id === open) ? open! : "";
  const filter: Filter = show === "following" || show === "followers" ? show : "all";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;

  const [{ data: people }, { data: guides }, following, { data: followerRows }, { data: mine }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, institution, role_title, field, techniques, open_to, avatar_url").neq("id", me).order("display_name"),
    // Mentoring credit is given by the person who was helped, so you name your guides here.
    supabase.from("mentorships").select("mentor_id").eq("mentee_id", me),
    followingOf(supabase, me),
    supabase.from("follows").select("follower_id").eq("followee_id", me),
    supabase.from("profiles").select("display_name, orcid").eq("id", me).maybeSingle(),
  ]);
  const isGuide = new Set((guides ?? []).map((g) => g.mentor_id));
  const followers = new Set((followerRows ?? []).map((f: any) => f.follower_id));
  const co = await coauthorsOf(supabase, me, mine?.orcid, following);
  const toFollow = co.members.filter((m) => !m.following);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "scicollab"}`;

  // Searching by technique: who lists it, who made it work, who repeated it.
  const experts = q ? await findExperts(supabase, q) : null;
  const rank = (e?: Evidence[]) => (e ?? []).reduce((n, x) => n + (x.kind === "listed" ? 1 : 3), 0);
  const shown = (people ?? []).filter((p: any) =>
    (filter === "following" ? following.has(p.id) : filter === "followers" ? followers.has(p.id) : true)
    && (!experts || experts.has(p.id))
    && (!openTo || (p.open_to ?? []).includes(openTo)))
    .sort((a: any, b: any) => (experts ? rank(experts.get(b.id)) - rank(experts.get(a.id)) : 0));

  return (
    <Page title="Network" lede="Find people by technique, follow them, message them.">
      {mine?.orcid && (toFollow.length > 0 || co.others.length > 0) && (
        <Panel style={{ marginBottom: 14, borderColor: "var(--signal)" }}>
          <PanelHead>From your publications</PanelHead>
          {toFollow.length > 0 && (
            <>
              <div style={{ padding: "10px 14px 4px", font: "400 13px/1.7 var(--sans)", color: "var(--mute)" }}>
                {toFollow.length} of your co-authors {toFollow.length === 1 ? "is" : "are"} here.
              </div>
              {toFollow.map((m) => (
                <div key={m.person.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--rule)" }}>
                  <Avatar name={m.person.display_name} url={m.person.avatar_url} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/people/${m.person.id}`} style={{ font: mono(12.5, 500), color: "var(--ink)" }}>{m.person.display_name}</Link>
                    <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 2 }}>{m.papers} paper{m.papers > 1 ? "s" : ""} together{m.person.institution ? ` · ${m.person.institution}` : ""}</div>
                  </div>
                  <FollowButton personId={m.person.id} following={false} compact />
                </div>
              ))}
            </>
          )}
          {co.others.length > 0 && (
            <details style={{ padding: "10px 14px" }}>
              <summary style={{ listStyle: "none", cursor: "pointer", width: "fit-content", height: 32, padding: "0 14px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", display: "flex", alignItems: "center", font: "600 12.5px/1 var(--sans)", color: "var(--ink)" }}>Invite co-authors who are not here yet · {co.others.length}</summary>
              <div style={{ marginTop: 8 }}>
                {co.others.slice(0, 12).map((o) => (
                  <div key={o.openalexId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
                    <span style={{ flex: "1 1 200px", font: "400 13.5px/1.5 var(--sans)" }}>{o.name}</span>
                    <span style={{ font: mono(10.5), color: "var(--mute)" }}>{o.papers} paper{o.papers > 1 ? "s" : ""}</span>
                    <InviteButton subject="Join me on SciCollab" text={inviteText(mine.display_name ?? "", o.name, origin)} />
                  </div>
                ))}
                <p style={{ font: "400 12.5px/1.7 var(--sans)", color: "var(--mute)", margin: "8px 0 0" }}>
                  SciCollab does not know their e-mail addresses and sends nothing; the invitation is yours to send.
                </p>
              </div>
            </details>
          )}
        </Panel>
      )}

      <form role="search" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <label style={{ flex: "2 1 260px", font: "600 12px/1.4 var(--sans)", color: "var(--mute)" }}>Find people by technique
          <input name="q" defaultValue={q} placeholder="Seahorse, lipofection, qPCR, flow cytometry…" style={{ ...field, marginTop: 4 }} />
        </label>
        <label style={{ flex: "1 1 180px", font: "600 12px/1.4 var(--sans)", color: "var(--mute)" }}>Open to
          <select name="open" defaultValue={openTo} style={{ ...field, marginTop: 4 }}>
            <option value="">Anything</option>
            {OPEN_TO.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        {filter !== "all" && <input type="hidden" name="show" value={filter} />}
        <button type="submit" style={{ ...btn, height: 38 }}>Search</button>
        {(q || openTo) && <Link href={filter === "all" ? "/network" : `/network?show=${filter}`} style={{ font: "400 12.5px/38px var(--sans)", color: "var(--mute)" }}>clear</Link>}
      </form>
      {q && <p style={{ font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)", margin: "-4px 0 10px" }}>Strongest evidence first: worked or repeated, then listed.</p>}

      <SegTabs label="Who" style={{ margin: "0 0 10px" }} items={([["all", `Everyone · ${people?.length ?? 0}`], ["following", `Following · ${following.size}`], ["followers", `Follow you · ${followers.size}`]] as const).map(([key, label]) => ({
        href: `/network?${new URLSearchParams(Object.entries({ show: key === "all" ? undefined : key, q: q || undefined, open: openTo || undefined }).filter(([, v]) => v) as [string, string][])}`.replace(/\?$/, ""),
        label, active: filter === key,
      }))} />

      <Panel>
        {shown.length === 0 ? (
          <Empty>
            {filter === "following" ? <>You do not follow anyone yet. <Link href="/network" style={{ color: "var(--link)" }}>See everyone</Link>.</>
              : filter === "followers" ? "Nobody follows you yet. Posting, answering and recording methods is how people find you."
              : q || openTo ? "Nobody matches yet. Try a broader word, or post a call for collaborators so the right person finds you."
              : "Nobody else has an account yet."}
          </Empty>
        ) : shown.map((p) => (
          <div key={p.id} style={{ padding: "13px 14px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Link href={`/people/${p.id}`} aria-label={`${p.display_name}, profile`} style={{ display: "flex" }}>
              <Avatar name={p.display_name} url={p.avatar_url} size={34} />
            </Link>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <Link href={`/people/${p.id}`} style={{ font: mono(13, 500), color: "var(--ink)" }}>{p.display_name || "Researcher"}</Link>
              {followers.has(p.id) && <span style={{ font: mono(10), color: "var(--mute)", marginLeft: 8 }}>follows you</span>}
              <div style={{ font: mono(11), color: "var(--mute)", marginTop: 3 }}>
                {[p.role_title, p.institution, p.field].filter(Boolean).join(" · ") || "No role or institution yet"}
              </div>
              {(p.open_to ?? []).length > 0 && <OpenToChips ids={p.open_to} style={{ marginTop: 7 }} />}
              {experts?.get(p.id) && (
                <ul style={{ margin: "7px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
                  {experts.get(p.id)!.slice(0, 4).map((e, i) => (
                    <li key={i} style={{ font: "400 12.5px/1.55 var(--sans)" }}>
                      <span aria-hidden="true" style={{ color: e.kind === "listed" ? "var(--mute)" : "var(--ok)" }}>{e.kind === "listed" ? "·" : "✓"}</span>{" "}
                      {e.href ? <Link href={e.href} style={{ color: "var(--ink)" }}>{e.text}</Link> : <span style={{ color: "var(--mute)" }}>{e.text}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {!experts && p.techniques?.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
                  {p.techniques.slice(0, 4).map((t: string) => <Tag key={t}>{t}</Tag>)}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <FollowButton personId={p.id} following={following.has(p.id)} compact />
              {isGuide.has(p.id) ? (
                <form action={unnameGuide.bind(null, p.id)}>
                  <button type="submit" style={{ ...btn, height: 30, padding: "0 10px", borderColor: "var(--ok)", color: "var(--ok)" }} title="Remove the credit you gave">Your guide ✓</button>
                </form>
              ) : (
                <form action={nameGuide.bind(null, p.id)}>
                  <button type="submit" style={{ ...btn, height: 30, padding: "0 10px" }} title="Credit this person for helping you. Only the two of you see it.">Name as guide</button>
                </form>
              )}
              <Link href={`/messages/${p.id}`} style={{ ...btn, height: 30, padding: "0 10px" }}>Message</Link>
            </div>
          </div>
        ))}
      </Panel>
    </Page>
  );
}
