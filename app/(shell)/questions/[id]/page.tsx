import { peopleById } from "@/lib/people";
import Avatar from "@/components/Avatar";
import PersonLink from "@/components/social/PersonLink";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { postAnswer, acceptAnswer } from "@/app/actions/qa";
import { Page, LimitNotice, Panel, PanelHead, Empty, Tag, field, btn, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import RichText from "@/components/RichText";
import MentionTextarea from "@/components/social/MentionTextarea";
import Reactions from "@/components/social/Reactions";
import { mentionsIn } from "@/lib/social/mentions";
import { reactionsFor } from "@/lib/social/reactions";
import { whoCouldAnswer } from "@/lib/social/experts";

export const dynamic = "force-dynamic";

/** Question detail — board C1 screen 5. Discussion sits adjacent to the
 *  artifact; the accepted answer is marked, never hidden behind a sort. */
export default async function Question({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ limited?: string }> }) {
  const { limited } = await searchParams;
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: q } = await supabase.from("questions").select("*").eq("id", id).maybeSingle();
  if (!q) notFound();

  const [{ data: answers }, { data: asker }, { data: card }] = await Promise.all([
    supabase.from("answers").select("*").eq("question_id", id).order("accepted", { ascending: false }).order("created_at"),
    supabase.from("profiles").select("display_name, institution, avatar_url").eq("id", q.author_id).maybeSingle(),
    q.method_card_id
      ? supabase.from("method_cards").select("id, code, title, outcome").eq("id", q.method_card_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const answerIds = (answers ?? []).map((a) => a.id);
  const [people, qMentions, aMentions, reactions, experts] = await Promise.all([
    peopleById(supabase, (answers ?? []).map((a) => a.author_id)),
    mentionsIn(supabase, "question", [q.id]),
    mentionsIn(supabase, "answer", answerIds),
    reactionsFor(supabase, "answer", answerIds, user!.id),
    whoCouldAnswer(supabase, q, [q.author_id, user!.id, ...(answers ?? []).map((a) => a.author_id)]),
  ]);

  const isAsker = q.author_id === user!.id;

  return (
    <Page title={q.title} actions={<Link href="/ask#questions" style={btn}>All questions</Link>}>
      <LimitNotice show={limited} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Panel>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)", font: mono(11), color: "var(--mute)", display: "flex", gap: 9, alignItems: "center" }}>
            <Avatar name={asker?.display_name ?? ""} url={asker?.avatar_url} size={24} />
            <span><PersonLink id={q.author_id}>{asker?.display_name ?? "Someone"}</PersonLink>{asker?.institution ? ` · ${asker.institution}` : ""} · {timeAgo(q.created_at)}</span>
          </div>
          {q.body && (
            <div style={{ padding: 14 }}>
              <RichText body={q.body} mentions={qMentions.get(q.id)} />
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
          const who = people.get(a.author_id);
          return (
            <Panel key={a.id} style={a.accepted ? { borderColor: "var(--ok)" } : undefined}>
              {a.accepted && (
                <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--ok)", font: mono(10, 700), letterSpacing: ".09em", color: "var(--ok)" }}>
                  ACCEPTED ANSWER
                </div>
              )}
              <div style={{ padding: 14 }}>
                <RichText body={a.body} mentions={aMentions.get(a.id)} />
                <div style={{ marginTop: 10 }}>
                  <Reactions kind="answer" targetId={a.id} summary={reactions.get(a.id)} own={a.author_id === user!.id} path={`/questions/${q.id}`} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--rule)" }}>
                  <Avatar name={who?.display_name ?? ""} url={who?.avatar_url} size={22} />
                  <span style={{ font: mono(11), color: "var(--mute)" }}>
                    <PersonLink id={a.author_id}>{who?.display_name ?? "Someone"}</PersonLink>{who?.institution ? ` · ${who.institution}` : ""} · {timeAgo(a.created_at)}
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

        {experts.length > 0 && (
          <Panel>
            <PanelHead>Who could answer this</PanelHead>
            <div style={{ padding: "8px 14px 0", font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)" }}>
              Members whose techniques match this question. Mention them with @ in an answer, or send them a message.
            </div>
            {experts.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
                <Avatar name={e.display_name} url={e.avatar_url} size={24} />
                <PersonLink id={e.id} style={{ font: mono(12.5, 500) }}>{e.display_name}</PersonLink>
                <span style={{ flex: 1, font: mono(10.5), color: "var(--mute)" }}>{e.match.join(", ")}</span>
                <Link href={`/messages/${e.id}`} style={{ ...btn, height: 28, padding: "0 10px" }}>Message</Link>
              </div>
            ))}
          </Panel>
        )}

        <Panel>
          <PanelHead>Your answer</PanelHead>
          <form action={postAnswer.bind(null, q.id)} style={{ padding: 14 }}>
            <MentionTextarea name="body" rows={6} required style={field} aria-label="Your answer" placeholder="Answer with the conditions that made the difference. Type @ to bring someone in." />
            <button type="submit" style={{ ...btnPrimary, marginTop: 11 }}>Post answer</button>
          </form>
        </Panel>
      </div>
    </Page>
  );
}
