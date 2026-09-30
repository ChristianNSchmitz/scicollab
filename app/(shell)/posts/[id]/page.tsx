import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, PanelHead, Outcome, Tag, btn, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { roomById, housesOfRoom, intentById } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default async function PostDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: post } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
  if (!post) notFound();

  const [{ data: author }, { data: card }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, institution, role_title").eq("id", post.author_id).maybeSingle(),
    post.method_card_id
      ? supabase.from("method_cards").select("id, code, title, outcome, system, conditions, fails_under").eq("id", post.method_card_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const room = roomById(post.room_id);
  const spec = intentById(post.intent);
  const isMine = post.author_id === user!.id;

  return (
    <Page
      title={post.title}
      lede={[spec?.label, room ? `#${room.id}` : null].filter(Boolean).join(" · ")}
      actions={
        !isMine ? <Link href={`/messages/${post.author_id}`} style={btn}>Message the author</Link> : undefined
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--rule)", font: mono(11), color: "var(--mute)" }}>
              {author?.display_name ?? "Someone"}
              {author?.role_title ? ` · ${author.role_title}` : ""}
              {author?.institution ? ` · ${author.institution}` : ""} · {timeAgo(post.created_at)}
            </div>
            {post.body && (
              <div style={{ padding: 14 }}>
                <p style={{ font: "400 13px/1.7 var(--sans)", margin: 0, whiteSpace: "pre-wrap" }}>{post.body}</p>
              </div>
            )}

            {post.intent === "collab" && (
              <div style={{ padding: 14, borderTop: "1px solid var(--rule)" }}>
                <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--signal)", marginBottom: 8 }}>THE ASK</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, font: mono(12, 400, 1.6) }}>
                  <div><span style={{ color: "var(--mute)" }}>technique</span><br />{post.technique || "—"}</div>
                  <div><span style={{ color: "var(--mute)" }}>system</span><br />{post.organism || "—"}</div>
                  <div><span style={{ color: "var(--mute)" }}>by</span><br />{post.deadline || "—"}</div>
                  <div><span style={{ color: "var(--mute)" }}>offered back</span><br />{post.offer || "—"}</div>
                </div>
              </div>
            )}
          </Panel>

          {card && (
            <Panel>
              <PanelHead>Attached method card</PanelHead>
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <Outcome value={card.outcome} />
                  <span style={{ font: mono(10.5), color: "var(--mute)" }}>{card.code}</span>
                </div>
                <Link href={`/methods/${card.id}`} style={{ font: mono(14, 500), color: "var(--ink)" }}>{card.title}</Link>
                <div style={{ font: mono(11), color: "var(--mute)", marginTop: 6 }}>
                  {[card.system, card.conditions].filter(Boolean).join(" · ") || "—"}
                </div>
                {card.fails_under && (
                  <div style={{ marginTop: 11, borderLeft: "3px solid var(--signal)", background: "var(--bg)", padding: "9px 12px" }}>
                    <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--signal)", marginBottom: 4 }}>FAILS UNDER</div>
                    <p style={{ font: "400 12px/1.6 var(--sans)", margin: 0 }}>{card.fails_under}</p>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <PanelHead>Room</PanelHead>
            <div style={{ padding: 14 }}>
              <Link href={`/home?room=${post.room_id}`} style={{ font: mono(13.5, 500), color: "var(--ink)" }}>#{post.room_id}</Link>
              <p style={{ font: "400 12px/1.55 var(--sans)", color: "var(--mute)", margin: "6px 0 10px" }}>{room?.blurb}</p>
              <div style={{ font: mono(9.5, 700), letterSpacing: ".09em", color: "var(--mute)", marginBottom: 6 }}>APPEARS IN</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {housesOfRoom(post.room_id).map((h) => <Tag key={h.id}>{h.name}</Tag>)}
              </div>
            </div>
          </Panel>
          {post.intent === "collab" && !isMine && (
            <Link href={`/messages/${post.author_id}`} style={{ ...btnPrimary, justifyContent: "center" }}>
              Offer to collaborate
            </Link>
          )}
        </aside>
      </div>
    </Page>
  );
}
