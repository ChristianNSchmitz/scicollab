"use client";

import { useState, useEffect } from "react";
import {
  getComments, addComment, deleteComment, getMockProfile, getProfile,
  getCurrentUserId, type Comment,
} from "@/lib/mock-db";
import ReportModal from "@/components/ReportModal";

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  targetType: "experiment" | "publication" | "feedpost" | "project";
  targetId: string;
  compact?: boolean;         // slimmer layout for inline feed use
  onCommentAdded?: () => void; // called after each successful comment/reply
}

interface CommentItemProps {
  comment: Comment;
  targetType: "experiment" | "publication" | "feedpost" | "project";
  onDelete: (id: string) => void;
  onReply: (parentId: string) => void;
  replyingTo: string | null;
  replyText: string;
  setReplyText: (v: string) => void;
  onSubmitReply: (parentId: string) => void;
}

function CommentItem({ comment, targetType, onDelete, onReply, replyingTo, replyText, setReplyText, onSubmitReply }: CommentItemProps) {
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const author = getProfile(comment.user_id);
  const isOwn = comment.user_id === getCurrentUserId();
  const initials = author?.avatar_initials || author?.full_name?.[0]?.toUpperCase() || "?";

  return (
    <div className="flex gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${author?.avatar_color || "bg-slate-500"}`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-slate-50 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-800">{author?.full_name ?? "Researcher"}</span>
              <span className="text-xs text-slate-400">{timeAgo(comment.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              {isOwn && (
                <button onClick={() => onDelete(comment.id)} className="text-xs text-red-400 hover:text-red-600" title="Delete">
                  🗑
                </button>
              )}
              <button onClick={() => setReportTarget(comment.id)} className="text-xs text-slate-300 hover:text-slate-500" title="Report">
                ⚑
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-700 break-words">{comment.body}</p>
        </div>
        <button onClick={() => onReply(comment.id)} className="text-xs text-slate-400 hover:text-blue-600 mt-1 ml-1">
          Reply
        </button>

        {replyingTo === comment.id && (
          <div className="mt-2 flex gap-2">
            <textarea
              rows={2}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
              autoFocus
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={() => onSubmitReply(comment.id)}
                disabled={!replyText.trim()}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Reply
              </button>
              <button onClick={() => onReply("")} className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {reportTarget && (
        <ReportModal
          targetType="comment"
          targetId={reportTarget}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}

export default function CommentSection({ targetType, targetId, compact = false, onCommentAdded }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newBody, setNewBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const me = getMockProfile();

  function refresh() {
    setComments(getComments(targetType, targetId));
  }

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId]);

  function handleAdd() {
    if (!newBody.trim()) return;
    addComment({ target_type: targetType, target_id: targetId, user_id: getCurrentUserId(), body: newBody.trim(), parent_id: null });
    setNewBody("");
    refresh();
    onCommentAdded?.();
  }

  function handleDelete(id: string) {
    deleteComment(id);
    refresh();
  }

  function handleReply(parentId: string) {
    setReplyingTo(parentId || null);
    setReplyText("");
  }

  function handleSubmitReply(parentId: string) {
    if (!replyText.trim()) return;
    addComment({ target_type: targetType, target_id: targetId, user_id: getCurrentUserId(), body: replyText.trim(), parent_id: parentId });
    setReplyingTo(null);
    setReplyText("");
    refresh();
    onCommentAdded?.();
  }

  const topLevel = comments.filter((c) => !c.parent_id);
  const replies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  return (
    <div className={compact ? "pt-3 border-t border-slate-100" : "mt-8 bg-white border border-slate-200 rounded-2xl p-6"}>
      {!compact && (
        <h2 className="font-semibold text-slate-900 mb-5 flex items-center gap-2">
          <span>💬</span> Discussion
          {comments.length > 0 && <span className="text-xs font-normal text-slate-400">({comments.length})</span>}
        </h2>
      )}

      {/* New comment */}
      <div className={`flex gap-3 ${compact ? "mb-3" : "mb-6"}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${me.avatar_color || "bg-slate-500"}`}>
          {me.avatar_initials || "R"}
        </div>
        <div className="flex-1">
          <textarea
            rows={compact ? 2 : 3}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Add a comment…"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleAdd}
              disabled={!newBody.trim()}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              Post comment
            </button>
          </div>
        </div>
      </div>

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {topLevel.map((comment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                targetType={targetType}
                onDelete={handleDelete}
                onReply={handleReply}
                replyingTo={replyingTo}
                replyText={replyText}
                setReplyText={setReplyText}
                onSubmitReply={handleSubmitReply}
              />
              {/* Replies */}
              {replies(comment.id).length > 0 && (
                <div className="ml-11 mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
                  {replies(comment.id).map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      targetType={targetType}
                      onDelete={handleDelete}
                      onReply={handleReply}
                      replyingTo={replyingTo}
                      replyText={replyText}
                      setReplyText={setReplyText}
                      onSubmitReply={handleSubmitReply}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
