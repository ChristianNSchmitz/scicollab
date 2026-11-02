import { timeAgo } from "@/lib/format";
import { linkRepo, unlinkRepo, refreshRepo } from "@/app/actions/repos";
import { isConfigured } from "@/lib/mode";
import type { RepoLink } from "@/lib/repos";
import { Panel, PanelHead, Empty, field, mono } from "@/components/ui";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  linked: { text: "Repository linked." },
  bad: { text: "Paste a link to a GitHub or GitLab repository, like https://github.com/owner/repo.", error: true },
  had: { text: "That repository is already linked here.", error: true },
  missing: { text: "That repository was not found, or it is private. Only public repositories can be shown.", error: true },
  unreachable: { text: "GitHub or GitLab could not be reached. Try again in a moment.", error: true },
};

const Mark = ({ provider }: { provider: "github" | "gitlab" }) => (
  <span aria-hidden="true" style={{ display: "inline-grid", placeItems: "center", width: 26, height: 26, borderRadius: 8, flex: "none",
    background: provider === "github" ? "var(--ink)" : "#e2432a", color: provider === "github" ? "var(--bg)" : "#fff", font: "800 11px/1 var(--sans)" }}>
    {provider === "github" ? "GH" : "GL"}
  </span>
);

const pill = { height: 28, padding: "0 12px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink)", font: "600 12px/1 var(--sans)", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" } as const;

/**
 * Repositories linked to a project or a group: what the repository is, its
 * latest commits, and a way to it. Members link one by pasting its URL.
 */
export default function Repositories({ scope, id, links, canEdit, canManage, me, flash }: {
  scope: "project" | "group"; id: string; links: RepoLink[]; canEdit: boolean; canManage: boolean; me: string; flash?: string;
}) {
  const f = flash ? FLASH[flash] : null;
  return (
    <Panel>
      <div id="repos" style={{ scrollMarginTop: 72 }}><PanelHead>Repositories · {links.length}</PanelHead></div>
      {f && <p role={f.error ? "alert" : "status"} style={{ margin: 0, padding: "9px 14px", borderBottom: "1px solid var(--rule)", font: "400 12.5px/1.6 var(--sans)", color: f.error ? "var(--err)" : "var(--ok)" }}>{f.text}</p>}
      {links.length === 0 && <Empty>No repository linked yet.</Empty>}
      {links.map((l) => {
        const c = l.cache;
        return (
          <div key={l.id} style={{ padding: "12px 14px", borderBottom: "1px solid var(--rule)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Mark provider={l.provider} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={c?.webUrl ?? l.url} target="_blank" rel="noreferrer" style={{ font: mono(13.5, 600, 1.5), color: "var(--ink)", overflowWrap: "anywhere" }}>{c?.name ?? l.path} ↗</a>
                {c?.description && <div style={{ font: "400 13px/1.6 var(--sans)", color: "var(--ink)", marginTop: 3 }}>{c.description}</div>}
                <div style={{ font: "400 12px/1.6 var(--sans)", color: "var(--mute)", marginTop: 3 }}>
                  {[l.provider === "github" ? "GitHub" : `GitLab${l.host !== "gitlab.com" ? ` (${l.host})` : ""}`, c?.language, c ? `${c.defaultBranch}` : null,
                    c && c.stars ? `★ ${c.stars}` : null, c?.updatedAt ? `updated ${timeAgo(c.updatedAt)}` : null].filter(Boolean).join(" · ")}
                  {l.error && <span style={{ color: "var(--err)" }}> · {l.error}, showing the last snapshot</span>}
                </div>
              </div>
              {canEdit && isConfigured() && <form action={refreshRepo.bind(null, scope, id, l.id)}><button type="submit" style={pill} title="Read the latest commits now">Refresh</button></form>}
              {(l.added_by === me || canManage) && <form action={unlinkRepo.bind(null, scope, id, l.id)}><button type="submit" style={pill}>Remove</button></form>}
            </div>
            {(c?.commits ?? []).length > 0 && (
              <ul style={{ listStyle: "none", margin: "10px 0 0 36px", padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {c!.commits.map((m) => (
                  <li key={m.sha} style={{ display: "flex", gap: 8, alignItems: "baseline", font: "400 12.5px/1.55 var(--sans)", minWidth: 0 }}>
                    <a href={m.url} target="_blank" rel="noreferrer" style={{ font: mono(11, 700), color: "var(--signal-ink)", flex: "none" }}>{m.sha.slice(0, 7)}</a>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.message}</span>
                    <span style={{ color: "var(--mute)", fontSize: 11.5, whiteSpace: "nowrap" }}>{m.author}{m.date ? ` · ${timeAgo(m.date)}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {canEdit && (
        <form action={linkRepo.bind(null, scope, id)} style={{ display: "flex", gap: 8, padding: 14, flexWrap: "wrap" }}>
          <label htmlFor={`repo-url-${scope}`} style={{ position: "absolute", left: -9999 }}>Repository link</label>
          <input id={`repo-url-${scope}`} name="url" type="url" required placeholder="https://github.com/owner/repo or https://gitlab.com/group/project" style={{ ...field, flex: "1 1 280px", width: "auto" }} />
          <button type="submit" style={{ ...pill, height: 38, padding: "0 16px" }}>Link repository</button>
        </form>
      )}
    </Panel>
  );
}
