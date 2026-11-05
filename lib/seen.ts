/**
 * Which held-at-the-top posts you have already seen (the feed holds your posts
 * that got a reply, and posts that mention you, until you have looked at them).
 *
 * It is a cookie, not a table: nothing to migrate, and the feed can read it on
 * the server. The cost is that it belongs to one browser, so a post you saw on
 * your phone is shown once more on your laptop.
 *
 * For each post it keeps the time of the latest activity you saw (the reply or
 * the mention), not the time you looked. A newer reply is newer than that, so
 * the post comes back; and the server's clock and yours never have to agree.
 */

export const SEEN_COOKIE = "sc-seen";
/** Entries kept: the cookie must stay far below the 4 kB a browser allows. */
export const SEEN_MAX = 40;
/** How long an entry matters: the feed only looks back this far anyway. */
export const SEEN_DAYS = 7;

export type Seen = Map<string, number>;

/** "id.t,id.t" with t in base 36 → Map. Anything malformed is skipped. */
export function parseSeen(raw: string | undefined | null): Seen {
  const seen: Seen = new Map();
  for (const part of String(raw ?? "").split(",")) {
    const [id, t] = part.split(".");
    const ms = parseInt(t ?? "", 36);
    if (/^[A-Za-z0-9-]{1,64}$/.test(id ?? "") && Number.isFinite(ms) && ms > 0) seen.set(id, ms);
  }
  return seen;
}

/** The cookie value: the newest entries, nothing older than SEEN_DAYS. */
export function serializeSeen(seen: Seen, now: number = Date.now()): string {
  const keep = [...seen].filter(([, t]) => now - t < SEEN_DAYS * 864e5).sort((a, b) => b[1] - a[1]).slice(0, SEEN_MAX);
  return keep.map(([id, t]) => `${id}.${t.toString(36)}`).join(",");
}

/** Has this post's latest activity been seen? Activity after what was seen counts as new. */
export function isSeen(seen: Seen, postId: string, activityAt: string): boolean {
  const t = seen.get(postId);
  const at = Date.parse(activityAt);
  return t !== undefined && Number.isFinite(at) && t >= at;
}

/** Record that the activity at `activityAt` on a post was seen. Never moves an entry back. */
export function markSeen(seen: Seen, postId: string, activityAt: string): Seen {
  const at = Date.parse(activityAt);
  if (!Number.isFinite(at)) return seen;
  const next = new Map(seen);
  next.set(postId, Math.max(next.get(postId) ?? 0, at));
  return next;
}
