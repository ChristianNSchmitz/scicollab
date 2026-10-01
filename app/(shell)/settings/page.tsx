import { createClient } from "@/lib/supabase/server";
import { saveProfile } from "@/app/actions/profile";
import { Page, Panel, PanelHead, field, fieldLabel, btnPrimary } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Settings — board B2 screen 14. The per-field privacy matrix is designed
 *  there and is not wired; what is live is the profile itself. */
export default async function Settings() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();

  return (
    <Page title="Settings" lede="Your profile. Per-field visibility controls are designed on board B2 and are not connected yet.">
      <form action={saveProfile} style={{ maxWidth: 680 }}>
        <Panel>
          <PanelHead>Profile</PanelHead>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 13 }}>
            <div>
              <label style={fieldLabel} htmlFor="display_name">Display name</label>
              <input id="display_name" name="display_name" defaultValue={p?.display_name ?? ""} style={field} />
            </div>
            <div className="sc-pair" style={{ gap: 12 }}>
              <div>
                <label style={fieldLabel} htmlFor="institution">Institution</label>
                <input id="institution" name="institution" defaultValue={p?.institution ?? ""} style={field} />
              </div>
              <div>
                <label style={fieldLabel} htmlFor="role_title">Role</label>
                <input id="role_title" name="role_title" defaultValue={p?.role_title ?? ""} style={field} placeholder="Postdoctoral researcher" />
              </div>
            </div>
            <div className="sc-pair" style={{ gap: 12 }}>
              <div>
                <label style={fieldLabel} htmlFor="field">Field</label>
                <input id="field" name="field" defaultValue={p?.field ?? ""} style={field} placeholder="Cell biology" />
              </div>
              <div>
                <label style={fieldLabel} htmlFor="orcid">ORCID</label>
                <input id="orcid" name="orcid" defaultValue={p?.orcid ?? ""} style={field} placeholder="0000-0002-1825-0097" />
              </div>
            </div>
            <div>
              <label style={fieldLabel} htmlFor="techniques">Techniques — comma separated</label>
              <input id="techniques" name="techniques" defaultValue={(p?.techniques ?? []).join(", ")} style={field} placeholder="transfection, western blot, qPCR" />
            </div>
          </div>
        </Panel>
        <button type="submit" style={{ ...btnPrimary, marginTop: 12, height: 42 }}>Save profile</button>
      </form>
    </Page>
  );
}
