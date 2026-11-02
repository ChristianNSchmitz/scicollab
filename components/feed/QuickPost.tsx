"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { createPost, type PostState } from "@/app/actions/posts";
import { INTENTS, FEEDBACK_KINDS, type Intent } from "@/lib/taxonomy";
import { Panel, field, btnPrimary, mono } from "@/components/ui";
import MentionTextarea from "@/components/social/MentionTextarea";
import ImagePicker from "@/components/feed/ImagePicker";
import PeoplePicker from "@/components/feed/PeoplePicker";

type Topic = { id: string; name: string };
type Card = { id: string; code: string; title: string };

/**
 * The composer at the top of the feed: a title, text with @mentions and
 * links, up to four images, a topic group and the kind of post. A call for
 * collaborators gets its details (technique, system, deadline, what is
 * offered back); a request for feedback gets files (a draft, a poster),
 * the kinds of feedback wanted, a deadline, and who sees it: a topic group
 * or only the people chosen. The full form (/post) adds project data.
 */
export default function QuickPost({ topics, cards, defaultTopic, groupId, groupName }: {
  topics: Topic[]; cards: Card[]; defaultTopic?: string;
  /** Post into this group's members-only discussion instead of a topic group. */
  groupId?: string; groupName?: string;
}) {
  const [state, action, pending] = useActionState<PostState, FormData>(createPost, null);
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<Intent>(groupId ? "general" : "update");
  const spec = INTENTS.find((i) => i.id === intent)!;
  const [audience, setAudience] = useState<"topic" | "people">("topic");
  const chosenOnly = !groupId && intent === "feedback" && audience === "people";
  const sub = { font: "600 12px/1.3 var(--sans)", color: "var(--mute)" } as const;
  const check = { display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 999, border: "1px solid var(--rule)", font: "500 12.5px/1 var(--sans)", cursor: "pointer" } as const;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  }

  if (!groupId && !topics.length) {
    return (
      <Panel style={{ padding: 14, font: "400 13.5px/1.6 var(--sans)" }}>
        To post, first <Link href="/groups#topics" style={{ color: "var(--link)" }}>join a topic group</Link>: every post is filed in one.
      </Panel>
    );
  }

  return (
    <form id="compose" onSubmit={submit} style={{ scrollMarginTop: 72 }}>
      <Panel>
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <label htmlFor="qp-title" style={{ position: "absolute", left: -9999 }}>Title</label>
          <input id="qp-title" name="title" required maxLength={200} onFocus={() => setOpen(true)} style={{ ...field, font: "500 14px/1.4 var(--sans)" }}
            placeholder={groupId ? `Write to ${groupName ?? "the group"}: an update, a question, a request…` : "Share something: a result, a question, a paper, a picture from the bench…"} />
          {open && (
            <>
              <label htmlFor="qp-body" style={{ position: "absolute", left: -9999 }}>Text</label>
              <MentionTextarea id="qp-body" name="body" rows={4} maxLength={10000} style={field}
                placeholder="Say more. Type @ to mention someone; paste a link and a preview is added." />
              <ImagePicker />
              {intent === "collab" && (
                <div className="sc-inset" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, padding: 10, border: "1px solid var(--signal)", borderRadius: 12 }}>
                  <label style={sub}>Technique needed<input name="technique" maxLength={200} required style={{ ...field, marginTop: 4 }} placeholder="Seahorse XF, CRISPR screen…" /></label>
                  <label style={sub}>System<input name="organism" maxLength={200} style={{ ...field, marginTop: 4 }} placeholder="iPSC neurons, HEK293T…" /></label>
                  <label style={sub}>By<input name="deadline" type="date" style={{ ...field, marginTop: 4 }} /></label>
                  <label style={sub}>What you offer back<input name="offer" maxLength={300} style={{ ...field, marginTop: 4 }} placeholder="Co-authorship, reagents, data…" /></label>
                </div>
              )}
              {intent === "feedback" && (
                <div className="sc-inset" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 10, border: "1px solid var(--info)", borderRadius: 12 }}>
                  <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend style={{ ...sub, marginBottom: 6 }}>What feedback do you want?</legend>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {FEEDBACK_KINDS.map((k) => (
                        <label key={k.id} className="sc-option" style={check}><input type="checkbox" name="feedback_kinds" value={k.id} /> {k.label}</label>
                      ))}
                    </div>
                  </fieldset>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <label style={sub}>By<input name="deadline" type="date" style={{ ...field, marginTop: 4, width: "auto" }} /></label>
                    <label style={{ ...sub, flex: "1 1 220px" }}>The draft, poster or figures (PDF or images, up to 3 files, 3 MB each)
                      <input name="files" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" style={{ display: "block", marginTop: 6, font: "400 12.5px/1.4 var(--sans)" }} />
                    </label>
                  </div>
                  {!groupId && (
                    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                      <legend style={{ ...sub, marginBottom: 6 }}>Who sees it</legend>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <label className="sc-option" style={check}><input type="radio" name="audience" value="topic" checked={audience === "topic"} onChange={() => setAudience("topic")} /> Everyone in a topic group</label>
                        <label className="sc-option" style={check}><input type="radio" name="audience" value="people" checked={audience === "people"} onChange={() => setAudience("people")} /> Only people I choose</label>
                      </div>
                      {audience === "people" && (
                        <div style={{ marginTop: 8 }}>
                          <PeoplePicker name="audience_people" max={10} label="Search people by name or institution" />
                          <p style={{ ...sub, fontWeight: 400, margin: "6px 0 0" }}>Only you and these people see the post, its files and the comments. It cannot be reposted or sent on.</p>
                        </div>
                      )}
                    </fieldset>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <label htmlFor="qp-intent" style={{ position: "absolute", left: -9999 }}>Kind of post</label>
                <select id="qp-intent" name="intent" value={intent} onChange={(e) => setIntent(e.target.value as Intent)} style={{ ...field, width: "auto", height: 34, padding: "0 8px" }}>
                  {INTENTS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                </select>
                {groupId ? (
                  <>
                    <input type="hidden" name="group_id" value={groupId} />
                    <span style={{ font: "500 12px/1.3 var(--sans)", color: "var(--mute)" }}>Only members see this</span>
                  </>
                ) : chosenOnly ? (
                  <span style={{ font: "500 12px/1.3 var(--sans)", color: "var(--mute)" }}>Only the people you chose see this</span>
                ) : (
                  <>
                    <label htmlFor="qp-topic" style={{ position: "absolute", left: -9999 }}>Topic group</label>
                    <select id="qp-topic" name="room_id" required defaultValue={defaultTopic ?? topics[0].id} style={{ ...field, width: "auto", height: 34, padding: "0 8px" }}>
                      {topics.map((t) => <option key={t.id} value={t.id}>#{t.id}</option>)}
                    </select>
                  </>
                )}
                {spec.needsArtifact && (
                  <>
                    <label htmlFor="qp-card" style={{ position: "absolute", left: -9999 }}>Method card</label>
                    <select id="qp-card" name="method_card_id" required style={{ ...field, width: "auto", maxWidth: 260, height: 34, padding: "0 8px" }} defaultValue="">
                      <option value="" disabled>Attach a method card</option>
                      {cards.map((c) => <option key={c.id} value={c.id}>{c.code} {c.title}</option>)}
                    </select>
                  </>
                )}
                <input type="hidden" name="return_to" value="feed" />
                <span style={{ flex: 1 }} />
                {!groupId && <Link href="/post" style={{ font: mono(11, 500), color: "var(--mute)" }}>More options</Link>}
                <button type="submit" disabled={pending} style={{ ...btnPrimary, height: 34 }}>{pending ? "Posting…" : "Post"}</button>
              </div>
              {spec.needsArtifact && cards.length === 0 && (
                <p style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--signal-ink)", margin: 0 }}>
                  This kind needs a method card. <Link href="/methods/new" style={{ color: "var(--link)" }}>Record one</Link>, or choose another kind.
                </p>
              )}
              {state?.error && <p role="alert" style={{ font: "400 13px/1.5 var(--sans)", color: "var(--err)", margin: 0 }}>{state.error}</p>}
            </>
          )}
        </div>
      </Panel>
    </form>
  );
}
