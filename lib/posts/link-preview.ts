import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * A preview of the first link in a post: title, description and site name,
 * read once when the post is saved and stored with it.
 *
 * Fetching a URL someone typed is a classic way to make a server reach
 * places it should not (its own metadata service, the database, the local
 * network). So only http(s) on the default ports, every address the name
 * resolves to must be public, redirects are followed by hand and checked
 * again, the answer must be HTML, and at most 512 kB of it is read within
 * four seconds. Remote images are deliberately not used: showing one would
 * tell a third-party server who is reading the feed.
 */

export type LinkPreview = { url: string; title: string; description: string; site: string };

const URL_RE = /\bhttps?:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?]/i;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;

export function firstUrl(text: string): string | null {
  return text.match(URL_RE)?.[0] ?? null;
}

function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}
function privateIp(ip: string): boolean {
  if (isIP(ip) === 4) return privateV4(ip);
  const v = ip.toLowerCase();
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateV4(mapped[1]);
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
}

async function safeTarget(raw: string): Promise<URL | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null;
  } catch { return null; }
  return u;
}

const decode = (s: string) => s
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/\s+/g, " ").trim();

function meta(html: string, key: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "") : "";
}

export async function linkPreview(raw: string): Promise<LinkPreview | null> {
  let target = await safeTarget(raw);
  const deadline = AbortSignal.timeout(4000);
  for (let hop = 0; target && hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetch(target, { redirect: "manual", signal: deadline, headers: { "user-agent": "SciCollabLinkPreview/1.0", accept: "text/html" } });
    } catch { return null; }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      target = next ? await safeTarget(new URL(next, target).toString()) : null;
      continue;
    }
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html") || !res.body) return null;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (size < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); size += value.length;
      }
    } catch { /* keep what arrived */ } finally { reader.cancel().catch(() => {}); }
    const html = new TextDecoder().decode(Buffer.concat(chunks)).slice(0, MAX_BYTES);
    const title = meta(html, "og:title") || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "");
    if (!title) return null;
    return {
      url: raw,
      title: title.slice(0, 200),
      description: (meta(html, "og:description") || meta(html, "description")).slice(0, 300),
      site: (meta(html, "og:site_name") || target.hostname.replace(/^www\./, "")).slice(0, 80),
    };
  }
  return null;
}
