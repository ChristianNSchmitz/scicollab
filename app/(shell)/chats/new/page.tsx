import Link from "next/link";
import { createChat } from "@/app/actions/chats";
import { MAX_CHAT_PEOPLE } from "@/lib/social/chats";
import { Page, Panel, btn, btnPrimary, field, fieldLabel } from "@/components/ui";
import PeoplePicker from "@/components/feed/PeoplePicker";

const ERRORS: Record<string, string> = {
  few: "Choose at least two people: a small chat is for three to five. For one person, send a direct message.",
  many: `At most ${MAX_CHAT_PEOPLE} people in a small chat, you included.`,
  person: "One of the people you chose could not be found.",
};

/** Start a small chat: a name, two to four people from any lab, and a first message. */
export default async function NewChat({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <Page title="New small chat" lede={`For three to five people from any lab: writing buddies, a mini collaboration, a few people comparing protocols. Only the people in it see it.`}
      actions={<Link href="/messages" style={btn}>Back to messages</Link>}>
      <form action={createChat} style={{ maxWidth: 640 }}>
        <Panel style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {error && ERRORS[error] && <p role="alert" style={{ margin: 0, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--err)", color: "var(--err)", font: "400 13px/1.5 var(--sans)" }}>{ERRORS[error]}</p>}
          <div>
            <label style={fieldLabel} htmlFor="chat-title">Name (optional)</label>
            <input id="chat-title" name="title" maxLength={120} placeholder="Writing buddies, Seahorse users, iPSC journal club…" style={field} />
          </div>
          <div>
            <span style={fieldLabel}>People (two to four, besides you)</span>
            <div style={{ marginTop: 4 }}><PeoplePicker name="people" max={MAX_CHAT_PEOPLE - 1} label="Search people by name or institution" /></div>
          </div>
          <div>
            <label style={fieldLabel} htmlFor="chat-first">First message (optional)</label>
            <textarea id="chat-first" name="first" rows={3} maxLength={4000} placeholder="Why you are bringing these people together." style={field} />
          </div>
          <div><button type="submit" style={btnPrimary}>Start the chat</button></div>
        </Panel>
      </form>
    </Page>
  );
}
