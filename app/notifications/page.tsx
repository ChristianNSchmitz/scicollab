"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  getNotificationsWithReadState, markNotificationRead, markAllNotificationsRead,
  type Notification,
} from "@/lib/mock-db";

const NOTIF_META: Record<Notification["type"], { icon: string; color: string }> = {
  match:                { icon: "🔬", color: "bg-blue-50 border-blue-200" },
  answer_request:       { icon: "❓", color: "bg-amber-50 border-amber-200" },
  fork:                 { icon: "🔁", color: "bg-purple-50 border-purple-200" },
  endorsement:          { icon: "✅", color: "bg-emerald-50 border-emerald-200" },
  version_update:       { icon: "🔄", color: "bg-slate-50 border-slate-200" },
  follow:               { icon: "👤", color: "bg-blue-50 border-blue-100" },
  citation:             { icon: "📝", color: "bg-teal-50 border-teal-200" },
  collaboration_invite: { icon: "🤝", color: "bg-indigo-50 border-indigo-200" },
  publication_like:     { icon: "❤️", color: "bg-red-50 border-red-200" },
  new_answer:           { icon: "💬", color: "bg-green-50 border-green-200" },
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const FILTERS = ["All", "Unread", "Experiments", "Q&A", "Social"] as const;
type Filter = typeof FILTERS[number];

function filterNotifs(notifs: Notification[], filter: Filter): Notification[] {
  if (filter === "Unread") return notifs.filter((n) => !n.is_read);
  if (filter === "Experiments") return notifs.filter((n) => ["match", "fork", "version_update"].includes(n.type));
  if (filter === "Q&A") return notifs.filter((n) => ["answer_request", "endorsement", "new_answer"].includes(n.type));
  if (filter === "Social") return notifs.filter((n) => ["follow", "citation", "collaboration_invite", "publication_like"].includes(n.type));
  return notifs;
}

export default function NotificationsPage() {
  const [notifs, setNotifs]   = useState<Notification[]>([]);
  const [filter, setFilter]   = useState<Filter>("All");
  const unread = notifs.filter((n) => !n.is_read).length;

  useEffect(() => {
    setNotifs(getNotificationsWithReadState());
    // Tell NavBar to refresh the unread badge as soon as this page opens
    window.dispatchEvent(new Event("sci-notif-read"));
  }, []);

  function handleMarkRead(id: string) {
    markNotificationRead(id);
    setNotifs(getNotificationsWithReadState());
    window.dispatchEvent(new Event("sci-notif-read"));
  }

  function handleMarkAll() {
    markAllNotificationsRead();
    setNotifs(getNotificationsWithReadState());
    window.dispatchEvent(new Event("sci-notif-read"));
  }

  function notifHref(n: Notification): string {
    if (n.linked_type === "experiment") return `/experiments/${n.linked_id}`;
    if (n.linked_type === "publication") return `/publications/${n.linked_id}`;
    if (n.linked_type === "question") return `/questions/${n.linked_id}`;
    if (n.linked_type === "profile") return `/profile/${n.linked_id}`;
    return "#";
  }

  const visible = filterNotifs(notifs, filter);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            {unread > 0 && (
              <p className="text-sm text-slate-500 mt-0.5">{unread} unread</p>
            )}
          </div>
          {unread > 0 && (
            <button onClick={handleMarkAll}
              className="text-sm text-blue-600 hover:underline font-medium">
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-colors ${
                filter === f ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}>
              {f}
              {f === "Unread" && unread > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5">{unread}</span>
              )}
            </button>
          ))}
        </div>

        {/* Notification list */}
        {visible.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <div className="text-4xl mb-3">🔔</div>
            <p className="font-semibold text-slate-800">All caught up!</p>
            <p className="text-sm text-slate-500 mt-1">No {filter !== "All" ? filter.toLowerCase() + " " : ""}notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((n) => {
              const meta = NOTIF_META[n.type] ?? { icon: "🔔", color: "bg-white border-slate-200" };
              return (
                <div key={n.id}
                  className={`relative rounded-xl border p-4 transition-all ${meta.color} ${!n.is_read ? "shadow-sm" : "opacity-80"}`}>
                  {!n.is_read && (
                    <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-500" />
                  )}
                  <div className="flex gap-3">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">{n.title}</p>
                      <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{n.body}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-slate-400">{timeAgo(n.created_at)}</span>
                        {n.linked_id && (
                          <Link href={notifHref(n)}
                            className="text-xs text-blue-600 hover:underline font-medium">
                            View →
                          </Link>
                        )}
                        {!n.is_read && (
                          <button onClick={() => handleMarkRead(n.id)}
                            className="text-xs text-slate-400 hover:text-slate-600">
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Engagement info */}
        <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-1 text-sm">Notification settings</h3>
          <p className="text-xs text-slate-500 mb-3">
            Notifications are pull-based, not push-spam — you only hear about what matters to your current work.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            {[
              ["🔬 New technique matches", "On"],
              ["❓ Questions on your cards", "On"],
              ["🔁 Forks of your protocols", "On"],
              ["✅ Answer endorsements", "On"],
              ["👤 New followers", "Digest"],
              ["🤝 Collaboration invites", "On"],
            ].map(([label, state]) => (
              <div key={label} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <span>{label}</span>
                <span className="text-emerald-600 font-medium">{state}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
