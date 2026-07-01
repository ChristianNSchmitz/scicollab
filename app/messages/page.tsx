"use client";

import { timeAgo } from "@/lib/utils";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getConversations, getMessages, getProfile, sendMessage, startConversation, searchProfiles, getCurrentUserId, type Conversation, type Message, type Profile } from "@/lib/mock-db";
import { useToast } from "@/lib/toast";


function MessagesInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialConvId = searchParams.get("conv");

  const [convos, setConvos]         = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(initialConvId);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [draft, setDraft]           = useState("");
  const [sending, setSending]       = useState(false);
  const [readConvIds, setReadConvIds] = useState<Set<string>>(new Set());

  // New conversation state
  const [showNewConv, setShowNewConv]       = useState(false);
  const [newConvSearch, setNewConvSearch]   = useState("");
  const [newConvResults, setNewConvResults] = useState<Profile[]>([]);

  const { toast } = useToast();

  // Load read conversation IDs from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("scicollab_read_convs");
      if (raw) setReadConvIds(new Set(JSON.parse(raw) as string[]));
    } catch { /* ok */ }
  }, []);

  function markConvRead(convId: string) {
    setReadConvIds((prev) => {
      const next = new Set(prev);
      next.add(convId);
      try { localStorage.setItem("scicollab_read_convs", JSON.stringify(Array.from(next))); } catch { /* ok */ }
      return next;
    });
  }

  useEffect(() => {
    const c = getConversations();
    setConvos(c);
    if (!initialConvId && c.length > 0) {
      const firstId = c[0].id;
      setActiveConv(firstId);
      markConvRead(firstId);
    } else if (initialConvId) {
      markConvRead(initialConvId);
    }
  }, [initialConvId]);

  useEffect(() => {
    if (activeConv) setMessages(getMessages(activeConv));
  }, [activeConv]);

  useEffect(() => {
    if (newConvSearch.length >= 2) {
      setNewConvResults(searchProfiles(newConvSearch).filter((p) => p.id !== getCurrentUserId()));
    } else {
      setNewConvResults([]);
    }
  }, [newConvSearch]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeConv) return;
    setSending(true);
    const m = sendMessage(activeConv, draft.trim());
    setMessages((prev) => [...prev, m]);
    setDraft("");
    setSending(false);
  }

  function handleSelectConv(convId: string) {
    setActiveConv(convId);
    markConvRead(convId);
    router.replace("/messages?conv=" + convId, { scroll: false });
  }

  function handleStartConversation(userId: string) {
    const conv = startConversation(userId);
    const updated = getConversations();
    setConvos(updated);
    setActiveConv(conv.id);
    router.replace("/messages?conv=" + conv.id, { scroll: false });
    setShowNewConv(false);
    setNewConvSearch("");
    setNewConvResults([]);
    toast("Conversation started");
  }

  const active = convos.find((c) => c.id === activeConv);
  const otherUserId = active?.participant_ids.find((id) => id !== getCurrentUserId());
  const otherUser   = otherUserId ? getProfile(otherUserId) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ height: "calc(100vh - 120px)", minHeight: 500 }}>
          <div className="flex h-full">
            {/* Conversation list — hidden on mobile when a conv is active */}
            <div className={`${activeConv ? "hidden md:flex" : "flex"} w-full md:w-72 border-r border-slate-200 flex-col flex-shrink-0`}>
              <div className="px-4 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-slate-900">Messages</h2>
                  <button
                    onClick={() => { setShowNewConv((v) => !v); setNewConvSearch(""); setNewConvResults([]); }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    + New
                  </button>
                </div>
                {showNewConv && (
                  <div className="mt-3">
                    <input
                      autoFocus
                      value={newConvSearch}
                      onChange={(e) => setNewConvSearch(e.target.value)}
                      placeholder="Search researchers…"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    {newConvResults.length > 0 && (
                      <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden">
                        {newConvResults.slice(0, 5).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleStartConversation(p.id)}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 transition-colors"
                          >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${p.avatar_color || "bg-slate-600"}`}>
                              {p.avatar_initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate">{p.full_name}</p>
                              <p className="text-xs text-slate-400 truncate">{p.institution}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {convos.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <p className="text-3xl mb-2">✉️</p>
                    <p className="text-sm font-semibold text-slate-700 mb-1">No conversations yet</p>
                    <p className="text-xs text-slate-400 mb-3">Start a direct conversation with any researcher on the platform</p>
                    <Link href="/discover" className="text-xs text-blue-600 hover:underline block mb-2">Find researchers →</Link>
                    <Link href="/discover" className="block text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors font-medium">
                      Browse profiles
                    </Link>
                  </div>
                ) : convos.map((conv) => {
                  const otherId   = conv.participant_ids.find((id) => id !== getCurrentUserId());
                  const otherP    = otherId ? getProfile(otherId) : null;
                  const isActive  = conv.id === activeConv;
                  const isUnread  = !!conv.last_message_at && !readConvIds.has(conv.id);
                  return (
                    <button key={conv.id} onClick={() => handleSelectConv(conv.id)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isActive ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                      <div className="relative flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${otherP?.avatar_color || "bg-slate-600"}`}>
                          {otherP?.avatar_initials || "?"}
                        </div>
                        {isUnread && (
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${isActive ? "text-blue-700 font-semibold" : isUnread ? "text-slate-900 font-bold" : "text-slate-900 font-semibold"}`}>
                          {otherP?.full_name ?? "Unknown"}
                        </p>
                        <p className={`text-xs truncate ${isUnread ? "text-slate-600 font-medium" : "text-slate-400"}`}>
                          {conv.last_message ?? "No messages yet"}
                        </p>
                      </div>
                      {conv.last_message_at && (
                        <p className={`text-xs flex-shrink-0 ${isUnread ? "text-blue-500 font-medium" : "text-slate-400"}`}>{timeAgo(conv.last_message_at)}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message thread — hidden on mobile when no conv active */}
            <div className={`${activeConv ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
              {!activeConv || !active ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-4xl mb-2">💬</p>
                    <p className="text-slate-500 text-sm">Select a conversation to start messaging.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                    {/* Back button — mobile only */}
                    <button
                      onClick={() => setActiveConv(null)}
                      className="md:hidden text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mr-1"
                    >
                      ← Back
                    </button>
                    {otherUser && (
                      <>
                        <Link href={`/profile/${otherUserId}`}
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${otherUser.avatar_color || "bg-slate-600"}`}>
                          {otherUser.avatar_initials}
                        </Link>
                        <div>
                          <Link href={`/profile/${otherUserId}`} className="font-semibold text-slate-900 text-sm hover:underline">
                            {otherUser.full_name}
                          </Link>
                          <p className="text-xs text-slate-500">{otherUser.role} · {otherUser.institution}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    {messages.map((m) => {
                      const isMe = m.sender_id === getCurrentUserId();
                      const sender = getProfile(m.sender_id);
                      return (
                        <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          {!isMe && (
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mr-2 ${sender?.avatar_color || "bg-slate-600"}`}>
                              {sender?.avatar_initials || "?"}
                            </div>
                          )}
                          <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? "bg-blue-600 text-white rounded-tr-sm" : "bg-slate-100 text-slate-800 rounded-tl-sm"}`}>
                              {m.body}
                            </div>
                            <p className="text-xs text-slate-400">{timeAgo(m.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Input */}
                  <form onSubmit={handleSend} className="px-5 py-4 border-t border-slate-200 flex gap-2">
                    <input value={draft} onChange={(e) => setDraft(e.target.value)}
                      placeholder="Write a message…"
                      className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                    <button type="submit" disabled={!draft.trim() || sending}
                      className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      Send
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return <Suspense><MessagesInner /></Suspense>;
}
