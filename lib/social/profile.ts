import type { SupabaseClient } from "@supabase/supabase-js";
import { bibliometricsFor, type Bibliometrics } from "@/lib/record/bibliometrics";
import { loadPublications } from "@/lib/record/publications";
import { citationProfile, type CitationProfile } from "@/lib/record/citations";
import type { PubRow } from "@/lib/openalex/store";
import { ROOMS } from "@/lib/taxonomy";

type Client = SupabaseClient<any, any, any>;

export type ProfileData = {
  person: {
    id: string; display_name: string; institution: string; role_title: string; field: string;
    techniques: string[]; avatar_url: string | null; orcid: string | null; bio: string; public_profile: boolean; created_at: string;
  };
  cards: { id: string; code: string; title: string; outcome: "success" | "partial" | "negative" | null; visibility: string; created_at: string }[];
  answers: { id: string; question_id: string; title: string; accepted: boolean; created_at: string }[];
  questions: { id: string; title: string; created_at: string }[];
  groups: { id: string; name: string; role: string }[];
  sharedRooms: { id: string; label: string }[];
  pubs: PubRow[]; citations: CitationProfile; biblio: Bibliometrics;
  counts: { cards: number; nulls: number; answers: number; accepted: number; questions: number };
};

/**
 * Everything a profile page shows about one person.
 *
 * `viewer` is the signed-in member looking, or null for a signed-out visitor.
 * For a visitor `db` is the server's own reader, so this function is the
 * gate: only people who made their profile public are returned, and of their
 * work only what is itself public.
 */
export async function loadProfile(db: Client, personId: string, viewer: string | null): Promise<ProfileData | null> {
  const { data: person } = await db.from("profiles")
    .select("id, display_name, institution, role_title, field, techniques, avatar_url, orcid, bio, public_profile, created_at")
    .eq("id", personId).maybeSingle();
  if (!person) return null;
  if (!viewer && !person.public_profile) return null;
  const isMe = viewer === personId;
  const empty = Promise.resolve({ data: [] as any[] });

  const [{ data: cards }, { data: answers }, { data: questions }, { data: memberships }, { data: theirRooms }, { data: myRooms }] = await Promise.all([
    db.from("method_cards").select("id, code, title, outcome, visibility, created_at").eq("author_id", personId).order("created_at", { ascending: false }),
    db.from("answers").select("id, question_id, accepted, created_at").eq("author_id", personId).order("created_at", { ascending: false }),
    db.from("questions").select("id, title, visibility, created_at").eq("author_id", personId).order("created_at", { ascending: false }),
    viewer ? db.from("group_members").select("group_id, role").eq("user_id", personId) : empty,
    viewer && !isMe ? db.from("user_rooms").select("room_id").eq("user_id", personId) : empty,
    viewer && !isMe ? db.from("user_rooms").select("room_id").eq("user_id", viewer) : empty,
  ]);

  // Private cards are their author's alone; a visitor sees only public ones.
  const visibleCards = (cards ?? []).filter((c: any) => isMe || (viewer ? c.visibility !== "private" : c.visibility === "public"));
  const visibleQuestions = (questions ?? []).filter((q: any) => viewer || q.visibility === "public");
  const qIds = [...new Set((answers ?? []).map((a: any) => a.question_id))];
  const gIds = (memberships ?? []).map((m: any) => m.group_id);
  const [{ data: answered }, { data: groups }] = await Promise.all([
    qIds.length ? db.from("questions").select("id, title, visibility").in("id", qIds) : empty,
    gIds.length ? db.from("groups").select("id, name").in("id", gIds) : empty,
  ]);
  const questionOf = new Map((answered ?? []).filter((q: any) => viewer || q.visibility === "public").map((q: any) => [q.id, q.title]));
  const visibleAnswers = (answers ?? []).filter((a: any) => questionOf.has(a.question_id))
    .map((a: any) => ({ ...a, title: questionOf.get(a.question_id) as string }));

  const mine = new Set((myRooms ?? []).map((r: any) => r.room_id));
  const sharedRooms = (theirRooms ?? []).filter((r: any) => mine.has(r.room_id))
    .map((r: any) => ({ id: r.room_id, label: ROOMS.find((x) => x.id === r.room_id)?.name ?? r.room_id }));

  const [{ pubs }, biblio] = await Promise.all([loadPublications(personId, person.orcid, 1), bibliometricsFor(personId, person.orcid)]);

  return {
    person: { ...person, techniques: person.techniques ?? [], bio: person.bio ?? "" },
    cards: visibleCards,
    answers: visibleAnswers,
    questions: visibleQuestions,
    groups: (groups ?? []).map((g: any) => ({ id: g.id, name: g.name, role: (memberships ?? []).find((m: any) => m.group_id === g.id)?.role ?? "member" })),
    sharedRooms,
    pubs, citations: citationProfile(pubs), biblio,
    counts: {
      cards: visibleCards.filter((c: any) => c.outcome !== "negative").length,
      nulls: visibleCards.filter((c: any) => c.outcome === "negative").length,
      answers: visibleAnswers.length,
      accepted: visibleAnswers.filter((a: any) => a.accepted).length,
      questions: visibleQuestions.length,
    },
  };
}
