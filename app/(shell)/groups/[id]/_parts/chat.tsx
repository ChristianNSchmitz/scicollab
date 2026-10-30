import { peopleById } from "@/lib/people";
import { timeAgo } from "@/lib/format";
import { sendGroupMessage, deleteGroupMessage } from "@/app/actions/group-workspace";
import { Panel, PanelHead, mono } from "@/components/ui";
import RichText from "@/components/RichText";
import Avatar from "@/components/Avatar";
import LiveRefresh from "@/components/groups/LiveRefresh";
import ChatComposer from "@/components/groups/ChatComposer";
import ChatScroller from "@/components/groups/ChatScroller";
import { markSeen, type GroupCtx } from "./ctx";

/** The group's chat: quick talk for current members, newest at the bottom. */
export default async function GroupChat({ ctx }: { ctx: GroupCtx }) {
  const { supabase, id, me, manage } = ctx;
  const { data: rows } = await supabase.from("group_messages").select("id, author_id, body, created_at")
    .eq("group_id", id).order("created_at", { ascending: false }).limit(150);
  const messages = [...(rows ?? [])].reverse();
  const [people] = await Promise.all([
    peopleById(supabase, messages.map((m: any) => m.author_id)),
    markSeen(supabase, id, me, "chat"),
  ]);
  // Where "new since your last visit" goes: the first message from someone else after it.
  const firstNew = messages.findIndex((m: any) => m.created_at > ctx.since.chat && m.author_id !== me);

  return (
    <Panel style={{ maxWidth: 820 }}>
      <LiveRefresh seconds={10} />
      <PanelHead>Chat · members only</PanelHead>
      <ChatScroller count={messages.length} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, maxHeight: "62vh", overflowY: "auto", background: "var(--bg)" }}>
        {messages.length === 0 && (
          <p style={{ font: "400 13px/1.6 var(--sans)", color: "var(--mute)", margin: "8px 0", textAlign: "center" }}>No messages yet. Say hello to the group.</p>
        )}
        {messages.map((m: any, i: number) => {
          const mine = m.author_id === me;
          const p = people.get(m.author_id);
          return (
            <div key={m.id}>
              {i === firstNew && <div style={{ textAlign: "center", font: mono(10.5, 600), color: "var(--signal-ink)", margin: "4px 0 8px" }}>New since your last visit</div>}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexDirection: mine ? "row-reverse" : "row" }}>
                {!mine && <Avatar name={p?.display_name ?? ""} url={p?.avatar_url} size={26} />}
                <div style={{ maxWidth: "78%" }}>
                  <div className={mine ? "sc-bubble sc-bubble-mine" : "sc-bubble"} style={{ border: `1px solid ${mine ? "transparent" : "var(--rule)"}`, borderRadius: mine ? "18px 18px 6px 18px" : "18px 18px 18px 6px", background: mine ? "color-mix(in srgb, var(--signal) 12%, var(--surface))" : "var(--surface)", padding: "8px 12px" }}>
                    <RichText body={m.body} className="" style={{ font: "400 13.5px/1.55 var(--sans)" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: mine ? "flex-end" : "flex-start", alignItems: "center", font: mono(10), color: "var(--mute)", marginTop: 3 }}>
                    <span>{mine ? "You" : p?.display_name ?? "Someone"} · {timeAgo(m.created_at)}</span>
                    {(mine || manage) && (
                      <form action={deleteGroupMessage.bind(null, id, m.id)}>
                        <button type="submit" aria-label="Delete message" style={{ border: 0, background: "none", padding: 0, font: mono(10), color: "var(--mute)", cursor: "pointer", textDecoration: "underline" }}>delete</button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div id="latest" />
      </ChatScroller>
      <ChatComposer action={sendGroupMessage.bind(null, id)} />
    </Panel>
  );
}
