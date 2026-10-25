import { createClient } from "@/lib/supabase/server";
import { saveProfile } from "@/app/actions/profile";
import { Page, Panel, PanelHead, field, fieldLabel, btn, btnPrimary, mono } from "@/components/ui";
import { deleteAccount } from "@/app/actions/account";
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
  "error=confirm":   { text: "Type DELETE to confirm deleting your account.", error: true },
  "error=demo":      { text: "Seeded demo accounts cannot be deleted — other people use them. Create your own demo account to try it.", error: true },
  "error=nokey":     { text: "Account deletion needs SUPABASE_SERVICE_ROLE_KEY on the server.", error: true },
  "error=delete":    { text: "The account could not be deleted. Please try again, or contact the team.", error: true },
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
            font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px",
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
            <div style={{ padding: 14, font: "400 13.5px/1.7 var(--sans)" }}>
              <div><span style={{ font: mono(10, 700), letterSpacing: ".08em", color: "var(--mute)", marginRight: 8 }}>EMAIL</span>{user!.email ?? "—"}</div>
              <div style={{ color: "var(--mute)", marginTop: 6 }}>Changing your email is not available here yet.</div>

              <div style={{ borderTop: "1px solid var(--rule)", margin: "14px -14px 0", padding: "14px 14px 0" }}>
                <div style={{ font: mono(10, 700), letterSpacing: ".08em", color: "var(--mute)", marginBottom: 6 }}>YOUR DATA</div>
                <p style={{ margin: "0 0 10px", color: "var(--mute)" }}>
                  Everything you wrote or that is about you: profile, cards, questions, answers, posts, messages, projects, datasets and synced publications.
                </p>
                <a href="/settings/export" download style={btn}>Download your data (JSON)</a>
              </div>

              <details style={{ borderTop: "1px solid var(--rule)", margin: "14px -14px 0", padding: "14px 14px 0" }}>
                <summary style={{ font: mono(11.5), color: "var(--err)", cursor: "pointer" }}>Delete your account</summary>
                <form action={deleteAccount} style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ margin: 0 }}>
                    This removes your account and everything that belongs to it, permanently: your profile and picture, method cards,
                    questions, answers, posts, messages, the projects you own and your synced publications. It cannot be undone.
                    Download your data first if you want a copy.
                  </p>
                  <div>
                    <label style={fieldLabel} htmlFor="confirm">Type DELETE to confirm</label>
                    <input id="confirm" name="confirm" required autoComplete="off" style={{ ...field, maxWidth: 240 }} />
                  </div>
                  <div><button type="submit" style={{ ...btn, borderColor: "var(--err)", color: "var(--err)" }}>Delete my account</button></div>
                </form>
              </details>
            </div>
          </Panel>
        </section>
      </div>
    </Page>
  );
}
