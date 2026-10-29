import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/mode";
import { loadPublications } from "@/lib/record/publications";
import { memberAuthorIds, readAuthor } from "@/lib/openalex/store";
import { normaliseOrcid } from "@/lib/openalex/sync";
import { peopleById, type Person } from "@/lib/people";

/**
 * Co-authors, from the bylines OpenAlex gives for each synced publication.
 *
 * The cheapest way to find colleagues on a new network is the people you
 * already published with: those who are members are offered to follow, the
 * others to invite. Matching is by OpenAlex author id or ORCID, never by
 * name, so two people called J. Smith are never confused.
 */

/* The demo's example publications name some demo members as co-authors;
   their invented OpenAlex ids map to them here (lib/openalex/example.ts). */
const DEMO_SELF = "A-example-self";
const demoMember = (id: string) => (id.startsWith("A-example-u-") ? id.slice("A-example-".length) : null);

export type CoauthorMember = { person: Person; papers: number; following: boolean };
export type CoauthorOther = { name: string; papers: number; openalexId: string };

export async function coauthorsOf(
  supabase: SupabaseClient<any, any, any>, userId: string, orcid: string | null | undefined, following: Set<string>,
): Promise<{ members: CoauthorMember[]; others: CoauthorOther[]; papers: number }> {
  if (!normaliseOrcid(orcid)) return { members: [], others: [], papers: 0 };
  const [{ pubs }, me, ids] = await Promise.all([loadPublications(userId, orcid, 1), readAuthor(userId), memberAuthorIds()]);

  const tally = new Map<string, { name: string; orcid: string | null; papers: number }>();
  for (const p of pubs) {
    for (const a of p.authors ?? []) {
      if (a.id === me?.openalex_id || a.id === DEMO_SELF || (a.orcid && a.orcid === normaliseOrcid(orcid))) continue;
      const t = tally.get(a.id) ?? { name: a.name, orcid: a.orcid, papers: 0 };
      t.papers++;
      tally.set(a.id, t);
    }
  }

  const byAuthor = new Map(ids.map((r) => [r.openalex_id, r.user_id]));
  const byOrcid = new Map(ids.map((r) => [r.orcid, r.user_id]));
  const memberOf = (id: string, o: string | null) =>
    byAuthor.get(id) ?? (o ? byOrcid.get(o) : undefined) ?? (!isConfigured() ? demoMember(id) : null) ?? null;

  const found = new Map<string, number>();
  const others: CoauthorOther[] = [];
  for (const [id, t] of tally) {
    const member = memberOf(id, t.orcid);
    if (member && member !== userId) found.set(member, (found.get(member) ?? 0) + t.papers);
    else if (!member) others.push({ name: t.name, papers: t.papers, openalexId: id });
  }
  const people = await peopleById(supabase, [...found.keys()]);
  const members = [...found]
    .filter(([id]) => people.has(id))
    .map(([id, papers]) => ({ person: people.get(id)!, papers, following: following.has(id) }))
    .sort((a, b) => b.papers - a.papers);
  others.sort((a, b) => b.papers - a.papers || a.name.localeCompare(b.name));
  return { members, others, papers: pubs.length };
}

/** A message to send a co-author who is not here yet; nothing is sent by SciCollab. */
export function inviteText(fromName: string, toName: string, origin: string): string {
  return `Hi ${toName.replace(/\.ex$/, "")},\n\nI am on SciCollab, where researchers share methods (including the runs that did not work), ask each other questions and keep their publication record up to date from ORCID. We have published together, so I thought you might like it too.\n\nYou can join here: ${origin}/signup\n\nBest,\n${fromName.replace(/\.ex$/, "")}`;
}
