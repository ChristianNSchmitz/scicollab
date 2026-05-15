"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import CommentSection from "@/components/CommentSection";
import { useToast } from "@/lib/toast";
import {
  getProject, updateProject, deleteProject,
  getWikiPages, saveWikiPage, updateWikiPage, deleteWikiPage,
  getIssues, saveIssue, updateIssueStatus, deleteIssue, addIssueComment,
  addProjectContributor, removeProjectContributor,
  getAllPublications, getProfile, searchProfiles,
  MOCK_USER_ID, type Project, type WikiPage, type Issue,
} from "@/lib/mock-db";

const TAB_LIST = ["Overview", "Publications", "Discussion", "Wiki", "Issues"] as const;
type Tab = typeof TAB_LIST[number];

type SortMode = "date" | "impact" | "first_author";

const PRIORITY_BADGE: Record<Issue["priority"], string> = {
  high:   "🔴",
  medium: "🟡",
  low:    "🟢",
};

const STATUS_BADGE: Record<Project["status"], string> = {
  active:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  paused:    "bg-slate-100 text-slate-500 border-slate-200",
};

const ISSUE_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open:       { label: "Open",        cls: "bg-red-50 text-red-700 border-red-200" },
  in_process: { label: "In Process",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  waiting:    { label: "Waiting",     cls: "bg-amber-50 text-amber-700 border-amber-200" },
  solved:     { label: "Solved",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  closed:     { label: "Closed",      cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

type IssueFilter = "open" | "in_process" | "waiting" | "solved" | "closed" | "all";

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-slate-800 mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-slate-900 mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-slate-900 mt-6 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-slate-100 rounded px-1 py-0.5 text-xs font-mono text-blue-700">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>');
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("Overview");

  // Edit mode
  const [editing, setEditing]       = useState(false);
  const [editTitle, setEditTitle]   = useState("");
  const [editDesc, setEditDesc]     = useState("");
  const [editGit, setEditGit]       = useState("");
  const [editStatus, setEditStatus] = useState<Project["status"]>("active");
  const [editTags, setEditTags]     = useState("");

  // Publications tab
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [allPubs, setAllPubs] = useState(getAllPublications());
  const [pubModalSearch, setPubModalSearch] = useState("");
  const [modalSelected, setModalSelected] = useState<Set<string>>(new Set());

  // Wiki tab
  const [wikiPages, setWikiPages]           = useState<WikiPage[]>([]);
  const [showNewWiki, setShowNewWiki]       = useState(false);
  const [newWikiTitle, setNewWikiTitle]     = useState("");
  const [newWikiContent, setNewWikiContent] = useState("");
  const [newWikiParentId, setNewWikiParentId] = useState("");
  const [viewingWiki, setViewingWiki]       = useState<WikiPage | null>(null);
  const [editingWiki, setEditingWiki]       = useState<WikiPage | null>(null);
  const [editWikiTitle, setEditWikiTitle]   = useState("");
  const [editWikiContent, setEditWikiContent] = useState("");
  const [editWikiParentId, setEditWikiParentId] = useState<string | null>(null);
  const [previewMode, setPreviewMode]       = useState(false);
  const [editPreviewMode, setEditPreviewMode] = useState(false);
  const [confirmWikiDelete, setConfirmWikiDelete] = useState<string | null>(null);
  const [confirmWikiTimer, setConfirmWikiTimer]   = useState<ReturnType<typeof setTimeout> | null>(null);

  // Issues tab
  const [issues, setIssues]               = useState<Issue[]>([]);
  const [issueFilter, setIssueFilter]     = useState<IssueFilter>("open");
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [newComment, setNewComment]       = useState<Record<string, string>>({});
  const [showNewIssue, setShowNewIssue]   = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueBody, setNewIssueBody]   = useState("");
  const [newIssuePriority, setNewIssuePriority] = useState<Issue["priority"]>("medium");
  const [newIssueLabels, setNewIssueLabels]     = useState("");
  const [confirmDeleteIssue, setConfirmDeleteIssue] = useState<string | null>(null);
  const [confirmDeleteIssueTimer, setConfirmDeleteIssueTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Contributors
  const [showAddContributor, setShowAddContributor] = useState(false);
  const [contributorSearch, setContributorSearch]   = useState("");
  const [contributorResults, setContributorResults] = useState<ReturnType<typeof searchProfiles>>([]);

  const { toast } = useToast();

  useEffect(() => {
    const p = getProject(id);
    if (!p) { setNotFound(true); return; }
    setProject(p);
    setWikiPages(getWikiPages(id));
    setIssues(getIssues(id));
    setAllPubs(getAllPublications());
  }, [id]);

  // Cleanup confirm timers on unmount
  useEffect(() => {
    return () => {
      if (confirmWikiTimer) clearTimeout(confirmWikiTimer);
      if (confirmDeleteIssueTimer) clearTimeout(confirmDeleteIssueTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshProject() {
    const p = getProject(id);
    if (p) setProject(p);
  }

  function refreshWiki() { setWikiPages(getWikiPages(id)); }
  function refreshIssues() { setIssues(getIssues(id)); }

  const handleContributorSearchChange = useCallback((q: string) => {
    setContributorSearch(q);
    if (q.length >= 2) {
      setContributorResults(searchProfiles(q));
    } else {
      setContributorResults([]);
    }
  }, []);

  const isOwner = project?.user_id === MOCK_USER_ID;
  const isCollab = project?.collaborator_ids.includes(MOCK_USER_ID) ?? false;
  const canEdit = isOwner || isCollab;

  function startEdit() {
    if (!project) return;
    setEditTitle(project.title);
    setEditDesc(project.description);
    setEditGit(project.git_url ?? "");
    setEditStatus(project.status);
    setEditTags(project.tags.join(", "));
    setEditing(true);
  }

  function saveEdit() {
    if (!project) return;
    const updated = updateProject(project.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
      git_url: editGit.trim() || null,
      status: editStatus,
      tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    if (updated) setProject(updated);
    setEditing(false);
    toast("Project updated");
  }

  // Publications
  const linkedPubs = useMemo(() => {
    if (!project) return [];
    const all = getAllPublications();
    const mapped = project.publication_ids
      .map((pid) => all.find((p) => p.id === pid))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
    if (sortMode === "date") return [...mapped].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sortMode === "impact") return [...mapped].sort((a, b) => b.citation_count - a.citation_count);
    if (sortMode === "first_author") return [...mapped].sort((a, b) => (a.authors[0] ?? "").localeCompare(b.authors[0] ?? ""));
    return mapped;
  }, [project, sortMode]);

  const modalPubs = allPubs.filter((p) =>
    !pubModalSearch || p.title.toLowerCase().includes(pubModalSearch.toLowerCase())
  );

  function openLinkModal() {
    setModalSelected(new Set(project?.publication_ids ?? []));
    setPubModalSearch("");
    setShowLinkModal(true);
  }

  function saveLinkModal() {
    if (!project) return;
    const updated = updateProject(project.id, { publication_ids: Array.from(modalSelected) });
    if (updated) setProject(updated);
    setShowLinkModal(false);
  }

  function unlinkPub(pubId: string) {
    if (!project) return;
    const updated = updateProject(project.id, {
      publication_ids: project.publication_ids.filter((pid) => pid !== pubId),
    });
    if (updated) setProject(updated);
  }

  // Wiki
  const topLevelWiki = wikiPages.filter((w) => !w.parent_id);

  function handleNewWikiSave() {
    if (!newWikiTitle.trim()) return;
    saveWikiPage({ project_id: id, title: newWikiTitle.trim(), content: newWikiContent.trim(), parent_id: newWikiParentId || null, created_by: MOCK_USER_ID });
    setNewWikiTitle(""); setNewWikiContent(""); setNewWikiParentId(""); setShowNewWiki(false); setPreviewMode(false);
    refreshWiki();
    toast("Wiki page saved");
  }

  function handleWikiEdit(page: WikiPage) {
    setEditingWiki(page);
    setEditWikiTitle(page.title);
    setEditWikiContent(page.content);
    setEditWikiParentId(page.parent_id ?? null);
    setEditPreviewMode(false);
    setViewingWiki(null);
  }

  function handleWikiSaveEdit() {
    if (!editingWiki) return;
    updateWikiPage(editingWiki.id, editWikiContent.trim(), editWikiTitle.trim(), editWikiParentId ?? undefined);
    setEditingWiki(null);
    refreshWiki();
    toast("Wiki page saved");
  }

  function handleWikiDeleteClick(pageId: string) {
    if (confirmWikiDelete === pageId) {
      if (confirmWikiTimer) clearTimeout(confirmWikiTimer);
      deleteWikiPage(pageId);
      if (viewingWiki?.id === pageId) setViewingWiki(null);
      setConfirmWikiDelete(null);
      refreshWiki();
      toast("Page deleted", "info");
    } else {
      if (confirmWikiTimer) clearTimeout(confirmWikiTimer);
      setConfirmWikiDelete(pageId);
      const t = setTimeout(() => setConfirmWikiDelete(null), 3000);
      setConfirmWikiTimer(t);
    }
  }

  // Issues
  const filteredIssues = issues.filter((i) => {
    if (issueFilter === "all") return true;
    return i.status === issueFilter;
  });

  function handleNewIssueSave() {
    if (!newIssueTitle.trim()) return;
    saveIssue({
      project_id: id,
      user_id: MOCK_USER_ID,
      title: newIssueTitle.trim(),
      body: newIssueBody.trim(),
      status: "open",
      priority: newIssuePriority,
      labels: newIssueLabels.split(",").map((l) => l.trim()).filter(Boolean),
    });
    setNewIssueTitle(""); setNewIssueBody(""); setNewIssueLabels(""); setNewIssuePriority("medium");
    setShowNewIssue(false);
    refreshIssues();
    toast("Issue created");
  }

  function handleDeleteIssueClick(issueId: string) {
    if (confirmDeleteIssue === issueId) {
      if (confirmDeleteIssueTimer) clearTimeout(confirmDeleteIssueTimer);
      deleteIssue(issueId);
      setConfirmDeleteIssue(null);
      refreshIssues();
      toast("Issue deleted", "info");
    } else {
      if (confirmDeleteIssueTimer) clearTimeout(confirmDeleteIssueTimer);
      setConfirmDeleteIssue(issueId);
      const t = setTimeout(() => setConfirmDeleteIssue(null), 3000);
      setConfirmDeleteIssueTimer(t);
    }
  }

  function handleAddComment(issueId: string) {
    const body = newComment[issueId] ?? "";
    if (!body.trim()) return;
    addIssueComment(issueId, body.trim());
    setNewComment((prev) => ({ ...prev, [issueId]: "" }));
    refreshIssues();
    toast("Comment posted");
  }

  const openIssueCount = issues.filter((i) => i.status === "open").length;

  if (notFound) return (
    <div className="min-h-screen bg-slate-50"><NavBar />
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-3xl mb-2">🗂</p>
          <p className="font-semibold text-slate-800">Project not found</p>
          <Link href="/projects" className="text-sm text-blue-600 hover:underline mt-2 block">← Back to projects</Link>
        </div>
      </div>
    </div>
  );

  if (!project) return (
    <div className="min-h-screen bg-slate-50"><NavBar />
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const owner = getProfile(project.user_id);
  const collaborators = project.collaborator_ids.map((cid) => getProfile(cid)).filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {!editing ? (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Link href="/projects" className="text-xs text-slate-400 hover:text-slate-600">🗂 Projects</Link>
                  <span className="text-slate-300">/</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE[project.status]}`}>{project.status}</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">{project.title}</h1>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed max-w-2xl">{project.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {project.tags.map((t) => (
                    <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 border border-blue-100">{t}</span>
                  ))}
                  {project.git_url && (
                    <a href={project.git_url} target="_blank" rel="noopener"
                      className="text-xs bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1 text-slate-600 hover:border-slate-400 flex items-center gap-1">
                      🐙 GitHub
                    </a>
                  )}
                </div>
                {/* Collaborators */}
                <div className="flex items-center gap-2 mt-3">
                  {owner && (
                    <Link href={`/profile/${project.user_id}`}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${owner.avatar_color || "bg-slate-600"}`}
                      title={owner.full_name}>
                      {owner.avatar_initials}
                    </Link>
                  )}
                  {collaborators.map((c) => c && (
                    <Link key={c.id} href={`/profile/${c.id}`}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${c.avatar_color || "bg-slate-600"}`}
                      title={c.full_name}>
                      {c.avatar_initials}
                    </Link>
                  ))}
                  <span className="text-xs text-slate-400">{collaborators.length + 1} contributor{collaborators.length > 0 ? "s" : ""}</span>
                </div>
              </div>
              {isOwner && (
                <button onClick={startEdit}
                  className="text-sm border border-slate-200 px-4 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors flex-shrink-0">
                  ✏️ Edit
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-xl font-bold border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3}
                className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 resize-none" />
              <input value={editGit} onChange={(e) => setEditGit(e.target.value)} placeholder="Git URL"
                className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 font-mono" />
              <input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="Tags (comma-separated)"
                className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500" />
              <div className="flex gap-2">
                {(["active", "completed", "paused"] as Project["status"][]).map((s) => (
                  <button key={s} type="button" onClick={() => setEditStatus(s)}
                    className={`text-sm px-4 py-1.5 rounded-full font-medium border transition-colors ${editStatus === s ? STATUS_BADGE[s] : "bg-white border-slate-200 text-slate-500"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} className="bg-blue-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-blue-700">Save</button>
                <button onClick={() => setEditing(false)} className="text-sm px-5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-hide -mb-px">
            {TAB_LIST.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                {t}{t === "Issues" && openIssueCount > 0 && (
                  <span className="ml-1.5 bg-red-100 text-red-600 text-xs rounded-full px-1.5 py-0.5">{openIssueCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* ── Overview ── */}
        {tab === "Overview" && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Publications", value: project.publication_ids.length, icon: "📄" },
                  { label: "Wiki Pages", value: wikiPages.length, icon: "📝" },
                  { label: "Open Issues", value: openIssueCount, icon: "⚠️" },
                  { label: "Discussions", value: 0, icon: "💬" },
                ].map((s) => (
                  <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                    <p className="text-lg mb-0.5">{s.icon}</p>
                    <p className="text-xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Recent activity */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h2 className="font-semibold text-slate-900 mb-4">Recent Activity</h2>
                <div className="space-y-3">
                  {[
                    ...issues.slice(0, 3).map((i) => ({
                      icon: i.status === "open" ? "⚠️" : "✅",
                      text: `Issue: ${i.title}`,
                      sub: timeAgo(i.created_at),
                    })),
                    ...wikiPages.slice(0, 3).map((w) => ({
                      icon: "📝",
                      text: `Wiki: ${w.title}`,
                      sub: `Updated ${timeAgo(w.updated_at)}`,
                    })),
                  ].slice(0, 6).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="w-6 text-center flex-shrink-0">{item.icon}</span>
                      <span className="flex-1 text-slate-700 line-clamp-1">{item.text}</span>
                      <span className="text-xs text-slate-400 flex-shrink-0">{item.sub}</span>
                    </div>
                  ))}
                  {issues.length === 0 && wikiPages.length === 0 && (
                    <p className="text-sm text-slate-400">No activity yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Contributors</h3>
                <div className="space-y-2">
                  {[project.user_id, ...project.collaborator_ids].map((uid) => {
                    const p = getProfile(uid);
                    if (!p) return null;
                    return (
                      <div key={uid} className="flex items-center gap-2">
                        <Link href={`/profile/${uid}`} className="flex items-center gap-2 flex-1 hover:opacity-80">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${p.avatar_color || "bg-slate-600"}`}>
                            {p.avatar_initials}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{p.full_name}</p>
                            <p className="text-xs text-slate-400">{uid === project.user_id ? "Owner" : "Contributor"}</p>
                          </div>
                        </Link>
                        {isOwner && uid !== project.user_id && (
                          <button
                            onClick={() => { removeProjectContributor(id, uid); refreshProject(); toast("Contributor removed", "info"); }}
                            className="text-xs text-slate-400 hover:text-red-500 px-1"
                            title="Remove contributor">
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isOwner && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {!showAddContributor ? (
                      <button
                        onClick={() => setShowAddContributor(true)}
                        className="text-xs text-blue-600 hover:underline">
                        + Add Contributor
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            value={contributorSearch}
                            onChange={(e) => handleContributorSearchChange(e.target.value)}
                            placeholder="Search by name or institution…"
                            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-400"
                            autoFocus
                          />
                          {contributorResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-10 mt-1 max-h-48 overflow-y-auto">
                              {contributorResults
                                .filter((r) => r.id !== project.user_id && !project.collaborator_ids.includes(r.id))
                                .map((r) => (
                                  <button
                                    key={r.id}
                                    onClick={() => {
                                      addProjectContributor(id, r.id);
                                      refreshProject();
                                      setShowAddContributor(false);
                                      setContributorSearch("");
                                      setContributorResults([]);
                                      toast("Contributor added");
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${r.avatar_color || "bg-slate-600"}`}>
                                      {r.avatar_initials}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium text-slate-800 truncate">{r.full_name}</p>
                                      <p className="text-xs text-slate-400 truncate">{r.institution}</p>
                                    </div>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                        <button onClick={() => { setShowAddContributor(false); setContributorSearch(""); setContributorResults([]); }} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Publications ── */}
        {tab === "Publications" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-1.5">
                <span className="text-xs text-slate-400 self-center mr-1">Sort:</span>
                {(["date", "impact", "first_author"] as SortMode[]).map((s) => (
                  <button key={s} onClick={() => setSortMode(s)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${sortMode === s ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                    {s === "date" ? "Date" : s === "impact" ? "Impact" : "First Author"}
                  </button>
                ))}
              </div>
              {canEdit && (
                <button onClick={openLinkModal}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
                  + Link Publication
                </button>
              )}
            </div>

            {linkedPubs.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <p className="text-3xl mb-2">📄</p>
                <p className="font-semibold text-slate-800">No publications linked yet</p>
                {canEdit && <button onClick={openLinkModal} className="text-sm text-blue-600 hover:underline mt-1">+ Link a publication</button>}
              </div>
            ) : (
              <div className="space-y-3">
                {linkedPubs.map((pub) => (
                  <div key={pub.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-200 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${pub.status === "published" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                            {pub.status}
                          </span>
                        </div>
                        <Link href={`/publications/${pub.id}`}>
                          <h3 className="font-semibold text-slate-900 leading-snug hover:text-blue-600">{pub.title}</h3>
                        </Link>
                        <p className="text-xs text-slate-500 mt-1">{pub.authors.join(", ")}</p>
                        <p className="text-xs text-slate-400">{pub.journal || "arXiv"} · {pub.year}</p>
                      </div>
                      <div className="text-right flex-shrink-0 text-xs text-slate-400 space-y-0.5">
                        <p className="font-medium text-slate-700">{pub.citation_count} <span className="font-normal">citations</span></p>
                        {isOwner && (
                          <button onClick={() => unlinkPub(pub.id)}
                            className="text-xs text-slate-400 hover:text-red-500 mt-1 block">
                            🗑 Unlink
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Link modal */}
            {showLinkModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-slate-900">Link Publications</h2>
                    <button onClick={() => setShowLinkModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  <div className="relative mb-3">
                    <input value={pubModalSearch} onChange={(e) => setPubModalSearch(e.target.value)}
                      placeholder="Search publications…"
                      className="w-full border border-slate-200 rounded-xl pl-4 pr-4 py-2 text-sm outline-none focus:border-blue-400" />
                  </div>
                  <div className="space-y-2 overflow-y-auto flex-1">
                    {modalPubs.map((pub) => (
                      <label key={pub.id} className="flex items-start gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
                        <input type="checkbox" checked={modalSelected.has(pub.id)} onChange={() => setModalSelected((prev) => { const n = new Set(prev); n.has(pub.id) ? n.delete(pub.id) : n.add(pub.id); return n; })} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 line-clamp-1">{pub.title}</p>
                          <p className="text-xs text-slate-400">{pub.authors[0]} · {pub.year} · {pub.citation_count} cit.</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                    <button onClick={saveLinkModal} className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">Save ({modalSelected.size} selected)</button>
                    <button onClick={() => setShowLinkModal(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Discussion ── */}
        {tab === "Discussion" && (
          <div className="max-w-2xl">
            <CommentSection targetType="project" targetId={project.id} />
          </div>
        )}

        {/* ── Wiki ── */}
        {tab === "Wiki" && (
          <div className="flex gap-4">
            {/* Tree Sidebar */}
            <div className="w-48 flex-shrink-0">
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pages</p>
                {wikiPages.length === 0 && (
                  <p className="text-xs text-slate-400">No pages yet.</p>
                )}
                {topLevelWiki.map((page) => {
                  const children = wikiPages.filter((w) => w.parent_id === page.id);
                  const isSelected = viewingWiki?.id === page.id || editingWiki?.id === page.id;
                  return (
                    <div key={page.id}>
                      <button
                        onClick={() => { setViewingWiki(page); setEditingWiki(null); setShowNewWiki(false); }}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded-lg truncate transition-colors ${isSelected ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"}`}>
                        {page.title}
                      </button>
                      {children.map((child) => {
                        const isChildSelected = viewingWiki?.id === child.id || editingWiki?.id === child.id;
                        return (
                          <button
                            key={child.id}
                            onClick={() => { setViewingWiki(child); setEditingWiki(null); setShowNewWiki(false); }}
                            className={`w-full text-left text-xs px-2 py-1.5 pl-5 rounded-lg truncate transition-colors flex items-center gap-1 ${isChildSelected ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-500 hover:bg-slate-50"}`}>
                            <span className="flex-shrink-0">└</span>
                            <span className="truncate">{child.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                {/* Pages not in tree (children of non-existent parents) */}
                {wikiPages.filter((w) => w.parent_id && !topLevelWiki.find((p) => p.id === w.parent_id)).map((page) => {
                  const isSelected = viewingWiki?.id === page.id || editingWiki?.id === page.id;
                  return (
                    <button
                      key={page.id}
                      onClick={() => { setViewingWiki(page); setEditingWiki(null); setShowNewWiki(false); }}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded-lg truncate transition-colors ${isSelected ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"}`}>
                      {page.title}
                    </button>
                  );
                })}
                {canEdit && (
                  <div className="pt-2 border-t border-slate-100 mt-2">
                    <button
                      onClick={() => { setShowNewWiki(true); setViewingWiki(null); setEditingWiki(null); }}
                      className="w-full text-xs text-blue-600 hover:text-blue-700 text-left px-2 py-1.5 rounded-lg hover:bg-blue-50">
                      + New Page
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              {/* New wiki page form */}
              {showNewWiki && (
                <div className="bg-white border border-blue-200 rounded-2xl p-5 space-y-3">
                  <h3 className="font-semibold text-slate-900">New Wiki Page</h3>
                  <input value={newWikiTitle} onChange={(e) => setNewWikiTitle(e.target.value)}
                    placeholder="Page title"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500" />
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Parent page (optional)</label>
                    <select value={newWikiParentId} onChange={(e) => setNewWikiParentId(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 bg-white">
                      <option value="">None (top-level)</option>
                      {topLevelWiki.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-500">Content</label>
                      <button onClick={() => setPreviewMode((v) => !v)} className="text-xs text-blue-600 hover:underline">
                        {previewMode ? "Edit" : "Preview"}
                      </button>
                    </div>
                    {!previewMode ? (
                      <textarea value={newWikiContent} onChange={(e) => setNewWikiContent(e.target.value)}
                        rows={8} placeholder="Page content (Markdown supported)…"
                        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 resize-none font-mono" />
                    ) : (
                      <div
                        className="min-h-[12rem] border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: '<p class="mb-2">' + renderMarkdown(newWikiContent) + '</p>' }}
                      />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleNewWikiSave} disabled={!newWikiTitle.trim()}
                      className="bg-blue-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50">Save Page</button>
                    <button onClick={() => { setShowNewWiki(false); setNewWikiTitle(""); setNewWikiContent(""); setNewWikiParentId(""); setPreviewMode(false); }}
                      className="text-sm px-5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
                  </div>
                </div>
              )}

              {/* Editing a wiki page */}
              {editingWiki && (
                <div className="bg-white border border-blue-200 rounded-2xl p-5 space-y-3">
                  <h3 className="font-semibold text-slate-900">Editing: {editingWiki.title}</h3>
                  <input value={editWikiTitle} onChange={(e) => setEditWikiTitle(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500" />
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Parent page</label>
                    <select
                      value={editWikiParentId ?? ""}
                      onChange={(e) => setEditWikiParentId(e.target.value || null)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 bg-white">
                      <option value="">None (top-level)</option>
                      {topLevelWiki.filter((p) => p.id !== editingWiki.id).map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-500">Content</label>
                      <button onClick={() => setEditPreviewMode((v) => !v)} className="text-xs text-blue-600 hover:underline">
                        {editPreviewMode ? "Edit" : "Preview"}
                      </button>
                    </div>
                    {!editPreviewMode ? (
                      <textarea value={editWikiContent} onChange={(e) => setEditWikiContent(e.target.value)}
                        rows={10}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 resize-none font-mono" />
                    ) : (
                      <div
                        className="min-h-[14rem] border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: '<p class="mb-2">' + renderMarkdown(editWikiContent) + '</p>' }}
                      />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleWikiSaveEdit} className="bg-blue-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-blue-700">Save</button>
                    <button onClick={() => setEditingWiki(null)} className="text-sm px-5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
                  </div>
                </div>
              )}

              {/* Viewing a wiki page */}
              {viewingWiki && !editingWiki && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-slate-900 text-xl">{viewingWiki.title}</h2>
                      {viewingWiki.parent_id && (() => {
                        const parent = wikiPages.find((w) => w.id === viewingWiki.parent_id);
                        return parent ? (
                          <button onClick={() => setViewingWiki(parent)} className="text-xs text-slate-400 hover:text-blue-600 mt-0.5">
                            ↑ {parent.title}
                          </button>
                        ) : null;
                      })()}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {canEdit && (
                        <>
                          <button onClick={() => handleWikiEdit(viewingWiki)}
                            className="text-xs border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50">
                            ✏️ Edit
                          </button>
                          <button onClick={() => handleWikiDeleteClick(viewingWiki.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${confirmWikiDelete === viewingWiki.id ? "bg-red-600 text-white" : "border border-slate-200 text-slate-400 hover:text-red-500"}`}>
                            {confirmWikiDelete === viewingWiki.id ? "Confirm?" : "🗑"}
                          </button>
                        </>
                      )}
                      <button onClick={() => setViewingWiki(null)} className="text-xs text-slate-400 hover:text-slate-600 px-2">✕</button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Updated {timeAgo(viewingWiki.updated_at)}</p>
                  <div
                    className="text-sm text-slate-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: '<p class="mb-2">' + renderMarkdown(viewingWiki.content) + '</p>' }}
                  />
                </div>
              )}

              {/* Placeholder */}
              {!viewingWiki && !editingWiki && !showNewWiki && (
                <div className="flex items-center justify-center h-48 bg-white border border-slate-200 rounded-2xl">
                  <p className="text-sm text-slate-400">Select a page from the sidebar</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Issues ── */}
        {tab === "Issues" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-1.5 flex-wrap">
                {(["open", "in_process", "waiting", "solved", "closed", "all"] as IssueFilter[]).map((f) => {
                  const count = f === "all" ? issues.length : issues.filter((i) => i.status === f).length;
                  const label = f === "all" ? "All" : (ISSUE_STATUS_LABEL[f]?.label ?? f);
                  return (
                    <button key={f} onClick={() => setIssueFilter(f)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors capitalize ${issueFilter === f ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}>
                      {label} ({count})
                    </button>
                  );
                })}
              </div>
              {canEdit && (
                <button onClick={() => setShowNewIssue(true)}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
                  + New Issue
                </button>
              )}
            </div>

            {/* New issue form */}
            {showNewIssue && (
              <div className="bg-white border border-blue-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-semibold text-slate-900">New Issue</h3>
                <input value={newIssueTitle} onChange={(e) => setNewIssueTitle(e.target.value)}
                  placeholder="Issue title"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500" />
                <textarea value={newIssueBody} onChange={(e) => setNewIssueBody(e.target.value)}
                  rows={4} placeholder="Describe the issue…"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 resize-none" />
                <div className="flex gap-3 flex-wrap">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Priority</label>
                    <div className="flex gap-1.5">
                      {(["low", "medium", "high"] as Issue["priority"][]).map((p) => (
                        <button key={p} type="button" onClick={() => setNewIssuePriority(p)}
                          className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${newIssuePriority === p ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                          {PRIORITY_BADGE[p]} {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-w-40">
                    <label className="text-xs text-slate-500 block mb-1">Labels (comma-separated)</label>
                    <input value={newIssueLabels} onChange={(e) => setNewIssueLabels(e.target.value)}
                      placeholder="bug, enhancement…"
                      className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleNewIssueSave} disabled={!newIssueTitle.trim()}
                    className="bg-blue-600 text-white text-sm px-5 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50">Create Issue</button>
                  <button onClick={() => setShowNewIssue(false)}
                    className="text-sm px-5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
                </div>
              </div>
            )}

            {/* Issue list */}
            {filteredIssues.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <p className="text-3xl mb-2">✅</p>
                <p className="font-semibold text-slate-800">No {issueFilter === "all" ? "" : issueFilter} issues</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredIssues.map((issue) => {
                  const expanded = expandedIssue === issue.id;
                  const issueOwner = getProfile(issue.user_id);
                  const canManage = project.user_id === MOCK_USER_ID || issue.user_id === MOCK_USER_ID;
                  const statusInfo = ISSUE_STATUS_LABEL[issue.status] ?? { label: issue.status, cls: "bg-slate-100 text-slate-500 border-slate-200" };
                  return (
                    <div key={issue.id} className={`bg-white border rounded-2xl transition-colors ${expanded ? "border-blue-200" : "border-slate-200"}`}>
                      {/* Issue header */}
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <span className="text-lg flex-shrink-0 mt-0.5">{PRIORITY_BADGE[issue.priority]}</span>
                          <div className="flex-1 min-w-0">
                            <button onClick={() => setExpandedIssue(expanded ? null : issue.id)}
                              className="text-left w-full">
                              <p className={`font-semibold text-slate-900 hover:text-blue-600 ${issue.status === "closed" || issue.status === "solved" ? "line-through text-slate-400" : ""}`}>
                                {issue.title}
                              </p>
                            </button>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusInfo.cls}`}>
                                {statusInfo.label}
                              </span>
                              {issue.labels.map((l) => (
                                <span key={l} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 border border-slate-200">{l}</span>
                              ))}
                            </div>
                            <p className="text-xs text-slate-400 mt-1.5">
                              💬 {issue.comments.length} comment{issue.comments.length !== 1 ? "s" : ""} · Opened {timeAgo(issue.created_at)} by {issueOwner?.full_name ?? "Researcher"}
                            </p>
                          </div>
                          {canManage && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <select
                                value={issue.status}
                                onChange={(e) => { updateIssueStatus(issue.id, e.target.value as Issue["status"]); refreshIssues(); }}
                                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-blue-400"
                                onClick={(e) => e.stopPropagation()}>
                                <option value="open">Open</option>
                                <option value="in_process">In Process</option>
                                <option value="waiting">Waiting</option>
                                <option value="solved">Solved</option>
                                <option value="closed">Closed</option>
                              </select>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteIssueClick(issue.id); }}
                                className={`text-xs px-2 py-1.5 rounded-lg transition-colors ${confirmDeleteIssue === issue.id ? "bg-red-600 text-white" : "text-slate-400 hover:text-red-500 border border-slate-200"}`}>
                                {confirmDeleteIssue === issue.id ? "Confirm?" : "🗑"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded body + comments */}
                      {expanded && (
                        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-4">
                          {issue.body && (
                            <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3">
                              {issue.body}
                            </div>
                          )}
                          {issue.comments.length > 0 && (
                            <div className="space-y-3">
                              {issue.comments.map((c) => {
                                const cp = getProfile(c.user_id);
                                return (
                                  <div key={c.id} className="flex gap-3">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${cp?.avatar_color || "bg-slate-500"}`}>
                                      {cp?.avatar_initials ?? "?"}
                                    </div>
                                    <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2.5">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-semibold text-slate-800">{cp?.full_name ?? "Researcher"}</span>
                                        <span className="text-xs text-slate-400">{timeAgo(c.created_at)}</span>
                                      </div>
                                      <p className="text-sm text-slate-700">{c.body}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {/* Add comment */}
                          <div className="flex gap-2">
                            <textarea
                              value={newComment[issue.id] ?? ""}
                              onChange={(e) => setNewComment((prev) => ({ ...prev, [issue.id]: e.target.value }))}
                              rows={2} placeholder="Add a comment…"
                              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
                            <button onClick={() => handleAddComment(issue.id)}
                              disabled={!(newComment[issue.id] ?? "").trim()}
                              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 self-end">
                              Submit
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
