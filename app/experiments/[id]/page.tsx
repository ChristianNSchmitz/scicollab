import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QASection from "./components/QASection";
import ForkButton from "./components/ForkButton";

type Reagent = { name: string; concentration: string; supplier: string };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default async function ExperimentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ forked?: string }>;
}) {
  const { id } = await params;
  const { forked } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: exp } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", id)
    .single();

  if (!exp) notFound();

  const [{ data: authorProfile }, { data: parentExp }, { data: rawQuestions }, { data: forks }] =
    await Promise.all([
      supabase.from("profiles").select("full_name, institution, orcid_id").eq("id", exp.user_id).single(),
      exp.parent_id
        ? supabase.from("experiments").select("id, title").eq("id", exp.parent_id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("questions")
        .select("id, body, created_at, user_id, profiles(full_name, institution), answers(id, body, created_at, is_endorsed, user_id, endorsed_by, profiles(full_name, institution))")
        .eq("experiment_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("experiments")
        .select("id, title, created_at")
        .eq("parent_id", id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questions = (rawQuestions ?? []).map((q: any) => ({
    ...q,
    answers: Array.isArray(q.answers) ? q.answers : [],
  }));

  const isOwner = user?.id === exp.user_id;

  const outcomeConfig = {
    success: { border: "border-emerald-200", bg: "bg-emerald-50", badge: "border-emerald-300 bg-emerald-50 text-emerald-700", label: "✅ Success" },
    partial: { border: "border-amber-200", bg: "bg-amber-50", badge: "border-amber-300 bg-amber-50 text-amber-700", label: "⚠️ Partial" },
    failed: { border: "border-red-200", bg: "bg-red-50", badge: "border-red-300 bg-red-50 text-red-700", label: "❌ Failed — documented" },
  };
  const oc = exp.outcome ? outcomeConfig[exp.outcome as keyof typeof outcomeConfig] : outcomeConfig.success;

  const reagents: Reagent[] = Array.isArray(exp.reagents) ? exp.reagents as Reagent[] : [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">SciCollab</Link>
            <span className="text-slate-300">/</span>
            <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">Experiments</Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-mono text-slate-600">{id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-2">
            <ForkButton experiment={exp} currentUserId={user?.id ?? null} />
            <button className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors font-medium">
              ↗ Cite
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Banners */}
        {forked === "true" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-start gap-3 mb-6">
            <span className="text-2xl">🔁</span>
            <div>
              <p className="font-semibold text-blue-800">Protocol forked — this is your copy</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Adapt the parameters, run the experiment, and record your outcome.
                {parentExp && (
                  <> Original: <Link href={`/experiments/${parentExp.id}`} className="underline hover:text-blue-900">{parentExp.title}</Link></>
                )}
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
            <span>Fork of{" "}
              {parentExp
                ? <Link href={`/experiments/${parentExp.id}`} className="underline hover:text-blue-900">{parentExp.title}</Link>
                : "a protocol"}
            </span>
          </div>
        )}

        {/* Method Card */}
        <div className={`bg-white border ${oc.border} rounded-2xl overflow-hidden shadow-sm mb-6`}>
          <div className={`${oc.bg} border-b ${oc.border} px-6 py-5`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {exp.outcome && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${oc.badge}`}>{oc.label}</span>
                  )}
                  <span className="text-xs font-mono text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 bg-white">{exp.protocol_version}</span>
                  <span className="text-xs text-slate-400">{timeAgo(exp.created_at)}</span>
                  {isOwner && (
                    <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">Your card</span>
                  )}
                </div>
                <h1 className="text-xl font-bold text-slate-900 leading-snug">{exp.title}</h1>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-xs">
                      {(authorProfile?.full_name ?? "?")[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm text-slate-600">
                      {authorProfile?.full_name ?? "Researcher"}
                      {authorProfile?.institution ? ` · ${authorProfile.institution}` : ""}
                    </span>
                  </div>
                  {authorProfile?.orcid_id && (
                    <>
                      <span className="text-xs text-slate-300">|</span>
                      <span className="text-xs text-slate-500">🆔 ORCID verified</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0 text-xs text-slate-400">
                <span>{(forks ?? []).length} fork{forks?.length !== 1 ? "s" : ""}</span>
                <span>{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 space-y-6">
            {exp.hypothesis && (
              <CardSection title="Hypothesis">
                <p className="text-sm text-slate-700">{exp.hypothesis}</p>
              </CardSection>
            )}

            {exp.methods && (
              <CardSection title="Protocol / Methods">
                <div className="text-sm text-slate-700 whitespace-pre-line">{exp.methods}</div>
              </CardSection>
            )}

            {exp.conditions && (
              <CardSection title="Key Conditions">
                <p className="font-mono text-xs bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 text-slate-700">{exp.conditions}</p>
              </CardSection>
            )}

            {reagents.length > 0 && (
              <CardSection title="Reagents">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 pr-4 font-semibold text-slate-600">Reagent</th>
                        <th className="text-left py-2 pr-4 font-semibold text-slate-600">Concentration</th>
                        <th className="text-left py-2 font-semibold text-slate-600">Supplier</th>
                      </tr>
                    </thead>
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

            {(exp.technique_tags?.length > 0 || exp.organism_tags?.length > 0) && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                {(exp.technique_tags ?? []).map((t: string) => (
                  <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 border border-blue-100">{t}</span>
                ))}
                {(exp.organism_tags ?? []).map((t: string) => (
                  <span key={t} className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1 border border-emerald-100">{t}</span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
              <span className="text-xs text-slate-400">
                {exp.visibility === "public" ? "🌐 Public" : exp.visibility === "network" ? "🤝 Collaborator network" : "🔒 Lab only"}
              </span>
              <span className="text-xs text-slate-400">{exp.protocol_version}</span>
            </div>
          </div>
        </div>

        {/* Fork version tree */}
        {(forks ?? []).length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
            <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span>🌿</span> Protocol Version Tree
              <span className="text-xs font-normal text-slate-400 ml-1">— forks by the community</span>
            </h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600 pl-2 border-l-2 border-slate-200">
                <span className="text-xs font-mono text-slate-400">{exp.protocol_version}</span>
                <span className="font-medium">{exp.title}</span>
                <span className="text-xs text-slate-400">(this card)</span>
              </div>
              {(forks ?? []).map((f: { id: string; title: string; created_at: string }) => (
                <Link
                  key={f.id}
                  href={`/experiments/${f.id}`}
                  className="flex items-center gap-2 text-sm text-slate-600 pl-8 border-l-2 border-blue-100 ml-2 hover:text-blue-700 transition-colors"
                >
                  <span className="text-blue-400">↳</span>
                  <span>{f.title}</span>
                  <span className="text-xs text-slate-400">{timeAgo(f.created_at)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Q&A */}
        <QASection
          experimentId={id}
          experimentOwnerId={exp.user_id}
          currentUserId={user?.id ?? null}
          currentUserProfileId={user?.id ?? null}
          initialQuestions={questions}
        />

        {/* Next actions */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: "🔍", title: "Find similar experiments", desc: "AI-matched method cards", href: `/search?q=${encodeURIComponent(exp.title)}` },
            { icon: "⬆️", title: "Upload next experiment", desc: "Keep the knowledge loop going", href: "/experiments/new" },
            { icon: "📊", title: "Back to dashboard", desc: "View your research feed", href: "/dashboard" },
          ].map((card) => (
            <Link key={card.title} href={card.href} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="font-semibold text-slate-900 text-sm">{card.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{card.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  );
}
