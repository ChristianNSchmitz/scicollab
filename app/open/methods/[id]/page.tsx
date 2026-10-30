import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { publicReader } from "@/lib/showcase";
import { ensureRecordSeed } from "@/lib/record/demo-seed";
import { isRowId } from "@/lib/query";
import PublicPage, { h2, p as para, small } from "@/components/PublicPage";
import { Outcome, Tag, btn, btnPrimary, mono } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * A public method card as signed-out visitors see it (proxy.ts sends them
 * here from /methods/[id]). Cards marked public only; anything else is a
 * 404. The author is named, and linked only if their profile is public too.
 */
const load = cache(async (id: string) => {
  const db = publicReader();
  if (!db || !isRowId(id)) return null;
  ensureRecordSeed();
  const { data: c } = await db.from("method_cards")
    .select("id, code, version, title, method, system, conditions, outcome, outcome_detail, fails_under, tags, visibility, author_id, created_at, updated_at")
    .eq("id", id).eq("visibility", "public").maybeSingle();
  if (!c || c.visibility !== "public") return null;
  const [{ data: author }, { count: repro }, { count: recs }] = await Promise.all([
    db.from("profiles").select("id, display_name, institution, public_profile").eq("id", c.author_id).maybeSingle(),
    db.from("reproductions").select("card_id", { count: "exact", head: true }).eq("card_id", id),
    db.from("recommendations").select("card_id", { count: "exact", head: true }).eq("card_id", id),
  ]);
  return { c, author, repro: repro ?? 0, recs: recs ?? 0 };
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const d = await load((await params).id);
  if (!d) return { title: "SciCollab", robots: { index: false } };
  const description = [d.c.system, d.c.outcome_detail, d.c.fails_under ? `Fails under: ${d.c.fails_under}` : ""].filter(Boolean).join(" · ").slice(0, 200)
    || "A method card on SciCollab.";
  const title = `${d.c.code} ${d.c.title}`;
  return {
    title: `${title} · SciCollab`,
    description,
    openGraph: { title, description, type: "article", siteName: "SciCollab" },
    twitter: { card: "summary", title, description },
  };
}

export default async function OpenMethod({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await load(id);
  if (!d) notFound();
  const { c, author } = d;
  const fields: [string, string][] = [["Method", c.method], ["System", c.system], ["Conditions", c.conditions], ["Outcome", c.outcome_detail]]
    .filter(([, v]) => v) as [string, string][];
  return (
    <PublicPage
      eyebrow={`METHOD CARD · ${c.code} · v${c.version}`}
      title={c.title}
      lede={<>
        Recorded by {author?.public_profile
          ? <Link href={`/people/${author.id}`} style={{ color: "var(--link)" }}>{author.display_name}</Link>
          : author?.display_name ?? "a member"}{author?.institution ? `, ${author.institution}` : ""} · updated {String(c.updated_at ?? c.created_at).slice(0, 10)}
      </>}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <Outcome value={c.outcome} />
        {(c.tags ?? []).map((t: string) => <Tag key={t}>{t}</Tag>)}
        <span style={{ ...small, marginLeft: "auto" }}>{d.repro} reproduction{d.repro === 1 ? "" : "s"} · {d.recs} recommendation{d.recs === 1 ? "" : "s"}</span>
      </div>
      <dl style={{ margin: 0 }}>
        {fields.map(([k, v]) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 140px) 1fr", gap: 12, padding: "10px 0", borderTop: "1px solid var(--rule)" }}>
            <dt style={{ font: mono(10.5, 700), letterSpacing: ".08em", textTransform: "uppercase", color: "var(--mute)" }}>{k}</dt>
            <dd style={{ margin: 0, font: "400 14.5px/1.6 var(--sans)", whiteSpace: "pre-wrap" }}>{v}</dd>
          </div>
        ))}
      </dl>
      {c.fails_under && (
        <>
          <h2 style={h2}>Where it fails</h2>
          <p style={{ ...para, whiteSpace: "pre-wrap" }}>{c.fails_under}</p>
        </>
      )}
      <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--rule)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ ...para, margin: 0, flex: "1 1 260px" }}>Members discuss this card, reproduce it and fork it for their own conditions.</span>
        <Link href={`/login?next=${encodeURIComponent(`/methods/${id}`)}`} style={btn}>Sign in</Link>
        <Link href="/signup" style={btnPrimary}>Join SciCollab</Link>
      </div>
    </PublicPage>
  );
}
