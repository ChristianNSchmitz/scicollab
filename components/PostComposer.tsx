"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { createPost, type PostState } from "@/app/actions/posts";
import { INTENTS, type Intent } from "@/lib/taxonomy";
import { Panel, PanelHead, field, fieldLabel, btnPrimary, mono } from "@/components/ui";

type Room = { id: string; name: string };
type Card = { id: string; code: string; title: string };
type Attachable = { value: string; project: string; label: string; kind: string };

/**
 * The composer form.
 *
 * A client component so a rejected post says why on the form rather than
 * hitting an error boundary, and so the collaboration fields only appear when
 * they are relevant. The rules are still enforced in the action — this is the
 * courtesy layer, not the guard.
 */
export default function PostComposer({
  rooms, cards, attachables = [], defaultRoom, defaultIntent, defaultCard,
}: {
  rooms: Room[]; cards: Card[]; attachables?: Attachable[];
  defaultRoom?: string; defaultIntent?: string; defaultCard?: string;
}) {
  const [attach, setAttach] = useState("");
  const [state, action, pending] = useActionState<PostState, FormData>(createPost, null);
  const [intent, setIntent] = useState<Intent>(
    (INTENTS.find((i) => i.id === defaultIntent)?.id ?? "result") as Intent
  );
  const spec = INTENTS.find((i) => i.id === intent)!;
  const [card, setCard] = useState(defaultCard ?? "");
  const [cardMissing, setCardMissing] = useState(false);

  // Submitted through onSubmit rather than the form's action prop: a form
  // action resets every field once it settles, so a rejected post would
  // come back empty and the researcher would have to type it all again.
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (spec.needsArtifact && !card) {
      setCardMissing(true);
      document.getElementById("method_card_id")?.focus();
      return;
    }
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 820 }}>
      <Panel style={{ marginBottom: 12 }}>
        <PanelHead>What kind of post is this?</PanelHead>
        <div className="sc-pair" style={{ padding: 14, gap: 10 }}>
          {INTENTS.map((i) => (
            <label
              key={i.id}
              style={{
                border: `1px solid ${intent === i.id ? "var(--ink)" : "var(--rule)"}`,
                padding: "11px 12px", cursor: "pointer",
                background: intent === i.id ? "var(--surface)" : "var(--bg)",
              }}
            >
              <input
                type="radio" name="intent" value={i.id} required
                checked={intent === i.id}
                onChange={() => { setIntent(i.id); setCardMissing(false); }}
                style={{ marginRight: 8 }}
              />
              <span style={{ font: mono(12.5, 500) }}>{i.label}</span>
              <span style={{ display: "block", font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", marginTop: 5 }}>{i.hint}</span>
              {i.needsArtifact && (
                <span style={{ display: "inline-block", font: mono(9.5, 700), letterSpacing: ".08em", color: "var(--signal-ink)", marginTop: 7 }}>
                  NEEDS A METHOD CARD
                </span>
              )}
            </label>
          ))}
        </div>
      </Panel>

      <Panel style={{ marginBottom: 12 }}>
        <PanelHead>The post</PanelHead>
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 13 }}>
          <div>
            <label style={fieldLabel} htmlFor="room_id">Room</label>
            <select id="room_id" name="room_id" required defaultValue={defaultRoom ?? ""} style={{ ...field, height: 38 }}>
              <option value="" disabled>Choose a room you have joined</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>#{r.id} — {r.name}</option>)}
            </select>
            {rooms.length === 0 && (
              <p style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--signal-ink)", margin: "6px 0 0" }}>
                You have not joined any rooms yet. <Link href="/rooms" style={{ color: "var(--link)" }}>Join some first</Link> and this list fills up.
              </p>
            )}
          </div>
          <div>
            <label style={fieldLabel} htmlFor="title">Title</label>
            <input id="title" name="title" required style={field} placeholder="Say the finding or the problem in one line" />
          </div>
          <div>
            <label style={fieldLabel} htmlFor="body">Detail</label>
            <textarea id="body" name="body" rows={6} style={field} placeholder="What you did, what you saw, and what you want from the room." />
          </div>
          <div>
            <label style={fieldLabel} htmlFor="method_card_id">
              Method card {spec.needsArtifact && <span style={{ color: "var(--signal-ink)" }}>· required for this kind of post</span>}
            </label>
            <select
              id="method_card_id" name="method_card_id" value={card}
              onChange={(e) => { setCard(e.target.value); setCardMissing(false); }}
              aria-invalid={cardMissing || undefined}
              style={{ ...field, height: 38, ...(cardMissing ? { borderColor: "var(--err)" } : {}) }}
            >
              <option value="">No card attached</option>
              {cards.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
            </select>
            {cards.length === 0 && spec.needsArtifact ? (
              <p style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--signal-ink)", margin: "6px 0 0" }}>
                You have no method cards yet. <Link href="/methods/new" style={{ color: "var(--link)" }}>Record one first</Link>, or choose a general question.
              </p>
            ) : cardMissing && (
              <p role="alert" style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--err)", margin: "6px 0 0" }}>
                “{spec.label}” needs a method card. Pick one here, or choose a different kind of post above.
              </p>
            )}
          </div>
        </div>
      </Panel>

      <Panel style={{ marginBottom: 12 }}>
        <PanelHead>Attach data or code from a project</PanelHead>
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 13 }}>
          {attachables.length === 0 ? (
            <p style={{ font: "400 13px/1.6 var(--sans)", color: "var(--mute)", margin: 0 }}>
              Nothing to attach yet — datasets and code live inside a project, and you are not on one that has any.
            </p>
          ) : (
            <>
              <div>
                <label style={fieldLabel} htmlFor="attach">The evidence</label>
                <select
                  id="attach" name="attach" value={attach}
                  onChange={(e) => setAttach(e.target.value)}
                  style={{ ...field, height: 38 }}
                >
                  <option value="">Nothing attached</option>
                  {[...new Set(attachables.map((a) => a.project))].map((proj) => (
                    <optgroup key={proj} label={proj}>
                      {attachables.filter((a) => a.project === proj).map((a) => (
                        <option key={a.value} value={a.value}>{a.kind} · {a.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {attach && (
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={{ ...fieldLabel, padding: 0 }}>Who can open it</legend>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    <label style={{ border: "1px solid var(--rule)", padding: "10px 11px", cursor: "pointer", background: "var(--bg)" }}>
                      <input type="radio" name="access" value="on_request" defaultChecked style={{ marginRight: 8 }} />
                      <span style={{ font: mono(12.5, 500) }}>Request access</span>
                      <span style={{ display: "block", font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", marginTop: 4 }}>
                        The room sees what it is — title, kind, size, licence — and has to ask you.
                        You approve one researcher at a time.
                      </span>
                    </label>
                    <label style={{ border: "1px solid var(--rule)", padding: "10px 11px", cursor: "pointer", background: "var(--bg)" }}>
                      <input type="radio" name="access" value="open" style={{ marginRight: 8 }} />
                      <span style={{ font: mono(12.5, 500) }}>Open</span>
                      <span style={{ display: "block", font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", marginTop: 4 }}>
                        Anyone who can read the post can open it. Sensible for data you have already published.
                      </span>
                    </label>
                  </div>
                </fieldset>
              )}
            </>
          )}
        </div>
      </Panel>

      {intent === "collab" && (
        <Panel style={{ marginBottom: 12 }}>
          <PanelHead>What you need, and what you offer</PanelHead>
          <div className="sc-pair" style={{ padding: 14, gap: 12 }}>
            <div>
              <label style={fieldLabel} htmlFor="technique">Technique needed</label>
              <input id="technique" name="technique" style={field} placeholder="Lipofection" />
            </div>
            <div>
              <label style={fieldLabel} htmlFor="organism">Organism or system</label>
              <input id="organism" name="organism" style={field} placeholder="HEK293T" />
            </div>
            <div>
              <label style={fieldLabel} htmlFor="deadline">By when</label>
              <input id="deadline" name="deadline" type="date" style={field} />
            </div>
            <div>
              <label style={fieldLabel} htmlFor="offer">What you offer back</label>
              <input id="offer" name="offer" style={field} placeholder="Co-authorship, reagents covered" />
            </div>
          </div>
        </Panel>
      )}

      {state?.error && (
        <p style={{ font: "400 12px/1.6 var(--mono)", color: "var(--err)", border: "1px solid var(--err)", padding: "10px 12px", margin: "0 0 12px" }}>
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} style={{ ...btnPrimary, height: 42 }}>
        {pending ? "Posting…" : "Post to the room"}
      </button>
    </form>
  );
}
