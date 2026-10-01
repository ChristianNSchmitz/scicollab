import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { forkCard, setVisibility, deleteCard } from "@/app/actions/cards";
import CardRecordPanels from "@/components/record/CardRecordPanels";
import { toggleRecommendation } from "@/app/actions/record";
import { ensureRecordSeed } from "@/lib/record/demo-seed";
import { recordCardRead, viaFrom } from "@/lib/record/reads";
import { Page, Panel, PanelHead, Outcome, Tag, Visibility, btn, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Method card, full view — board C2 screen 8. Discussion sits adjacent to the
 *  card rather than behind a tab, and lineage is drawn rather than implied. */
export default async function MethodCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  ensureRecordSeed();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: card } = await supabase.from("method_cards").select("*").eq("id", id).maybeSingle();
  if (!card) notFound();

  const [{ data: author }, { data: parent }, { data: forks }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, institution, orcid").eq("id", card.author_id).maybeSingle(),
    card.forked_from
      ? supabase.from("method_cards").select("id, code, title").eq("id", card.forked_from).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("method_cards").select("id, code, title, outcome, author_id").eq("forked_from", card.id),
  ]);
  const { data: recs } = await supabase.from("recommendations").select("user_id").eq("card_id", card.id);
  const recommended = (recs ?? []).some((r) => r.user_id === user!.id);

  const isOwner = card.author_id === user!.id;
  // Counted as a read only for someone else on a shared card; who it was is not kept.
  await recordCardRead(supabase, card.id, user!.id, viaFrom((await headers()).get("referer")));

  return (
    <Page
      title={card.title}
      lede={undefined}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <form action={forkCard.bind(null, card.id)}>
            <button type="submit" style={btn}>Fork protocol</button>
          </form>
          {isOwner ? (
            <Link href={`/you/record/cards/${card.id}`} style={btn}>Analytics</Link>
          ) : (
            <form action={toggleRecommendation.bind(null, card.id)}>
              <button type="submit" style={recommended ? { ...btn, background: "var(--ink)", color: "var(--bg)" } : btn}
                      aria-pressed={recommended} title={recommended ? "Take your recommendation back" : "Recommend this card to others"}>
                {recommended ? "Recommended ✓" : "Recommend"}
              </button>
            </form>
          )}
        </div>
      }
    >
      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <div style={{ padding: "12px 14px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, borderBottom: "1px solid var(--rule)", background: "var(--bg)" }}>
              <Outcome value={card.outcome} />
              <span style={{ font: mono(11), color: "var(--mute)" }}>{card.code} · v{card.version}</span>
              <span style={{ font: mono(11), color: "var(--mute)" }}>· {timeAgo(card.created_at)}</span>
              <span style={{ marginLeft: "auto", font: mono(11), color: "var(--mute)" }}>
                {forks?.length ?? 0} forks · {card.reproductions} reproductions · {recs?.length ?? 0} recommendations
              </span>
              <Visibility value={card.visibility} />
            </div>

            <div style={{ padding: 14, borderBottom: "1px solid var(--rule)", font: mono(11.5), color: "var(--mute)" }}>
              {author?.display_name ?? "Unknown"}
              {author?.institution ? ` · ${author.institution}` : ""}
              {parent && (
                <> · forked from <Link href={`/methods/${parent.id}`} style={{ color: "var(--link)" }}>{parent.code}</Link></>
              )}
            </div>

            <Field label="Method" value={card.method} />
            <div className="sc-pair" style={{ borderBottom: "1px solid var(--rule)" }}>
              <Cell label="System" value={card.system} />
              <Cell label="Conditions" value={card.conditions} borderLeft />
            </div>
            <Field label="Result" value={card.outcome_detail} />

            {card.fails_under && (
              <div style={{ padding: 14 }}>
                <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--signal)", marginBottom: 7 }}>FAILS UNDER</div>
                <div style={{ borderLeft: "3px solid var(--signal)", background: "var(--bg)", padding: "10px 12px" }}>
                  <p style={{ font: "400 13px/1.65 var(--sans)", margin: 0 }}>{card.fails_under}</p>
                </div>
              </div>
            )}

            {card.tags?.length > 0 && (
              <div style={{ padding: 14, borderTop: "1px solid var(--rule)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                {card.tags.map((t: string) => <Tag key={t}>{t}</Tag>)}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHead>Lineage</PanelHead>
            <div style={{ padding: 14, font: mono(12, 400, 1.7) }}>
              {parent ? (
                <div>← forked from <Link href={`/methods/${parent.id}`} style={{ color: "var(--link)" }}>{parent.code} {parent.title}</Link></div>
              ) : (
                <div style={{ color: "var(--mute)" }}>Root card — not forked from anything.</div>
              )}
              {(forks?.length ?? 0) > 0 ? (
                <ul style={{ margin: "8px 0 0", paddingLeft: 16 }}>
                  {forks!.map((f) => (
                    <li key={f.id}>→ <Link href={`/methods/${f.id}`} style={{ color: "var(--link)" }}>{f.code} {f.title}</Link></li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: "var(--mute)", marginTop: 6 }}>No forks yet.</div>
              )}
            </div>
          </Panel>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {isOwner && (
            <Panel>
              <PanelHead>Visibility</PanelHead>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {(["private", "lab", "public"] as const).map((v) => (
                  <form key={v} action={setVisibility.bind(null, card.id, v)}>
                    <button
                      type="submit"
                      disabled={card.visibility === v}
                      style={{
                        ...btn, width: "100%", justifyContent: "center",
                        opacity: card.visibility === v ? 1 : .7,
                        background: card.visibility === v ? "var(--ink)" : "transparent",
                        color: card.visibility === v ? "var(--bg)" : "var(--ink)",
                        cursor: card.visibility === v ? "default" : "pointer",
                      }}
                    >
                      {v}
                    </button>
                  </form>
                ))}
              </div>
            </Panel>
          )}

          <CardRecordPanels supabase={supabase} cardId={card.id} isOwner={isOwner} userId={user!.id} />

          <Panel>
            <PanelHead>Ask about this card</PanelHead>
            <div style={{ padding: 14 }}>
              <p style={{ font: "400 12px/1.6 var(--sans)", color: "var(--mute)", margin: "0 0 11px" }}>
                A question raised here carries the card, so nobody has to retype the conditions.
              </p>
              <Link href={`/ask?card=${card.id}`} style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}>Ask with this attached</Link>
            </div>
          </Panel>

          {isOwner && (
            <form action={deleteCard.bind(null, card.id)}>
              <button type="submit" style={{ ...btn, width: "100%", justifyContent: "center", borderColor: "var(--err)", color: "var(--err)" }}>
                Delete this card
              </button>
            </form>
          )}
        </aside>
      </div>
    </Page>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ padding: 14, borderBottom: "1px solid var(--rule)" }}>
      <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--mute)", marginBottom: 7 }}>{label.toUpperCase()}</div>
      <p style={{ font: "400 13px/1.7 var(--sans)", margin: 0, whiteSpace: "pre-wrap" }}>{value}</p>
    </div>
  );
}

function Cell({ label, value, borderLeft }: { label: string; value: string; borderLeft?: boolean }) {
  return (
    <div style={{ padding: 14, borderLeft: borderLeft ? "1px solid var(--rule)" : undefined }}>
      <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--mute)", marginBottom: 6 }}>{label.toUpperCase()}</div>
      <div style={{ font: mono(12.5, 400, 1.5) }}>{value || "—"}</div>
    </div>
  );
}
