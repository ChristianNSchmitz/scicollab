/**
 * Which repository a link points at, and whether SciCollab may read it: only
 * github.com, gitlab.com and the self-hosted GitLab hosts listed in
 * SCICOLLAB_GITLAB_HOSTS. Kept free of imports so it can be tested alone.
 */

export type Provider = "github" | "gitlab";
export type RepoRef = { provider: Provider; host: string; path: string; url: string };
function gitlabHosts(): string[] {
  return ["gitlab.com", ...(process.env.SCICOLLAB_GITLAB_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean)];
}

/** "https://github.com/owner/repo(.git)(/tree/…)" → a reference, or null for anything else. */
export function parseRepoUrl(raw: string): RepoRef | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
  if (host === "github.com" || host === "www.github.com") {
    if (parts.length < 2) return null;
    const path = `${parts[0]}/${parts[1]}`;
    if (!/^[\w.-]+\/[\w.-]+$/.test(path)) return null;
    return { provider: "github", host: "github.com", path, url: `https://github.com/${path}` };
  }
  if (gitlabHosts().includes(host)) {
    // GitLab paths can be nested (group/subgroup/project); "/-/" starts the file views.
    const cut = parts.indexOf("-");
    const segs = (cut >= 0 ? parts.slice(0, cut) : parts);
    if (segs.length < 2 || segs.some((s) => !/^[\w.-]+$/.test(s))) return null;
    const path = segs.join("/");
    return { provider: "gitlab", host, path, url: `https://${host}/${path}` };
  }
  return null;
}


/**
 * A stored link is only as trustworthy as its row: any member of the project
 * can edit host and path through the database API. So the check made when the
 * link was added is made again before the server fetches anything.
 */
export function checkedLink(l: { provider: string; host: string; path: string; url: string }): RepoRef | null {
  const ref = parseRepoUrl(l.url);
  return ref && ref.provider === l.provider && ref.host === l.host && ref.path === l.path ? ref : null;
}

/** A cached address is shown only when it stays on the link's own host. */
export function onHost(address: unknown, host: string, fallback: string): string {
  try {
    const u = new URL(String(address));
    const same = u.hostname === host || (host === "github.com" && u.hostname === "www.github.com");
    if (u.protocol === "https:" && same) return u.toString();
  } catch { /* not an address */ }
  return fallback;
}
