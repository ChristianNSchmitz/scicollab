import type { SupabaseClient } from "@supabase/supabase-js";
import { safeTarget } from "@/lib/posts/link-preview";
import { parseShareUrl, hostAllowed, parseListing, type ShareRef, type NcEntry } from "@/lib/nextcloud-url";
export { parseShareUrl, hostAllowed, parseListing, type ShareRef, type NcEntry };

/**
 * Nextcloud folders linked to a group or a method card
 * (supabase/19-nextcloud.sql). A member pastes a public share link; the
 * server lists the folder over WebDAV (public.php/webdav, the share token as
 * user name, the share password if there is one) and keeps the listing on
 * the link for an hour. Files open and download from Nextcloud itself, so
 * nothing is copied into SciCollab.
 *
 * The address is checked like a link preview: https only, every address the
 * name resolves to must be public, no redirects followed. Operators can limit
 * which Nextcloud servers may be used with SCICOLLAB_NEXTCLOUD_HOSTS.
 */

export type NcListing = { entries: NcEntry[]; total: number; fetchedAt: string };
export type NcLink = ShareRef & { id: string; label: string; added_by: string; added_at: string; cache: NcListing | null; cached_at: string | null; has_password?: boolean; error?: string };

const STALE_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 200;

const PROPFIND = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:getlastmodified/><d:getcontentlength/><d:getcontenttype/><d:resourcetype/></d:prop></d:propfind>`;

/** Read the top level of a public share. Throws a short, readable message. */
export async function listShare(ref: ShareRef, password?: string | null): Promise<NcListing> {
  if (!hostAllowed(ref.host)) throw new Error("this Nextcloud server is not allowed here");
  // public.php/webdav works on every Nextcloud in use; newer ones also
  // serve public.php/dav/files/<token>, tried when the first is gone.
  const ask = async (path: string, user: string) => {
    const target = await safeTarget(`${ref.origin}${path}`);
    if (!target) throw new Error("that address cannot be reached from here");
    try {
      return await fetch(target, {
        method: "PROPFIND", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(6000),
        headers: {
          Depth: "1", "Content-Type": "application/xml; charset=utf-8", "X-Requested-With": "XMLHttpRequest", "User-Agent": "SciCollab",
          Authorization: `Basic ${Buffer.from(`${user}:${password ?? ""}`).toString("base64")}`,
        },
        body: PROPFIND,
      });
    } catch { throw new Error("Nextcloud could not be reached"); }
  };
  let res = await ask("/public.php/webdav/", ref.token);
  if (res.status === 404 || res.status === 405 || res.status === 501) res = await ask(`/public.php/dav/files/${ref.token}/`, "anonymous");
  if (res.status === 401) throw new Error(password ? "the password is not right" : "this share needs a password");
  if (res.status === 404) throw new Error("the share was not found, or it was removed");
  if (res.status !== 207 && !res.ok) throw new Error(`Nextcloud answered ${res.status}`);
  const text = (await res.text()).slice(0, 2_000_000);
  const entries = parseListing(text, ref);
  return { entries: entries.slice(0, MAX_ENTRIES), total: entries.length, fetchedAt: new Date().toISOString() };
}

type Scope = { groupId?: string; methodId?: string };

/**
 * The shares linked to a group or a method card. Stale listings are read
 * again when the viewer may read the share's password (or there is none).
 */
export async function ncLinks(supabase: SupabaseClient<any, any, any>, scope: Scope): Promise<NcLink[]> {
  let q = supabase.from("nextcloud_links").select("id, origin, host, token, url, label, added_by, added_at, cache, cached_at, has_password").order("added_at", { ascending: true });
  q = scope.groupId ? q.eq("group_id", scope.groupId) : q.eq("method_id", scope.methodId ?? "");
  const { data } = await q;
  const links = (data ?? []) as NcLink[];
  return Promise.all(links.map(async (l) => {
    if (l.cached_at && Date.now() - +new Date(l.cached_at) < STALE_MS) return l;
    // A seeded demo share points nowhere: keep its snapshot.
    if (l.host.endsWith(".example.org")) return l;
    let password: string | null = null;
    if (l.has_password) {
      const { data: s } = await supabase.from("nextcloud_secrets").select("password").eq("link_id", l.id).maybeSingle();
      if (!s) return l;                     // not yours to refresh: show the last listing
      password = s.password;
    }
    try {
      const cache = await listShare(l, password);
      const cached_at = new Date().toISOString();
      await supabase.from("nextcloud_links").update({ cache, cached_at }).eq("id", l.id);
      return { ...l, cache, cached_at };
    } catch (e) {
      return { ...l, error: e instanceof Error ? e.message : "Nextcloud could not be read" };
    }
  }));
}
