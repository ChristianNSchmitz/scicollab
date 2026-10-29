import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createGroup } from "@/app/actions/groups";
import { Page, Panel, PanelHead, Empty, Tag, field, fieldLabel, btnPrimary, mono } from "@/components/ui";

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  "error=name": { text: "A group needs a name of at least two characters.", error: true },
  "deleted=1":  { text: "The group was deleted." },
};

/** Groups: labs, consortia, journal clubs. Yours first, then the rest. */
export default async function Groups({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from("groups").select("id, name, description, institution, access, created_at").order("name"),
    supabase.from("group_members").select("group_id, user_id, role"),
  ]);
  const count = (id: string) => (members ?? []).filter((m: any) => m.group_id === id).length;
  const mine = new Map((members ?? []).filter((m: any) => m.user_id === user!.id).map((m: any) => [m.group_id, m.role as string]));
  const yours = (groups ?? []).filter((g: any) => mine.has(g.id));
  const others = (groups ?? []).filter((g: any) => !mine.has(g.id));
  const flashKey = Object.keys(FLASH).find((k) => { const [key, v] = k.split("="); return sp[key] === v; });
  const flash = flashKey ? FLASH[flashKey] : null;

  const row = (g: any) => (
    <Link key={g.id} href={`/groups/${g.id}`} style={{ display: "block", padding: "12px 14px", borderBottom: "1px solid var(--rule)", textDecoration: "none", color: "var(--ink)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ font: mono(13.5, 600) }}>{g.name}</span>
        <Tag>{g.access === "open" ? "open" : "closed"}</Tag>
        {mine.get(g.id) === "owner" && <Tag>owner</Tag>}
        <span style={{ marginLeft: "auto", font: mono(10.5), color: "var(--mute)" }}>{count(g.id)} member{count(g.id) === 1 ? "" : "s"}</span>
      </div>
      {(g.institution || g.description) && (
        <div style={{ font: "400 13px/1.55 var(--sans)", color: "var(--mute)", marginTop: 4 }}>
          {[g.institution, g.description].filter(Boolean).join(" · ").slice(0, 220)}
        </div>
      )}
    </Link>
  );

  return (
    <Page title="Groups" lede="Labs, consortia and journal clubs: the people you actually work with, their members and shared projects in one place. Rooms are for topics; groups are for people.">
      {flash && (
        <p role={flash.error ? "alert" : "status"} style={{ font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: `1px solid ${flash.error ? "var(--err)" : "var(--ok)"}`, background: "var(--surface)" }}>{flash.text}</p>
      )}
      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <PanelHead>Your groups · {yours.length}</PanelHead>
            {yours.length ? yours.map(row) : <Empty>You are not in a group yet. Join an open one below, or start one for your lab.</Empty>}
          </Panel>
          <Panel>
            <PanelHead>Other groups · {others.length}</PanelHead>
            {others.length ? others.map(row) : <Empty>No other groups yet.</Empty>}
          </Panel>
        </div>
        <aside>
          <form id="new" action={createGroup} style={{ scrollMarginTop: 72 }}>
            <Panel>
              <PanelHead>Start a group</PanelHead>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={fieldLabel} htmlFor="g-name">Name</label>
                  <input id="g-name" name="name" required minLength={2} maxLength={120} style={field} placeholder="Okafor lab, Dublin" />
                </div>
                <div>
                  <label style={fieldLabel} htmlFor="g-inst">Institution (optional)</label>
                  <input id="g-inst" name="institution" maxLength={200} style={field} />
                </div>
                <div>
                  <label style={fieldLabel} htmlFor="g-desc">What the group is for</label>
                  <textarea id="g-desc" name="description" rows={3} maxLength={1000} style={field} placeholder="Who is in it, what you work on together." />
                </div>
                <fieldset style={{ border: 0, padding: 0, margin: 0, font: "400 13px/1.6 var(--sans)" }}>
                  <legend style={fieldLabel}>Who can join</legend>
                  <label style={{ display: "flex", gap: 8 }}><input type="radio" name="access" value="closed" defaultChecked /> Closed: owners add members (a lab)</label>
                  <label style={{ display: "flex", gap: 8 }}><input type="radio" name="access" value="open" /> Open: anyone can join (a journal club)</label>
                </fieldset>
                <div><button type="submit" style={btnPrimary}>Create group</button></div>
              </div>
            </Panel>
          </form>
        </aside>
      </div>
    </Page>
  );
}
