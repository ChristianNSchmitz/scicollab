import { createClient } from "@/lib/supabase/server";
import { saveProfile } from "@/app/actions/profile";
import { Page, Panel, PanelHead, field, fieldLabel, btnPrimary, mono } from "@/components/ui";
import AvatarPicker from "@/components/settings/AvatarPicker";
import OrcidLinker, { type LinkedSummary } from "@/components/settings/OrcidLinker";
import { bibliometricsFor } from "@/lib/record/bibliometrics";
import { readAuthor } from "@/lib/openalex/store";
import { normaliseOrcid } from "@/lib/orcid";

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  "saved=profile":   { text: "Profile saved." },
  "error=name":      { text: "A display name is needed. It is how people find and credit you.", error: true },
  "orcid=linked":    { text: "ORCID linked. The first sync has started; publications appear on your profile shortly." },
  "orcid=unlinked":  { text: "ORCID unlinked. Synced publications were removed from SciCollab." },
  "orcid=invalid":   { text: "That is not a valid ORCID iD.", error: true },
};

/** Settings — board B2 screen 14. Picture, profile and the ORCID link are
 *  live; the per-field privacy matrix is designed there and not wired yet. */
export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();

  const orcid = normaliseOrcid(p?.orcid);
  let linked: LinkedSummary | null = null;
  if (orcid) {
    const [b, a] = await Promise.all([bibliometricsFor(user!.id, orcid), readAuthor(user!.id)]);
    linked = {
      orcid,
      state: b.state,
      name: a?.display_name ?? (b.state === "ok" && b.example ? "Josiah Carberry (example)" : null),
      works: b.state === "ok" ? b.works : null,
      citations: b.state === "ok" ? b.citations : null,
      hIndex: b.state === "ok" ? b.hIndex : null,
      syncedAt: b.state === "ok" ? b.updated : null,
    };
  }

  const flashKey = Object.keys(FLASH).find((k) => { const [key, v] = k.split("="); return sp[key] === v; });
  const flash = flashKey ? FLASH[flashKey] : null;
  const nav = [["#picture", "Picture"], ["#profile", "Profile"], ["#orcid", "ORCID & publications"], ["#account", "Account"]];

  return (
    <Page title="Settings" lede="Your picture, profile and ORCID link. Per-field visibility controls are designed on board B2 and are not connected yet.">
      <div style={{ maxWidth: 720 }}>
        <nav aria-label="Settings sections" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {nav.map(([href, label]) => (
            <a key={href} href={href} style={{ font: mono(11, 500), padding: "5px 10px", border: "1px solid var(--rule)", color: "var(--ink)" }}>{label}</a>
          ))}
        </nav>

        {flash && (
          <p role={flash.error ? "alert" : "status"} style={{
            font: "400 12.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px",
            border: `1px solid ${flash.error ? "var(--err)" : "var(--ok)"}`, color: flash.error ? "var(--err)" : "var(--ink)", background: "var(--surface)",
          }}>{flash.text}</p>
        )}

        <section id="picture" style={{ scrollMarginTop: 72, marginBottom: 14 }}>
          <Panel>
            <PanelHead>Picture</PanelHead>
            <div style={{ padding: 14 }}>
              <AvatarPicker name={p?.display_name ?? ""} current={p?.avatar_url ?? null} />
            </div>
          </Panel>
        </section>

        <section id="profile" style={{ scrollMarginTop: 72, marginBottom: 14 }}>
          <form action={saveProfile}>
            <Panel>
              <PanelHead>Profile</PanelHead>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 13 }}>
                <div>
                  <label style={fieldLabel} htmlFor="display_name">Display name</label>
                  <input id="display_name" name="display_name" required maxLength={120} defaultValue={p?.display_name ?? ""} style={field} />
                </div>
                <div className="sc-pair" style={{ gap: 12 }}>
                  <div>
                    <label style={fieldLabel} htmlFor="institution">Institution</label>
                    <input id="institution" name="institution" maxLength={200} defaultValue={p?.institution ?? ""} style={field} />
                  </div>
                  <div>
                    <label style={fieldLabel} htmlFor="role_title">Role</label>
                    <input id="role_title" name="role_title" maxLength={120} defaultValue={p?.role_title ?? ""} style={field} placeholder="Postdoctoral researcher" />
                  </div>
                </div>
                <div>
                  <label style={fieldLabel} htmlFor="field">Field</label>
                  <input id="field" name="field" maxLength={120} defaultValue={p?.field ?? ""} style={field} placeholder="Cell biology" />
                </div>
                <div>
                  <label style={fieldLabel} htmlFor="techniques">Techniques — comma separated</label>
                  <input id="techniques" name="techniques" defaultValue={(p?.techniques ?? []).join(", ")} style={field} placeholder="transfection, western blot, qPCR" />
                </div>
                <div><button type="submit" style={{ ...btnPrimary, height: 38 }}>Save profile</button></div>
              </div>
            </Panel>
          </form>
        </section>

        <section id="orcid" style={{ scrollMarginTop: 72, marginBottom: 14 }}>
          <Panel>
            <PanelHead>ORCID &amp; publications</PanelHead>
            <div style={{ padding: 14 }}>
              <OrcidLinker linked={linked} defaultName={p?.display_name ?? ""} />
            </div>
          </Panel>
        </section>

        <section id="account" style={{ scrollMarginTop: 72 }}>
          <Panel>
            <PanelHead>Account</PanelHead>
            <div style={{ padding: 14, font: "400 12.5px/1.7 var(--sans)" }}>
              <div><span style={{ font: mono(10, 700), letterSpacing: ".08em", color: "var(--mute)", marginRight: 8 }}>EMAIL</span>{user!.email ?? "—"}</div>
              <div style={{ color: "var(--mute)", marginTop: 6 }}>
                Changing your email or deleting the account is not available here yet.
              </div>
            </div>
          </Panel>
        </section>
      </div>
    </Page>
  );
}
