import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordReproduction, writeReview } from "@/app/actions/record";
import { Panel, PanelHead, btn, field, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";

type Client = SupabaseClient<any, "public", any>;

export const VERDICT: Record<string, string> = {
  clear: "Clear enough to run",
  unclear: "Unclear in places",
  incomplete: "Missing something needed",
  does_not_hold: "Does not hold as written",
};

/**
 * Reproductions and reviews on a method card. Only people other than the
 * author can record either — the author sees what others recorded and a link
 * to the card's own analytics instead.
 */
export default async function CardRecordPanels({ supabase, cardId, isOwner, userId }: {
  supabase: Client; cardId: string; isOwner: boolean; userId: string;
}) {
  const [{ data: repros }, { data: reviews }] = await Promise.all([
    supabase.from("reproductions").select("id, user_id, outcome, note, created_at").eq("card_id", cardId).order("created_at", { ascending: false }),
    supabase.from("reviews").select("id, reviewer_id, verdict, body, created_at").eq("card_id", cardId).order("created_at", { ascending: false }),
  ]);
  const ids = [...new Set([...(repros ?? []).map((r) => r.user_id), ...(reviews ?? []).map((r) => r.reviewer_id)])];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] as any[] };
  const name = (id: string) => (id === userId ? "You" : people?.find((p) => p.id === id)?.display_name ?? "Someone");
  const held = (repros ?? []).filter((r) => r.outcome === "held").length;
  const reviewed = (reviews ?? []).some((r) => r.reviewer_id === userId);

  return (
    <>
      <Panel>
        <PanelHead>Reproductions · {held} held · {(repros?.length ?? 0) - held} failed</PanelHead>
        {(repros ?? []).slice(0, 5).map((r) => (
          <div key={r.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", font: mono(11) }}>
              <span style={{ font: mono(10, 700), letterSpacing: ".06em", color: r.outcome === "held" ? "var(--ok)" : "var(--signal)" }}>
                {r.outcome === "held" ? "HELD" : "FAILED"}
              </span>
              <span>{name(r.user_id)}</span>
              <span style={{ marginLeft: "auto", color: "var(--mute)" }}>{timeAgo(r.created_at)}</span>
            </div>
            {r.note && <p style={{ font: "400 12px/1.55 var(--sans)", margin: "5px 0 0", color: "var(--ink)" }}>{r.note}</p>}
          </div>
        ))}
        {isOwner ? (
          <div style={{ padding: "10px 14px", font: "400 11.5px/1.6 var(--sans)", color: "var(--mute)" }}>
            Reproductions are recorded by the people who ran your card, never by you.{" "}
            <Link href={`/you/record/cards/${cardId}`} style={{ color: "var(--link)" }}>Analytics for this card →</Link>
          </div>
        ) : (
          <form action={recordReproduction.bind(null, cardId)} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <label htmlFor="repro-note" style={{ font: mono(10, 700), letterSpacing: ".1em", color: "var(--mute)" }}>YOU RAN THIS</label>
            <input id="repro-note" name="note" style={field} placeholder="Optional: what you saw, in a line" maxLength={500} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" name="outcome" value="held" style={{ ...btn, flex: 1, justifyContent: "center", borderColor: "var(--ok)", color: "var(--ok)" }}>It held</button>
              <button type="submit" name="outcome" value="failed" style={{ ...btn, flex: 1, justifyContent: "center" }}>It failed</button>
            </div>
            <span style={{ font: "400 11px/1.5 var(--sans)", color: "var(--mute)" }}>A failed repeat is recorded and credited the same way.</span>
          </form>
        )}
      </Panel>

      <Panel>
        <PanelHead>Reviews · {reviews?.length ?? 0}</PanelHead>
        {(reviews ?? []).map((r) => (
          <div key={r.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", font: mono(11) }}>
              <span style={{ font: mono(10.5, 700) }}>{VERDICT[r.verdict] ?? r.verdict}</span>
              <span style={{ marginLeft: "auto", color: "var(--mute)" }}>{timeAgo(r.created_at)}</span>
            </div>
            <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 3 }}>{name(r.reviewer_id)}</div>
            {r.body && <p style={{ font: "400 12px/1.55 var(--sans)", margin: "5px 0 0" }}>{r.body}</p>}
          </div>
        ))}
        {!isOwner && !reviewed && (
          <form action={writeReview.bind(null, cardId)} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 5 }}>
              <legend style={{ font: mono(10, 700), letterSpacing: ".1em", color: "var(--mute)", marginBottom: 6 }}>COULD SOMEONE RUN THIS FROM THE CARD?</legend>
              {Object.entries(VERDICT).map(([v, label]) => (
                <label key={v} style={{ font: "400 12px/1.4 var(--sans)", display: "flex", gap: 7, alignItems: "center" }}>
                  <input type="radio" name="verdict" value={v} required /> {label}
                </label>
              ))}
            </fieldset>
            <textarea name="body" rows={3} style={field} placeholder="What would you change, and why?" maxLength={2000} />
            <button type="submit" style={{ ...btn, justifyContent: "center" }}>Submit review</button>
          </form>
        )}
        {!isOwner && reviewed && (
          <div style={{ padding: "10px 14px", font: "400 11.5px/1.6 var(--sans)", color: "var(--mute)" }}>You have reviewed this card.</div>
        )}
        {isOwner && (reviews?.length ?? 0) === 0 && (
          <div style={{ padding: "10px 14px", font: "400 11.5px/1.6 var(--sans)", color: "var(--mute)" }}>No reviews yet. Lab or Public cards can be reviewed by others.</div>
        )}
      </Panel>
    </>
  );
}
