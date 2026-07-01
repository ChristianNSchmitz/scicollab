"use client";

import { timeAgo } from "@/lib/utils";

import { useState } from "react";
import { saveQuestion, saveAnswer, endorseAnswer, getProfile, getMockProfile, getCurrentUserId, type Question } from "@/lib/mock-db";


type Props = {
  experimentId: string;
  experimentOwnerId: string;
  initialQuestions: Question[];
  onQuestionsChange: (q: Question[]) => void;
};

export default function QASection({ experimentId, experimentOwnerId, initialQuestions, onQuestionsChange }: Props) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [questionBody, setQuestionBody]   = useState("");
  const [answerBodies, setAnswerBodies]   = useState<Record<string, string>>({});
  const [openForms, setOpenForms]         = useState<Set<string>>(new Set());
  const [postingQ, setPostingQ]           = useState(false);
  const [postingA, setPostingA]           = useState<string | null>(null);

  const currentUser = getMockProfile();
  const isOwner = experimentOwnerId === getCurrentUserId() || experimentOwnerId === currentUser.id;

  function update(q: Question[]) { setQuestions(q); onQuestionsChange(q); }

  function submitQuestion() {
    if (!questionBody.trim()) return;
    setPostingQ(true);
    const q = saveQuestion(experimentId, questionBody.trim());
    update([q, ...questions]);
    setQuestionBody("");
    setPostingQ(false);
  }

  function submitAnswer(qId: string) {
    const body = answerBodies[qId]?.trim();
    if (!body) return;
    setPostingA(qId);
    const a = saveAnswer(qId, body);
    update(questions.map((q) => q.id === qId ? { ...q, answers: [...q.answers, a] } : q));
    setAnswerBodies((p) => ({ ...p, [qId]: "" }));
    setOpenForms((p) => { const s = new Set(p); s.delete(qId); return s; });
    setPostingA(null);
  }

  function doEndorse(qId: string, aId: string) {
    endorseAnswer(qId, aId);
    update(questions.map((q) => q.id === qId
      ? { ...q, answers: q.answers.map((a) => a.id === aId ? { ...a, is_endorsed: true } : a) }
      : q));
  }

  function toggleForm(qId: string) {
    setOpenForms((p) => { const s = new Set(p); s.has(qId) ? s.delete(qId) : s.add(qId); return s; });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
      <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
        <span>💬</span> Peer Q&A
        <span className="text-xs font-normal text-slate-400 ml-1">— grounded in this experiment</span>
      </h2>
      <p className="text-xs text-slate-400 mb-5">Questions anchored to this card · Notifies matched experts</p>

      {questions.length > 0 && (
        <div className="space-y-5 mb-6">
          {questions.map((q) => {
            const asker = getProfile(q.user_id);
            return (
              <div key={q.id} className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-medium text-slate-700">
                      ❓ {asker?.full_name ?? "You"}{asker?.institution ? ` · ${asker.institution}` : ""}
                    </span>
                    <span className="text-xs text-slate-400">{timeAgo(q.created_at)}</span>
                    <span className="text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 border border-blue-100 ml-auto">
                      📎 Exp #{experimentId.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 font-medium">{q.body}</p>
                </div>

                {q.answers.map((a) => {
                  const responder = getProfile(a.user_id);
                  return (
                    <div key={a.id} className="px-4 py-3 border-b border-slate-100 last:border-0 bg-white">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {a.is_endorsed && <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">✅ Best answer</span>}
                            <span className="text-xs font-medium text-slate-700">
                              {responder?.full_name ?? "You"}{responder?.institution ? ` · ${responder.institution}` : ""}
                            </span>
                            <span className="text-xs text-slate-400">{timeAgo(a.created_at)}</span>
                          </div>
                          <p className="text-sm text-slate-700">{a.body}</p>
                        </div>
                        {isOwner && !a.is_endorsed && (
                          <button onClick={() => doEndorse(q.id, a.id)}
                            className="flex-shrink-0 text-xs text-slate-400 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 rounded-lg px-2 py-1 transition-colors">
                            Endorse
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                  {openForms.has(q.id) ? (
                    <div className="flex gap-2">
                      <textarea rows={2} placeholder="Write your answer…"
                        value={answerBodies[q.id] ?? ""}
                        onChange={(e) => setAnswerBodies((p) => ({ ...p, [q.id]: e.target.value }))}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none" />
                      <div className="flex flex-col gap-1">
                        <button onClick={() => submitAnswer(q.id)} disabled={postingA === q.id || !answerBodies[q.id]?.trim()}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                          {postingA === q.id ? "…" : "Post"}
                        </button>
                        <button onClick={() => toggleForm(q.id)} className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => toggleForm(q.id)} className="text-xs text-blue-600 hover:underline">+ Post an answer</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="border border-dashed border-slate-200 rounded-xl p-4">
        <p className="text-xs font-medium text-slate-600 mb-2">Ask a question about this experiment</p>
        <textarea rows={3}
          placeholder={`"Same buffer but still losing signal above 100kDa — what am I missing?"`}
          value={questionBody}
          onChange={(e) => setQuestionBody(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 resize-none mb-2" />
        <button onClick={submitQuestion} disabled={postingQ || !questionBody.trim()}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50">
          Ask question
        </button>
      </div>
    </div>
  );
}
