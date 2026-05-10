import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-blue-600">SciCollab</Link>
            <div className="hidden sm:flex items-center gap-1">
              {["Feed", "Search", "My Experiments", "Q&A"].map((item) => (
                <button key={item} className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-sm">
              A
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Welcome banner */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl p-8 mb-8">
          <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 text-xs font-medium mb-4">
            🎉 Welcome to SciCollab
          </div>
          <h1 className="text-2xl font-bold mb-2">Your workspace is ready!</h1>
          <p className="text-blue-100 mb-6 text-sm max-w-lg">
            You&apos;re set up and ready to go. Upload your first experiment, search the knowledge graph, or ask the community a question.
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="bg-white text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors">
              Upload First Experiment
            </button>
            <button className="border border-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/10 transition-colors">
              Explore the Knowledge Graph
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: "🧪", title: "New Experiment", desc: "Upload a method card", color: "blue", coming: false },
            { icon: "🔍", title: "Search", desc: "AI-grounded discovery", color: "purple", coming: true },
            { icon: "💬", title: "Ask Peers", desc: "Post a Q&A question", color: "emerald", coming: true },
            { icon: "🔁", title: "Fork Protocol", desc: "Adapt existing methods", color: "amber", coming: true },
          ].map((action) => (
            <div
              key={action.title}
              className={`bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:shadow-sm transition-all relative ${action.coming ? "opacity-70" : ""}`}
            >
              <div className="text-2xl mb-2">{action.icon}</div>
              <div className="font-semibold text-slate-900 text-sm">{action.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{action.desc}</div>
              {action.coming && (
                <span className="absolute top-3 right-3 text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                  Coming soon
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Activity feed placeholder */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span>📡</span> Your Research Feed
            <span className="text-xs font-normal text-slate-400 ml-1">— matching your expertise tags</span>
          </h2>
          <div className="space-y-4">
            {[
              {
                type: "question",
                icon: "❓",
                author: "R. Mehta · Postdoc · MIT",
                time: "2h ago",
                content: "Same buffer but still losing signal above 100kDa — what am I missing?",
                linked: "Western Blot — Exp #2041",
                reactions: 12,
                answers: 3,
              },
              {
                type: "negative",
                icon: "📢",
                author: "Nguyen Lab · UCLA",
                time: "5h ago",
                content: "Negative result: 5× scale-up of organoid protocol v2 failed reproducibly. Full failure log uploaded.",
                linked: "Organoid Scale-up — Exp #1849",
                reactions: 23,
                answers: 0,
              },
              {
                type: "update",
                icon: "🔗",
                author: "M. Osei · ETH Zurich",
                time: "1d ago",
                content: "Protocol updated: Seq library prep v3 validated across 4 tissue types. See Exp #3182.",
                linked: "RNA-seq Library Prep v3",
                reactions: 8,
                answers: 0,
              },
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
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                        📎 {item.linked}
                      </span>
                      <span className="text-xs text-slate-400">{item.reactions} reactions</span>
                      {item.answers > 0 && (
                        <span className="text-xs text-emerald-600">{item.answers} answers</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <button className="text-sm text-blue-600 hover:underline">Load more from your network →</button>
          </div>
        </div>

        {/* Onboarding checklist */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">🚀 Get the most out of SciCollab</h2>
          <div className="space-y-3">
            {[
              { done: true, label: "Create your account & verify ORCID" },
              { done: true, label: "Set up your lab workspace" },
              { done: true, label: "Add expertise tags for peer-matching" },
              { done: false, label: "Upload your first experiment card" },
              { done: false, label: "Ask or answer a Q&A question" },
              { done: false, label: "Invite a colleague to your workspace" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.done ? "bg-emerald-500" : "border-2 border-slate-200"
                }`}>
                  {item.done && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${item.done ? "text-slate-400 line-through" : "text-slate-700"}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
