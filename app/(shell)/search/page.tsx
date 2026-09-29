import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, PanelHead, Empty, Outcome, field, btnPrimary, mono } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Federated search — board H2. Six object types by default; the three with
 *  live data are searched here, the rest are designed and not yet wired. */
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  const term = q.trim();

  let cards: any[] = [], questions: any[] = [], people: any[] = [], projects: any[] = [];
  if (term) {
    const like = `%${term}%`;
    const [c, qq, p, pr] = await Promise.all([
      supabase.from("method_cards").select("id, code, title, outcome, system").or(`title.ilike.${like},method.ilike.${like},system.ilike.${like},fails_under.ilike.${like}`).limit(20),
      supabase.from("questions").select("id, title, body").or(`title.ilike.${like},body.ilike.${like}`).limit(20),
      supabase.from("profiles").select("id, display_name, institution, field").or(`display_name.ilike.${like},institution.ilike.${like},field.ilike.${like}`).limit(20),
      supabase.from("projects").select("id, title, summary").or(`title.ilike.${like},summary.ilike.${like}`).limit(20),
    ]);
    cards = c.data ?? []; questions = qq.data ?? []; people = p.data ?? []; projects = pr.data ?? [];
  }

  const total = cards.length + questions.length + people.length + projects.length;

  return (
    <Page title="Search" lede="Methods, questions, people and projects in one query — including the conditions under which something failed.">
      <form style={{ display: "flex", gap: 8, marginBottom: 16, maxWidth: 720 }}>
        <input name="q" defaultValue={q} style={{ ...field, height: 40 }} placeholder="passage number, HEK293T, transfection…" autoFocus />
        <button type="submit" style={{ ...btnPrimary, height: 40 }}>Search</button>
      </form>

      {!term ? (
        <Panel><Empty>Type a technique, an organism, an outcome or a person.</Empty></Panel>
      ) : total === 0 ? (
        <Panel><Empty>Nothing matches “{term}”.</Empty></Panel>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 860 }}>
          {cards.length > 0 && (
            <Panel>
              <PanelHead>Method cards · {cards.length}</PanelHead>
              {cards.map((c) => (
                <Link key={c.id} href={`/methods/${c.id}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
                  <Outcome value={c.outcome} />
                  <span style={{ font: mono(12.5, 500), flex: 1 }}>{c.title}</span>
                  <span style={{ font: mono(10.5), color: "var(--mute)" }}>{c.system}</span>
                </Link>
              ))}
            </Panel>
          )}
          {questions.length > 0 && (
            <Panel>
              <PanelHead>Questions · {questions.length}</PanelHead>
              {questions.map((x) => (
                <Link key={x.id} href={`/questions/${x.id}`} style={{ display: "block", padding: "11px 14px", borderBottom: "1px solid var(--rule)", font: mono(12.5, 500), color: "var(--ink)", textDecoration: "none" }}>{x.title}</Link>
              ))}
            </Panel>
          )}
          {people.length > 0 && (
            <Panel>
              <PanelHead>People · {people.length}</PanelHead>
              {people.map((x) => (
                <Link key={x.id} href={`/messages/${x.id}`} style={{ display: "block", padding: "11px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
                  <span style={{ font: mono(12.5, 500) }}>{x.display_name}</span>
                  <span style={{ font: mono(10.5), color: "var(--mute)", marginLeft: 8 }}>{[x.institution, x.field].filter(Boolean).join(" · ")}</span>
                </Link>
              ))}
            </Panel>
          )}
          {projects.length > 0 && (
            <Panel>
              <PanelHead>Projects · {projects.length}</PanelHead>
              {projects.map((x) => (
                <Link key={x.id} href={`/projects/${x.id}`} style={{ display: "block", padding: "11px 14px", borderBottom: "1px solid var(--rule)", font: mono(12.5, 500), color: "var(--ink)", textDecoration: "none" }}>{x.title}</Link>
              ))}
            </Panel>
          )}
        </div>
      )}
    </Page>
  );
}
