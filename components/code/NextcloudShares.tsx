import { timeAgo } from "@/lib/format";
import { fileSize } from "@/lib/social/group-files";
import { linkNextcloud, unlinkNextcloud, refreshNextcloud } from "@/app/actions/nextcloud";
import type { NcLink } from "@/lib/nextcloud";
import { Panel, PanelHead, Empty, field, mono } from "@/components/ui";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  linked: { text: "Nextcloud folder linked." },
  bad: { text: "Paste a Nextcloud share link, like https://cloud.example.org/s/AbC123xyz (Share → Share link → Copy).", error: true },
  host: { text: "This Nextcloud server is not on the list this site allows.", error: true },
  had: { text: "That folder is already linked here.", error: true },
  "needs-password": { text: "This share has a password. Enter it as well.", error: true },
  password: { text: "The share password is not right.", error: true },
  missing: { text: "That share was not found. It may have expired or been removed.", error: true },
  unreachable: { text: "Nextcloud could not be reached. Try again in a moment.", error: true },
};

const pill = { height: 28, padding: "0 12px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink)", font: "600 12px/1 var(--sans)", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" } as const;
const SHOWN = 12;

const Cloud = () => (
  <span aria-hidden="true" style={{ display: "inline-grid", placeItems: "center", width: 26, height: 26, borderRadius: 8, flex: "none", background: "#0082c9", color: "#fff" }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5.5" cy="12" r="2.6" /><circle cx="12" cy="12" r="4" /><circle cx="18.5" cy="12" r="2.6" /></svg>
  </span>
);

/**
 * Nextcloud folders linked to a group or a method card: what is in them,
 * with each file one click from download. The files stay on Nextcloud.
 */
export default function NextcloudShares({ scope, id, links, canEdit, canManage, me, flash }: {
  scope: "group" | "method"; id: string; links: NcLink[]; canEdit: boolean; canManage: boolean; me: string; flash?: string;
}) {
  const f = flash ? FLASH[flash] : null;
  if (!links.length && !canEdit) return null;
  return (
    <Panel>
      <div id="nextcloud" style={{ scrollMarginTop: 72 }}><PanelHead>Nextcloud · {links.length}</PanelHead></div>
      {f && <p role={f.error ? "alert" : "status"} style={{ margin: 0, padding: "9px 14px", borderBottom: "1px solid var(--rule)", font: "400 12.5px/1.6 var(--sans)", color: f.error ? "var(--err)" : "var(--ok)" }}>{f.text}</p>}
      {links.length === 0 && <Empty>{scope === "group" ? "Link a Nextcloud folder to keep the group's data, protocols and slides in one place." : "Link a Nextcloud folder with the raw data, protocols or analysis behind this card."}</Empty>}
      {links.map((l) => {
        const entries = l.cache?.entries ?? [];
        return (
          <div key={l.id} style={{ padding: "12px 14px", borderBottom: "1px solid var(--rule)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
              <Cloud />
              <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <a href={l.url} target="_blank" rel="noreferrer" style={{ font: "600 13.5px/1.5 var(--sans)", color: "var(--ink)", overflowWrap: "anywhere" }}>{l.label || l.host} ↗</a>
                <div style={{ font: "400 12px/1.6 var(--sans)", color: "var(--mute)", marginTop: 2 }}>
                  {[l.label ? l.host : null, l.cache ? `${l.cache.total} item${l.cache.total === 1 ? "" : "s"}` : null, l.has_password ? "password protected" : null, l.cached_at ? `read ${timeAgo(l.cached_at)}` : null].filter(Boolean).join(" · ")}
                  {l.error && <span style={{ color: "var(--err)" }}> · {l.error}{l.cache ? ", showing the last listing" : ""}</span>}
                </div>
              </div>
              {canEdit && <form action={refreshNextcloud.bind(null, scope, id, l.id)}><button type="submit" style={pill} title="Read the folder again now">Refresh</button></form>}
              {(l.added_by === me || canManage) && <form action={unlinkNextcloud.bind(null, scope, id, l.id)}><button type="submit" style={pill}>Remove</button></form>}
            </div>
            {entries.length > 0 && (
              <ul style={{ listStyle: "none", margin: "10px 0 0 36px", padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                {entries.slice(0, SHOWN).map((e) => <Entry key={e.name} e={e} />)}
              </ul>
            )}
            {entries.length > SHOWN && (
              <details className="sc-more-replies" style={{ margin: "2px 0 0 36px" }}>
                <summary style={{ listStyle: "none", cursor: "pointer", width: "fit-content", padding: "4px 0", font: "600 12.5px/1.5 var(--sans)", color: "var(--mute)" }}>
                  <span className="sc-when-closed">Show all {entries.length}</span><span className="sc-when-open">Show fewer</span>
                </summary>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  {entries.slice(SHOWN).map((e) => <Entry key={e.name} e={e} />)}
                </ul>
              </details>
            )}
          </div>
        );
      })}
      {canEdit && (
        <form action={linkNextcloud.bind(null, scope, id)} style={{ display: "flex", gap: 8, padding: 14, flexWrap: "wrap" }}>
          <label htmlFor={`nc-url-${scope}`} style={{ position: "absolute", left: -9999 }}>Nextcloud share link</label>
          <input id={`nc-url-${scope}`} name="url" type="url" required placeholder="https://cloud.your-institute.org/s/AbC123xyz" style={{ ...field, flex: "1 1 280px", width: "auto" }} />
          <label htmlFor={`nc-label-${scope}`} style={{ position: "absolute", left: -9999 }}>Name</label>
          <input id={`nc-label-${scope}`} name="label" maxLength={120} placeholder="Name (optional)" style={{ ...field, flex: "1 1 140px", width: "auto" }} />
          <label htmlFor={`nc-pw-${scope}`} style={{ position: "absolute", left: -9999 }}>Share password</label>
          <input id={`nc-pw-${scope}`} name="password" type="password" maxLength={200} autoComplete="off" placeholder="Share password, if any" style={{ ...field, flex: "1 1 140px", width: "auto" }} />
          <button type="submit" style={{ ...pill, height: 38, padding: "0 16px" }}>Link folder</button>
        </form>
      )}
    </Panel>
  );
}

function Entry({ e }: { e: { name: string; folder: boolean; size: number | null; modified: string | null; href: string } }) {
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "baseline", font: "400 12.5px/1.7 var(--sans)", minWidth: 0 }}>
      <span aria-hidden="true" style={{ font: mono(10, 700), color: e.folder ? "#0082c9" : "var(--mute)", width: 28, flex: "none" }}>{e.folder ? "DIR" : (e.name.split(".").pop() ?? "").slice(0, 4).toUpperCase()}</span>
      <a href={e.href} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }} title={e.folder ? "Open the folder in Nextcloud" : "Download"}>{e.name}{e.folder ? "/" : ""}</a>
      <span style={{ color: "var(--mute)", fontSize: 11.5, whiteSpace: "nowrap" }}>{[e.size != null ? fileSize(e.size) : null, e.modified ? timeAgo(e.modified) : null].filter(Boolean).join(" · ")}</span>
    </li>
  );
}
