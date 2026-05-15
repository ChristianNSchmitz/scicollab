"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getLabs, getProfile, getMyLab, getUserPublications, getAllExperiments, type Lab } from "@/lib/mock-db";

const ROLE_LABEL: Record<string, string> = { pi: "PI", postdoc: "Postdoc", phd: "PhD Student", research_assistant: "Research Asst." };
const ROLE_COLOR: Record<string, string> = { pi: "bg-purple-50 text-purple-700 border-purple-200", postdoc: "bg-blue-50 text-blue-700 border-blue-200", phd: "bg-emerald-50 text-emerald-700 border-emerald-200", research_assistant: "bg-slate-50 text-slate-600 border-slate-200" };

const OUTCOME_ICON: Record<string, string> = { success: "✅", partial: "⚠️", failed: "❌" };

function LabCard({ lab, isMyLab }: { lab: Lab; isMyLab: boolean }) {
  const pi = getProfile(lab.pi_user_id);
  const [showMemberResearch, setShowMemberResearch] = useState(false);

  return (
    <div className={`bg-white border rounded-2xl p-6 ${isMyLab ? "border-blue-300 shadow-sm" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="font-bold text-slate-900 text-lg">{lab.name}</h2>
            {isMyLab && <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5 font-medium">Your Lab</span>}
          </div>
          <p className="text-sm text-slate-500">{lab.institution}</p>
        </div>
        <div className="text-right text-xs text-slate-400 flex-shrink-0">
          <p className="font-medium text-slate-700">{lab.experiment_count} experiments</p>
          <p>{lab.publication_count} publications</p>
        </div>
      </div>

      <p className="text-sm text-slate-600 leading-relaxed mb-4">{lab.description}</p>

      {/* Research areas */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {lab.research_areas.map((a) => (
          <span key={a} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 border border-blue-100">{a}</span>
        ))}
      </div>

      {/* PI */}
      {pi && (
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
          <Link href={`/profile/${lab.pi_user_id}`}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${pi.avatar_color || "bg-purple-600"}`}>
            {pi.avatar_initials}
          </Link>
          <div>
            <Link href={`/profile/${lab.pi_user_id}`} className="text-sm font-semibold text-slate-800 hover:underline">{pi.full_name}</Link>
            <p className="text-xs text-slate-400">Principal Investigator</p>
          </div>
          {pi.is_verified && <span className="text-xs text-blue-600 ml-auto">✓ Verified</span>}
        </div>
      )}

      {/* Members */}
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Team ({lab.members.length})</h3>
      <div className="space-y-2">
        {lab.members.map((m) => {
          const member = getProfile(m.user_id);
          if (!member) return null;
          return (
            <div key={m.user_id} className="flex items-center gap-3">
              <Link href={`/profile/${m.user_id}`}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${member.avatar_color || "bg-slate-600"}`}>
                {member.avatar_initials}
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/profile/${m.user_id}`} className="text-sm font-medium text-slate-800 hover:underline">{member.full_name}</Link>
                <p className="text-xs text-slate-400">{member.institution}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${ROLE_COLOR[m.role] ?? ROLE_COLOR.research_assistant}`}>
                {ROLE_LABEL[m.role] ?? m.role}
              </span>
            </div>
          );
        })}
      </div>

      {/* Member Research expandable section */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        <button
          onClick={() => setShowMemberResearch((v) => !v)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
          {showMemberResearch ? "▲ Hide member research" : "📊 View member research"}
        </button>

        {showMemberResearch && (
          <div className="mt-4 space-y-5">
            {lab.members.map((m) => {
              const member = getProfile(m.user_id);
              if (!member) return null;
              const memberPubs = getUserPublications(m.user_id)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 2);
              const memberExps = getAllExperiments()
                .filter((e) => e.user_id === m.user_id)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 2);

              return (
                <div key={m.user_id} className="bg-slate-50 rounded-xl p-4">
                  {/* Member header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${member.avatar_color || "bg-slate-600"}`}>
                      {member.avatar_initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-slate-800">{member.full_name}</span>
                      <span className="text-xs text-slate-500 ml-2">{ROLE_LABEL[m.role] ?? m.role}</span>
                    </div>
                    <Link href={`/profile/${m.user_id}`} className="text-xs text-blue-600 hover:underline flex-shrink-0">
                      View profile →
                    </Link>
                  </div>

                  {/* Recent publications */}
                  {memberPubs.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Recent Publications</p>
                      <div className="space-y-1.5">
                        {memberPubs.map((pub) => (
                          <Link key={pub.id} href={`/publications/${pub.id}`}
                            className="flex items-center justify-between gap-2 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-blue-200 transition-colors">
                            <span className="text-slate-700 line-clamp-1 flex-1">{pub.title}</span>
                            <span className="text-slate-400 flex-shrink-0">{pub.year} · {pub.citation_count} cit.</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent experiments */}
                  {memberExps.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Recent Experiments</p>
                      <div className="space-y-1.5">
                        {memberExps.map((exp) => (
                          <Link key={exp.id} href={`/experiments/${exp.id}`}
                            className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-blue-200 transition-colors">
                            <span>{exp.outcome ? OUTCOME_ICON[exp.outcome] ?? "⏳" : "⏳"}</span>
                            <span className="text-slate-700 line-clamp-1 flex-1">{exp.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {memberPubs.length === 0 && memberExps.length === 0 && (
                    <p className="text-xs text-slate-400">No public work yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LabsPage() {
  const [labs, setLabs]     = useState<Lab[]>([]);
  const [myLab, setMyLab]   = useState<Lab | null>(null);

  useEffect(() => {
    setLabs(getLabs());
    setMyLab(getMyLab());
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Lab Workspaces</h1>
            <p className="text-sm text-slate-500 mt-1">Research groups sharing knowledge on SciCollab.</p>
          </div>
          <button className="text-sm border border-slate-200 bg-white px-4 py-2.5 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            + Create Lab
          </button>
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: "🔬", title: "Upload experiment",   href: "/experiments/new",  desc: "Add a new method card to your lab" },
            { icon: "📄", title: "Add publication",      href: "/publications/new", desc: "Share a paper or preprint" },
            { icon: "🔍", title: "Search experiments",   href: "/search",           desc: "Find methods across all labs" },
          ].map((a) => (
            <Link key={a.title} href={a.href}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all">
              <span className="text-2xl">{a.icon}</span>
              <p className="font-semibold text-slate-900 text-sm mt-2">{a.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{a.desc}</p>
            </Link>
          ))}
        </div>

        {/* Lab cards */}
        <div className="space-y-6">
          {labs.map((lab) => (
            <LabCard key={lab.id} lab={lab} isMyLab={myLab?.id === lab.id} />
          ))}
        </div>

        {/* No lab for user */}
        {!myLab && (
          <div className="mt-6 bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center">
            <p className="text-3xl mb-2">🏛️</p>
            <p className="font-semibold text-slate-800 mb-1">Not part of a lab yet?</p>
            <p className="text-sm text-slate-500 mb-4">Create your lab workspace or ask a PI to invite you.</p>
            <button className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
              Create Lab Workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
