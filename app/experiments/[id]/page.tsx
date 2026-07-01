"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  getExperiment, getProfile, getQuestions, getMockProfile, MOCK_USER_ID,
  updateExperiment, incrementExperimentView, getExperimentViews,
  getCurrentUserId,
  type Experiment, type Question,
} from "@/lib/mock-db";
import { getExperimentFromDb, deleteExperimentFromDb } from "@/app/actions/experiments";
import { createClient } from "@/lib/supabase/client";
import QASection      from "./components/QASection";
import ForkButton     from "./components/ForkButton";
import VersionTree    from "./components/VersionTree";
import CiteModal      from "./components/CiteModal";
import CommentSection from "@/components/CommentSection";
import ReportModal    from "@/components/ReportModal";

/* ── helpers ── */
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const outcomeConfig = {
  success: { border: "border-emerald-200", bg: "bg-emerald-50", badge: "border-emerald-300 bg-emerald-50 text-emerald-700", label: "✅ Success" },
  partial:  { border: "border-amber-200",   bg: "bg-amber-50",   badge: "border-amber-300 bg-amber-50 text-amber-700",       label: "⚠️ Partial" },
  failed:   { border: "border-red-200",     bg: "bg-red-50",     badge: "border-red-300 bg-red-50 text-red-700",             label: "❌ Failed — documented" },
};

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  );
}

/* ── inline edit field ── */
function EditField({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{label}</p>
      {multiline ? (
        <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full border border-blue-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 resize-none" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full border border-blue-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
      )}
    </div>
  );
}

/* ── main page ── */
export default function ExperimentPage() {
  const { id }      = useParams<{ id: string }>();
  const router      = useRouter();
  const searchParams = useSearchParams();
  const forked      = searchParams.get("forked");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [exp, setExp]           = useState<Experiment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [showCite, setShowCite] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [viewCount, setViewCount] = useState(0);

  // Edit mode state
  const [editing, setEditing]       = useState(false);
  const [editTitle, setEditTitle]   = useState("");
  const [editHypo, setEditHypo]     = useState("");
  const [editMethods, setEditMethods] = useState("");
  const [editConditions, setEditConditions] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editOutcome, setEditOutcome] = useState<"success" | "partial" | "failed" | "">("");
  const [editVersion, setEditVersion] = useState("");
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const dbExp = await getExperimentFromDb(id);
      const found = dbExp ?? getExperiment(id);
      if (!found) { setNotFound(true); return; }
      setExp(found as Experiment);
      setQuestions(getQuestions(id));
      incrementExperimentView(id);
      setViewCount(getExperimentViews(id) + 1);
    }
    load();
  }, [id]);

  function startEdit(e: Experiment) {
    setEditTitle(e.title);
    setEditHypo(e.hypothesis ?? "");
    setEditMethods(e.methods ?? "");
    setEditConditions(e.conditions ?? "");
    setEditSummary(e.outcome_summary ?? "");
    setEditOutcome(e.outcome ?? "");
    setEditVersion(e.protocol_version);
    setEditing(true);
  }

  async function handleDelete() {
    if (!exp) return;
    if (!confirm("Delete this experiment? This cannot be undone.")) return;
    setDeleting(true);
    await deleteExperimentFromDb(exp.id);
    router.push("/experiments");
  }

  function saveEdit() {
    if (!exp) return;
    setSaving(true);
    const updated = updateExperiment(exp.id, {
      title:           editTitle,
      hypothesis:      editHypo || null,
      methods:         editMethods || null,
      conditions:      editConditions || null,
      outcome_summary: editSummary || null,
      outcome:         (editOutcome || null) as Experiment["outcome"],
      protocol_version: editVersion,
    });
    if (updated) setExp(updated);
    setSaving(false);
    setEditing(false);
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-2">🔬</p>
          <p className="font-semibold text-slate-800 mb-1">Experiment not found</p>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  if (!exp) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentUser    = getMockProfile();
  const currentId      = getCurrentUserId();
  const isOwner        = exp.user_id === currentUserId || exp.user_id === currentId || exp.user_id === MOCK_USER_ID || exp.user_id === currentUser.id;
  const authorProfile  = getProfile(exp.user_id);
  const parentExp      = exp.parent_id ? getExperiment(exp.parent_id) : null;
  const oc             = exp.outcome ? outcomeConfig[exp.outcome] : outcomeConfig.success;
  const reagents       = Array.isArray(exp.reagents) ? exp.reagents : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      {showCite && <CiteModal experiment={exp} onClose={() => setShowCite(false)} />}
      {showReport && <ReportModal targetType="experiment" targetId={exp.id} onClose={() => setShowReport(false)} />}

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/dashboard" className="hover:text-slate-700">Experiments</Link>
          <span>/</span>
          <span className="font-mono text-slate-600">{id.slice(0, 8)}</span>
          {isOwner && (
            <span className="ml-auto flex items-center gap-2">
              {editing ? (
                <>
                  <button onClick={saveEdit} disabled={saving}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-60">
                    {saving ? "Saving…" : "💾 Save changes"}
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => startEdit(exp)}
                    className="text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-medium">
                    ✏️ Edit
                  </button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 font-medium disabled:opacity-60">
                    {deleting ? "Deleting…" : "🗑 Delete"}
                  </button>
                </>
              )}
            </span>
          )}
        </div>

        {/* Banners */}
        {forked === "true" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-start gap-3 mb-6">
            <span className="text-2xl">🔁</span>
            <div>
              <p className="font-semibold text-blue-800">Protocol forked — this is your editable copy</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Click <strong>Edit</strong> (top right) to adapt the parameters and record your outcome.
                {parentExp && <> Original: <Link href={`/experiments/${parentExp.id}`} className="underline">{parentExp.title}</Link></>}
              </p>
            </div>
          </div>
        )}

        {!forked && !exp.parent_id && isOwner && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-start gap-3 mb-8">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-semibold text-emerald-800">Your method card is live in the knowledge graph!</p>
              <p className="text-sm text-emerald-700 mt-0.5">Peers with matching expertise tags have been notified. Card is now searchable and citable.</p>
            </div>
          </div>
        )}

        {exp.parent_id && !forked && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 flex items-center gap-2 mb-6 text-sm text-blue-700">
            <span>🔁</span>
            <span>Fork of {parentExp
              ? <Link href={`/experiments/${parentExp.id}`} className="underline">{parentExp.title}</Link>
              : "a protocol"}
            </span>
          </div>
        )}

        {/* Edit-mode hint */}
        {editing && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-2 mb-6 text-sm text-amber-800">
            <span>✏️</span>
            <span>Edit mode — adapt parameters, conditions, and record your outcome. Changes are saved locally.</span>
          </div>
        )}

        {/* Method Card */}
        <div className={`bg-white border ${oc.border} rounded-2xl overflow-hidden shadow-sm mb-6`}>
          <div className={`${oc.bg} border-b ${oc.border} px-6 py-5`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {exp.outcome && !editing && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${oc.badge}`}>{oc.label}</span>
                  )}
                  {editing ? (
                    <select value={editOutcome} onChange={(e) => setEditOutcome(e.target.value as typeof editOutcome)}
                      className="text-xs border border-blue-300 rounded-lg px-2 py-1 outline-none">
                      <option value="">— No outcome yet —</option>
                      <option value="success">✅ Success</option>
                      <option value="partial">⚠️ Partial</option>
                      <option value="failed">❌ Failed</option>
                    </select>
                  ) : (
                    <span className="text-xs font-mono text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 bg-white">{exp.protocol_version}</span>
                  )}
                  <span className="text-xs text-slate-400">{timeAgo(exp.created_at)}</span>
                  {isOwner && <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">Your card</span>}
                </div>
                {editing ? (
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    className="text-xl font-bold text-slate-900 w-full border border-blue-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100" />
                ) : (
                  <h1 className="text-xl font-bold text-slate-900 leading-snug">{exp.title}</h1>
                )}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <Link href={`/profile/${exp.user_id}`} className="flex items-center gap-1.5 hover:opacity-80">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-xs">
                      {(authorProfile?.full_name ?? "?")[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm text-slate-600">
                      {authorProfile?.full_name ?? "Researcher"}{authorProfile?.institution ? ` · ${authorProfile.institution}` : ""}
                    </span>
                  </Link>
                  {authorProfile?.orcid_id && <span className="text-xs text-slate-500">🆔 ORCID verified</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <ForkButton experiment={exp} />
                <button onClick={() => setShowCite(true)}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors font-medium">
                  📝 Cite
                </button>
                <button onClick={() => setShowReport(true)}
                  className="text-xs text-slate-400 hover:text-slate-600 hover:underline">
                  ⚑ Report
                </button>
              </div>
            </div>

            {/* Version selector in edit mode */}
            {editing && (
              <div className="mt-3">
                <label className="text-xs text-slate-500 block mb-1">Protocol version</label>
                <input value={editVersion} onChange={(e) => setEditVersion(e.target.value)}
                  placeholder="e.g. v1.2"
                  className="text-xs font-mono border border-blue-300 rounded-lg px-2 py-1 outline-none w-24" />
              </div>
            )}
          </div>

          <div className="px-6 py-6 space-y-6">
            {editing ? (
              <>
                <EditField label="Hypothesis" value={editHypo} onChange={setEditHypo} multiline />
                <EditField label="Protocol / Methods" value={editMethods} onChange={setEditMethods} multiline />
                <EditField label="Key Conditions" value={editConditions} onChange={setEditConditions} multiline />
                <EditField label="Results Summary" value={editSummary} onChange={setEditSummary} multiline />
              </>
            ) : (
              <>
                {exp.hypothesis && <CardSection title="Hypothesis"><p className="text-sm text-slate-700">{exp.hypothesis}</p></CardSection>}
                {exp.methods    && <CardSection title="Protocol / Methods"><div className="text-sm text-slate-700 whitespace-pre-line">{exp.methods}</div></CardSection>}
                {exp.conditions && (
                  <CardSection title="Key Conditions">
                    <p className="font-mono text-xs bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 text-slate-700">{exp.conditions}</p>
                  </CardSection>
                )}
                {reagents.length > 0 && (
                  <CardSection title="Reagents">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-slate-200">
                          <th className="text-left py-2 pr-4 font-semibold text-slate-600">Reagent</th>
                          <th className="text-left py-2 pr-4 font-semibold text-slate-600">Concentration</th>
                          <th className="text-left py-2 font-semibold text-slate-600">Supplier</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {reagents.map((r, i) => (
                            <tr key={i}>
                              <td className="py-2 pr-4 font-medium text-slate-800">{r.name}</td>
                              <td className="py-2 pr-4 text-slate-600">{r.concentration || "—"}</td>
                              <td className="py-2 text-slate-500">{r.supplier || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardSection>
                )}
                {exp.outcome_summary && (
                  <CardSection title="Results Summary">
                    <div className={`${oc.bg} border ${oc.border} rounded-xl px-4 py-3`}>
                      <p className="text-sm text-slate-700">{exp.outcome_summary}</p>
                    </div>
                  </CardSection>
                )}
                {exp.failure_context && (
                  <CardSection title="Failure Context & Troubleshooting">
                    <p className="text-sm text-slate-700 mb-3">{exp.failure_context}</p>
                    {exp.root_cause && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Suspected root cause:</span>
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">{exp.root_cause}</span>
                      </div>
                    )}
                  </CardSection>
                )}
              </>
            )}

            {(exp.technique_tags?.length > 0 || exp.organism_tags?.length > 0) && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                {exp.technique_tags?.map((t) => <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 border border-blue-100">{t}</span>)}
                {exp.organism_tags?.map((t)  => <span key={t} className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1 border border-emerald-100">{t}</span>)}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                {exp.visibility === "public" ? "🌐 Public" : exp.visibility === "network" ? "🤝 Collaborator network" : "🔒 Lab only"}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">👁 {viewCount.toLocaleString()} views</span>
                <span className="text-xs text-slate-400">{exp.protocol_version}</span>
              </div>
            </div>

            {/* Real attachments */}
            {exp.attachments && exp.attachments.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Attached Files</p>
                <div className="space-y-2">
                  {exp.attachments.map((att, i) => {
                    const icon = att.type.startsWith("image/") ? "🖼️"
                      : att.name.endsWith(".pdf") ? "📋"
                      : att.name.endsWith(".csv") || att.name.endsWith(".tsv") ? "📄"
                      : att.name.endsWith(".zip") ? "📦"
                      : "📄";
                    const sizeStr = att.size < 1024 ? `${att.size} B`
                      : att.size < 1024 * 1024 ? `${(att.size / 1024).toFixed(1)} KB`
                      : `${(att.size / (1024 * 1024)).toFixed(1)} MB`;
                    return (
                      <a
                        key={i}
                        href={att.dataUrl}
                        download={att.name}
                        className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-lg">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{att.name}</p>
                          <p className="text-xs text-slate-400">{sizeStr}</p>
                        </div>
                        <span className="text-xs text-blue-600 font-medium flex-shrink-0">⬇ Download</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Version Tree */}
        <VersionTree experiment={exp} />

        {/* Q&A */}
        <QASection
          experimentId={id}
          experimentOwnerId={exp.user_id}
          initialQuestions={questions}
          onQuestionsChange={setQuestions}
        />

        {/* Comments */}
        <CommentSection targetType="experiment" targetId={exp.id} />

        {/* Next actions */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: "🔍", title: "Find similar experiments", desc: "AI-matched method cards",        href: `/search?q=${encodeURIComponent(exp.title)}` },
            { icon: "⬆️", title: "Upload next experiment",   desc: "Keep the knowledge loop going",  href: "/experiments/new" },
            { icon: "📊", title: "Back to dashboard",         desc: "View your research feed",         href: "/dashboard" },
          ].map((c) => (
            <Link key={c.title} href={c.href} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="text-2xl mb-2">{c.icon}</div>
              <div className="font-semibold text-slate-900 text-sm">{c.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{c.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
