// ─── Built-in Project Repository ─────────────────────────────────────────────
// Each project gets its own mini git-like repo stored in localStorage.
// Branch → file tree + commit history. Supports multi-branch, file CRUD,
// text/binary uploads, and commit messages.

import { getCurrentUserId, getProfile } from "./mock-db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RepoFileEncoding = "utf-8" | "base64";

export type RepoFile = {
  path: string;                  // full path from root, e.g. "src/utils/helper.py"
  name: string;                  // basename, e.g. "helper.py"
  type: "file" | "dir";
  content: string;               // text content or base64 string
  encoding: RepoFileEncoding;
  size: number;                  // byte count (approx for base64)
  last_commit_id: string;
  last_commit_message: string;
  last_commit_at: string;
  last_commit_author: string;
};

export type RepoCommit = {
  id: string;
  message: string;
  author: string;
  author_id: string;
  timestamp: string;
  branch: string;
  files_changed: { path: string; action: "added" | "modified" | "deleted" }[];
};

export type RepoBranch = {
  name: string;
  created_at: string;
  from_branch: string | null;
  head_commit_id: string | null;
};

export type ProjectRepo = {
  project_id: string;
  initialized: boolean;
  branches: RepoBranch[];
  files: Record<string, RepoFile[]>;     // branch → flat file list
  commits: Record<string, RepoCommit[]>; // branch → commits (newest first)
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

const repoKey = (projectId: string) => `scicollab_repo_${projectId}`;

function loadRepo(projectId: string): ProjectRepo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(repoKey(projectId));
    return raw ? (JSON.parse(raw) as ProjectRepo) : null;
  } catch {
    return null;
  }
}

function saveRepo(repo: ProjectRepo): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(repoKey(repo.project_id), JSON.stringify(repo));
}

function shortId(): string {
  return Math.random().toString(16).slice(2, 10);
}

function authorName(): string {
  const id = getCurrentUserId();
  const p = getProfile(id);
  return p?.full_name ?? "Researcher";
}

// ─── Init ─────────────────────────────────────────────────────────────────────

const DEFAULT_README = (projectName: string) =>
  `# ${projectName}\n\nWelcome to this project repository.\n\n## Getting Started\n\nUpload your files or create new ones using the repository interface.\n`;

export function initRepo(projectId: string, projectName: string): ProjectRepo {
  const existing = loadRepo(projectId);
  if (existing?.initialized) return existing;

  const now = new Date().toISOString();
  const commitId = shortId();
  const author = authorName();

  const readmeFile: RepoFile = {
    path: "README.md",
    name: "README.md",
    type: "file",
    content: DEFAULT_README(projectName),
    encoding: "utf-8",
    size: DEFAULT_README(projectName).length,
    last_commit_id: commitId,
    last_commit_message: "Initial commit",
    last_commit_at: now,
    last_commit_author: author,
  };

  const initialCommit: RepoCommit = {
    id: commitId,
    message: "Initial commit",
    author,
    author_id: getCurrentUserId(),
    timestamp: now,
    branch: "main",
    files_changed: [{ path: "README.md", action: "added" }],
  };

  const repo: ProjectRepo = {
    project_id: projectId,
    initialized: true,
    branches: [{ name: "main", created_at: now, from_branch: null, head_commit_id: commitId }],
    files: { main: [readmeFile] },
    commits: { main: [initialCommit] },
  };

  saveRepo(repo);
  return repo;
}

// ─── Branch operations ────────────────────────────────────────────────────────

export function getRepo(projectId: string): ProjectRepo | null {
  return loadRepo(projectId);
}

export function getBranches(projectId: string): RepoBranch[] {
  return loadRepo(projectId)?.branches ?? [];
}

export function createBranch(projectId: string, fromBranch: string, newName: string): RepoBranch | null {
  const repo = loadRepo(projectId);
  if (!repo) return null;
  if (repo.branches.find((b) => b.name === newName)) return null; // already exists

  const now = new Date().toISOString();
  const branch: RepoBranch = {
    name: newName,
    created_at: now,
    from_branch: fromBranch,
    head_commit_id: repo.branches.find((b) => b.name === fromBranch)?.head_commit_id ?? null,
  };

  repo.branches.push(branch);
  // Copy files from source branch
  repo.files[newName] = [...(repo.files[fromBranch] ?? [])];
  repo.commits[newName] = [...(repo.commits[fromBranch] ?? [])];

  saveRepo(repo);
  return branch;
}

// ─── File operations ──────────────────────────────────────────────────────────

export function getFiles(projectId: string, branch: string, dirPath: string = ""): RepoFile[] {
  const repo = loadRepo(projectId);
  if (!repo) return [];
  const all = repo.files[branch] ?? [];

  // Return direct children of dirPath
  return all.filter((f) => {
    const rel = dirPath ? f.path.slice(dirPath.length + 1) : f.path;
    if (!f.path.startsWith(dirPath ? dirPath + "/" : "")) {
      if (dirPath) return false;
    }
    // Only direct children: no "/" in relative path (for files), or exactly one segment (for dirs)
    const parts = rel.split("/");
    return parts.length === 1;
  }).map((f) => {
    // Synthesize dir entries for subdirectories at this level
    return f;
  });
}

/** Returns files + synthesized directory entries at a given path. */
export function listDirectory(projectId: string, branch: string, dirPath: string = ""): RepoFile[] {
  const repo = loadRepo(projectId);
  if (!repo) return [];
  const all = repo.files[branch] ?? [];

  const prefix = dirPath ? dirPath + "/" : "";
  const seen = new Set<string>();
  const result: RepoFile[] = [];

  for (const f of all) {
    if (!f.path.startsWith(prefix)) continue;
    const rel = f.path.slice(prefix.length);
    const parts = rel.split("/");

    if (parts.length === 1) {
      // Direct file child
      if (!seen.has(f.path)) {
        seen.add(f.path);
        result.push(f);
      }
    } else {
      // Subdirectory
      const dirName = parts[0];
      const dirFullPath = prefix + dirName;
      if (!seen.has(dirFullPath)) {
        seen.add(dirFullPath);
        // Find the newest file in this dir for metadata
        const dirFiles = all.filter((x) => x.path.startsWith(dirFullPath + "/"));
        const newest = dirFiles.sort((a, b) => b.last_commit_at.localeCompare(a.last_commit_at))[0];
        result.push({
          path: dirFullPath,
          name: dirName,
          type: "dir",
          content: "",
          encoding: "utf-8",
          size: 0,
          last_commit_id: newest?.last_commit_id ?? "",
          last_commit_message: newest?.last_commit_message ?? "",
          last_commit_at: newest?.last_commit_at ?? "",
          last_commit_author: newest?.last_commit_author ?? "",
        });
      }
    }
  }

  // Sort: dirs first, then files, alphabetically
  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function getFileContent(projectId: string, branch: string, filePath: string): RepoFile | null {
  const repo = loadRepo(projectId);
  if (!repo) return null;
  return (repo.files[branch] ?? []).find((f) => f.path === filePath) ?? null;
}

// ─── Commit (write) operations ────────────────────────────────────────────────

export type FileChange = {
  path: string;
  name: string;
  content: string;
  encoding: RepoFileEncoding;
  size: number;
};

export function commitFiles(
  projectId: string,
  branch: string,
  changes: FileChange[],
  deletions: string[],
  message: string
): RepoCommit | null {
  const repo = loadRepo(projectId);
  if (!repo) return null;

  const now = new Date().toISOString();
  const commitId = shortId();
  const author = authorName();
  const authorId = getCurrentUserId();

  const branchFiles = [...(repo.files[branch] ?? [])];
  const changedPaths: RepoCommit["files_changed"] = [];

  // Apply changes
  for (const change of changes) {
    const existing = branchFiles.find((f) => f.path === change.path);
    const meta: RepoFile = {
      path: change.path,
      name: change.name,
      type: "file",
      content: change.content,
      encoding: change.encoding,
      size: change.size,
      last_commit_id: commitId,
      last_commit_message: message,
      last_commit_at: now,
      last_commit_author: author,
    };
    if (existing) {
      Object.assign(existing, meta);
      changedPaths.push({ path: change.path, action: "modified" });
    } else {
      branchFiles.push(meta);
      changedPaths.push({ path: change.path, action: "added" });
    }
  }

  // Apply deletions
  for (const del of deletions) {
    const idx = branchFiles.findIndex((f) => f.path === del);
    if (idx !== -1) {
      branchFiles.splice(idx, 1);
      changedPaths.push({ path: del, action: "deleted" });
    }
  }

  repo.files[branch] = branchFiles;

  const commit: RepoCommit = {
    id: commitId,
    message,
    author,
    author_id: authorId,
    timestamp: now,
    branch,
    files_changed: changedPaths,
  };

  if (!repo.commits[branch]) repo.commits[branch] = [];
  repo.commits[branch].unshift(commit);

  // Update branch head
  const branchMeta = repo.branches.find((b) => b.name === branch);
  if (branchMeta) branchMeta.head_commit_id = commitId;

  saveRepo(repo);
  return commit;
}

export function deleteFile(
  projectId: string,
  branch: string,
  filePath: string,
  message: string
): boolean {
  const commit = commitFiles(projectId, branch, [], [filePath], message);
  return commit !== null;
}

/** Delete all files under a directory path */
export function deleteDirectory(
  projectId: string,
  branch: string,
  dirPath: string,
  message: string
): boolean {
  const repo = loadRepo(projectId);
  if (!repo) return false;
  const prefix = dirPath + "/";
  const toDelete = (repo.files[branch] ?? [])
    .filter((f) => f.path.startsWith(prefix))
    .map((f) => f.path);
  if (toDelete.length === 0) return false;
  return commitFiles(projectId, branch, [], toDelete, message) !== null;
}

export function getCommits(projectId: string, branch: string): RepoCommit[] {
  return loadRepo(projectId)?.commits[branch] ?? [];
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function fileIcon(name: string, type: "file" | "dir"): string {
  if (type === "dir") return "📁";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    md: "📝", txt: "📄", py: "🐍", js: "🟨", ts: "🔷", tsx: "⚛️", jsx: "⚛️",
    json: "📋", yaml: "📋", yml: "📋", toml: "📋", csv: "📊", ipynb: "📓",
    r: "📊", sh: "🔧", bash: "🔧", dockerfile: "🐳", gitignore: "🚫",
    pdf: "📕", png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️", svg: "🖼️",
    zip: "🗜️", tar: "🗜️", gz: "🗜️", mp4: "🎬", mp3: "🎵",
    html: "🌐", css: "🎨", scss: "🎨", sql: "🗄️", rs: "🦀", go: "🐹",
    java: "☕", cpp: "⚙️", c: "⚙️", h: "⚙️",
  };
  return map[ext] ?? "📄";
}

export function isTextFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const textExts = new Set([
    "md", "txt", "py", "js", "ts", "tsx", "jsx", "json", "yaml", "yml",
    "toml", "csv", "r", "sh", "bash", "html", "css", "scss", "sql", "rs",
    "go", "java", "cpp", "c", "h", "gitignore", "env", "ini", "cfg", "xml",
    "dockerfile", "makefile", "lock", "log",
  ]);
  return textExts.has(ext) || name === "Makefile" || name === "Dockerfile";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function timeAgoRepo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
