import { redirect } from "next/navigation";
import { callsHref } from "@/lib/calls";

/**
 * Calls for collaborators moved into the feed (Home → Calls tab). This stays so
 * that old links, bookmarks and notifications still land in the right place,
 * with the filters they carried.
 */
export default async function Calls({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; due?: string; mine?: string }> }) {
  const sp = await searchParams;
  redirect(`${callsHref({ q: sp.q, due: sp.due, mine: sp.mine, status: sp.status })}#feed`);
}
