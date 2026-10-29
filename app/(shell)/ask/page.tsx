import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { askQuestion } from "@/app/actions/qa";
import { Page, Panel, PanelHead, Empty, Tag, LimitNotice, field, fieldLabel, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import MentionTextarea from "@/components/social/MentionTextarea";

export const dynamic = "force-dynamic";

/** Ask — board C1 screen 1. A question is a structured instrument, not a text
 *  box: it can carry the artifact that produced it. */
export default async function Ask({ searchParams }: { searchParams: Promise<{ card?: string; limited?: string }> }) {
  const { card, limited } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: cards }, { data: questions }, { data: answers }] = await Promise.all([
    supabase
      .from("method_cards")
      .select("id, code, title")
      .eq("author_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("questions")
      .select("id, title, tags, method_card_id, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("answers").select("question_id, accepted"),
  ]);

  // Answer counts per question, and whether one was accepted — so a reader
  // can tell an open question from a settled one without opening it.
  const tally = new Map<string, { n: number; accepted: boolean }>();
  for (const a of (answers ?? []) as { question_id: string; accepted: boolean }[]) {
    const t = tally.get(a.question_id) ?? { n: 0, accepted: false };
    tally.set(a.question_id, { n: t.n + 1, accepted: t.accepted || a.accepted });
  }

  return (
    <Page title="Ask a question" lede="Attach the run it came from. Peers answer conditions, not paraphrases.">
      <LimitNotice show={limited} />
      <form action={askQuestion}>
        <div className="sc-two-col">
          <Panel>
            <PanelHead>The question</PanelHead>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 13 }}>
              <div>
                <label style={fieldLabel} htmlFor="title">Title</label>
                <input id="title" name="title" required style={field} placeholder="Transfection efficiency collapses above passage 18 — what am I missing?" />
              </div>
              <div>
                <label style={fieldLabel} htmlFor="body">What you have tried</label>
                <MentionTextarea id="body" name="body" rows={8} style={field} placeholder="Three biological replicates, two reagent lots, fresh medium each time… Type @ to ask someone directly." />
              </div>
              <div>
                <label style={fieldLabel} htmlFor="tags">Tags — comma separated</label>
                <input id="tags" name="tags" style={field} placeholder="transfection, HEK293T, passage number" />
              </div>
            </div>
          </Panel>

          <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Panel>
              <PanelHead>Attach a method card</PanelHead>
              <div style={{ padding: 14 }}>
                {cards && cards.length > 0 ? (
                  <select name="method_card_id" defaultValue={card ?? ""} style={{ ...field, height: 38 }}>
                    <option value="">No card attached</option>
                    {cards.map((c: { id: string; code: string; title: string }) => (
                      <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                    ))}
                  </select>
                ) : (
                  <p style={{ font: "400 13px/1.6 var(--sans)", color: "var(--mute)", margin: 0 }}>
                    You have no method cards yet. A question without one still works, it just makes peers guess.{" "}
                    <Link href="/methods/new" style={{ color: "var(--link)" }}>Record a method</Link>
                  </p>
                )}
              </div>
            </Panel>
            <button type="submit" style={{ ...btnPrimary, height: 42, justifyContent: "center" }}>Post question</button>
          </aside>
        </div>
      </form>

      <h2 id="questions" style={{ font: mono(11, 700), letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)", margin: "28px 0 8px" }}>
        Recent questions · {questions?.length ?? 0}
      </h2>
      <Panel>
        {(questions?.length ?? 0) === 0 ? <Empty>No questions yet. Yours would be the first.</Empty> : questions!.map((q: any) => {
          const t = tally.get(q.id) ?? { n: 0, accepted: false };
          return (
            <Link key={q.id} href={`/questions/${q.id}`} style={{ display: "block", padding: "12px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
              <div style={{ font: mono(13.5, 500, 1.35) }}>{q.title}</div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 7, font: mono(11), color: "var(--mute)" }}>
                <span style={t.accepted ? { color: "var(--ok)" } : undefined}>
                  {t.n} {t.n === 1 ? "answer" : "answers"}{t.accepted ? " · accepted" : ""}
                </span>
                {q.method_card_id && <span>· card attached</span>}
                <span>· {timeAgo(q.created_at)}</span>
                {(q.tags ?? []).slice(0, 3).map((tag: string) => <Tag key={tag}>{tag}</Tag>)}
              </div>
            </Link>
          );
        })}
      </Panel>
    </Page>
  );
}
