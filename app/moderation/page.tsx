"use client";

import { timeAgo } from "@/lib/utils";

import { useState, useEffect } from "react";
import NavBar from "@/components/NavBar";
import { getReports, updateReportStatus, type Report } from "@/lib/mock-db";

type StatusFilter = "All" | "Pending" | "Reviewed" | "Dismissed";
const STATUS_FILTERS: StatusFilter[] = ["All", "Pending", "Reviewed", "Dismissed"];

function statusBadge(status: Report["status"]) {
  if (status === "pending")   return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "reviewed")  return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "dismissed") return "bg-slate-50 text-slate-500 border-slate-200";
  return "bg-slate-50 text-slate-500 border-slate-200";
}


export default function ModerationPage() {
  const [reports, setReports]       = useState<Report[]>([]);
  const [filter, setFilter]         = useState<StatusFilter>("All");

  useEffect(() => {
    setReports(getReports());
  }, []);

  function refresh() { setReports(getReports()); }

  function handleStatus(id: string, status: Report["status"]) {
    updateReportStatus(id, status);
    refresh();
  }

  const visible = reports.filter((r) => {
    if (filter === "All") return true;
    return r.status === filter.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">🛡️ Moderation Queue</h1>
          <p className="text-sm text-slate-500 mt-1">Review and action user-submitted reports.</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {STATUS_FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-sm px-4 py-2 rounded-full font-medium transition-colors ${filter === f ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}>
              {f}
              {f === "Pending" && reports.filter((r) => r.status === "pending").length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {reports.filter((r) => r.status === "pending").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Reports list */}
        {visible.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">✅</p>
            <p className="font-semibold text-slate-800">No reports in this queue</p>
            <p className="text-sm text-slate-500 mt-1">All clear!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((report) => (
              <div key={report.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusBadge(report.status)}`}>
                      {report.status}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-1 border border-slate-200">
                      {report.target_type}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
                      {report.reason}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(report.created_at)}</span>
                </div>

                <div className="space-y-1.5 mb-4">
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">Target ID:</span> {report.target_id}
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">Reporter:</span> Anonymous
                  </p>
                  {report.details && (
                    <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mt-2">
                      {report.details}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  {report.status !== "reviewed" && (
                    <button onClick={() => handleStatus(report.id, "reviewed")}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium">
                      🔍 Mark Reviewed
                    </button>
                  )}
                  {report.status !== "dismissed" && (
                    <button onClick={() => handleStatus(report.id, "dismissed")}
                      className="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-medium">
                      ✅ Dismiss
                    </button>
                  )}
                  {report.status !== "pending" && (
                    <button onClick={() => handleStatus(report.id, "pending")}
                      className="text-xs text-slate-400 hover:text-slate-600 text-xs ml-auto">
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
