import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, Empty, mono } from "@/components/ui";
import { timeAgo, initialsOf } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Messages — board G4. One row per correspondent, newest first. */
export default async function Messages() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, body, read_at, created_at")
    .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
    .order("created_at", { ascending: false });

  const threads = new Map<string, { last: any; unread: number }>();
  for (const m of msgs ?? []) {
    const other = m.sender_id === user!.id ? m.recipient_id : m.sender_id;
    const t = threads.get(other) ?? { last: m, unread: 0 };
    if (m.recipient_id === user!.id && !m.read_at) t.unread += 1;
    threads.set(other, t);
  }

  const ids = [...threads.keys()];
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, display_name, institution").in("id", ids)
    : { data: [] as any[] };

  return (
    <Page title="Messages" lede="Direct messages. An unsolicited first message is gated until you have contributed something — board G4.">
      <Panel>
        {ids.length === 0 ? (
          <Empty>No conversations yet. Start one from <Link href="/network" style={{ color: "var(--link)" }}>Network</Link>.</Empty>
        ) : ids.map((id) => {
          const t = threads.get(id)!;
          const who = people?.find((p) => p.id === id);
          return (
            <Link key={id} href={`/messages/${id}`} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
              <span style={{ width: 34, height: 34, border: "1px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", font: mono(11, 500), background: "var(--bg)", flex: "none" }}>
                {initialsOf(who?.display_name ?? "")}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: mono(13, 500) }}>{who?.display_name ?? "Researcher"}</div>
                <div style={{ font: mono(11), color: "var(--mute)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.last.body}
                </div>
              </div>
              <span style={{ font: mono(10.5), color: "var(--mute)" }}>{timeAgo(t.last.created_at)}</span>
              {t.unread > 0 && (
                <span style={{ font: mono(10, 700), background: "var(--signal)", color: "#fff", padding: "2px 6px" }}>{t.unread}</span>
              )}
            </Link>
          );
        })}
      </Panel>
    </Page>
  );
}
