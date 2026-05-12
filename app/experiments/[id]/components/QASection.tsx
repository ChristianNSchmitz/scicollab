"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = { full_name: string | null; institution: string | null } | null;

type Answer = {
  id: string;
  body: string;
  created_at: string;
  is_endorsed: boolean;
  user_id: string;
  profiles: Profile | Profile[];
};

type Question = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: Profile | Profile[];
  answers: Answer[];
};

type Props = {
  experimentId: string;
  experimentOwnerId: string;
  currentUserId: string | null;
  currentUserProfileId: string | null;
  initialQuestions: Question[];
};

function getProfile(p: Profile | Profile[] | undefined): { full_name: string | null; institution: string | null } | null {
  if (!p) return null;
  if (Array.isArray(p)) return p[0] ?? null;
  return p;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function QASection({
  experimentId,
  experimentOwnerId,
  currentUserId,
  currentUserProfileId,
  initialQuestions,
}: Props) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [questionBody, setQuestionBody] = useState("");
  const [postingQuestion, setPostingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const [answerBodies, setAnswerBodies] = useState<Record<string, string>>({});
  const [postingAnswer, setPostingAnswer] = useState<string | null>(null);
  const [openAnswerForms, setOpenAnswerForms] = useState<Set<string>>(new Set());

  async function submitQuestion() {
    if (!questionBody.trim()) return;
    if (!currentUserId || !currentUserProfileId) {
      setQuestionError("You must be signed in to ask a question.");
      return;
    }
    setQuestionError("");
    setPostingQuestion(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("questions")
      .insert({ experiment_id: experimentId, user_id: currentUserProfileId, body: questionBody.trim() })
      .select("id, body, created_at, user_id, profiles(full_name, institution)")
      .single();

    if (error) {
      setQuestionError(error.message);
    } else {
      setQuestions((prev) => [...prev, { ...data, answers: [] } as unknown as Question]);
      setQuestionBody("");
    }
    setPostingQuestion(false);
  }

  async function submitAnswer(questionId: string) {
    const body = answerBodies[questionId]?.trim();
    if (!body || !currentUserId || !currentUserProfileId) return;
    setPostingAnswer(questionId);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("answers")
      .insert({ question_id: questionId, user_id: currentUserProfileId, body })
      .select("id, body, created_at, is_endorsed, user_id, profiles(full_name, institution)")
      .single();

    if (!error && data) {
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId ? { ...q, answers: [...q.answers, data as unknown as Answer] } : q
        )
      );
      setAnswerBodies((prev) => ({ ...prev, [questionId]: "" }));
      setOpenAnswerForms((prev) => { const s = new Set(prev); s.delete(questionId); return s; });
    }
    setPostingAnswer(null);
  }

  async function endorseAnswer(questionId: string, answerId: string) {
    if (currentUserId !== experimentOwnerId) return;
    const supabase = createClient();
    await supabase
      .from("answers")
      .update({ is_endorsed: true, endorsed_by: currentUserProfileId })
      .eq("id", answerId);

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, answers: q.answers.map((a) => a.id === answerId ? { ...a, is_endorsed: true } : a) }
          : q
      )
    );
  }

  function toggleAnswerForm(questionId: string) {
    setOpenAnswerForms((prev) => {
      const s = new Set(prev);
      if (s.has(questionId)) s.delete(questionId);
      else s.add(questionId);
      return s;
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
      <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
        <span>💬</span> Peer Q&A
        <span className="text-xs font-normal text-slate-400 ml-1">— grounded in this experiment</span>
      </h2>
      <p className="text-xs text-slate-400 mb-5">Questions anchored to this card · Notifies matched experts</p>

      {/* Existing questions */}
      {questions.length > 0 && (
        <div className="space-y-5 mb-6">
          {questions.map((q) => (
            <div key={q.id} className="border border-slate-100 rounded-xl overflow-hidden">
              {/* Question */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-medium text-slate-700">
                    ❓ {getProfile(q.profiles)?.full_name ?? "Researcher"}
                    {getProfile(q.profiles)?.institution ? ` · ${getProfile(q.profiles)?.institution}` : ""}
                  </span>
                  <span className="text-xs text-slate-400">{timeAgo(q.created_at)}</span>
                  <span className="text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 border border-blue-100 ml-auto">
                    📎 Exp #{experimentId.slice(0, 8)}
                  </span>
                </div>
                <p className="text-sm text-slate-800 font-medium">{q.body}</p>
              </div>

              {/* Answers */}
              {q.answers.map((a) => (
                <div key={a.id} className="px-4 py-3 border-b border-slate-100 last:border-0 bg-white">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {a.is_endorsed && (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">✅ Best answer</span>
                        )}
                        <span className="text-xs font-medium text-slate-700">
                          {getProfile(a.profiles)?.full_name ?? "Researcher"}
                          {getProfile(a.profiles)?.institution ? ` · ${getProfile(a.profiles)?.institution}` : ""}
                        </span>
                        <span className="text-xs text-slate-400">{timeAgo(a.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-700">{a.body}</p>
                    </div>
                    {currentUserId === experimentOwnerId && !a.is_endorsed && (
                      <button
                        onClick={() => endorseAnswer(q.id, a.id)}
                        className="flex-shrink-0 text-xs text-slate-400 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 rounded-lg px-2 py-1 transition-colors"
                      >
                        Endorse
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Answer form toggle */}
              {currentUserId && (
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                  {openAnswerForms.has(q.id) ? (
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        placeholder="Write your answer…"
                        value={answerBodies[q.id] ?? ""}
                        onChange={(e) => setAnswerBodies((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => submitAnswer(q.id)}
                          disabled={postingAnswer === q.id || !answerBodies[q.id]?.trim()}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {postingAnswer === q.id ? "…" : "Post"}
                        </button>
                        <button
                          onClick={() => toggleAnswerForm(q.id)}
                          className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleAnswerForm(q.id)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      + Post an answer
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ask a question */}
      {currentUserId ? (
        <div className="border border-dashed border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-600 mb-2">Ask a question about this experiment</p>
          <textarea
            rows={3}
            placeholder={"\"Same buffer but still losing signal above 100kDa — what am I missing?\""}
            value={questionBody}
            onChange={(e) => { setQuestionBody(e.target.value); setQuestionError(""); }}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 resize-none mb-2"
          />
          {questionError && <p className="text-xs text-red-500 mb-2">{questionError}</p>}
          <button
            onClick={submitQuestion}
            disabled={postingQuestion || !questionBody.trim()}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {postingQuestion && (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Ask question
          </button>
        </div>
      ) : (
        <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center">
          <p className="text-sm text-slate-500 mb-3">Sign in to ask or answer questions</p>
          <a href="/login" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
            Sign in
          </a>
        </div>
      )}
    </div>
  );
}
