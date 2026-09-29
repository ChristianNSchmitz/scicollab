import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, Empty, Tag, btn, mono } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Network — board G1. Reachability is a designed property, so every row
 *  offers the action that is actually open to you. */
export default async function Network() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: people } = await supabase
    .from("profiles")
    .select("id, display_name, institution, role_title, field, techniques")
    .neq("id", user!.id)
    .order("display_name");

  return (
    <Page title="Network" lede="Everyone on this instance. Follow and connect are designed on board G1 as a dual model; messaging is live.">
      <Panel>
        {(people?.length ?? 0) === 0 ? (
          <Empty>Nobody else has an account yet.</Empty>
        ) : people!.map((p) => (
          <div key={p.id} style={{ padding: "13px 14px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 34, height: 34, border: "1px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", font: mono(11, 500), background: "var(--bg)", flex: "none" }}>
              {(p.display_name || "?").slice(0, 2).toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: mono(13, 500) }}>{p.display_name || "Researcher"}</div>
              <div style={{ font: mono(11), color: "var(--mute)", marginTop: 3 }}>
                {[p.role_title, p.institution, p.field].filter(Boolean).join(" · ") || "—"}
              </div>
              {p.techniques?.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
                  {p.techniques.slice(0, 4).map((t: string) => <Tag key={t}>{t}</Tag>)}
                </div>
              )}
            </div>
            <Link href={`/messages/${p.id}`} style={btn}>Message</Link>
          </div>
        ))}
      </Panel>
    </Page>
  );
}
