"use client";

import { timeAgo, initialsOf } from "@/lib/utils";

import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  getNotificationsWithReadState, getUserPublications, getCurrentUserId,
  type Experiment, type Notification,
} from "@/lib/mock-db";
import { getMyExperimentsFromDb, getAllExperimentsFromDb, type DbExperiment } from "@/app/actions/experiments";
import { createClient } from "@/lib/supabase/client";


function outcomeIcon(o: Experiment["outcome"]) {
  if (o === "success") return "✅";
  if (o === "partial")  return "⚠️";
  if (o === "failed")   return "❌";
  return "⏳";
}

/** Card-shaped shimmer placeholder while Supabase data loads. */
function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4 animate-pulse">
          <div className="w-8 h-8 bg-slate-100 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-slate-100 rounded w-2/3" />
            <div className="h-2.5 bg-slate-100 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

const NOTIF_ICON: Record<Notification["type"], string> = {
  match: "🔬", answer_request: "❓", fork: "🔁", endorsement: "✅",
  version_update: "🔄", follow: "👤", citation: "📝",
  collaboration_invite: "🤝", publication_like: "❤️", new_answer: "💬",
};

export default function DashboardPage() {
  const [profile, setProfile] = useState({ full_name: "", avatar_initials: "R", institution: "", research_domain: "", profile_completeness: 0 });
  const [myExps, setMyExps]   = useState<DbExperiment[]>([]);
  const [recentExps, setRecentExps] = useState<DbExperiment[]>([]);
  const [notifs, setNotifs]   = useState<Notification[]>([]);
  const [unread, setUnread]   = useState(0);
  const [pubCount, setPubCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      const name = prof?.full_name || user.email || "Researcher";

      // Completeness from actual profile fields, not a magic number
      const checks = [!!prof?.full_name, !!prof?.institution, !!prof?.research_domain, !!prof?.orcid_id, (prof?.techniques?.length ?? 0) > 0];
      const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

      setProfile({
        full_name:            name,
        avatar_initials:      initialsOf(name),
        institution:          prof?.institution || "",
        research_domain:      prof?.research_domain || "",
        profile_completeness: completeness,
      });

      const [mine, all] = await Promise.all([
        getMyExperimentsFromDb(user.id).catch(() => [] as DbExperiment[]),
        getAllExperimentsFromDb().catch(() => [] as DbExperiment[]),
      ]);
      setMyExps(mine);
      setRecentExps(all.filter((e) => e.user_id !== user.id).slice(0, 4));
      setLoading(false);
    });
    const n = getNotificationsWithReadState();
    setNotifs(n.slice(0, 5));
    setUnread(n.filter((x) => !x.is_read).length);
    setPubCount(getUserPublications(getCurrentUserId()).length);
  }, []);

  const successCount = myExps.filter((e) => e.outcome === "success").length;
  const hasProfile = profile.profile_completeness >= 60;

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-8 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold bg-white/20 border border-white/30">
                {profile.avatar_initials}
              </div>
              <div>
                <h1 className="text-xl font-bold">Welcome back, {profile.full_name || "Researcher"} 👋</h1>
                <p className="text-blue-100 text-sm mt-0.5">
                  {profile.institution || "Complete your profile to get started"}
                  {profile.research_domain ? ` · ${profile.research_domain}` : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/experiments/new" className="bg-white text-blue-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors text-center">+ Upload</Link>
              <Link href="/feed" className="bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-400 border border-blue-400 transition-colors text-center">Feed →</Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { icon: "🔬", label: "My Experiments", value: myExps.length,   href: "/experiments" },
            { icon: "✅", label: "Successful",      value: successCount,    href: "/experiments" },
            { icon: "📄", label: "Publications",    value: pubCount,        href: "/publications" },
            { icon: "🔔", label: "Unread",          value: unread,          href: "/notifications" },
          ].map((s) => (
            <Link key={s.label} href={s.href} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all text-center">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-2xl font-bold text-slate-900">{loading ? "–" : s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </Link>
          ))}
        </div>

        {/* Mobile quick access — icon row visible below lg */}
        <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {[
            ["🏠", "Feed",        "/feed"],
            ["🔍", "Search",      "/search"],
            ["💬", "Q&A",         "/questions"],
            ["📄", "Papers",      "/publications"],
            ["🌐", "Discover",    "/discover"],
            ["✉️", "Messages",   "/messages"],
            ["📊", "Analytics",  "/analytics"],
            ["⚙️", "Settings",   "/settings"],
          ].map(([icon, label, href]) => (
            <Link key={href} href={href}
              className="flex flex-col items-center gap-1 flex-shrink-0 bg-white border border-slate-200 rounded-xl px-3 py-2 hover:border-blue-200 transition-colors text-center">
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-xs text-slate-500 whitespace-nowrap">{label}</span>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">My Experiments</h2>
              <Link href="/experiments/new" className="text-sm text-blue-600 hover:underline">+ New</Link>
            </div>
            {loading ? (
              <CardSkeleton rows={3} />
            ) : myExps.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center">
                <div className="text-4xl mb-3">🔬</div>
                <p className="font-semibold text-slate-800 mb-1">No experiments yet</p>
                <p className="text-sm text-slate-500 mb-4 max-w-xs mx-auto">Upload your first protocol, successful or failed — every result helps the community</p>
                <Link href="/experiments/new" className="inline-block bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 mb-3">
                  Upload first experiment →
                </Link>
                <p className="text-sm text-slate-400">
                  or{" "}
                  <Link href="/experiments" className="text-blue-600 hover:underline">explore community experiments →</Link>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myExps.map((exp) => (
                  <Link key={exp.id} href={`/experiments/${exp.id}`}
                    className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-blue-200 hover:shadow-sm transition-all">
                    <span className="text-2xl">{outcomeIcon(exp.outcome)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{exp.title}</p>
                      <p className="text-xs text-slate-400">{exp.protocol_version} · {timeAgo(exp.created_at)}</p>
                    </div>
                    <div className="hidden sm:flex gap-1">
                      {exp.technique_tags.slice(0, 2).map((t) => <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">{t}</span>)}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {recentExps.length > 0 && (
              <>
                <div className="flex items-center justify-between mt-2">
                  <h2 className="font-bold text-slate-900">Recent from Community</h2>
                  <Link href="/search" className="text-sm text-blue-600 hover:underline">Search all →</Link>
                </div>
                <div className="space-y-3">
                  {recentExps.map((exp) => (
                    <Link key={exp.id} href={`/experiments/${exp.id}`}
                      className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-blue-200 hover:shadow-sm transition-all">
                      <span className="text-2xl">{outcomeIcon(exp.outcome)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{exp.title}</p>
                        <p className="text-xs text-slate-400">{timeAgo(exp.created_at)}</p>
                      </div>
                      <div className="hidden sm:flex gap-1">
                        {exp.technique_tags.slice(0, 1).map((t) => <span key={t} className="text-xs bg-slate-50 text-slate-600 rounded-full px-2 py-0.5 border border-slate-200">{t}</span>)}
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
            {!hasProfile && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-semibold text-amber-800 text-sm mb-1">Complete your profile</h3>
                <div className="h-1.5 bg-amber-200 rounded-full mb-2 mt-2">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${profile.profile_completeness}%` }} />
                </div>
                <p className="text-xs text-amber-700 mb-3">{profile.profile_completeness}% complete</p>
                <Link href="/settings" className="block w-full bg-amber-500 text-white text-sm font-semibold py-2 rounded-xl hover:bg-amber-600 text-center">
                  Complete profile →
                </Link>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
                {unread > 0 && <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5">{unread}</span>}
              </div>
              {notifs.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-2xl mb-1.5">🔕</p>
                  <p className="text-xs text-slate-500 leading-relaxed">No notifications yet.<br />They&apos;ll appear when peers interact with your work.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {notifs.slice(0, 4).map((n) => (
                      <div key={n.id} className={`flex items-start gap-2 p-2 rounded-lg ${!n.is_read ? "bg-blue-50" : ""}`}>
                        <span className="text-base flex-shrink-0">{NOTIF_ICON[n.type] ?? "🔔"}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 leading-snug">{n.title}</p>
                          <p className="text-xs text-slate-500 line-clamp-1">{n.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link href="/notifications" className="block text-center text-xs text-blue-600 hover:underline mt-3 font-medium">View all →</Link>
                </>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-slate-900 text-sm mb-3">Quick access</h3>
              <div className="space-y-1">
                {[
                  ["🏠", "Feed",          "/feed"],
                  ["🔍", "Search",         "/search"],
                  ["💬", "Q&A Forum",      "/questions"],
                  ["📄", "Publications",   "/publications"],
                  ["🌐", "Discover",       "/discover"],
                  ["✉️", "Messages",       "/messages"],
                  ["🏛️", "Lab Workspaces", "/labs"],
                  ["📊", "Analytics",      "/analytics"],
                  ["⚙️", "Settings",       "/settings"],
                  ["🛡️", "Moderation",    "/moderation"],
                ].map(([icon, label, href]) => (
                  <Link key={href} href={href} className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 hover:bg-slate-50 px-2 py-1.5 rounded-lg transition-colors">
                    <span>{icon}</span> {label}
                  </Link>
                ))}
              </div>
            </div>

            <Link href="/analytics"
              className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 hover:from-blue-100 hover:to-indigo-100 transition-colors">
              <span className="text-2xl">📊</span>
              <div>
                <p className="text-sm font-semibold text-blue-800">View Analytics</p>
                <p className="text-xs text-blue-600">Views, citations & forks</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
