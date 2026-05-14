"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  getFeed, getProfile, toggleLikeFeedPost, toggleBookmarkFeedPost,
  saveFeedPost, getMockProfile, getFollowing, MOCK_USER_ID,
  type FeedPost,
} from "@/lib/mock-db";

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

const FILTERS = ["All", "Following", "Experiments", "Publications", "Discussions"] as const;
type Filter = typeof FILTERS[number];

export default function FeedPage() {
  const [feed, setFeed]         = useState<FeedPost[]>([]);
  const [filter, setFilter]     = useState<Filter>("All");
  const [newPost, setNewPost]   = useState("");
  const [posting, setPosting]   = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [following, setFollowing]    = useState<string[]>([]);
  const me = getMockProfile();

  useEffect(() => {
    setFeed(getFeed());
    setFollowing(getFollowing());
  }, []);

  function handleLike(id: string) {
    const updated = toggleLikeFeedPost(id);
    if (updated) setFeed((prev) => prev.map((p) => p.id === id ? updated : p));
  }

  function handleBookmark(id: string) {
    const updated = toggleBookmarkFeedPost(id);
    if (updated) setFeed((prev) => prev.map((p) => p.id === id ? updated : p));
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
  }

  const visible = feed.filter((p) => {
    if (filter === "Following") return following.includes(p.user_id) || p.user_id === MOCK_USER_ID;
    if (filter === "Experiments")  return p.type === "experiment";
    if (filter === "Publications") return p.type === "publication";
    if (filter === "Discussions")  return p.type === "post" || p.type === "question";
    return true;
  });

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
        {visible.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">📡</p>
            <p className="font-semibold text-slate-800">Nothing in this feed yet</p>
            <p className="text-sm text-slate-500 mt-1">Follow more researchers or switch to All.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((post) => {
              const author     = getProfile(post.user_id);
              const hasLiked   = post.liked_by.includes(MOCK_USER_ID);
              const hasBookmarked = post.bookmarked_by.includes(MOCK_USER_ID);
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
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        <span>{POST_TYPE_ICON[post.type]}</span>
                        <span>{post.type.charAt(0).toUpperCase() + post.type.slice(1)}</span>
                        <span>·</span>
                        <span>{timeAgo(post.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <p className="text-sm text-slate-800 leading-relaxed mb-3">{post.content}</p>

                  {/* Linked experiment card */}
                  {post.linked_experiment_id && (
                    <Link href={`/experiments/${post.linked_experiment_id}`}
                      className="block border border-blue-200 bg-blue-50 rounded-xl px-4 py-3 mb-3 hover:border-blue-300 transition-colors">
                      <p className="text-xs text-blue-600 font-semibold mb-0.5">🔬 Linked Experiment</p>
                      <p className="text-sm text-slate-800 font-medium">View method card →</p>
                    </Link>
                  )}

                  {/* Linked publication card */}
                  {post.linked_publication_id && (
                    <Link href={`/publications/${post.linked_publication_id}`}
                      className="block border border-emerald-200 bg-emerald-50 rounded-xl px-4 py-3 mb-3 hover:border-emerald-300 transition-colors">
                      <p className="text-xs text-emerald-600 font-semibold mb-0.5">📄 Linked Publication</p>
                      <p className="text-sm text-slate-800 font-medium">View paper →</p>
                    </Link>
                  )}

                  {/* Action bar */}
                  <div className="flex items-center gap-1 pt-3 border-t border-slate-100">
                    <button onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-colors ${hasLiked ? "text-red-500 bg-red-50" : "text-slate-500 hover:bg-slate-50"}`}>
                      {hasLiked ? "❤️" : "🤍"} {post.like_count}
                    </button>
                    <button className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-50 font-medium">
                      💬 {post.comment_count}
                    </button>
                    <button className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-50 font-medium">
                      🔁 {post.repost_count}
                    </button>
                    <button onClick={() => handleBookmark(post.id)}
                      className={`ml-auto flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-colors ${hasBookmarked ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:bg-slate-50"}`}>
                      {hasBookmarked ? "🔖" : "🏷️"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
