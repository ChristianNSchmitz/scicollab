import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { peopleById } from "@/lib/people";
import { loadNotices } from "@/lib/social/notifications";
import { timeAgo } from "@/lib/format";
import { Page, Panel, PanelHead, Empty, Tag, btn, mono } from "@/components/ui";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

/**
 * Everything that happened to you in the last 30 days, newest first, each
 * linking to where you deal with it (lib/social/notifications.ts). Opening
 * this page clears the badge on the bell; what arrived since your last visit
 * is marked. A weekly e-mail digest of the same list can be switched off in
 * Settings.
 */
export default async function Notifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;

  const [items, { data: profile }] = await Promise.all([
    loadNotices(supabase, me, 30),
    supabase.from("profiles").select("notifications_seen_at").eq("id", me).maybeSingle(),
  ]);
  const seenAt: string | null = profile?.notifications_seen_at ?? null;
  // Seen once shown. A write during render is fine here: it changes nothing on this page.
  await supabase.from("profiles").update({ notifications_seen_at: new Date().toISOString() }).eq("id", me);

  const people = await peopleById(supabase, items.map((i) => i.who));

  return (
    <Page
      title="Notifications"
      lede="Messages, mentions, replies, answers, reactions, new followers and data requests from the last 30 days, newest first. A weekly e-mail summary can be switched off in Settings."
      actions={<div style={{ display: "flex", gap: 8 }}><Link href="/messages" style={btn}>Messages</Link><Link href="/requests" style={btn}>Data requests</Link></div>}
    >
      <Panel>
        <PanelHead>{items.length ? `${items.length} in the last 30 days` : "Last 30 days"}</PanelHead>
        {items.length === 0 ? (
          <Empty>
            Nothing new. Messages, mentions, replies to your posts, answers to your questions and new followers will show up here.
            <br /><Link href="/home" style={{ color: "var(--link)" }}>Back to Home</Link>
          </Empty>
        ) : items.map((i, n) => {
          const p = i.who ? people.get(i.who) : undefined;
          const fresh = !seenAt || i.at > seenAt;
          return (
            <Link key={n} href={i.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: "1px solid var(--rule)", textDecoration: "none", color: "var(--ink)", boxShadow: fresh ? "inset 3px 0 0 var(--signal)" : undefined }}>
              <Avatar name={p?.display_name ?? "?"} url={p?.avatar_url ?? null} size={28} />
              <span style={{ flex: 1, minWidth: 0, font: "400 13.5px/1.5 var(--sans)" }}>
                <strong style={{ fontWeight: 600 }}>{p?.display_name ?? "Someone"}</strong> {i.text}
              </span>
              {fresh && <span style={{ font: mono(10, 700), color: "var(--signal-ink)" }}>NEW</span>}
              <Tag>{i.kind}</Tag>
              <span style={{ font: mono(11), color: "var(--mute)", whiteSpace: "nowrap" }}>{timeAgo(i.at)}</span>
            </Link>
          );
        })}
      </Panel>
    </Page>
  );
}
