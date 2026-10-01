import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, Empty, Outcome, Tag, Visibility, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Methods — every card you can see: your own at any visibility, everyone
 *  else's once it has left 'private'. Enforced by row-level security. */
export default async function Methods() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: cards } = await supabase
    .from("method_cards")
    .select("id, code, version, title, outcome, system, tags, visibility, author_id, reproductions, forked_from, created_at")
    .order("created_at", { ascending: false });

  const mine = (cards ?? []).filter((c) => c.author_id === user!.id);
  const others = (cards ?? []).filter((c) => c.author_id !== user!.id);

  return (
    <Page
      title="Methods"
      lede="A method card is structured, versioned, forkable, and explicit about the conditions under which the method fails."
      actions={<Link href="/methods/new" style={btnPrimary}>Record a method</Link>}
    >
      <Section title={`Yours · ${mine.length}`} cards={mine} empty="You have not recorded a method yet." />
      <div style={{ height: 20 }} />
      <Section title={`From the community · ${others.length}`} cards={others} empty="No shared cards yet." />
    </Page>
  );
}

function Section({ title, cards, empty }: { title: string; cards: any[]; empty: string }) {
  return (
    <>
      <h2 style={{ font: mono(11, 700), letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)", margin: "0 0 8px" }}>{title}</h2>
      <Panel>
        {cards.length === 0 ? <Empty>{empty}</Empty> : cards.map((c) => (
          <Link key={c.id} href={`/methods/${c.id}`} style={{ display: "block", padding: "13px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9, marginBottom: 6 }}>
              <Outcome value={c.outcome} />
              <span style={{ font: mono(11), color: "var(--mute)" }}>{c.code} · v{c.version}</span>
              {c.forked_from && <Tag>fork</Tag>}
              <span style={{ marginLeft: "auto", font: mono(11), color: "var(--mute)" }}>{timeAgo(c.created_at)}</span>
              <Visibility value={c.visibility} />
            </div>
            <div style={{ font: mono(14, 500, 1.35) }}>{c.title}</div>
            <div style={{ font: mono(11), color: "var(--mute)", marginTop: 4 }}>
              {c.system || "—"} · {c.reproductions} reproductions
            </div>
            {c.tags?.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {c.tags.map((t: string) => <Tag key={t}>{t}</Tag>)}
              </div>
            )}
          </Link>
        ))}
      </Panel>
    </>
  );
}
