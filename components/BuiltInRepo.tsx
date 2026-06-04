"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  initRepo, getRepo, listDirectory, getFileContent, getCommits, getBranches,
  createBranch, commitFiles, deleteFile, deleteDirectory,
  fileIcon, isTextFile, formatBytes, timeAgoRepo,
  type RepoFile, type RepoCommit, type RepoBranch, type FileChange,
} from "@/lib/repo-db";
import { useToast } from "@/lib/toast";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  projectId: string;
  projectName: string;
  isOwner: boolean;
};

type Tab = "files" | "commits" | "branches";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function syntaxHighlight(content: string, filename: string): string {
  // Very lightweight: just escape HTML — a real app would use highlight.js
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function languageLabel(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const m: Record<string, string> = {
    py: "Python", js: "JavaScript", ts: "TypeScript", tsx: "TSX", jsx: "JSX",
    json: "JSON", yaml: "YAML", yml: "YAML", md: "Markdown", sh: "Shell",
    r: "R", sql: "SQL", rs: "Rust", go: "Go", java: "Java", cpp: "C++",
    c: "C", h: "C Header", html: "HTML", css: "CSS", scss: "SCSS",
    toml: "TOML", csv: "CSV",
  };
  return m[ext] ?? (ext.toUpperCase() || "Text");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BranchSelector({
  branches, current, onChange, canCreate,
}: {
  branches: RepoBranch[];
  current: string;
  onChange: (name: string) => void;
  canCreate: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-300 transition-colors"
      >
        <span>🌿</span>
        <span className="max-w-[120px] truncate">{current}</span>
        <span className="text-slate-400 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden animate-slide-in">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Branches</p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {branches.map((b) => (
              <button
                key={b.name}
                onClick={() => { onChange(b.name); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${b.name === current ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}
              >
                <span>🌿</span> {b.name}
                {b.name === current && <span className="ml-auto text-xs text-blue-400">current</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100">
            <button
              onClick={() => { canCreate(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium"
            >
              + New branch
            </button>
          </div>
        </div>
      )}
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}
    </div>
  );
}

function CommitBadge({ message }: { message: string }) {
  return (
    <span className="text-xs text-slate-500 truncate max-w-[200px]" title={message}>
      {message}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BuiltInRepo({ projectId, projectName, isOwner }: Props) {
  const { toast } = useToast();

  // Repo state
  const [initialized, setInitialized] = useState(false);
  const [branch, setBranch] = useState("main");
  const [branches, setBranches] = useState<RepoBranch[]>([]);
  const [dirPath, setDirPath] = useState(""); // current directory, "" = root
  const [entries, setEntries] = useState<RepoFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<RepoFile | null>(null);
  const [commits, setCommits] = useState<RepoCommit[]>([]);
  const [tab, setTab] = useState<Tab>("files");

  // UI state
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [showNewDir, setShowNewDir] = useState(false);
  const [showEditFile, setShowEditFile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [newFileName, setNewFileName]         = useState("");
  const [newFileContent, setNewFileContent]   = useState("");
  const [commitMsg, setCommitMsg]             = useState("");
  const [newBranchName, setNewBranchName]     = useState("");
  const [newDirName, setNewDirName]           = useState("");
  const [editContent, setEditContent]         = useState("");
  const [editCommitMsg, setEditCommitMsg]     = useState("");
  const [uploading, setUploading]             = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Init / load ─────────────────────────────────────────────────────────────

  const refresh = useCallback(() => {
    const repo = getRepo(projectId);
    if (!repo?.initialized) return;
    setBranches(getBranches(projectId));
    setEntries(listDirectory(projectId, branch, dirPath));
    setCommits(getCommits(projectId, branch));
    setSelectedFile((prev) => prev ? getFileContent(projectId, branch, prev.path) : null);
  }, [projectId, branch, dirPath]);

  useEffect(() => {
    const repo = getRepo(projectId);
    if (repo?.initialized) {
      setInitialized(true);
      setBranches(getBranches(projectId));
      setEntries(listDirectory(projectId, branch, dirPath));
      setCommits(getCommits(projectId, branch));
    }
  }, [projectId, branch, dirPath]);

  function handleInit() {
    initRepo(projectId, projectName);
    setInitialized(true);
    refresh();
    toast("Repository initialized");
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  function enterDir(entry: RepoFile) {
    setDirPath(entry.path);
    setSelectedFile(null);
  }

  function breadcrumbs(): { label: string; path: string }[] {
    const crumbs = [{ label: projectName, path: "" }];
    if (!dirPath) return crumbs;
    const parts = dirPath.split("/");
    let acc = "";
    for (const part of parts) {
      acc = acc ? acc + "/" + part : part;
      crumbs.push({ label: part, path: acc });
    }
    return crumbs;
  }

  function handleBranchChange(name: string) {
    setBranch(name);
    setDirPath("");
    setSelectedFile(null);
  }

  // ── Upload files ─────────────────────────────────────────────────────────────

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);

    const readers = files.map(
      (file) =>
        new Promise<FileChange>((resolve) => {
          const reader = new FileReader();
          const isText = isTextFile(file.name);
          reader.onload = (ev) => {
            const raw = ev.target?.result;
            const content = isText ? (raw as string) : (raw as string).split(",")[1];
            const filePath = dirPath ? `${dirPath}/${file.name}` : file.name;
            resolve({
              path: filePath,
              name: file.name,
              content,
              encoding: isText ? "utf-8" : "base64",
              size: file.size,
            });
          };
          if (isText) reader.readAsText(file);
          else reader.readAsDataURL(file);
        })
    );

    Promise.all(readers).then((changes) => {
      const msg = commitMsg.trim() || `Upload ${changes.map((c) => c.name).join(", ")}`;
      const result = commitFiles(projectId, branch, changes, [], msg);
      setUploading(false);
      setShowUpload(false);
      setCommitMsg("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (result) {
        refresh();
        toast(`${changes.length} file${changes.length > 1 ? "s" : ""} uploaded`);
      } else {
        toast("Upload failed", "error");
      }
    });
  }

  // ── New file ─────────────────────────────────────────────────────────────────

  function handleCreateFile() {
    if (!newFileName.trim()) return;
    const filePath = dirPath ? `${dirPath}/${newFileName.trim()}` : newFileName.trim();
    const content = newFileContent;
    const msg = commitMsg.trim() || `Add ${newFileName.trim()}`;
    const result = commitFiles(
      projectId, branch,
      [{ path: filePath, name: newFileName.trim(), content, encoding: "utf-8", size: content.length }],
      [], msg
    );
    if (result) {
      refresh();
      toast("File created");
      setShowNewFile(false);
      setNewFileName("");
      setNewFileContent("");
      setCommitMsg("");
    }
  }

  // ── New directory ─────────────────────────────────────────────────────────────

  function handleCreateDir() {
    if (!newDirName.trim()) return;
    const gitkeepPath = dirPath
      ? `${dirPath}/${newDirName.trim()}/.gitkeep`
      : `${newDirName.trim()}/.gitkeep`;
    const msg = commitMsg.trim() || `Create directory ${newDirName.trim()}`;
    const result = commitFiles(
      projectId, branch,
      [{ path: gitkeepPath, name: ".gitkeep", content: "", encoding: "utf-8", size: 0 }],
      [], msg
    );
    if (result) {
      refresh();
      toast("Directory created");
      setShowNewDir(false);
      setNewDirName("");
      setCommitMsg("");
    }
  }

  // ── New branch ───────────────────────────────────────────────────────────────

  function handleCreateBranch() {
    if (!newBranchName.trim()) return;
    const result = createBranch(projectId, branch, newBranchName.trim());
    if (result) {
      setBranches(getBranches(projectId));
      toast(`Branch "${newBranchName.trim()}" created`);
      setBranch(newBranchName.trim());
      setShowNewBranch(false);
      setNewBranchName("");
    } else {
      toast("Branch already exists", "error");
    }
  }

  // ── Edit file ────────────────────────────────────────────────────────────────

  function openEdit() {
    if (!selectedFile) return;
    setEditContent(selectedFile.content);
    setEditCommitMsg("");
    setShowEditFile(true);
  }

  function handleSaveEdit() {
    if (!selectedFile) return;
    const msg = editCommitMsg.trim() || `Update ${selectedFile.name}`;
    const result = commitFiles(
      projectId, branch,
      [{ path: selectedFile.path, name: selectedFile.name, content: editContent, encoding: "utf-8", size: editContent.length }],
      [], msg
    );
    if (result) {
      refresh();
      toast("File saved");
      setShowEditFile(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  function handleDelete() {
    if (!selectedFile) return;
    const msg = `Delete ${selectedFile.name}`;
    const ok = selectedFile.type === "dir"
      ? deleteDirectory(projectId, branch, selectedFile.path, msg)
      : deleteFile(projectId, branch, selectedFile.path, msg);
    if (ok) {
      refresh();
      setSelectedFile(null);
      toast("Deleted");
      setShowDeleteConfirm(false);
    }
  }

  // ── Copy path ────────────────────────────────────────────────────────────────

  function copyPath(path: string) {
    navigator.clipboard.writeText(path);
    toast("Path copied");
  }

  // ─── Render: not initialized ─────────────────────────────────────────────────

  if (!initialized) {
    return (
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <div className="text-5xl mb-4">🗄️</div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">No repository yet</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-sm">
            Initialize a built-in repository to store code, data, and files directly inside this project.
          </p>
          {isOwner ? (
            <button
              onClick={handleInit}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              Initialize Repository
            </button>
          ) : (
            <p className="text-sm text-slate-400">Only the project owner can initialize the repository.</p>
          )}
        </div>
      </div>
    );
  }

  // ─── Render: initialized ──────────────────────────────────────────────────────

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50 flex-wrap">
        <BranchSelector
          branches={branches}
          current={branch}
          onChange={handleBranchChange}
          canCreate={() => setShowNewBranch(true)}
        />
        <div className="flex-1" />
        {isOwner && (
          <>
            <button
              onClick={() => { setShowNewDir(true); setCommitMsg(""); setNewDirName(""); }}
              className="text-xs font-medium text-slate-600 border border-slate-200 bg-white hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              📁 New folder
            </button>
            <button
              onClick={() => { setShowNewFile(true); setNewFileName(""); setNewFileContent(""); setCommitMsg(""); }}
              className="text-xs font-medium text-slate-600 border border-slate-200 bg-white hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              📄 New file
            </button>
            <button
              onClick={() => { setShowUpload(true); setCommitMsg(""); }}
              className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              📤 Upload
            </button>
          </>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-slate-200 bg-white">
        {(["files", "commits", "branches"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t === "files" ? "📂 Files" : t === "commits" ? `🕐 Commits (${commits.length})` : `🌿 Branches (${branches.length})`}
          </button>
        ))}
      </div>

      {/* ── Files tab ── */}
      {tab === "files" && (
        <div className="flex flex-col md:flex-row" style={{ minHeight: 420 }}>

          {/* File tree */}
          <div className={`${selectedFile ? "hidden md:flex" : "flex"} flex-col w-full md:w-72 border-r border-slate-200 flex-shrink-0`}>
            {/* Breadcrumb */}
            <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1 flex-wrap">
              {breadcrumbs().map((crumb, i, arr) => (
                <span key={crumb.path} className="flex items-center gap-1">
                  <button
                    onClick={() => { setDirPath(crumb.path); setSelectedFile(null); }}
                    className={`text-xs hover:underline ${i === arr.length - 1 ? "font-semibold text-slate-700" : "text-blue-600"}`}
                  >
                    {crumb.label}
                  </button>
                  {i < arr.length - 1 && <span className="text-slate-300 text-xs">/</span>}
                </span>
              ))}
            </div>

            {/* Entries */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {dirPath && (
                <button
                  onClick={() => {
                    const parts = dirPath.split("/");
                    parts.pop();
                    setDirPath(parts.join("/"));
                    setSelectedFile(null);
                  }}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition-colors"
                >
                  <span>⬆️</span>
                  <span className="text-sm text-slate-500">..</span>
                </button>
              )}
              {entries.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-400">Empty directory</div>
              )}
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => entry.type === "dir" ? enterDir(entry) : setSelectedFile(entry)}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition-colors group ${selectedFile?.path === entry.path ? "bg-blue-50" : ""}`}
                >
                  <span className="text-base flex-shrink-0">{fileIcon(entry.name, entry.type)}</span>
                  <span className={`text-sm flex-1 truncate ${selectedFile?.path === entry.path ? "text-blue-700 font-semibold" : "text-slate-700"}`}>
                    {entry.name}
                  </span>
                  {entry.type === "dir" && <span className="text-slate-300 text-xs">›</span>}
                </button>
              ))}
            </div>
          </div>

          {/* File viewer / empty state */}
          <div className={`${selectedFile ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
            {!selectedFile ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center px-6">
                <p className="text-4xl mb-3">📂</p>
                <p className="text-sm text-slate-500">Select a file to view its contents</p>
              </div>
            ) : (
              <>
                {/* File header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50 flex-wrap">
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="md:hidden text-sm text-slate-500 hover:text-slate-700 mr-1"
                  >
                    ← Back
                  </button>
                  <span className="text-lg">{fileIcon(selectedFile.name, selectedFile.type)}</span>
                  <span className="font-semibold text-slate-800 text-sm">{selectedFile.name}</span>
                  <span className="text-xs text-slate-400">{formatBytes(selectedFile.size)}</span>
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                    {languageLabel(selectedFile.name)}
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={() => copyPath(selectedFile.path)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                    title="Copy path"
                  >
                    🔗
                  </button>
                  {isOwner && (
                    <>
                      {isTextFile(selectedFile.name) && (
                        <button
                          onClick={openEdit}
                          className="text-xs font-medium text-slate-600 border border-slate-200 bg-white hover:border-slate-300 px-3 py-1 rounded-lg transition-colors"
                        >
                          ✏️ Edit
                        </button>
                      )}
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-xs font-medium text-red-500 border border-red-200 bg-white hover:bg-red-50 px-3 py-1 rounded-lg transition-colors"
                      >
                        🗑 Delete
                      </button>
                    </>
                  )}
                </div>

                {/* Last commit info */}
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-700">
                  <span>🕐</span>
                  <span className="font-medium">{selectedFile.last_commit_author}</span>
                  <span>{selectedFile.last_commit_message}</span>
                  <span className="ml-auto text-amber-500">{timeAgoRepo(selectedFile.last_commit_at)}</span>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto">
                  {selectedFile.encoding === "base64" ? (
                    selectedFile.name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i) ? (
                      <div className="flex items-center justify-center p-8">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`data:image/${selectedFile.name.split(".").pop()};base64,${selectedFile.content}`}
                          alt={selectedFile.name}
                          className="max-w-full max-h-96 rounded-lg shadow"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-16 text-center px-6">
                        <div>
                          <p className="text-4xl mb-3">🗜️</p>
                          <p className="text-sm text-slate-500">Binary file — preview not available</p>
                          <p className="text-xs text-slate-400 mt-1">{formatBytes(selectedFile.size)}</p>
                        </div>
                      </div>
                    )
                  ) : selectedFile.name.endsWith(".md") ? (
                    <div className="prose prose-sm max-w-none p-6 text-slate-700">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{selectedFile.content}</pre>
                    </div>
                  ) : (
                    <pre
                      className="p-4 text-xs font-mono text-slate-700 leading-relaxed overflow-auto"
                      dangerouslySetInnerHTML={{ __html: syntaxHighlight(selectedFile.content, selectedFile.name) }}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Commits tab ── */}
      {tab === "commits" && (
        <div className="divide-y divide-slate-100">
          {commits.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-400">No commits yet</div>
          )}
          {commits.map((c) => (
            <div key={c.id} className="px-4 py-3.5 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                  {c.author[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{c.message}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{c.author} · {timeAgoRepo(c.timestamp)}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {c.files_changed.map((f) => (
                      <span
                        key={f.path}
                        className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                          f.action === "added" ? "bg-emerald-50 text-emerald-700" :
                          f.action === "deleted" ? "bg-red-50 text-red-700" :
                          "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {f.action === "added" ? "+" : f.action === "deleted" ? "−" : "~"} {f.path}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-mono flex-shrink-0">{c.id.slice(0, 7)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Branches tab ── */}
      {tab === "branches" && (
        <div className="divide-y divide-slate-100">
          {branches.map((b) => (
            <div key={b.name} className="px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
              <span className="text-lg">🌿</span>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  {b.name}
                  {b.name === branch && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">current</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Created {timeAgoRepo(b.created_at)}
                  {b.from_branch && ` from ${b.from_branch}`}
                </p>
              </div>
              {b.name !== branch && (
                <button
                  onClick={() => handleBranchChange(b.name)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 px-3 py-1 rounded-lg transition-colors"
                >
                  Switch
                </button>
              )}
            </div>
          ))}
          {isOwner && (
            <div className="px-4 py-3">
              <button
                onClick={() => { setShowNewBranch(true); setNewBranchName(""); }}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                + Create new branch from &quot;{branch}&quot;
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Modals ─────────────────────────────────────────────────────────── */}

      {/* Upload modal */}
      {showUpload && (
        <Modal title="Upload files" onClose={() => setShowUpload(false)}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInput}
            className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4"
          />
          <label className="block text-xs font-semibold text-slate-500 mb-1">Commit message (optional)</label>
          <input
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="Upload files"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-400 mt-2">Files will be added to: <span className="font-mono">{dirPath || "/"}</span> on <span className="font-mono">{branch}</span></p>
          {uploading && <p className="text-xs text-blue-600 mt-2 font-medium">Uploading…</p>}
        </Modal>
      )}

      {/* New file modal */}
      {showNewFile && (
        <Modal title="Create new file" onClose={() => setShowNewFile(false)}>
          <label className="block text-xs font-semibold text-slate-500 mb-1">File name</label>
          <input
            autoFocus
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="e.g. analysis.py"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 mb-3"
          />
          <label className="block text-xs font-semibold text-slate-500 mb-1">Content</label>
          <textarea
            value={newFileContent}
            onChange={(e) => setNewFileContent(e.target.value)}
            rows={8}
            placeholder="# Start writing…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 mb-3 resize-y"
          />
          <label className="block text-xs font-semibold text-slate-500 mb-1">Commit message</label>
          <input
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder={`Add ${newFileName || "file"}`}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 mb-4"
          />
          <button
            onClick={handleCreateFile}
            disabled={!newFileName.trim()}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Commit new file
          </button>
        </Modal>
      )}

      {/* New folder modal */}
      {showNewDir && (
        <Modal title="Create new folder" onClose={() => setShowNewDir(false)}>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Folder name</label>
          <input
            autoFocus
            value={newDirName}
            onChange={(e) => setNewDirName(e.target.value)}
            placeholder="e.g. src"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 mb-3"
          />
          <label className="block text-xs font-semibold text-slate-500 mb-1">Commit message</label>
          <input
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder={`Create directory ${newDirName || "folder"}`}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 mb-4"
          />
          <button
            onClick={handleCreateDir}
            disabled={!newDirName.trim()}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Create folder
          </button>
        </Modal>
      )}

      {/* New branch modal */}
      {showNewBranch && (
        <Modal title={`New branch from "${branch}"`} onClose={() => setShowNewBranch(false)}>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Branch name</label>
          <input
            autoFocus
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateBranch()}
            placeholder="e.g. feature/my-analysis"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 mb-4"
          />
          <button
            onClick={handleCreateBranch}
            disabled={!newBranchName.trim()}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Create branch
          </button>
        </Modal>
      )}

      {/* Edit file modal */}
      {showEditFile && selectedFile && (
        <Modal title={`Edit ${selectedFile.name}`} onClose={() => setShowEditFile(false)} wide>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={16}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 mb-3 resize-y"
          />
          <label className="block text-xs font-semibold text-slate-500 mb-1">Commit message</label>
          <input
            value={editCommitMsg}
            onChange={(e) => setEditCommitMsg(e.target.value)}
            placeholder={`Update ${selectedFile.name}`}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 mb-4"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowEditFile(false)}
              className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Commit changes
            </button>
          </div>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && selectedFile && (
        <Modal title="Confirm delete" onClose={() => setShowDeleteConfirm(false)}>
          <p className="text-sm text-slate-600 mb-4">
            Are you sure you want to delete <span className="font-semibold font-mono">{selectedFile.path}</span>?
            {selectedFile.type === "dir" && " This will delete all files inside."}
            {" "}This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto animate-slide-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
