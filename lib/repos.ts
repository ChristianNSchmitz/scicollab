import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/mode";

/**
 * GitHub and GitLab repositories linked to a project or a group
 * (supabase/17-repositories.sql). The server reads public details and the
 * latest commits from the provider's API and caches them on the link.
 *
 * Only github.com and gitlab.com are contacted, plus self-hosted GitLab hosts
 * the operator lists in SCICOLLAB_GITLAB_HOSTS (comma separated): the server
 * never fetches an arbitrary URL a member typed in. GITHUB_TOKEN and
 * GITLAB_TOKEN, when set, raise the providers' rate limits; private
 * repositories are not read.
 */

import { parseRepoUrl, type Provider, type RepoRef } from "@/lib/repo-url";
export { parseRepoUrl, type Provider, type RepoRef };

export type RepoCommit = { sha: string; message: string; author: string; date: string; url: string };
export type RepoInfo = {
  name: string; description: string; stars: number; forks: number; language: string | null;
  defaultBranch: string; updatedAt: string | null; webUrl: string; commits: RepoCommit[];
};
export type RepoLink = RepoRef & { id: string; added_by: string; added_at: string; cache: RepoInfo | null; cached_at: string | null; error?: string };

const STALE_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 3000;

async function getJson(url: string, token?: string, header = "Authorization"): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "SciCollab", ...(token ? { [header]: header === "Authorization" ? `Bearer ${token}` : token } : {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store",
  });
  if (!res.ok) throw new Error(res.status === 404 ? "not found or private" : `the provider answered ${res.status}`);
  return res.json();
}

/** Read a repository's public details and latest five commits from its provider. */
export async function fetchRepo(ref: RepoRef): Promise<RepoInfo> {
  if (ref.provider === "github") {
    const base = `https://api.github.com/repos/${ref.path}`;
    const [r, commits] = await Promise.all([getJson(base, process.env.GITHUB_TOKEN), getJson(`${base}/commits?per_page=5`, process.env.GITHUB_TOKEN).catch(() => [])]);
    return {
      name: r.full_name ?? ref.path, description: r.description ?? "", stars: r.stargazers_count ?? 0, forks: r.forks_count ?? 0,
      language: r.language ?? null, defaultBranch: r.default_branch ?? "main", updatedAt: r.pushed_at ?? r.updated_at ?? null, webUrl: r.html_url ?? ref.url,
      commits: (Array.isArray(commits) ? commits : []).slice(0, 5).map((c: any) => ({
        sha: String(c.sha ?? "").slice(0, 40), message: String(c.commit?.message ?? "").split("\n")[0].slice(0, 200),
        author: c.commit?.author?.name ?? c.author?.login ?? "", date: c.commit?.author?.date ?? "", url: c.html_url ?? ref.url,
      })),
    };
  }
  const base = `https://${ref.host}/api/v4/projects/${encodeURIComponent(ref.path)}`;
  const token = ref.host === "gitlab.com" ? process.env.GITLAB_TOKEN : undefined;
  const [r, commits] = await Promise.all([getJson(base, token, "PRIVATE-TOKEN"), getJson(`${base}/repository/commits?per_page=5`, token, "PRIVATE-TOKEN").catch(() => [])]);
  return {
    name: r.path_with_namespace ?? ref.path, description: r.description ?? "", stars: r.star_count ?? 0, forks: r.forks_count ?? 0,
    language: null, defaultBranch: r.default_branch ?? "main", updatedAt: r.last_activity_at ?? null, webUrl: r.web_url ?? ref.url,
    commits: (Array.isArray(commits) ? commits : []).slice(0, 5).map((c: any) => ({
      sha: String(c.id ?? "").slice(0, 40), message: String(c.title ?? c.message ?? "").slice(0, 200),
      author: c.author_name ?? "", date: c.committed_date ?? c.created_at ?? "", url: c.web_url ?? ref.url,
    })),
  };
}

/** The repositories linked to a project or a group, refreshing stale caches (in parallel, briefly). */
export async function repoLinks(supabase: SupabaseClient<any, any, any>, scope: { projectId?: string; groupId?: string }): Promise<RepoLink[]> {
  let q = supabase.from("repo_links").select("*").order("added_at", { ascending: true });
  q = scope.projectId ? q.eq("project_id", scope.projectId) : q.eq("group_id", scope.groupId ?? "");
  const { data } = await q;
  const links = (data ?? []) as RepoLink[];
  // The demo has no network access to rely on: it shows the seeded snapshot.
  if (!isConfigured()) return links;
  return Promise.all(links.map(async (l) => {
    if (l.cached_at && Date.now() - +new Date(l.cached_at) < STALE_MS) return l;
    try {
      const cache = await fetchRepo(l);
      const cached_at = new Date().toISOString();
      await supabase.from("repo_links").update({ cache, cached_at }).eq("id", l.id);
      return { ...l, cache, cached_at };
    } catch (e) {
      return { ...l, error: e instanceof Error ? e.message : "could not be reached" };
    }
  }));
}
