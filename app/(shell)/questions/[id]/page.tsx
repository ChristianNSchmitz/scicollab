import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { postAnswer, acceptAnswer } from "@/app/actions/qa";
import { Page, Panel, PanelHead, Empty, Tag, field, btn, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Question detail — board C1 screen 5. Discussion sits adjacent to the
 *  artifact; the accepted answer is marked, never hidden behind a sort. */
export default async function Question({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: q } = await supabase.from("questions").select("*").eq("id", id).maybeSingle();
  if (!q) notFound();

  const [{ data: answers }, { data: asker }, { data: card }] = await Promise.all([
    supabase.from("answers").select("*").eq("question_id", id).order("accepted", { ascending: false }).order("created_at"),
    supabase.from("profiles").select("display_name, institution").eq("id", q.author_id).maybeSingle(),
    q.method_card_id
      ? supabase.from("method_cards").select("id, code, title, outcome").eq("id", q.method_card_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const ids = [...new Set((answers ?? []).map((a) => a.author_id))];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, display_name, institution").in("id", ids)
    : { data: [] as any[] };

  const isAsker = q.author_id === user!.id;

  return (
    <Page title={q.title} lede={undefined}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Panel>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--rule)", font: mono(11), color: "var(--mute)" }}>
            {asker?.display_name ?? "Someone"}{asker?.institution ? ` · ${asker.institution}` : ""} · {timeAgo(q.created_at)}
          </div>
          {q.body && (
            <div style={{ padding: 14 }}>
              <p style={{ font: "400 13px/1.7 var(--sans)", margin: 0, whiteSpace: "pre-wrap" }}>{q.body}</p>
            </div>
          )}
          {card && (
            <div style={{ padding: 14, borderTop: "1px solid var(--rule)", background: "var(--bg)" }}>
              <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--mute)", marginBottom: 7 }}>ATTACHED METHOD CARD</div>
              <Link href={`/methods/${card.id}`} style={{ font: mono(13, 500), color: "var(--ink)" }}>
                {card.code} — {card.title}
              </Link>
            </div>
          )}
          {q.tags?.length > 0 && (
            <div style={{ padding: 14, borderTop: "1px solid var(--rule)", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {q.tags.map((t: string) => <Tag key={t}>{t}</Tag>)}
            </div>
          )}
        </Panel>

        <h2 style={{ font: mono(11, 700), letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)", margin: "8px 0 0" }}>
          {answers?.length ?? 0} {answers?.length === 1 ? "answer" : "answers"}
        </h2>

        {(answers?.length ?? 0) === 0 && <Panel><Empty>No answers yet.</Empty></Panel>}

        {answers?.map((a) => {
          const who = people?.find((p) => p.id === a.author_id);
          return (
            <Panel key={a.id} style={a.accepted ? { borderColor: "var(--ok)" } : undefined}>
              {a.accepted && (
                <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--ok)", font: mono(10, 700), letterSpacing: ".09em", color: "var(--ok)" }}>
                  ACCEPTED ANSWER
                </div>
              )}
              <div style={{ padding: 14 }}>
                <p style={{ font: "400 13px/1.7 var(--sans)", margin: 0, whiteSpace: "pre-wrap" }}>{a.body}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--rule)" }}>
                  <span style={{ font: mono(11), color: "var(--mute)" }}>
                    {who?.display_name ?? "Someone"}{who?.institution ? ` · ${who.institution}` : ""} · {timeAgo(a.created_at)}
                  </span>
                  {isAsker && !a.accepted && (
                    <form action={acceptAnswer.bind(null, q.id, a.id)} style={{ marginLeft: "auto" }}>
                      <button type="submit" style={{ ...btn, height: 28, borderColor: "var(--ok)", color: "var(--ok)" }}>Accept this answer</button>
                    </form>
                  )}
                </div>
              </div>
            </Panel>
          );
        })}

        <Panel>
          <PanelHead>Your answer</PanelHead>
          <form action={postAnswer.bind(null, q.id)} style={{ padding: 14 }}>
            <textarea name="body" rows={6} required style={field} placeholder="Answer with the conditions that made the difference." />
            <button type="submit" style={{ ...btnPrimary, marginTop: 11 }}>Post answer</button>
          </form>
        </Panel>
      </div>
    </Page>
  );
}
