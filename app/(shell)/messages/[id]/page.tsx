import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MESSAGE_PROBLEM } from "@/lib/messages";
import type { MessageProblem } from "@/app/actions/messages";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/server";
import { canMessage, sendMessage, markRead } from "@/app/actions/messages";
import { Page, LimitNotice, Panel, PanelHead, Empty, field, btnPrimary, btn, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import RichText from "@/components/RichText";

export const dynamic = "force-dynamic";

/**
 * A conversation — board G4 screen 16, both states.
 *
 * The gate is the real rule, not a mock: an unsolicited first message is held
 * until you have contributed something. Anyone you have already exchanged
 * messages with is never gated. When it does block, it says so in plain words
 * and offers the routes out, because a gate with no explanation reads as
 * "you are not welcome here".
 */
export default async function Thread({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ limited?: string; error?: string }> }) {
  const { limited, error } = await searchParams;
  const { id: otherId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // There is no conversation with yourself; the gate would wrongly call you a stranger.
  if (otherId === user!.id) redirect("/messages");
  const problem = error && error in MESSAGE_PROBLEM ? MESSAGE_PROBLEM[error as MessageProblem] : null;

  const { data: other } = await supabase
    .from("profiles")
    .select("id, display_name, institution, role_title, avatar_url")
    .eq("id", otherId)
    .maybeSingle();
  if (!other) notFound();

  const [{ data: msgs }, gate] = await Promise.all([
    supabase
      .from("messages")
      .select("id, sender_id, body, method_card_id, created_at")
      .or(`and(sender_id.eq.${user!.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user!.id})`)
      .order("created_at"),
    canMessage(otherId),
  ]);

  await markRead(otherId);

  const cardIds = [...new Set((msgs ?? []).map((m) => m.method_card_id).filter(Boolean))] as string[];
  const { data: cards } = cardIds.length
    ? await supabase.from("method_cards").select("id, code, title").in("id", cardIds)
    : { data: [] as { id: string; code: string; title: string }[] };

  const { data: myCards } = await supabase
    .from("method_cards")
    .select("id, code, title")
    .eq("author_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <Page
      title={other.display_name || "Researcher"}
      lede={[other.role_title, other.institution].filter(Boolean).join(" · ") || undefined}
      actions={<div style={{ display: "flex", gap: 8 }}><Link href={`/people/${other.id}`} style={btn}>Profile</Link><Link href="/messages" style={btn}>All messages</Link></div>}
    >
      <LimitNotice show={limited} />
      {problem && (
        <p role="alert" style={{ font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--err)", color: "var(--err)", background: "var(--surface)", maxWidth: 760 }}>
          {problem}
        </p>
      )}
      <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 12 }}>
        <Panel>
          <PanelHead>Conversation</PanelHead>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {(msgs?.length ?? 0) === 0 && <Empty>No messages yet.</Empty>}
            {msgs?.map((m) => {
              const mine = m.sender_id === user!.id;
              const card = cards?.find((c) => c.id === m.method_card_id);
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: 520, border: "1px solid var(--rule)", background: mine ? "var(--bg)" : "var(--surface)", padding: "10px 12px" }}>
                    <div style={{ font: mono(10), color: "var(--mute)", marginBottom: 5, display: "flex", alignItems: "center", gap: 6 }}>
                      {!mine && <Avatar name={other.display_name} url={other.avatar_url} size={16} />}
                      {mine ? "You" : other.display_name} · {timeAgo(m.created_at)}
                    </div>
                    <RichText body={m.body} className="" style={{ font: "400 14px/1.65 var(--sans)" }} />
                    {card && (
                      <Link
                        href={`/methods/${card.id}`}
                        style={{ display: "block", marginTop: 9, borderLeft: "3px solid var(--signal)", background: "var(--surface)", padding: "8px 10px", color: "var(--ink)" }}
                      >
                        <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--signal-ink)" }}>METHOD CARD</div>
                        <div style={{ font: mono(12, 500), marginTop: 3 }}>{card.code} — {card.title}</div>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {gate.allowed ? (
          <Panel>
            <PanelHead>Reply</PanelHead>
            <form action={sendMessage.bind(null, otherId)} style={{ padding: 14 }}>
              <textarea name="body" rows={3} required maxLength={4000} style={field} placeholder="Reply — attach the card rather than retyping the conditions." />
              {myCards && myCards.length > 0 && (
                <select name="method_card_id" defaultValue="" style={{ ...field, height: 36, marginTop: 10 }}>
                  <option value="">No card attached</option>
                  {myCards.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                </select>
              )}
              <button type="submit" style={{ ...btnPrimary, marginTop: 11 }}>Send</button>
            </form>
          </Panel>
        ) : (
          <Panel style={{ borderColor: "var(--flag)" }}>
            <PanelHead>You cannot message strangers yet</PanelHead>
            <div style={{ padding: 14 }}>
              <p style={{ font: "400 14px/1.7 var(--sans)", margin: "0 0 14px" }}>
                New accounts cannot send an unsolicited direct message. This is not about you — it is the single
                measure that stops a research network turning into a recruiting channel.
              </p>
              <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--mute)", marginBottom: 8 }}>
                THE PATH TO UNLOCKING · ANY ONE OF THESE
              </div>
              <ul style={{ margin: "0 0 14px", paddingLeft: 18, font: "400 13.5px/1.8 var(--sans)" }}>
                <li>Record one method card — including a run that did not work</li>
                <li>Ask one question</li>
                <li>Answer someone else&rsquo;s question, or reply to a post in a topic group</li>
              </ul>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/methods/new" style={btnPrimary}>Record a method</Link>
                <Link href="/ask" style={btn}>Ask publicly instead</Link>
              </div>
              <p style={{ font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)", margin: "12px 0 0" }}>
                Asking publicly is usually faster than a direct message, and others benefit from the answer.
              </p>
            </div>
          </Panel>
        )}
      </div>
    </Page>
  );
}
