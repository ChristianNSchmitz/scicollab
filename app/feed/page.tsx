"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  getFeed, getProfile, toggleLikeFeedPost, toggleBookmarkFeedPost,
  saveFeedPost, updateFeedPost, deleteFeedPost, getMockProfile, getFollowing,
  getExperiment, getPublication, repostFeedPost, incrementFeedCommentCount,
  MOCK_USER_ID, type FeedPost,
} from "@/lib/mock-db";
import CommentSection from "@/components/CommentSection";
import { useToast } from "@/lib/toast";
import { FeedPostSkeleton } from "@/components/Skeleton";

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const POST_TYPE_ICON: Record<FeedPost["type"], string> = {
  experiment:  "🔬",
  publication: "📄",
  question:    "❓",
  achievement: "🏆",
  post:        "💬",
};

const FILTERS = ["All", "Following", "Experiments", "Publications", "Discussions", "✨ For You"] as const;
type Filter = typeof FILTERS[number];

// Deterministic hash for stable tie-breaking (replaces Math.random)
function stableNoise(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 1000) / 1000 - 0.5; // ±0.5 range, deterministic
}

function scorePost(post: FeedPost, following: string[], userSkills: string[]): number {
  let score = 0;

  // +3 if followed
  if (following.includes(post.user_id)) score += 3;

  // +1 per like, capped at 5
  score += Math.min(5, post.like_count);

  // +1 if recent (within 3 days)
  const ageDays = (Date.now() - new Date(post.created_at).getTime()) / 86400000;
  if (ageDays < 3) score += 1;

  // +2 if experiment techniques overlap with user skills
  if (post.type === "experiment" && post.linked_experiment_id) {
    const exp = getExperiment(post.linked_experiment_id);
    if (exp) {
      const overlap = exp.technique_tags.some((t) =>
        userSkills.some((s) => s.toLowerCase() === t.toLowerCase())
      );
      if (overlap) score += 2;
    }
  }

  // +2 if publication tags overlap with user skills
  if (post.type === "publication" && post.linked_publication_id) {
    const pub = getPublication(post.linked_publication_id);
    if (pub) {
      const overlap = pub.tags.some((t) =>
        userSkills.some((s) => s.toLowerCase() === t.toLowerCase())
      );
      if (overlap) score += 2;
    }
  }

  // Deterministic tie-breaking noise ±0.5 (stable across renders)
  score += stableNoise(post.id);

  return score;
}

export default function FeedPage() {
  const [feed, setFeed]         = useState<FeedPost[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<Filter>("All");
  const [newPost, setNewPost]   = useState("");
  const [posting, setPosting]   = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [following, setFollowing]    = useState<string[]>([]);
  const [userSkills, setUserSkills]  = useState<string[]>([]);
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [reposted, setReposted]         = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(10);
  // edit/delete own posts
  const [editingPostId, setEditingPostId]   = useState<string | null>(null);
  const [editContent, setEditContent]       = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const me = getMockProfile();
  const { toast } = useToast();

  useEffect(() => {
    setFeed(getFeed());
    setFollowing(getFollowing());
    const p = getMockProfile();
    setUserSkills([...(p.skills || []), ...(p.techniques || [])]);
    setLoading(false);
  }, []);

  function handleLike(id: string) {
    const updated = toggleLikeFeedPost(id);
    if (updated) setFeed((prev) => prev.map((p) => p.id === id ? updated : p));
  }

  function handleBookmark(id: string) {
    const updated = toggleBookmarkFeedPost(id);
    if (updated) {
      setFeed((prev) => prev.map((p) => p.id === id ? updated : p));
      if (updated.bookmarked_by.includes(MOCK_USER_ID)) {
        toast("Saved to bookmarks");
      } else {
        toast("Removed from bookmarks", "info");
      }
    }
  }

  function handleToggleComments(id: string) {
    setOpenComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleRepost(id: string) {
    if (reposted.has(id)) return;
    const newPost = repostFeedPost(id);
    if (newPost) {
      setFeed((prev) => [newPost, ...prev.map((p) => p.id === id ? { ...p, repost_count: p.repost_count + 1 } : p)]);
      setReposted((prev) => new Set(prev).add(id));
      toast("Reposted");
    }
  }

  function handleCommentPosted(postId: string) {
    incrementFeedCommentCount(postId);
    setFeed((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
  }

  function handleEditStart(post: FeedPost) {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setConfirmDeleteId(null);
  }

  function handleEditSave(postId: string) {
    if (!editContent.trim()) return;
    const updated = updateFeedPost(postId, editContent.trim());
    if (updated) {
      setFeed((prev) => prev.map((p) => p.id === postId ? updated : p));
      toast("Post updated");
    }
    setEditingPostId(null);
    setEditContent("");
  }

  function handleDeletePost(postId: string) {
    if (confirmDeleteId !== postId) {
      setConfirmDeleteId(postId);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    const ok = deleteFeedPost(postId);
    if (ok) {
      setFeed((prev) => prev.filter((p) => p.id !== postId));
      toast("Post deleted", "info");
    } else {
      toast("Seed posts cannot be deleted", "error");
    }
    setConfirmDeleteId(null);
  }

  function handlePost() {
    if (!newPost.trim()) return;
    setPosting(true);
    const post = saveFeedPost({
      user_id: MOCK_USER_ID,
      type: "post",
      content: newPost.trim(),
      linked_experiment_id: null,
      linked_publication_id: null,
      linked_question_id: null,
    });
    setFeed((prev) => [post, ...prev]);
    setNewPost("");
    setPosting(false);
    setShowCompose(false);
    toast("Posted to feed");
  }

  // Build scored posts for "For You" — memoised so rankings don't shuffle on re-render
  const scoredFeed = useMemo(() =>
    feed.map((p) => ({ post: p, score: scorePost(p, following, userSkills) })),
  [feed, following, userSkills]);

  function getVisible(): Array<{ post: FeedPost; score: number; recommended: boolean }> {
    if (filter === "✨ For You") {
      return [...scoredFeed]
        .sort((a, b) => b.score - a.score)
        .map(({ post, score }) => ({ post, score, recommended: score >= 5 }));
    }

    const filtered = feed.filter((p) => {
      if (filter === "Following") return following.includes(p.user_id) || p.user_id === MOCK_USER_ID;
      if (filter === "Experiments")  return p.type === "experiment";
      if (filter === "Publications") return p.type === "publication";
      if (filter === "Discussions")  return p.type === "post" || p.type === "question";
      return true;
    });

    return filtered.map((p) => ({ post: p, score: 0, recommended: false }));
  }

  const allVisible = getVisible();
  const visible = allVisible.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Compose */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm">
          {showCompose ? (
            <div>
              <textarea rows={4} value={newPost} onChange={(e) => setNewPost(e.target.value)}
                placeholder="Share a finding, ask a question, or announce something…"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 resize-none mb-3" autoFocus />
              <div className="flex items-center gap-2">
                <button onClick={handlePost} disabled={posting || !newPost.trim()}
                  className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {posting ? "Posting…" : "Post"}
                </button>
                <Link href="/experiments/new"
                  className="text-sm border border-slate-200 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50">
                  🔬 Upload experiment
                </Link>
                <Link href="/publications/new"
                  className="text-sm border border-slate-200 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50">
                  📄 Add paper
                </Link>
                <button onClick={() => { setShowCompose(false); setNewPost(""); }}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCompose(true)}
              className="flex items-center gap-3 w-full text-left">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${me.avatar_color || "bg-slate-600"}`}>
                {me.avatar_initials || "R"}
              </div>
              <span className="text-sm text-slate-400 bg-slate-50 rounded-xl px-4 py-2.5 flex-1 border border-slate-200">
                Share a finding, paper, or question…
              </span>
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-colors ${filter === f ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Feed posts */}
        {/* Skeleton while loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <FeedPostSkeleton key={i} />)}
          </div>
        )}

        {!loading && visible.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">📡</p>
            <p className="font-semibold text-slate-800">Nothing in this feed yet</p>
            <p className="text-sm text-slate-500 mt-1">Follow more researchers or switch to All.</p>
          </div>
        ) : !loading && (
          <div className="space-y-4">
            {visible.map(({ post, recommended }) => {
              const author     = getProfile(post.user_id);
              const hasLiked   = post.liked_by.includes(MOCK_USER_ID);
              const hasBookmarked = post.bookmarked_by.includes(MOCK_USER_ID);
              const isOwnPost  = post.user_id === MOCK_USER_ID;
              const isEditing  = editingPostId === post.id;
              return (
                <div key={post.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-colors">
                  {/* Author row */}
                  <div className="flex items-start gap-3 mb-3">
                    <Link href={`/profile/${post.user_id}`} className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${author?.avatar_color || "bg-slate-600"}`}>
                        {author?.avatar_initials || author?.full_name?.[0] || "?"}
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/profile/${post.user_id}`} className="font-semibold text-slate-900 text-sm hover:underline">
                          {author?.full_name ?? "Researcher"}
                        </Link>
                        {author?.is_verified && <span className="text-xs text-blue-600">✓</span>}
                        <span className="text-xs text-slate-400">{author?.institution}</span>
                        {recommended && (
                          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-medium">✨ Recommended</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        <span>{POST_TYPE_ICON[post.type]}</span>
                        <span>{post.type.charAt(0).toUpperCase() + post.type.slice(1)}</span>
                        <span>·</span>
                        <span>{timeAgo(post.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Own post controls — edit / delete */}
                  {isOwnPost && !isEditing && (
                    <div className="flex gap-2 mb-2">
                      <button onClick={() => handleEditStart(post)}
                        className="text-xs text-slate-400 hover:text-blue-600 transition-colors">✏️ Edit</button>
                      <button onClick={() => handleDeletePost(post.id)}
                        className={`text-xs transition-colors ${confirmDeleteId === post.id ? "text-red-600 font-semibold" : "text-slate-400 hover:text-red-500"}`}>
                        {confirmDeleteId === post.id ? "⚠️ Confirm delete?" : "🗑 Delete"}
                      </button>
                    </div>
                  )}

                  {/* Content — editable or display */}
                  {isEditing ? (
                    <div className="mb-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full border border-blue-400 rounded-xl px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-blue-50"
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleEditSave(post.id)}
                          disabled={!editContent.trim()}
                          className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                          Save
                        </button>
                        <button onClick={() => { setEditingPostId(null); setEditContent(""); }}
                          className="text-sm text-slate-500 px-4 py-1.5 hover:text-slate-700">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-800 leading-relaxed mb-3">{post.content}</p>
                  )}

                  {/* Linked experiment card */}
                  {post.linked_experiment_id && (() => {
                    const exp = getExperiment(post.linked_experiment_id);
                    return (
                      <Link href={`/experiments/${post.linked_experiment_id}`}
                        className="block border border-blue-200 bg-blue-50 rounded-xl px-4 py-3 mb-3 hover:border-blue-300 transition-colors">
                        <p className="text-xs text-blue-600 font-semibold mb-0.5">🔬 Linked Experiment</p>
                        <p className="text-sm text-slate-800 font-medium line-clamp-1">
                          {exp?.title ?? "View method card"} →
                        </p>
                        {exp && (
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {exp.technique_tags.slice(0, 3).map((t) => (
                              <span key={t} className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">{t}</span>
                            ))}
                            {exp.outcome && (
                              <span className={`text-xs rounded-full px-2 py-0.5 ${exp.outcome === "success" ? "bg-emerald-100 text-emerald-700" : exp.outcome === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                {exp.outcome === "success" ? "✅" : exp.outcome === "failed" ? "❌" : "⚠️"} {exp.outcome}
                              </span>
                            )}
                          </div>
                        )}
                      </Link>
                    );
                  })()}

                  {/* Linked publication card */}
                  {post.linked_publication_id && (() => {
                    const pub = getPublication(post.linked_publication_id);
                    const url = pub?.doi ? `https://doi.org/${pub.doi}` : pub?.arxiv_id ? `https://arxiv.org/abs/${pub.arxiv_id}` : null;
                    return (
                      <div className="border border-emerald-200 bg-emerald-50 rounded-xl px-4 py-3 mb-3">
                        <p className="text-xs text-emerald-600 font-semibold mb-0.5">📄 Linked Publication</p>
                        <Link href={`/publications/${post.linked_publication_id}`}
                          className="text-sm text-slate-800 font-medium line-clamp-2 hover:underline block mb-1.5">
                          {pub?.title ?? "View paper"} →
                        </Link>
                        {pub && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-emerald-700">{pub.journal || "arXiv"} · {pub.year}</span>
                            {url && (
                              <a href={url} target="_blank" rel="noopener noreferrer"
                                className="text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-700 font-medium">
                                Read →
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Action bar */}
                  <div className="flex items-center gap-1 pt-3 border-t border-slate-100">
                    <button onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-colors ${hasLiked ? "text-red-500 bg-red-50" : "text-slate-500 hover:bg-slate-50"}`}>
                      {hasLiked ? "❤️" : "🤍"} {post.like_count}
                    </button>
                    <button onClick={() => handleToggleComments(post.id)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-colors ${openComments.has(post.id) ? "text-blue-600 bg-blue-50" : "text-slate-500 hover:bg-slate-50"}`}>
                      💬 {post.comment_count}
                    </button>
                    <button
                      onClick={() => handleRepost(post.id)}
                      disabled={reposted.has(post.id)}
                      title={reposted.has(post.id) ? "Reposted" : "Repost"}
                      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-colors ${reposted.has(post.id) ? "text-emerald-600 bg-emerald-50" : "text-slate-500 hover:bg-slate-50"}`}>
                      🔁 {post.repost_count}
                    </button>
                    <button onClick={() => handleBookmark(post.id)}
                      className={`ml-auto flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-colors ${hasBookmarked ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:bg-slate-50"}`}>
                      {hasBookmarked ? "🔖" : "🏷️"}
                    </button>
                  </div>

                  {/* Inline comments */}
                  {openComments.has(post.id) && (
                    <CommentSection
                      targetType="feedpost"
                      targetId={post.id}
                      compact
                      onCommentAdded={() => handleCommentPosted(post.id)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {!loading && visibleCount < allVisible.length && (
          <div className="text-center mt-4">
            <button
              onClick={() => setVisibleCount((c) => c + 10)}
              className="text-sm text-slate-600 border border-slate-200 bg-white px-6 py-2.5 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors font-medium">
              Load more ({allVisible.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
