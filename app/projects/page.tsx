"use client";

import { timeAgo } from "@/lib/utils";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getProjects, getProfile, getCurrentUserId, type Project } from "@/lib/mock-db";

type FilterTab = "All" | "Active" | "Completed" | "Paused" | "Mine";
const STATUS_BADGE: Record<Project["status"], string> = {
  active:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  paused:    "bg-slate-100 text-slate-500 border-slate-200",
};


export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filterTab, setFilterTab] = useState<FilterTab>("All");

  useEffect(() => { setProjects(getProjects()); }, []);

  const visible = projects.filter((p) => {
    if (filterTab === "All") return true;
    if (filterTab === "Mine") { const cid = getCurrentUserId(); return p.user_id === cid || p.collaborator_ids.includes(cid); }
    return p.status === filterTab.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">🗂 Projects</h1>
            <p className="text-sm text-slate-500 mt-0.5">Research projects with publications, wiki, issues & discussions</p>
          </div>
          <Link href="/projects/new"
            className="bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
            + New Project
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {(["All", "Active", "Completed", "Paused", "Mine"] as FilterTab[]).map((t) => (
            <button key={t} onClick={() => setFilterTab(t)}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-colors ${filterTab === t ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Count */}
        <p className="text-sm text-slate-500 mb-4">{visible.length} project{visible.length !== 1 ? "s" : ""}</p>

        {/* List */}
        {visible.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">🗂</p>
            <p className="font-semibold text-slate-800">No projects found</p>
            <p className="text-sm text-slate-500 mt-1">
              {filterTab === "Mine" ? "You haven't created any projects yet." : "No projects match this filter."}
            </p>
            <Link href="/projects/new" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
              + Create your first project
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {visible.map((proj) => {
              const owner = getProfile(proj.user_id);
              const collaborators = proj.collaborator_ids.map((id) => getProfile(id)).filter(Boolean);
              return (
                <div key={proj.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-200 transition-colors flex flex-col gap-3">
                  {/* Status + title */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE[proj.status]}`}>
                        {proj.status}
                      </span>
                      <h2 className="font-semibold text-slate-900 leading-snug line-clamp-1">{proj.title}</h2>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{proj.description}</p>
                  </div>

                  {/* Tags */}
                  {proj.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {proj.tags.map((t) => (
                        <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">{t}</span>
                      ))}
                    </div>
                  )}

                  {/* Git URL chip */}
                  {proj.git_url && (
                    <a href={proj.git_url} target="_blank" rel="noopener"
                      className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 hover:border-slate-400 w-fit">
                      🐙 {proj.git_url.replace("https://github.com/", "")}
                    </a>
                  )}
                  {proj.gitlab_url && (
                    <a href={proj.gitlab_url} target="_blank" rel="noopener"
                      className="inline-flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1 hover:border-orange-400 w-fit">
                      🦊 {proj.gitlab_url.replace("https://gitlab.com/", "")}
                    </a>
                  )}

                  {/* Footer: owner + collaborators + pub count + link */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      {owner && (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${owner.avatar_color || "bg-slate-600"}`} title={owner.full_name}>
                          {owner.avatar_initials}
                        </div>
                      )}
                      {collaborators.map((c) => c && (
                        <div key={c.id} className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${c.avatar_color || "bg-slate-600"}`} title={c.full_name}>
                          {c.avatar_initials}
                        </div>
                      ))}
                      <span className="text-xs text-slate-400 ml-1">{proj.publication_ids.length} pub{proj.publication_ids.length !== 1 ? "s" : ""}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">updated {timeAgo(proj.updated_at)}</span>
                    </div>
                    <Link href={`/projects/${proj.id}`} className="text-xs text-blue-600 hover:underline font-medium flex-shrink-0">
                      View Project →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
