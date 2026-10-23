import Link from "next/link";
import { listConversations } from "@/app/actions/chat";
import { Page, Panel, Empty, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

/** Messages — board G4. One row per correspondent, newest first. The same
 *  list the chat dock shows (app/actions/chat.ts), so the two never disagree. */
export default async function Messages() {
  const conversations = await listConversations();

  return (
    <Page title="Messages" lede="Direct messages. An unsolicited first message is gated until you have contributed something — board G4.">
      <Panel>
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
              <span style={{ font: mono(10, 700), background: "var(--signal-fill)", color: "var(--on-signal)", padding: "2px 6px" }}>{c.unread}</span>
            )}
          </Link>
        ))}
      </Panel>
    </Page>
  );
}
