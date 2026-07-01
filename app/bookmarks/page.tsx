"use client";

import { timeAgo } from "@/lib/utils";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  getBookmarkedPosts, getProfile, toggleBookmarkFeedPost,
  getCurrentUserId, type FeedPost,
} from "@/lib/mock-db";
import { useToast } from "@/lib/toast";


const POST_TYPE_ICON: Record<FeedPost["type"], string> = {
  experiment:  "🔬",
  publication: "📄",
  question:    "❓",
  achievement: "🏆",
  post:        "💬",
};

export default function BookmarksPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setPosts(getBookmarkedPosts());
  }, []);

  function handleUnbookmark(postId: string) {
    toggleBookmarkFeedPost(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    toast("Removed from bookmarks", "info");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">🔖 Saved Posts</h1>
          <span className="text-sm text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
            {posts.length}
          </span>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <p className="text-4xl mb-3">📎</p>
            <p className="font-semibold text-slate-800 mb-2">Nothing bookmarked yet</p>
            <p className="text-sm text-slate-500 mb-6">Save experiments, publications and posts you want to revisit.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/experiments"
                className="inline-block bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
                Browse Experiments
              </Link>
              <Link href="/feed"
                className="inline-block border border-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                Explore Feed
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const author = getProfile(post.user_id);
              const hasLiked = post.liked_by.includes(getCurrentUserId());
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
                    <div className="flex items-center gap-1.5 text-xs px-3 py-2 text-slate-400">
                      {hasLiked ? "❤️" : "🤍"} {post.like_count}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs px-3 py-2 text-slate-400">
                      💬 {post.comment_count}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs px-3 py-2 text-slate-400">
                      🔁 {post.repost_count}
                    </div>
                    <button
                      onClick={() => handleUnbookmark(post.id)}
                      className="ml-auto flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-colors text-blue-600 bg-blue-50 hover:bg-red-50 hover:text-red-600"
                      title="Remove bookmark"
                    >
                      🔖 Remove
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
