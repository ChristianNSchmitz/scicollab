"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMockProfile, getMyExperiments, type Experiment } from "@/lib/mock-db";

function outcomeStyle(o: string | null) {
  if (o === "success") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (o === "partial")  return "bg-amber-50 text-amber-700 border-amber-200";
  if (o === "failed")   return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-500 border-slate-200";
}
function outcomeLabel(o: string | null) {
  if (o === "success") return "✅ Success";
  if (o === "partial")  return "⚠️ Partial";
  if (o === "failed")   return "❌ Failed";
  return "Draft";
}
function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const [profile, setProfile]       = useState({ full_name: "Researcher", institution: "" });
  const [experiments, setExperiments] = useState<Experiment[]>([]);

  useEffect(() => {
    setProfile(getMockProfile());
    setExperiments(getMyExperiments());
  }, []);

  const firstName = profile.full_name.split(" ")[0] || "Researcher";
  const initials  = profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "R";
  const hasExp    = experiments.length > 0;

  const checklist = [
    { done: true,   label: "Create your account & verify ORCID" },
    { done: true,   label: "Set up your lab workspace" },
    { done: true,   label: "Add expertise tags for peer-matching" },
    { done: hasExp, label: "Upload your first experiment card" },
    { done: false,  label: "Ask or answer a Q&A question" },
    { done: false,  label: "Invite a colleague to your workspace" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-blue-600">SciCollab</Link>
            <div className="hidden sm:flex items-center gap-1">
              <Link href="/dashboard" className="text-sm text-slate-900 px-3 py-1.5 rounded-lg bg-slate-100 font-medium">Feed</Link>
              <Link href="/search"    className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">Search</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-sm">{initials}</div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl p-8 mb-8">
          <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 text-xs font-medium mb-4">🎉 Welcome to SciCollab</div>
          <h1 className="text-2xl font-bold mb-2">Welcome, {firstName}!</h1>
          <p className="text-blue-100 mb-6 text-sm max-w-lg">
            {hasExp ? `You have ${experiments.length} experiment card${experiments.length !== 1 ? "s" : ""} in the knowledge graph.`
                    : "Upload your first experiment, search the knowledge graph, or ask the community a question."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/experiments/new" className="bg-white text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors">Upload Experiment</Link>
            <Link href="/search" className="border border-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/10 transition-colors">Search Knowledge Graph</Link>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: "🧪", title: "New Experiment", desc: "Upload a method card",    href: "/experiments/new" },
            { icon: "🔍", title: "Search",          desc: "AI-grounded discovery",   href: "/search" },
            { icon: "🔁", title: "Fork Protocol",   desc: "Adapt existing methods",  href: "/search" },
            { icon: "💬", title: "Ask Peers",        desc: "Post a Q&A question",    href: "/search" },
          ].map((a) => (
            <Link key={a.title} href={a.href} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm hover:border-blue-200 transition-all block">
              <div className="text-2xl mb-2">{a.icon}</div>
              <div className="font-semibold text-slate-900 text-sm">{a.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{a.desc}</div>
            </Link>
          ))}
        </div>

        {/* My experiments */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2"><span>🧪</span> My Experiments</h2>
            <Link href="/experiments/new" className="text-xs text-blue-600 hover:underline font-medium">+ New experiment</Link>
          </div>

          {!hasExp ? (
            <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center">
              <div className="text-3xl mb-2">🧬</div>
              <p className="text-sm text-slate-500 mb-3">No experiments yet — upload your first method card</p>
              <Link href="/experiments/new" className="inline-block text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                Upload first experiment
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {experiments.map((exp) => (
                <Link key={exp.id} href={`/experiments/${exp.id}`}
                  className="flex items-center gap-3 border border-slate-100 rounded-xl px-4 py-3 hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${outcomeStyle(exp.outcome)}`}>{outcomeLabel(exp.outcome)}</span>
                      {exp.parent_id && <span className="text-xs text-slate-400">🔁 Fork</span>}
                      <span className="text-xs text-slate-400 ml-auto">{timeAgo(exp.created_at)}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-700 transition-colors">{exp.title}</p>
                    {exp.technique_tags?.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {exp.technique_tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Feed (sample) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span>📡</span> Research Feed
            <span className="text-xs font-normal text-slate-400 ml-1">— matching your expertise tags</span>
          </h2>
          <div className="space-y-4">
            {[
              { icon: "❓", author: "R. Mehta · Postdoc · MIT",  time: "2h ago",  content: "Same buffer but still losing signal above 100kDa — what am I missing?",                              linked: "Western Blot — Exp #2041", reactions: 12, answers: 3 },
              { icon: "📢", author: "Nguyen Lab · UCLA",           time: "5h ago",  content: "Negative result: 5× scale-up of organoid protocol v2 failed reproducibly. Full failure log uploaded.", linked: "Organoid Scale-up — Exp #1849", reactions: 23, answers: 0 },
              { icon: "🔗", author: "M. Osei · ETH Zurich",       time: "1d ago",  content: "Protocol updated: Seq library prep v3 validated across 4 tissue types. See Exp #3182.",              linked: "RNA-seq Library Prep v3", reactions: 8, answers: 0 },
            ].map((item, i) => (
              <div key={i} className="border border-slate-100 rounded-xl p-4 hover:border-slate-200 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium text-slate-700">{item.author}</span>
                      <span className="text-xs text-slate-400">{item.time}</span>
                    </div>
                    <p className="text-sm text-slate-800 mb-2">{item.content}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">📎 {item.linked}</span>
                      <span className="text-xs text-slate-400">{item.reactions} reactions</span>
                      {item.answers > 0 && <span className="text-xs text-emerald-600">{item.answers} answers</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link href="/search" className="text-sm text-blue-600 hover:underline">Search the full knowledge graph →</Link>
          </div>
        </div>

        {/* Checklist */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">🚀 Get the most out of SciCollab</h2>
          <div className="space-y-3">
            {checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? "bg-emerald-500" : "border-2 border-slate-200"}`}>
                  {item.done && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${item.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
