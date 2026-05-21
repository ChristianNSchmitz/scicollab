"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  getAuthorAnalytics, getMockProfile, getMyExperiments, getAllExperiments,
  getExperimentViews, getFollowers, getNotificationsWithReadState,
  getUserPublications, getCurrentUserId,
  type AuthorAnalytics, type AnalyticsSeries,
} from "@/lib/mock-db";

function Sparkline({ data }: { data: AnalyticsSeries }) {
  if (!data || data.length === 0) return null;
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const W = 300;
  const H = 80;
  const step = W / (data.length - 1);

  const points = data.map((d, i) => ({
    x: i * step,
    y: H - ((d.value - min) / range) * (H - 10) - 5,
  }));

  const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPoints = `0,${H} ${polylinePoints} ${W},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#sparkGrad)" />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AuthorAnalytics | null>(null);
  const [realData, setRealData] = useState<{
    myExps: ReturnType<typeof getMyExperiments>;
    totalViews: number;
    followersCount: number;
    pubCount: number;
    expViewData: { id: string; title: string; views: number }[];
    recentActivity: ReturnType<typeof getNotificationsWithReadState>;
  } | null>(null);

  useEffect(() => {
    const currentId = getCurrentUserId();
    const profile = getMockProfile();
    setAnalytics(getAuthorAnalytics(currentId));

    const myExps = [...getMyExperiments(), ...getAllExperiments().filter((e) => e.user_id === currentId)];
    const uniqueExps = Array.from(new Map(myExps.map((e) => [e.id, e])).values());
    const totalViews = uniqueExps.reduce((sum, e) => sum + getExperimentViews(e.id), 0);
    const followersCount = getFollowers().length;
    const pubs = getUserPublications(currentId);
    const pubCount = pubs.length || profile.publication_count;
    const expViewData = uniqueExps
      .map((e) => ({ id: e.id, title: e.title, views: getExperimentViews(e.id) }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 6);
    const recentActivity = getNotificationsWithReadState().slice(0, 10);

    setRealData({ myExps: uniqueExps, totalViews, followersCount, pubCount, expViewData, recentActivity });
  }, []);

  if (!analytics || !realData) return (
    <div className="min-h-screen bg-slate-50"><NavBar />
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const totalProfileViews     = analytics.profile_views.reduce((s, d) => s + d.value, 0);
  const totalPublicationViews = analytics.publication_views.reduce((s, d) => s + d.value, 0);
  const maxViews = Math.max(...realData.expViewData.map((e) => e.views), 1);

  const statCards = [
    { label: "My Experiments",    value: realData.myExps.length,    trend: null,    icon: "🔬" },
    { label: "Total Views",       value: realData.totalViews,        trend: "+8%",   icon: "👁" },
    { label: "Followers",         value: realData.followersCount,    trend: "+5%",   icon: "👥" },
    { label: "Publications",      value: realData.pubCount,          trend: null,    icon: "📄" },
  ];

  function notifIcon(type: string): string {
    if (type === "fork") return "🔁";
    if (type === "follow") return "👤";
    if (type === "citation") return "📈";
    if (type === "new_answer") return "💬";
    if (type === "endorsement") return "⭐";
    if (type === "match") return "🔍";
    return "🔔";
  }

  function timeAgo(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">📊 My Analytics</h1>
            <p className="text-sm text-slate-500 mt-0.5">Last 30 days</p>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
            ← Back to dashboard
          </Link>
        </div>

        {/* Real stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xl">{s.icon}</span>
                {s.trend && (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">{s.trend}</span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{s.value.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Profile views chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
          <h2 className="font-semibold text-slate-900 mb-4">Profile Views — Last 30 Days</h2>
          <Sparkline data={analytics.profile_views} />
          <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
            <span>{analytics.profile_views[0]?.date}</span>
            <span>{analytics.profile_views[analytics.profile_views.length - 1]?.date}</span>
          </div>
        </div>

        {/* Views per experiment bar chart */}
        {realData.expViewData.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
            <h2 className="font-semibold text-slate-900 mb-5">Views per Experiment</h2>
            <div className="space-y-3">
              {realData.expViewData.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <Link href={`/experiments/${e.id}`}
                    className="text-sm text-slate-700 hover:underline flex-shrink-0 w-48 truncate">
                    {e.title}
                  </Link>
                  <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.round((e.views / maxViews) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0 w-16 text-right">
                    👁 {e.views.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Forks",         value: analytics.total_forks,            icon: "🔁" },
            { label: "Total Citations",      value: analytics.total_citations,         icon: "📈" },
            { label: "Publication Views",    value: totalPublicationViews,            icon: "📄" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-2xl font-bold text-slate-900">{s.value.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Recent activity feed */}
        {realData.recentActivity.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
            <h2 className="font-semibold text-slate-900 mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {realData.recentActivity.map((n) => (
                <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl ${n.is_read ? "bg-slate-50" : "bg-blue-50 border border-blue-100"}`}>
                  <span className="text-lg flex-shrink-0 mt-0.5">{notifIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{n.body}</p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(n.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top experiments + publications */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Top Experiments</h2>
            {analytics.top_experiments.length === 0 ? (
              <p className="text-sm text-slate-400">No experiments yet.</p>
            ) : (
              <div className="space-y-4">
                {analytics.top_experiments.map((e, i) => (
                  <div key={e.id} className="flex items-start gap-3">
                    <span className="text-sm font-bold text-slate-400 mt-0.5 w-5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <Link href={`/experiments/${e.id}`} className="text-sm font-medium text-slate-800 hover:underline line-clamp-2">{e.title}</Link>
                      <div className="flex gap-3 mt-1 text-xs text-slate-400">
                        <span>👁 {e.views.toLocaleString()} views</span>
                        <span>🔁 {e.forks} forks</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Top Publications</h2>
            {analytics.top_publications.length === 0 ? (
              <p className="text-sm text-slate-400">No publications yet.</p>
            ) : (
              <div className="space-y-4">
                {analytics.top_publications.map((p, i) => (
                  <div key={p.id} className="flex items-start gap-3">
                    <span className="text-sm font-bold text-slate-400 mt-0.5 w-5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <Link href={`/publications/${p.id}`} className="text-sm font-medium text-slate-800 hover:underline line-clamp-2">{p.title}</Link>
                      <div className="flex gap-3 mt-1 text-xs text-slate-400">
                        <span>👁 {p.views.toLocaleString()} reads</span>
                        <span>📈 {p.citations} citations</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
