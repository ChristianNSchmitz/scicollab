"use client";

import { useState, useEffect, useCallback } from "react";
import { updateProject } from "@/lib/mock-db";

// ─── Types ────────────────────────────────────────────────────

type GLRepo = {
  id: number;
  name: string;
  description: string | null;
  star_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  web_url: string;
  visibility: string;
  last_activity_at: string;
};

type GLFile = {
  id: string;
  name: string;
  type: "blob" | "tree";
  path: string;
  mode: string;
};

type GLCommit = {
  id: string;
  short_id: string;
  title: string;
  author_name: string;
  authored_date: string;
  web_url: string;
};

// ─── Helpers ──────────────────────────────────────────────────

function parseGitLabPath(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\//, "").replace(/\.git$/, "");
    return path || null;
  } catch {
    return null;
  }
}

function fileIcon(name: string, type: "blob" | "tree"): string {
  if (type === "tree") return "📁";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "py") return "🐍";
  if (ext === "ipynb") return "📓";
  if (ext === "csv" || ext === "tsv") return "📊";
  if (ext === "md" || ext === "markdown") return "📋";
  if (ext === "yml" || ext === "yaml" || ext === "toml") return "⚙️";
  if (ext === "js" || ext === "ts" || ext === "jsx" || ext === "tsx") return "💻";
  if (ext === "r") return "🔬";
  return "📄";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-slate-800 mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-slate-900 mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-slate-900 mt-6 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-slate-100 rounded px-1 py-0.5 text-xs font-mono text-blue-700">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, "<br/>");
}

// Avatar color derived from author name
const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-red-500", "bg-indigo-500",
];
function avatarColor(name: string): string {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

// ─── Sub-components ───────────────────────────────────────────

function Shimmer() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-7 bg-slate-100 rounded-lg" style={{ width: `${60 + (i * 7) % 35}%` }} />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

interface GitLabPanelProps {
  projectId: string;
  gitlabUrl: string | null;
  isOwner: boolean;
  onUrlSaved: (url: string) => void;
}

export default function GitLabPanel({ projectId, gitlabUrl, isOwner, onUrlSaved }: GitLabPanelProps) {
  const [inputUrl, setInputUrl] = useState(gitlabUrl ?? "");

  // ── When no URL is set ──
  if (!gitlabUrl) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8">
        {isOwner ? (
          <div className="max-w-md mx-auto text-center">
            <div className="text-5xl mb-3">🦊</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Connect a GitLab Repository</h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Link a public GitLab repo to show the live file browser, README, and commit history.
            </p>
            <div className="flex gap-2">
              <input
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://gitlab.com/username/repository"
                type="url"
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-50 font-mono"
              />
              <button
                onClick={() => {
                  const trimmed = inputUrl.trim();
                  if (!trimmed) return;
                  updateProject(projectId, { gitlab_url: trimmed });
                  onUrlSaved(trimmed);
                }}
                disabled={!inputUrl.trim()}
                className="px-5 py-2.5 bg-orange-600 text-white text-sm font-semibold rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-colors">
                Connect
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🦊</div>
            <p className="text-slate-500 text-sm">No repository connected yet.</p>
          </div>
        )}
      </div>
    );
  }

  return <ConnectedPanel projectId={projectId} gitlabUrl={gitlabUrl} isOwner={isOwner} onUrlSaved={onUrlSaved} />;
}

// ─── Connected panel (URL is set) ─────────────────────────────

function ConnectedPanel({ projectId, gitlabUrl, isOwner, onUrlSaved }: GitLabPanelProps & { gitlabUrl: string }) {
  const [repo, setRepo] = useState<GLRepo | null>(null);
  const [files, setFiles] = useState<GLFile[]>([]);
  const [commits, setCommits] = useState<GLCommit[]>([]);
  const [readme, setReadme] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // File browser state
  const [currentPath, setCurrentPath] = useState<string>("");
  const [browseFiles, setBrowseFiles] = useState<GLFile[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  // File viewer state
  const [viewingFile, setViewingFile] = useState<{ path: string; content: string; tooLarge: boolean } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  // Right pane tab
  const [rightTab, setRightTab] = useState<"readme" | "commits">("readme");

  // Disconnect confirm
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const GL_API = "https://gitlab.com/api/v4";

  const glPath = parseGitLabPath(gitlabUrl);

  const fetchSubtree = useCallback(async (repoId: number, branch: string, path: string) => {
    setBrowseLoading(true);
    try {
      const url = `${GL_API}/projects/${repoId}/repository/tree?ref=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}&per_page=50`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("subtree fetch failed");
      const data: GLFile[] = await res.json();
      setBrowseFiles(data);
      setCurrentPath(path);
    } catch {
      // keep current files visible on error
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!glPath) { setError(true); setLoading(false); return; }

    async function load() {
      setLoading(true);
      setError(false);
      try {
        const encoded = encodeURIComponent(glPath!);
        const repoRes = await fetch(`${GL_API}/projects/${encoded}`);
        if (!repoRes.ok) throw new Error("repo not found");
        const repoData: GLRepo = await repoRes.json();
        setRepo(repoData);

        const branch = encodeURIComponent(repoData.default_branch);
        const [treeRes, commitsRes, readmeRes] = await Promise.all([
          fetch(`${GL_API}/projects/${repoData.id}/repository/tree?ref=${branch}&per_page=50`),
          fetch(`${GL_API}/projects/${repoData.id}/repository/commits?ref_name=${branch}&per_page=10`),
          fetch(`${GL_API}/projects/${repoData.id}/repository/files/README.md/raw?ref=${branch}`),
        ]);

        if (treeRes.ok) {
          const treeData: GLFile[] = await treeRes.json();
          setFiles(treeData);
          setBrowseFiles(treeData);
        }
        if (commitsRes.ok) {
          const commitsData: GLCommit[] = await commitsRes.json();
          setCommits(commitsData);
        }
        if (readmeRes.ok) {
          const text = await readmeRes.text();
          setReadme(text);
        } else {
          setReadme(null);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [glPath]);

  async function openFile(file: GLFile) {
    if (!repo) return;
    setFileLoading(true);
    setViewingFile(null);
    try {
      const encodedPath = encodeURIComponent(file.path);
      const branch = encodeURIComponent(repo.default_branch);
      const res = await fetch(`${GL_API}/projects/${repo.id}/repository/files/${encodedPath}/raw?ref=${branch}`);
      if (!res.ok) throw new Error("file not found");
      // Check content-length if available
      const length = parseInt(res.headers.get("content-length") ?? "0");
      if (length > 50000) {
        setViewingFile({ path: file.path, content: "", tooLarge: true });
        setFileLoading(false);
        return;
      }
      const text = await res.text();
      if (text.length > 50000) {
        setViewingFile({ path: file.path, content: "", tooLarge: true });
      } else {
        setViewingFile({ path: file.path, content: text, tooLarge: false });
      }
    } catch {
      setViewingFile({ path: file.path, content: "Could not load file content.", tooLarge: false });
    } finally {
      setFileLoading(false);
    }
  }

  // ── Error state ──
  if (!loading && error) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Repository not found or private</h2>
        <p className="text-sm text-slate-500 mb-5">This repository may be private or the URL may be incorrect.</p>
        {isOwner && (
          <button
            onClick={() => {
              updateProject(projectId, { gitlab_url: null });
              onUrlSaved("");
            }}
            className="text-sm text-orange-600 hover:underline">
            Change URL
          </button>
        )}
      </div>
    );
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 flex items-center gap-3">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span className="text-sm text-slate-500">Loading repository from GitLab…</span>
      </div>
    );
  }

  if (!repo) return null;

  const breadcrumbs = currentPath ? currentPath.split("/") : [];

  return (
    <div className="space-y-4">

      {/* ── A. Repo header bar ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl">🦊</span>
              <h2 className="font-bold text-slate-900 text-lg leading-tight">{repo.name}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${repo.visibility === "public" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                {repo.visibility === "public" ? "Public" : "Private"}
              </span>
            </div>
            {repo.description && (
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">{repo.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-600">
              <span title="Stars">⭐ {repo.star_count}</span>
              <span title="Forks">🔁 {repo.forks_count}</span>
              <span title="Open issues">🐛 {repo.open_issues_count}</span>
              <span className="text-xs bg-slate-100 text-slate-700 rounded-full px-2.5 py-0.5 border border-slate-200 font-mono">
                {repo.default_branch}
              </span>
              <span className="text-xs text-slate-400">Active {timeAgo(repo.last_activity_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <a
              href={repo.web_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl hover:bg-orange-100 hover:border-orange-400 transition-colors font-medium">
              Open on GitLab →
            </a>
            {isOwner && (
              <button
                onClick={() => {
                  if (confirmDisconnect) {
                    updateProject(projectId, { gitlab_url: null });
                    onUrlSaved("");
                  } else {
                    setConfirmDisconnect(true);
                    setTimeout(() => setConfirmDisconnect(false), 4000);
                  }
                }}
                className={`text-sm px-3 py-2 rounded-xl border transition-colors ${confirmDisconnect ? "bg-red-600 text-white border-red-600" : "border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-300"}`}>
                {confirmDisconnect ? "Confirm?" : "Disconnect"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── B. Two-column layout ── */}
      <div className="grid md:grid-cols-5 gap-4">

        {/* Left: File Browser (40%) */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">
              📁 Files
              <span className="ml-1.5 text-xs font-normal text-slate-400 font-mono">{repo.default_branch}</span>
            </h3>
          </div>

          {/* Breadcrumb */}
          {currentPath && (
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1 flex-wrap text-xs">
              <button
                onClick={() => { setBrowseFiles(files); setCurrentPath(""); setViewingFile(null); }}
                className="text-blue-600 hover:underline font-medium">
                root
              </button>
              {breadcrumbs.map((crumb, i) => {
                const pathUpTo = breadcrumbs.slice(0, i + 1).join("/");
                return (
                  <span key={pathUpTo} className="flex items-center gap-1">
                    <span className="text-slate-300">/</span>
                    {i < breadcrumbs.length - 1 ? (
                      <button
                        onClick={() => fetchSubtree(repo.id, repo.default_branch, pathUpTo)}
                        className="text-blue-600 hover:underline">
                        {crumb}
                      </button>
                    ) : (
                      <span className="text-slate-700 font-medium">{crumb}</span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {/* Back button */}
          {currentPath && (
            <div className="px-3 pt-2">
              <button
                onClick={() => {
                  const parts = currentPath.split("/");
                  if (parts.length === 1) {
                    setBrowseFiles(files);
                    setCurrentPath("");
                  } else {
                    const parent = parts.slice(0, -1).join("/");
                    fetchSubtree(repo.id, repo.default_branch, parent);
                  }
                  setViewingFile(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-1">
                ← Back
              </button>
            </div>
          )}

          <div className="divide-y divide-slate-50">
            {browseLoading ? (
              <div className="p-4"><Shimmer /></div>
            ) : browseFiles.length === 0 ? (
              <p className="text-xs text-slate-400 px-4 py-3">No files found.</p>
            ) : (
              // Directories first, then files
              [...browseFiles]
                .sort((a, b) => {
                  if (a.type === b.type) return a.name.localeCompare(b.name);
                  return a.type === "tree" ? -1 : 1;
                })
                .map((file) => (
                  <button
                    key={file.path}
                    onClick={() => {
                      if (file.type === "tree") {
                        fetchSubtree(repo.id, repo.default_branch, file.path);
                        setViewingFile(null);
                      } else {
                        openFile(file);
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors">
                    <span className="flex-shrink-0">{fileIcon(file.name, file.type)}</span>
                    <span className={`text-sm truncate ${file.type === "tree" ? "text-slate-800 font-medium" : "text-slate-700"}`}>
                      {file.name}
                    </span>
                  </button>
                ))
            )}
          </div>
        </div>

        {/* Right: README + Commits (60%) */}
        <div className="md:col-span-3 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
          {/* Mini-tabs */}
          <div className="flex border-b border-slate-100">
            {(["readme", "commits"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setRightTab(t)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${rightTab === t ? "border-orange-500 text-orange-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                {t === "readme" ? "📝 README" : "🕐 Commits"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* README */}
            {rightTab === "readme" && (
              <div className="p-5">
                {readme ? (
                  <div
                    className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: '<p class="mb-2">' + renderMarkdown(readme) + "</p>" }}
                  />
                ) : (
                  <div className="text-center py-10 text-slate-400">
                    <p className="text-2xl mb-2">📄</p>
                    <p className="text-sm">No README found</p>
                  </div>
                )}
              </div>
            )}

            {/* Commits */}
            {rightTab === "commits" && (
              <div className="divide-y divide-slate-50">
                {commits.length === 0 ? (
                  <p className="text-sm text-slate-400 p-5 text-center">No commits found.</p>
                ) : (
                  commits.map((commit) => (
                    <div key={commit.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50">
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${avatarColor(commit.author_name)}`}>
                        {commit.author_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
                          {commit.title.length > 72 ? commit.title.slice(0, 72) + "…" : commit.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-slate-500">{commit.author_name}</span>
                          <span className="text-xs text-slate-400">{timeAgo(commit.authored_date)}</span>
                          <a
                            href={`${repo.web_url}/-/commit/${commit.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-200 transition-colors">
                            {commit.short_id}
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── C. File content viewer ── */}
      {(viewingFile || fileLoading) && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800 font-mono truncate">
              {fileLoading ? "Loading file…" : viewingFile?.path}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {viewingFile && !viewingFile.tooLarge && (
                <a
                  href={`${repo.web_url}/-/blob/${encodeURIComponent(repo.default_branch)}/${viewingFile.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-600 hover:underline">
                  View on GitLab →
                </a>
              )}
              <button
                onClick={() => setViewingFile(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none">
                ×
              </button>
            </div>
          </div>
          <div className="p-4">
            {fileLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                Loading file content…
              </div>
            ) : viewingFile?.tooLarge ? (
              <div className="text-center py-6 text-slate-500">
                <p className="text-sm mb-2">File too large to preview (over 50 KB)</p>
                <a
                  href={`${repo.web_url}/-/blob/${encodeURIComponent(repo.default_branch)}/${viewingFile.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-orange-600 hover:underline">
                  View on GitLab →
                </a>
              </div>
            ) : viewingFile ? (
              <pre className="text-xs font-mono text-slate-700 overflow-x-auto whitespace-pre leading-relaxed max-h-96 overflow-y-auto">
                {viewingFile.content}
              </pre>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
