import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, PanelHead, Empty, Outcome, Visibility, btn, mono } from "@/components/ui";
import WeeklyBars from "@/components/record/WeeklyBars";
import { PrivacyStrip, Pair, tileGrid, smallCaps, WINDOWS } from "@/components/record/Chrome";
import { VERDICT } from "@/components/record/CardRecordPanels";
import { loadRecord } from "@/lib/record/metrics";
import { ensureRecordSeed, weekOf } from "@/lib/record/demo-seed";
import { cardReadStats, MIN_READERS_PER_INSTITUTION } from "@/lib/record/reads";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Per-output analytics — board J2 screen 3, for one method card.
 * Reads are attention and documented reuse is value; they are drawn at one
 * scale so the gap between them is visible. Reader identity is never stored.
 */
export default async function CardAnalytics({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ weeks?: string }>;
}) {
  ensureRecordSeed();
  const { id } = await params;
  const sp = await searchParams;
  const weeks = WINDOWS.includes(Number(sp.weeks)) ? Number(sp.weeks) : 12;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: card } = await supabase.from("method_cards").select("id, code, title, outcome, visibility, author_id, created_at").eq("id", id).maybeSingle();
  // Analytics belong to the author alone; anyone else gets the same 404 as a missing card.
  if (!card || card.author_id !== user.id) notFound();

  const [stats, r, { data: reviews }] = await Promise.all([
    cardReadStats(supabase, card.id, user.id),
    loadRecord(supabase, user.id, weeks),
    supabase.from("reviews").select("id, verdict, body, created_at").eq("card_id", card.id).order("created_at", { ascending: false }),
  ]);

  const weekStarts = r.weekStarts.map((d) => d.toISOString());
  const weekKeys = r.weekStarts.map((d) => weekOf(d));
  const reads = weekKeys.map((k) => stats?.weekly.find((w) => w.week === k)?.readers ?? 0);
  const reuseEvents = r.reuse.filter((e) => e.text.includes(card.code));
  const reuse = weekKeys.map((_, i) => reuseEvents.filter((e) => weekOf(new Date(e.at)) === weekKeys[i]).length);
  const shared = Math.max(1, ...reads, ...reuse);
  const out = r.outputs.find((o) => o.id === card.id);
  const totalReads = reads.reduce((a, b) => a + b, 0);
  const viaMax = Math.max(1, ...(stats?.via ?? []).map((v) => v.readers));

  const tiles: [string, string | number, string][] = [
    ["Reads", totalReads, `distinct readers per week, ${weeks} wk`],
    ["Forks", out?.forks ?? 0, "by other researchers"],
    ["Carried in questions", out?.carried ?? 0, "questions attaching this card"],
    ["Repeats", `${out?.held ?? 0} / ${out?.failed ?? 0}`, "held / failed, by others"],
  ];

  return (
    <Page
      title={`${card.code} · analytics`}
      lede={card.title}
      actions={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href={`/methods/${card.id}`} style={btn}>Open card</Link>
          <Link href="/you/record" style={btn}>Your record</Link>
        </div>
      }
    >
      <PrivacyStrip weeks={weeks} hrefFor={(w) => `/you/record/cards/${card.id}${w !== 12 ? `?weeks=${w}` : ""}`}>
        Only you see this. Who read the card is discarded when the read is counted, so nobody, you included, can learn that a particular person opened it.
      </PrivacyStrip>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <Outcome value={card.outcome} />
        <Visibility value={card.visibility} />
        <span style={{ font: mono(11), color: "var(--mute)" }}>recorded {timeAgo(card.created_at)}</span>
        {card.visibility === "private" && (
          <span style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)" }}>Private cards have no readers. Share it as Lab or Public to be read and reused.</span>
        )}
      </div>

      <div style={{ ...tileGrid, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))" }}>
        {tiles.map(([label, value, hint]) => (
          <Panel key={label}>
            <div style={{ padding: "12px 14px" }}>
              <div style={{ ...smallCaps, color: "var(--mute)" }}>{label}</div>
              <div style={{ font: mono(26, 700), letterSpacing: "-.02em", marginTop: 8 }}>{value}</div>
              <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 4 }}>{hint}</div>
            </div>
          </Panel>
        ))}
      </div>

      <Panel style={{ marginBottom: 16 }}>
        <PanelHead>Reads and documented reuse · one scale, on purpose</PanelHead>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 24, padding: 14 }}>
          <div>
            <div style={{ font: mono(11, 500), marginBottom: 8 }}>Reads per week</div>
            <WeeklyBars values={reads} weekStarts={weekStarts} unit="readers" max={shared} />
          </div>
          <div>
            <div style={{ font: mono(11, 500), marginBottom: 8 }}>Documented reuse per week</div>
            <WeeklyBars values={reuse} weekStarts={weekStarts} unit="reuses" max={shared} />
          </div>
        </div>
        <div style={{ padding: "0 14px 12px", font: "400 11.5px/1.6 var(--sans)", color: "var(--mute)" }}>
          Reads are attention; a fork, a repeat or a question that carries the card is use. A card can be read many times and used twice, and that is worth seeing.
        </div>
      </Panel>

      <Pair
        wide={
          <Panel>
            <PanelHead>Readers by institution</PanelHead>
            {(stats?.institutions.length ?? 0) === 0 ? (
              <Empty>No institution has reached {MIN_READERS_PER_INSTITUTION} readers in a week yet.</Empty>
            ) : stats!.institutions.map((i) => (
              <div key={i.institution} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--rule)", font: mono(12) }}>
                <span>{i.institution}</span><span style={{ font: mono(12, 500) }}>{i.readers}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--rule)", font: mono(12), color: "var(--mute)" }}>
              <span>Institutions under {MIN_READERS_PER_INSTITUTION} readers in a week, or none given</span>
              <span>{stats?.below_threshold ?? 0}</span>
            </div>
            <div style={{ padding: "9px 14px", font: "400 11px/1.6 var(--sans)", color: "var(--mute)" }}>
              An institution with two readers is two people, and naming it would identify them, so it is only shown from {MIN_READERS_PER_INSTITUTION} distinct readers in the same week. All time.
            </div>
          </Panel>
        }
        narrow={
          <Panel>
            <PanelHead>Where readers came from</PanelHead>
            {(stats?.via.length ?? 0) === 0 ? (
              <Empty>No reads yet.</Empty>
            ) : (
              <div style={{ padding: "6px 14px 12px" }}>
                {stats!.via.map((v) => (
                  <div key={v.via} style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", font: mono(11), marginBottom: 4 }}>
                      <span>{v.via}</span><span>{v.readers}</span>
                    </div>
                    <div style={{ height: 6, background: "var(--bg)", border: "1px solid var(--rule)" }}>
                      <div style={{ height: "100%", width: `${(v.readers / viaMax) * 100}%`, background: "var(--ink)" }} />
                    </div>
                  </div>
                ))}
                <div style={{ font: "400 11px/1.6 var(--sans)", color: "var(--mute)", marginTop: 10 }}>All time. Only the kind of page is kept, never the address.</div>
              </div>
            )}
          </Panel>
        }
      />

      <Pair
        wide={
          <Panel>
            <PanelHead>What others did with it</PanelHead>
            {reuseEvents.length === 0 ? (
              <Empty>No forks, repeats or questions carrying this card yet.</Empty>
            ) : reuseEvents.map((e, i) => (
              <Link key={i} href={e.href} style={{ display: "flex", gap: 12, padding: "11px 14px", borderBottom: "1px solid var(--rule)", textDecoration: "none", color: "var(--ink)" }}>
                <span style={{ font: "400 12.5px/1.5 var(--sans)", flex: 1, minWidth: 0 }}>{e.text}</span>
                <span style={{ font: mono(10.5), color: "var(--mute)", whiteSpace: "nowrap" }}>{timeAgo(e.at)}</span>
              </Link>
            ))}
          </Panel>
        }
        narrow={
          <Panel>
            <PanelHead>Reviews · {reviews?.length ?? 0}</PanelHead>
            {(reviews?.length ?? 0) === 0 ? (
              <Empty>No reviews yet.</Empty>
            ) : reviews!.map((v) => (
              <div key={v.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, font: mono(10.5, 700) }}>
                  <span>{VERDICT[v.verdict] ?? v.verdict}</span>
                  <span style={{ fontWeight: 400, color: "var(--mute)" }}>{timeAgo(v.created_at)}</span>
                </div>
                {v.body && <p style={{ font: "400 12px/1.55 var(--sans)", margin: "5px 0 0" }}>{v.body}</p>}
              </div>
            ))}
          </Panel>
        }
      />
    </Page>
  );
}
