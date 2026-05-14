"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getConversations, getMessages, getProfile, sendMessage, MOCK_USER_ID, type Conversation, type Message } from "@/lib/mock-db";

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function MessagesInner() {
  const searchParams = useSearchParams();
  const initialConvId = searchParams.get("conv");

  const [convos, setConvos]         = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(initialConvId);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [draft, setDraft]           = useState("");
  const [sending, setSending]       = useState(false);

  useEffect(() => {
    const c = getConversations();
    setConvos(c);
    if (!initialConvId && c.length > 0) setActiveConv(c[0].id);
  }, [initialConvId]);

  useEffect(() => {
    if (activeConv) setMessages(getMessages(activeConv));
  }, [activeConv]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeConv) return;
    setSending(true);
    const m = sendMessage(activeConv, draft.trim());
    setMessages((prev) => [...prev, m]);
    setDraft("");
    setSending(false);
  }

  const active = convos.find((c) => c.id === activeConv);
  const otherUserId = active?.participant_ids.find((id) => id !== MOCK_USER_ID);
  const otherUser   = otherUserId ? getProfile(otherUserId) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ height: "calc(100vh - 120px)", minHeight: 500 }}>
          <div className="flex h-full">
            {/* Conversation list */}
            <div className="w-72 border-r border-slate-200 flex flex-col flex-shrink-0">
              <div className="px-4 py-4 border-b border-slate-200">
                <h2 className="font-bold text-slate-900">Messages</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {convos.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <p className="text-3xl mb-2">✉️</p>
                    <p className="text-sm text-slate-500">No conversations yet.</p>
                    <Link href="/discover" className="text-xs text-blue-600 hover:underline mt-1 block">Find researchers →</Link>
                  </div>
                ) : convos.map((conv) => {
                  const otherId   = conv.participant_ids.find((id) => id !== MOCK_USER_ID);
                  const otherP    = otherId ? getProfile(otherId) : null;
                  const isActive  = conv.id === activeConv;
                  return (
                    <button key={conv.id} onClick={() => setActiveConv(conv.id)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isActive ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${otherP?.avatar_color || "bg-slate-600"}`}>
                        {otherP?.avatar_initials || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isActive ? "text-blue-700" : "text-slate-900"}`}>
                          {otherP?.full_name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{conv.last_message ?? "No messages yet"}</p>
                      </div>
                      {conv.last_message_at && (
                        <p className="text-xs text-slate-400 flex-shrink-0">{timeAgo(conv.last_message_at)}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message thread */}
            <div className="flex-1 flex flex-col">
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
                      const isMe = m.sender_id === MOCK_USER_ID;
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
