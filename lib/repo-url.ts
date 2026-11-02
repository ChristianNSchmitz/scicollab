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

