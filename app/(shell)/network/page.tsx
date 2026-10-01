import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, Empty, Tag, btn, mono } from "@/components/ui";
import { initialsOf } from "@/lib/format";
import { nameGuide, unnameGuide } from "@/app/actions/record";
import { ensureRecordTables } from "@/lib/record/demo-seed";

export const dynamic = "force-dynamic";

/** Network — board G1. Reachability is a designed property, so every row
 *  offers the action that is actually open to you. */
export default async function Network() {
  ensureRecordTables();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: people } = await supabase
    .from("profiles")
    .select("id, display_name, institution, role_title, field, techniques")
    .neq("id", user!.id)
    .order("display_name");
  // Mentoring credit is given by the person who was helped, so you name your guides here.
  const { data: guides } = await supabase.from("mentorships").select("mentor_id").eq("mentee_id", user!.id);
  const isGuide = new Set((guides ?? []).map((g) => g.mentor_id));

  return (
    <Page title="Network" lede="Everyone on this instance. Follow and connect are designed on board G1 as a dual model; messaging is live.">
      <Panel>
        {(people?.length ?? 0) === 0 ? (
          <Empty>Nobody else has an account yet.</Empty>
        ) : people!.map((p) => (
          <div key={p.id} style={{ padding: "13px 14px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 34, height: 34, border: "1px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", font: mono(11, 500), background: "var(--bg)", flex: "none" }}>
              {initialsOf(p.display_name)}
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
            {isGuide.has(p.id) ? (
              <form action={unnameGuide.bind(null, p.id)}>
                <button type="submit" style={{ ...btn, borderColor: "var(--ok)", color: "var(--ok)" }} title="Remove the credit you gave">Your guide ✓</button>
              </form>
            ) : (
              <form action={nameGuide.bind(null, p.id)}>
                <button type="submit" style={btn} title="Credit this person for helping you. Only the two of you see it.">Name as guide</button>
              </form>
            )}
            <Link href={`/messages/${p.id}`} style={btn}>Message</Link>
          </div>
        ))}
      </Panel>
    </Page>
  );
}
