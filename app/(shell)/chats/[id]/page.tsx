import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRowId } from "@/lib/query";
import { peopleById } from "@/lib/people";
import { timeAgo } from "@/lib/format";
import { MAX_CHAT_PEOPLE } from "@/lib/social/chats";
import { sendChatRoomMessage, addToChat, leaveChat, renameChat } from "@/app/actions/chats";
import { Page, Panel, PanelHead, btn, field, mono } from "@/components/ui";
import Avatar from "@/components/Avatar";
import PersonLink from "@/components/social/PersonLink";
import RichText from "@/components/RichText";
import LiveRefresh from "@/components/groups/LiveRefresh";
import ChatComposer from "@/components/groups/ChatComposer";
import ChatScroller from "@/components/groups/ChatScroller";
import PeoplePicker from "@/components/feed/PeoplePicker";

export const dynamic = "force-dynamic";

/** One small chat: messages for its three to five members, who is in it, add someone, leave. */
export default async function ChatRoom({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; added?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isRowId(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;
  const { data: members } = await supabase.from("chat_room_members").select("user_id, last_read_at, joined_at").eq("room_id", id);
  // Members only; the database hides the room from everyone else, the demo store does not.
  if (!(members ?? []).some((m: any) => m.user_id === me)) notFound();
  const [{ data: room }, { data: rows }] = await Promise.all([
    supabase.from("chat_rooms").select("id, title, created_at").eq("id", id).maybeSingle(),
    supabase.from("chat_room_messages").select("id, author_id, body, created_at").eq("room_id", id).order("created_at", { ascending: false }).limit(200),
  ]);
  if (!room) notFound();
  const messages = [...(rows ?? [])].reverse();
  const people = await peopleById(supabase, [...(members ?? []).map((m: any) => m.user_id), ...messages.map((m: any) => m.author_id)]);
  const lastRead = (members ?? []).find((m: any) => m.user_id === me)?.last_read_at ?? "";
  const firstNew = messages.findIndex((m: any) => m.created_at > lastRead && m.author_id !== me);
  await supabase.from("chat_room_members").update({ last_read_at: new Date().toISOString() }).eq("room_id", id).eq("user_id", me);
  const names = (members ?? []).map((m: any) => m.user_id === me ? "you" : people.get(m.user_id)?.display_name?.split(" ")[0] ?? "someone");
  const room_ = room.title || names.join(", ");
  const space = MAX_CHAT_PEOPLE - (members ?? []).length;

  return (
    <Page title={room_} lede={`Small chat · ${(members ?? []).length} people · only they see it`} actions={<Link href="/messages" style={btn}>All messages</Link>}>
      <LiveRefresh seconds={10} />
      {sp.error === "many" && <p role="alert" style={{ margin: "0 0 12px", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--err)", color: "var(--err)", font: "400 13px/1.6 var(--sans)" }}>A small chat has at most {MAX_CHAT_PEOPLE} people.</p>}
      <div className="sc-two-col">
        <Panel>
          <ChatScroller count={messages.length} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, maxHeight: "62vh", minHeight: 260, overflowY: "auto", background: "var(--bg)" }}>
            {messages.length === 0 && <p style={{ font: "400 13px/1.7 var(--sans)", color: "var(--mute)", margin: "8px 0", textAlign: "center" }}>No messages yet. Say why you brought everyone together.</p>}
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
                        <RichText body={m.body} className="" style={{ font: "400 13.5px/1.65 var(--sans)" }} />
                      </div>
                      <div style={{ font: mono(10), color: "var(--mute)", marginTop: 3, textAlign: mine ? "right" : "left" }}>{mine ? "You" : p?.display_name ?? "Someone"} · {timeAgo(m.created_at)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div id="latest" />
          </ChatScroller>
          <ChatComposer action={sendChatRoomMessage.bind(null, id)} />
        </Panel>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <PanelHead>People · {(members ?? []).length} of {MAX_CHAT_PEOPLE}</PanelHead>
            {(members ?? []).map((m: any) => {
              const p = people.get(m.user_id);
              return (
                <div key={m.user_id} style={{ display: "flex", gap: 9, alignItems: "center", padding: "9px 14px", borderBottom: "1px solid var(--rule)" }}>
                  <Avatar name={p?.display_name ?? ""} url={p?.avatar_url} size={24} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <PersonLink id={m.user_id} style={{ font: "600 13px/1.4 var(--sans)" }}>{m.user_id === me ? "You" : p?.display_name ?? "Someone"}</PersonLink>
                    {p?.institution && <div style={{ font: "400 11.5px/1.5 var(--sans)", color: "var(--mute)" }}>{p.institution}</div>}
                  </div>
                </div>
              );
            })}
            {space > 0 && (
              <form action={addToChat.bind(null, id)} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14 }}>
                <PeoplePicker name="people" max={space} label="Add someone" />
                <div><button type="submit" style={{ ...btn, height: 32 }}>Add</button></div>
              </form>
            )}
          </Panel>
          <details>
            <summary style={{ listStyle: "none", cursor: "pointer", width: "fit-content", height: 32, padding: "0 14px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", display: "flex", alignItems: "center", font: "600 12.5px/1 var(--sans)", color: "var(--ink)" }}>Rename or leave</summary>
            <Panel style={{ marginTop: 8, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <form action={renameChat.bind(null, id)} style={{ display: "flex", gap: 8 }}>
                <label htmlFor="chat-rename" style={{ position: "absolute", left: -9999 }}>Name</label>
                <input id="chat-rename" name="title" defaultValue={room.title} maxLength={120} placeholder="Name of the chat" style={field} />
                <button type="submit" style={{ ...btn, height: 38 }}>Save</button>
              </form>
              <form action={leaveChat.bind(null, id)}><button type="submit" style={{ ...btn, height: 32, borderColor: "var(--err)", color: "var(--err)" }}>Leave this chat</button></form>
            </Panel>
          </details>
        </aside>
      </div>
    </Page>
  );
}
