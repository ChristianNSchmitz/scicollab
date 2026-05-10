import Link from "next/link";

export default async function ExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">SciCollab</Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-500">Experiments</span>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-mono text-slate-600">#{id.replace("exp-", "")}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors font-medium">
              🔁 Fork Protocol
            </button>
            <button className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors font-medium">
              💬 Ask a Question
            </button>
            <button className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors font-medium">
              ↗ Cite
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Success banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-start gap-3 mb-8">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="font-semibold text-emerald-800">Your method card is live in the knowledge graph!</p>
            <p className="text-sm text-emerald-700 mt-0.5">Peers with matching expertise tags have been notified. Co-authors credited. Card is now searchable and citable.</p>
          </div>
        </div>

        {/* Method Card */}
        <div className="bg-white border border-red-200 rounded-2xl overflow-hidden shadow-sm mb-6">
          {/* Header */}
          <div className="bg-red-50 border-b border-red-200 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full border border-red-300 bg-red-50 text-red-700">❌ Failed — documented</span>
                  <span className="text-xs font-mono text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 bg-white">v1.0</span>
                  <span className="text-xs text-slate-400">Exp #2042</span>
                  <span className="text-xs text-slate-400">· Just now</span>
                </div>
                <h1 className="text-xl font-bold text-slate-900 leading-snug">
                  Western Blot Optimisation — HEK293 Low Signal, pH 8.3 Buffer
                </h1>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-xs">J</div>
                    <span className="text-sm text-slate-600">Dr. Janmejay Singh · ESSEC Business School</span>
                  </div>
                  <span className="text-xs text-slate-300">|</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">🆔 ORCID verified</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>0 forks</span>
                  <span>·</span>
                  <span>0 citations</span>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 space-y-6">
            <CardSection title="Hypothesis">
              <p className="text-sm text-slate-700">
                Increasing transfer buffer pH from 8.3 to 8.6 should improve signal detection for high-molecular-weight proteins in HEK293 cell lysate western blot.
              </p>
            </CardSection>

            <CardSection title="Protocol / Methods">
              <div className="text-sm text-slate-700 space-y-1">
                <p>1. Prepared HEK293 cell lysate at 2mg/mL total protein (BCA assay).</p>
                <p>2. Ran 10% SDS-PAGE at 120V for 90 min. Transferred to PVDF membrane using wet transfer at 100V for 60 min.</p>
                <p>3. Transfer buffer: 25mM Tris, 192mM glycine, 20% methanol, pH 8.3.</p>
                <p>4. Blocked with 5% non-fat milk in TBST for 1h at RT.</p>
                <p>5. Primary antibody overnight at 4°C. Secondary HRP-conjugated, 1h RT.</p>
                <p>6. ECL detection — signal in low-MW range but absent above 100kDa.</p>
              </div>
            </CardSection>

            <CardSection title="Key Conditions">
              <div className="font-mono text-xs bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 grid grid-cols-2 gap-x-6 gap-y-1">
                {[
                  ["pH", "8.3"],
                  ["Transfer buffer", "25mM Tris / 192mM glycine / 20% MeOH"],
                  ["Temperature", "4°C (overnight Ab incubation)"],
                  ["Cell line", "HEK293"],
                  ["Total protein", "2mg/mL"],
                  ["Transfer time", "60 min at 100V"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-slate-400 flex-shrink-0">{k}:</span>
                    <span className="text-slate-700 font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </CardSection>

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
                    {[
                      ["Anti-GAPDH antibody", "1:1000", "Cell Signaling #2118"],
                      ["HRP secondary Ab", "1:5000", "Abcam ab205718"],
                      ["Non-fat milk", "5% in TBST", "—"],
                      ["PVDF membrane", "0.45μm", "Millipore IPVH00010"],
                    ].map(([name, conc, supplier]) => (
                      <tr key={name}>
                        <td className="py-2 pr-4 font-medium text-slate-800">{name}</td>
                        <td className="py-2 pr-4 text-slate-600">{conc}</td>
                        <td className="py-2 text-slate-500">{supplier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardSection>

            <CardSection title="Results Summary">
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-sm text-slate-700">
                  Signal detected only below 75kDa. Proteins above 100kDa consistently absent from membrane. Replicated across 3 attempts with same outcome. Signal intensity in low-MW range was adequate (2× background), suggesting transfer buffer issue specific to high-MW proteins.
                </p>
              </div>
            </CardSection>

            <CardSection title="Failure Context & Troubleshooting">
              <p className="text-sm text-slate-700 mb-3">
                Tried increasing transfer time to 90 min — no improvement. Switched from wet to semi-dry transfer at 25V for 30 min — actually worse. Checked gel integrity post-transfer (Coomassie stain) — high-MW bands visible in gel, confirming transfer failure, not loading issue. Buffer pH confirmed with calibrated meter immediately before use.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Suspected root cause:</span>
                <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">Buffer concentration error</span>
              </div>
            </CardSection>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
              {["Western Blot"].map((t) => (
                <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 border border-blue-100">{t}</span>
              ))}
              {["Human (HEK293)"].map((t) => (
                <span key={t} className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1 border border-emerald-100">{t}</span>
              ))}
            </div>

            {/* Files */}
            <div className="flex items-center gap-4 pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>📎 blot_scan_attempt3.tiff · 4.2MB</span>
              <span>📊 raw_signal_data.csv · 128KB</span>
              <span>📓 analysis_notebook.ipynb · 1.1MB</span>
            </div>

            {/* Visibility */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-400">🌐 Public · SciCollab Knowledge Graph</span>
              <span className="text-xs text-slate-400">DOI pending · Version 1.0</span>
            </div>
          </div>
        </div>

        {/* Q&A section stub */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <span>💬</span> Peer Q&A
          </h2>
          <p className="text-sm text-slate-500 mb-4">Questions anchored to this experiment · Answered by matched experts</p>
          <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center">
            <p className="text-sm text-slate-500 mb-3">No questions yet — be the first to ask or answer</p>
            <button className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Ask a question about this experiment
            </button>
          </div>
        </div>

        {/* Next action prompts */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: "🔁", title: "Fork this protocol", desc: "Adapt it for your lab conditions", href: "#" },
            { icon: "🔍", title: "Find similar experiments", desc: "AI-matched method cards", href: "#" },
            { icon: "⬆️", title: "Upload next experiment", desc: "Keep the knowledge loop going", href: "/experiments/new" },
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
