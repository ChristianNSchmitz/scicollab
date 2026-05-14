"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  getStandaloneQuestion, getProfile, saveStandaloneAnswer, voteStandaloneQuestion,
  MOCK_USER_ID, type StandaloneQuestion, type StandaloneAnswer,
} from "@/lib/mock-db";

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [q, setQ]           = useState<StandaloneQuestion | null>(null);
  const [answerBody, setAnswerBody] = useState("");
  const [posting, setPosting]       = useState(false);
  const [voted, setVoted]           = useState(false);

  useEffect(() => { setQ(getStandaloneQuestion(id)); }, [id]);

  function handleAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!answerBody.trim() || !q) return;
    setPosting(true);
    const a = saveStandaloneAnswer(q.id, answerBody.trim());
    setQ((prev) => prev ? { ...prev, answers: [...prev.answers, a] } : prev);
    setAnswerBody("");
    setPosting(false);
  }

  function handleVote(delta: 1 | -1) {
    if (voted || !q) return;
    voteStandaloneQuestion(q.id, delta);
    setQ((prev) => prev ? { ...prev, vote_count: prev.vote_count + delta } : prev);
    setVoted(true);
  }

  if (!q) return (
    <div className="min-h-screen bg-slate-50"><NavBar />
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const asker = getProfile(q.user_id);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-4 gap-6">
          {/* Main */}
          <div className="md:col-span-3 space-y-6">
            {/* Question */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex gap-5">
                {/* Vote column */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleVote(1)} disabled={voted}
                    className={`w-9 h-9 flex items-center justify-center text-lg rounded-lg transition-colors ${voted ? "text-slate-300" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"}`}>
                    ▲
                  </button>
                  <span className="text-xl font-bold text-slate-900">{q.vote_count}</span>
                  <button onClick={() => handleVote(-1)} disabled={voted}
                    className={`w-9 h-9 flex items-center justify-center text-lg rounded-lg transition-colors ${voted ? "text-slate-300" : "text-slate-400 hover:text-red-500 hover:bg-red-50"}`}>
                    ▼
                  </button>
                  {q.is_answered && (
                    <div className="mt-2 w-9 h-9 bg-emerald-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">✓</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-slate-900 leading-snug mb-4">{q.title}</h1>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line mb-4">{q.body}</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {q.tags.map((t) => <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 border border-blue-100">{t}</span>)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 pt-3 border-t border-slate-100">
                    <span>{q.view_count} views</span>
                    <span>·</span>
                    <Link href={`/profile/${q.user_id}`} className="hover:underline">
                      {asker?.full_name ?? "Researcher"}
                    </Link>
                    {asker?.institution && <span>· {asker.institution}</span>}
                    <span>·</span>
                    <span>{timeAgo(q.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Answers */}
            {q.answers.length > 0 && (
              <div>
                <h2 className="font-semibold text-slate-900 mb-3">{q.answers.length} Answer{q.answers.length !== 1 ? "s" : ""}</h2>
                <div className="space-y-4">
                  {[...q.answers].sort((a, b) => (b.is_accepted ? 1 : 0) - (a.is_accepted ? 1 : 0) || b.vote_count - a.vote_count).map((a: StandaloneAnswer) => {
                    const responder = getProfile(a.user_id);
                    return (
                      <div key={a.id} className={`bg-white rounded-2xl p-5 border ${a.is_accepted ? "border-emerald-300 shadow-sm" : "border-slate-200"}`}>
                        {a.is_accepted && (
                          <div className="flex items-center gap-2 mb-3 text-emerald-700 text-xs font-semibold">
                            <span className="bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center">✓</span>
                            Accepted Answer
                          </div>
                        )}
                        <div className="flex gap-5">
                          {/* Vote */}
                          <div className="flex flex-col items-center gap-1 flex-shrink-0">
                            <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-sm">▲</button>
                            <span className="font-bold text-slate-900 text-sm">{a.vote_count}</span>
                            <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg text-sm">▼</button>
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line mb-3">{a.body}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <Link href={`/profile/${a.user_id}`} className="hover:underline font-medium text-slate-600">
                                {responder?.full_name ?? "Researcher"}
                              </Link>
                              {responder?.institution && <span>· {responder.institution}</span>}
                              <span>·</span>
                              <span>{timeAgo(a.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Answer form */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="font-semibold text-slate-900 mb-3">Your Answer</h2>
              {q.user_id === MOCK_USER_ID ? (
                <p className="text-sm text-slate-500 italic">You asked this question. You&apos;ll be notified when others answer.</p>
              ) : (
                <form onSubmit={handleAnswer}>
                  <textarea rows={6} value={answerBody} onChange={(e) => setAnswerBody(e.target.value)}
                    placeholder="Write a helpful, specific answer. Reference protocols, papers, or your own experience…"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 resize-none mb-3" />
                  <button type="submit" disabled={posting || !answerBody.trim()}
                    className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {posting ? "Posting…" : "Post Answer"}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm">
              <h3 className="font-semibold text-slate-900 mb-3">Question stats</h3>
              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between"><span>Votes</span><span className="font-semibold">{q.vote_count}</span></div>
                <div className="flex justify-between"><span>Answers</span><span className="font-semibold">{q.answers.length}</span></div>
                <div className="flex justify-between"><span>Views</span><span className="font-semibold">{q.view_count}</span></div>
                <div className="flex justify-between"><span>Status</span>
                  <span className={`font-semibold ${q.is_answered ? "text-emerald-600" : "text-amber-600"}`}>
                    {q.is_answered ? "Answered" : "Open"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-slate-900 text-sm mb-2">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {q.tags.map((t) => <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 border border-blue-100">{t}</span>)}
              </div>
            </div>

            <Link href="/questions" className="block text-center text-sm text-slate-500 hover:text-slate-700">
              ← All Questions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
