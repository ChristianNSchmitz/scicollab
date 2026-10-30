"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { createPost, type PostState } from "@/app/actions/posts";
import { INTENTS, type Intent } from "@/lib/taxonomy";
import { Panel, field, btnPrimary, mono } from "@/components/ui";
import MentionTextarea from "@/components/social/MentionTextarea";
import ImagePicker from "@/components/feed/ImagePicker";

type Topic = { id: string; name: string };
type Card = { id: string; code: string; title: string };

/**
 * The composer at the top of the feed: a title, text with @mentions and
 * links, up to four images, a topic group and the kind of post. The full
 * form (/post) adds project data and the collaboration details.
 */
export default function QuickPost({ topics, cards, defaultTopic }: { topics: Topic[]; cards: Card[]; defaultTopic?: string }) {
  const [state, action, pending] = useActionState<PostState, FormData>(createPost, null);
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<Intent>("update");
  const spec = INTENTS.find((i) => i.id === intent)!;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  }

  if (!topics.length) {
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
            placeholder="Share something: a result, a question, a paper, a picture from the bench…" />
          {open && (
            <>
              <label htmlFor="qp-body" style={{ position: "absolute", left: -9999 }}>Text</label>
              <MentionTextarea id="qp-body" name="body" rows={4} maxLength={10000} style={field}
                placeholder="Say more. Type @ to mention someone; paste a link and a preview is added." />
              <ImagePicker />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <label htmlFor="qp-intent" style={{ position: "absolute", left: -9999 }}>Kind of post</label>
                <select id="qp-intent" name="intent" value={intent} onChange={(e) => setIntent(e.target.value as Intent)} style={{ ...field, width: "auto", height: 34, padding: "0 8px" }}>
                  {INTENTS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                </select>
                <label htmlFor="qp-topic" style={{ position: "absolute", left: -9999 }}>Topic group</label>
                <select id="qp-topic" name="room_id" required defaultValue={defaultTopic ?? topics[0].id} style={{ ...field, width: "auto", height: 34, padding: "0 8px" }}>
                  {topics.map((t) => <option key={t.id} value={t.id}>#{t.id}</option>)}
                </select>
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
                <Link href="/post" style={{ font: mono(11, 500), color: "var(--mute)" }}>More options</Link>
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
