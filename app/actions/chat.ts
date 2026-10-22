"use server";

import { peopleById } from "@/lib/people";
import { likeTerm, isRowId } from "@/lib/query";
import { sessionUser } from "@/lib/session";
import { canMessage, checkMessage, markRead } from "@/app/actions/messages";
import { MESSAGE_PROBLEM } from "@/lib/messages";

/**
 * Data for the docked chat.
 *
 * Near-time rather than real-time: the dock polls while it is open. That was
 * open question Q5 on the communication deck, and polling is the right answer
 * for now — research conversations move in minutes, not milliseconds, and
 * websockets are infrastructure we would have to run before we have users.
 * The shape here does not foreclose a live channel later.
 */

export type Conversation = {
  id: string; name: string; institution: string; avatar_url: string | null;
  last: string; at: string; unread: number;
};

export type ChatMessage = {
  id: string; mine: boolean; body: string; at: string;
  card: { id: string; code: string; title: string } | null;
};


export async function listConversations(): Promise<Conversation[]> {
  const { supabase, user } = await sessionUser();
  if (!user) return [];

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, body, read_at, created_at")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const threads = new Map<string, { last: any; unread: number }>();
  for (const m of msgs ?? []) {
    const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    const t = threads.get(other) ?? { last: m, unread: 0 };
    if (m.recipient_id === user.id && !m.read_at) t.unread += 1;
    threads.set(other, t);
  }

  const ids = [...threads.keys()];
  if (!ids.length) return [];
  const people = await peopleById(supabase, ids);

  return ids.map((id) => {
    const t = threads.get(id)!;
    const p = people.get(id);
    return {
      id,
      name: p?.display_name ?? "Researcher",
      institution: p?.institution ?? "",
      avatar_url: p?.avatar_url ?? null,
      last: t.last.body,
      at: t.last.created_at,
      unread: t.unread,
    };
  });
}

export async function unreadTotal(): Promise<number> {
  const { supabase, user } = await sessionUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  return count ?? 0;
}

export async function loadThread(otherId: string): Promise<{
  messages: ChatMessage[];
  who: { name: string; institution: string };
  gated: boolean;
}> {
  const { supabase, user } = await sessionUser();
  if (!user || !isRowId(otherId)) return { messages: [], who: { name: "", institution: "" }, gated: true };

  const [{ data: msgs }, { data: person }, gate] = await Promise.all([
    supabase
      .from("messages")
      .select("id, sender_id, body, method_card_id, created_at")
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`)
      .order("created_at"),
    supabase.from("profiles").select("display_name, institution").eq("id", otherId).maybeSingle(),
    canMessage(otherId),
  ]);

  const cardIds = [...new Set((msgs ?? []).map((m: any) => m.method_card_id).filter(Boolean))];
  const { data: cards } = cardIds.length
    ? await supabase.from("method_cards").select("id, code, title").in("id", cardIds)
    : { data: [] as any[] };

  // Opening a thread marks it read — the same rule the full page uses.
  await markRead(otherId);

  return {
    messages: (msgs ?? []).map((m: any) => ({
      id: m.id,
      mine: m.sender_id === user.id,
      body: m.body,
      at: m.created_at,
      card: (cards ?? []).find((c: any) => c.id === m.method_card_id) ?? null,
    })),
    who: { name: person?.display_name ?? "Researcher", institution: person?.institution ?? "" },
    gated: !gate.allowed,
  };
}

export async function sendChat(otherId: string, body: string): Promise<{ error?: string }> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Not signed in." };
  const text = body.trim();
  if (!text) return {};
  const problem = await checkMessage(otherId, text, null);
  if (problem) return { error: MESSAGE_PROBLEM[problem] };
  const { error } = await supabase.from("messages").insert({ sender_id: user.id, recipient_id: otherId, body: text });
  return error ? { error: error.message } : {};
}

/** People you could start a conversation with, for the dock's own search. */
export async function findPeople(q: string): Promise<{ id: string; name: string; institution: string }[]> {
  const { supabase, user } = await sessionUser();
  const term = likeTerm(q);
  if (!user || term.length < 2) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, institution")
    .neq("id", user.id)
    .or(`display_name.ilike.%${term}%,institution.ilike.%${term}%`)
    .limit(8);
  return (data ?? []).map((p: any) => ({ id: p.id, name: p.display_name, institution: p.institution }));
}
