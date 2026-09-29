import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, Empty, Tag, Visibility, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Projects — board D1. The project is the container: datasets, publications
 *  and discussions live under one, which is what testers asked for. */
export default async function Projects() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, summary, status, tags, visibility, created_at")
    .order("created_at", { ascending: false });

  return (
    <Page
      title="Projects"
      lede="One container per line of work — notebook entries, datasets and the people on it."
      actions={<Link href="/projects/new" style={btnPrimary}>New project</Link>}
    >
      <Panel>
        {(projects?.length ?? 0) === 0 ? (
          <Empty>No projects yet. <Link href="/projects/new" style={{ color: "var(--link)" }}>Create the first one</Link>.</Empty>
        ) : projects!.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} style={{ display: "block", padding: "13px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
              <span style={{ font: mono(10, 700), letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ok)", border: "1px solid var(--ok)", padding: "3px 7px" }}>{p.status}</span>
              <span style={{ marginLeft: "auto", font: mono(11), color: "var(--mute)" }}>{timeAgo(p.created_at)}</span>
              <Visibility value={p.visibility} />
            </div>
            <div style={{ font: mono(14, 500, 1.35) }}>{p.title}</div>
            {p.summary && <p style={{ font: "400 12px/1.6 var(--sans)", color: "var(--mute)", margin: "5px 0 0" }}>{p.summary}</p>}
            {p.tags?.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{p.tags.map((t: string) => <Tag key={t}>{t}</Tag>)}</div>
            )}
          </Link>
        ))}
      </Panel>
    </Page>
  );
}
