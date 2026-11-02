import type { LinkPreview } from "@/lib/posts/link-preview";
import { mono } from "@/components/ui";

/**
 * A post's images and the preview of its first link. Images open full size
 * in a new tab; the grid keeps one to four of them in a tidy block.
 */
export function PostImages({ urls, title }: { urls?: string[]; title: string }) {
  if (!urls?.length) return null;
  const one = urls.length === 1;
  return (
    <div style={{ display: "grid", gridTemplateColumns: one ? "1fr" : "1fr 1fr", gap: 4, marginTop: 11 }}>
      {urls.map((src, i) => (
        <a key={i} href={src} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: "var(--bg)", border: "1px solid var(--rule)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Image ${i + 1} of ${urls.length} in “${title}”`} loading="lazy"
            style={{ display: "block", width: "100%", height: one ? "auto" : 200, maxHeight: one ? 480 : undefined, objectFit: one ? "contain" : "cover" }} />
        </a>
      ))}
    </div>
  );
}

export function LinkCard({ preview, doi }: { preview?: LinkPreview | null; doi?: string | null }) {
  // A DOI in an older post without a stored card still gets a plain one.
  if (!preview?.url && doi) preview = { url: `https://doi.org/${doi}`, kind: "paper", site: "Paper", title: `doi:${doi}`, description: "" };
  if (!preview?.url) return null;
  if (preview.kind === "paper" || /^https?:\/\/(dx\.)?doi\.org\//i.test(preview.url)) return <PaperCard preview={preview} />;
  return (
    <a href={preview.url} target="_blank" rel="noopener noreferrer nofollow ugc"
      style={{ display: "block", marginTop: 11, padding: "10px 12px", border: "1px solid var(--rule)", borderLeft: "3px solid var(--ink)", background: "var(--bg)", color: "var(--ink)", textDecoration: "none" }}>
      <div style={{ font: mono(10.5), color: "var(--mute)", marginBottom: 4 }}>{preview.site} ↗</div>
      <div style={{ font: "600 13.5px/1.5 var(--sans)" }}>{preview.title}</div>
      {preview.description && <div style={{ font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)", marginTop: 3 }}>{preview.description}</div>}
    </a>
  );
}

/** A paper: title, then authors · journal · year, and the DOI. */
function PaperCard({ preview }: { preview: LinkPreview }) {
  const doi = preview.url.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return (
    <a href={preview.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="sc-inset"
      style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 11, padding: "11px 13px", border: "1px solid var(--rule)", borderRadius: 12, background: "var(--bg)", color: "var(--ink)", textDecoration: "none" }}>
      <span aria-hidden="true" style={{ flex: "0 0 auto", width: 30, height: 38, borderRadius: 5, border: "1px solid var(--rule)", display: "grid", placeItems: "center", font: mono(8.5, 700), color: "var(--mute)", background: "var(--surface)" }}>DOI</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", font: "600 13.5px/1.45 var(--sans)", overflowWrap: "anywhere" }}>{preview.title}{preview.title.startsWith("doi:") ? " ↗" : ""}</span>
        {preview.description && <span style={{ display: "block", font: "400 12.5px/1.55 var(--sans)", color: "var(--mute)", marginTop: 2 }}>{preview.description}</span>}
        {!preview.title.startsWith("doi:") && <span style={{ display: "block", font: mono(10.5), color: "var(--mute)", marginTop: 3, overflowWrap: "anywhere" }}>doi:{doi} ↗</span>}
      </span>
    </a>
  );
}
