/**
 * A Nextcloud public share link, as Nextcloud shows it under "Share link":
 * https://cloud.example.org/s/AbC123xyz, also with /index.php/ in front of
 * /s/ or with Nextcloud living under a path (https://example.org/nextcloud/s/…).
 * Only https links are accepted.
 */
export type ShareRef = { origin: string; host: string; token: string; url: string };

export function parseShareUrl(raw: string): ShareRef | null {
  let u: URL;
  try { u = new URL(String(raw ?? "").trim()); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  const m = u.pathname.match(/^((?:\/[A-Za-z0-9._~-]+)*?)\/(?:index\.php\/)?s\/([A-Za-z0-9]{5,64})\/?(?:download\/?)?$/);
  if (!m) return null;
  const origin = `${u.origin}${m[1]}`;
  return { origin, host: u.host.toLowerCase(), token: m[2], url: `${origin}/s/${m[2]}` };
}

/**
 * Hosts the operator allows (SCICOLLAB_NEXTCLOUD_HOSTS, comma separated, for
 * example "cloud.zi-mannheim.de,nextcloud.uni-heidelberg.de"). When the list
 * is empty, any public host is allowed.
 */
export function hostAllowed(host: string, list = process.env.SCICOLLAB_NEXTCLOUD_HOSTS ?? ""): boolean {
  const allowed = list.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  return !allowed.length || allowed.includes(host.toLowerCase());
}

export type NcEntry = { name: string; folder: boolean; size: number | null; modified: string | null; type: string | null; href: string };

const decodeXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (block: string, name: string) => block.match(new RegExp(`<(?:[A-Za-z0-9]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9]+:)?${name}>`, "i"))?.[1] ?? null;

/** The entries of a WebDAV multistatus answer, the folder itself left out. */
export function parseListing(xml: string, ref: ShareRef): NcEntry[] {
  const blocks = xml.split(/<(?:[A-Za-z0-9]+:)?response[\s>]/i).slice(1);
  const out: NcEntry[] = [];
  for (const b of blocks) {
    const href = decodeXml(tag(b, "href") ?? "");
    const rel = decodeURIComponent(href.replace(/^.*?\/public\.php\/(?:webdav|dav\/files\/[^/]+)/, "")).replace(/\/$/, "");
    const folder = /<(?:[A-Za-z0-9]+:)?collection\s*\/?>/i.test(tag(b, "resourcetype") ?? "");
    if (!rel && blocks.length > 1) continue;            // the shared folder itself
    const name = rel.split("/").pop() || decodeXml(tag(b, "displayname") ?? "") || "file";
    const dir = rel.slice(0, Math.max(0, rel.lastIndexOf("/"))) || "/";
    const size = Number(tag(b, "getcontentlength"));
    const modified = tag(b, "getlastmodified");
    out.push({
      name, folder,
      size: folder || Number.isNaN(size) ? null : size,
      modified: modified && !Number.isNaN(Date.parse(modified)) ? new Date(modified).toISOString() : null,
      type: folder ? null : tag(b, "getcontenttype"),
      // Folders open in Nextcloud's own view; files download straight away.
      href: folder ? `${ref.url}?path=${encodeURIComponent(rel)}`
        : rel ? `${ref.url}/download?path=${encodeURIComponent(dir)}&files=${encodeURIComponent(name)}` : `${ref.url}/download`,
    });
  }
  return out.sort((a, b) => Number(b.folder) - Number(a.folder) || a.name.localeCompare(b.name));
}

