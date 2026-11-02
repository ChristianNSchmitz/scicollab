import Link from "next/link";
import { listConversations } from "@/app/actions/chat";
import { createClient } from "@/lib/supabase/server";
import { myChats } from "@/lib/social/chats";
import { peopleById } from "@/lib/people";
import { Page, Panel, PanelHead, Empty, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

/** Messages — board G4. One row per correspondent, newest first. The same
 *  list the chat dock shows (app/actions/chat.ts), so the two never disagree. */
export default async function Messages({ searchParams }: { searchParams: Promise<{ left?: string }> }) {
  const { left } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [conversations, chats] = await Promise.all([listConversations(), myChats(supabase, user!.id)]);
  const chatPeople = await peopleById(supabase, chats.flatMap((c) => c.members));

  return (
    <Page title="Messages" lede="Direct messages and small chats."
      actions={<Link href="/chats/new" style={btnPrimary}>New small chat</Link>}>
      {left === "1" && <p role="status" style={{ font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--ok)", borderRadius: 12, background: "var(--surface)" }}>You left the chat.</p>}
      <Panel style={{ marginBottom: 14 }}>
        <PanelHead>Small chats · {chats.length}</PanelHead>
        {chats.length === 0 ? (
          <Empty>None yet. <Link href="/chats/new" style={{ color: "var(--link)" }}>Start one</Link> with two to four people: writing buddies, a mini collaboration, a protocol comparison.</Empty>
        ) : chats.map((c) => {
          const others = c.members.filter((m) => m !== user!.id);
          return (
            <Link key={c.id} href={`/chats/${c.id}`} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
              <span style={{ display: "flex" }}>
                {others.slice(0, 3).map((m, i) => <span key={m} style={{ marginLeft: i ? -10 : 0 }}><Avatar name={chatPeople.get(m)?.display_name ?? ""} url={chatPeople.get(m)?.avatar_url} size={28} /></span>)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: mono(13, c.unread ? 700 : 500) }}>{c.title || others.map((m) => chatPeople.get(m)?.display_name?.split(" ")[0]).join(", ")}</div>
                <div style={{ font: mono(11), color: "var(--mute)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last}</div>
              </div>
              <span style={{ font: mono(10.5), color: "var(--mute)" }}>{timeAgo(c.at)}</span>
              {c.unread > 0 && <span style={{ font: mono(10, 700), background: "var(--signal-fill)", color: "var(--on-signal)", padding: "2px 7px", borderRadius: 999 }}>{c.unread}</span>}
            </Link>
          );
        })}
      </Panel>
      <Panel>
        <PanelHead>Direct messages</PanelHead>
        {conversations.length === 0 ? (
          <Empty>No conversations yet. Start one from <Link href="/network" style={{ color: "var(--link)" }}>Network</Link>, or message the author of a post.</Empty>
        ) : conversations.map((c) => (
          <Link key={c.id} href={`/messages/${c.id}`} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
            <Avatar name={c.name} url={c.avatar_url} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: mono(13, c.unread ? 700 : 500) }}>{c.name}</div>
              <div style={{ font: mono(11), color: "var(--mute)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.last}
              </div>
            </div>
            <span style={{ font: mono(10.5), color: "var(--mute)" }}>{timeAgo(c.at)}</span>
            {c.unread > 0 && (
              <span style={{ font: mono(10, 700), background: "var(--signal-fill)", color: "var(--on-signal)", padding: "2px 7px", borderRadius: 999 }}>{c.unread}</span>
            )}
          </Link>
        ))}
      </Panel>
    </Page>
  );
}
