import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { peopleById } from "@/lib/people";
import { loadPaper, MAX_PAPER_BYTES } from "@/lib/papers";
import { uploadPaperFile, deletePaperFile, requestFullText, decideFullText, withdrawFullText, commentOnPaper, deletePaperComment, followPaper } from "@/app/actions/papers";
import { Page, Panel, PanelHead, Empty, btn, btnPrimary, field, fieldLabel, mono } from "@/components/ui";
import Avatar from "@/components/Avatar";
import PersonLink from "@/components/social/PersonLink";
import { timeAgo } from "@/lib/format";
import { fileSize } from "@/lib/social/group-files";

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  added: { text: "Full text added." },
  asked: { text: "Request sent. The authors are told right away and can send you a private copy." },
  nofile: { text: "Choose a PDF first.", error: true },
  type: { text: "Only PDF files.", error: true },
  size: { text: `The PDF can be up to ${Math.round(MAX_PAPER_BYTES / 1024 / 1024 * 10) / 10} MB.`, error: true },
  rights: { text: "Confirm that the publisher allows sharing this version, or keep it private for requests.", error: true },
  upload: { text: "The upload did not go through. Try again.", error: true },
  needfile: { text: "Add the full text first (a private copy is enough), then send it.", error: true },
};
const VERSION: Record<string, string> = { preprint: "Preprint", accepted: "Accepted manuscript", published: "Published version" };

/**
 * One paper: its details, who of its authors is here, the full text (the
 * shareable version, or a private copy on request), comments and following.
 */
export default async function PaperPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ft?: string }> }) {
  const { id } = await params;
  const { ft } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;
  const paper = await loadPaper(supabase, id);
  if (!paper) notFound();
  const isAuthor = paper.authorIds.includes(me);

  const [{ data: files }, { data: requests }, { data: comments }, { data: follows }] = await Promise.all([
    supabase.from("paper_files").select("id, name, size_bytes, access, version, uploaded_by, created_at").eq("work_id", id).order("created_at", { ascending: false }),
    supabase.from("paper_requests").select("id, requester_id, message, status, created_at").eq("work_id", id).order("created_at", { ascending: false }),
    supabase.from("paper_comments").select("id, author_id, body, created_at").eq("work_id", id).order("created_at", { ascending: true }),
    supabase.from("paper_follows").select("user_id").eq("work_id", id),
  ]);
  const myRequest = (requests ?? []).find((r: any) => r.requester_id === me);
  const canReadPrivate = isAuthor || myRequest?.status === "sent";
  const shown = (files ?? []).filter((f: any) => f.access === "public" || canReadPrivate);
  const openRequests = isAuthor ? (requests ?? []).filter((r: any) => r.status === "open") : [];
  const following = (follows ?? []).some((f: any) => f.user_id === me);
  const people = await peopleById(supabase, [...paper.authorIds, ...(requests ?? []).map((r: any) => r.requester_id), ...(comments ?? []).map((c: any) => c.author_id)]);
  const f = ft ? FLASH[ft] : null;
  const byline = (paper.authors ?? []).map((a) => a.name);
  const external = paper.doi ? `https://doi.org/${paper.doi}` : paper.openalex_id.startsWith("W-example") ? null : `https://openalex.org/${paper.openalex_id}`;

  return (
    <Page title={paper.title || "Untitled"}
      lede={[paper.venue, paper.year, paper.type && paper.type !== "article" ? paper.type : null, `${paper.cited_by_count} citation${paper.cited_by_count === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
      actions={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {external && <a href={external} target="_blank" rel="noreferrer" style={btn}>{paper.doi ? "DOI" : "OpenAlex"} ↗</a>}
          <form action={followPaper.bind(null, id, !following)}>
            <button type="submit" style={following ? { ...btn, background: "var(--ink)", color: "var(--bg)" } : btn} aria-pressed={following}
              title="Get told about comments and a new full text">{following ? "Following ✓" : "Follow"}</button>
          </form>
        </div>
      }>
      {f && <p role={f.error ? "alert" : "status"} style={{ font: "400 13.5px/1.6 var(--sans)", margin: "0 0 12px", padding: "10px 12px", borderRadius: 12, border: `1px solid ${f.error ? "var(--err)" : "var(--ok)"}`, background: "var(--surface)" }}>{f.text}</p>}
      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {byline.length > 0 && <p style={{ margin: 0, font: "400 13.5px/1.7 var(--sans)", color: "var(--mute)" }}>{byline.join(", ")}</p>}

          <Panel>
            <div id="fulltext" style={{ scrollMarginTop: 72 }}><PanelHead>Full text</PanelHead></div>
            {shown.length === 0 && <Empty>{isAuthor ? "No full text yet. Add the version you may share, or a private copy to send on request." : "No full text here yet."}</Empty>}
            {shown.map((x: any) => (
              <div key={x.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
                <span aria-hidden="true" style={{ font: mono(10, 700), color: "var(--err)" }}>PDF</span>
                <a href={`/api/paper-files/${x.id}`} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, color: "var(--ink)", font: "600 13.5px/1.5 var(--sans)" }}>{VERSION[x.version] ?? "Full text"}</a>
                <span style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)" }}>{x.access === "public" ? "shared with everyone" : isAuthor ? "private, sent on request" : "shared with you"} · {fileSize(x.size_bytes)}</span>
                {isAuthor && <form action={deletePaperFile.bind(null, id, x.id)}><button type="submit" style={{ ...btn, height: 28, padding: "0 10px" }}>Remove</button></form>}
              </div>
            ))}
            {!isAuthor && !canReadPrivate && (
              myRequest ? (
                <div style={{ padding: 14, font: "400 13px/1.6 var(--sans)", color: "var(--mute)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  {myRequest.status === "open" ? <>You asked the authors {timeAgo(myRequest.created_at)}. <form action={withdrawFullText.bind(null, id)}><button type="submit" style={{ ...btn, height: 28 }}>Withdraw</button></form></> : "The authors declined your request."}
                </div>
              ) : paper.authorIds.length > 0 && (
                <form action={requestFullText.bind(null, id)} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <label htmlFor="ft-msg" style={fieldLabel}>Ask the authors for a private copy (a line on why helps)</label>
                  <textarea id="ft-msg" name="message" rows={2} maxLength={1000} style={field} placeholder="I am comparing transfection protocols for a review and need your Methods in detail." />
                  <div><button type="submit" style={btnPrimary}>Request full text</button></div>
                </form>
              )
            )}
            {isAuthor && (
              <form action={uploadPaperFile.bind(null, id)} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, borderTop: shown.length ? 0 : "1px solid var(--rule)" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <label style={{ ...fieldLabel, flex: "1 1 200px" }}>PDF<input name="file" type="file" accept="application/pdf" required style={{ display: "block", marginTop: 6, font: "400 12.5px/1.5 var(--sans)" }} /></label>
                  <label style={{ ...fieldLabel, flex: "1 1 160px" }}>Version
                    <select name="version" defaultValue="accepted" style={{ ...field, marginTop: 4 }}><option value="accepted">Accepted manuscript</option><option value="preprint">Preprint</option><option value="published">Published version</option></select>
                  </label>
                  <label style={{ ...fieldLabel, flex: "1 1 160px" }}>Who can read it
                    <select name="access" defaultValue="private" style={{ ...field, marginTop: 4 }}><option value="private">Only people I send it to</option><option value="public">Everyone on SciCollab</option></select>
                  </label>
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)" }}>
                  <input type="checkbox" name="rights" style={{ marginTop: 3 }} /> For &quot;Everyone&quot;: the publisher allows sharing this version (check the journal&apos;s policy, for example on Sherpa Romeo).
                </label>
                <div><button type="submit" style={btn}>Add full text</button></div>
              </form>
            )}
          </Panel>

          {isAuthor && (
            <Panel>
              <div id="requests" style={{ scrollMarginTop: 72 }}><PanelHead>Requests for the full text · {openRequests.length}</PanelHead></div>
              {openRequests.length === 0 && <Empty>No open requests.</Empty>}
              {openRequests.map((r: any) => (
                <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 14px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
                  <Avatar name={people.get(r.requester_id)?.display_name ?? ""} url={people.get(r.requester_id)?.avatar_url} size={28} />
                  <div style={{ flex: "1 1 200px", minWidth: 0, font: "400 13px/1.6 var(--sans)" }}>
                    <PersonLink id={r.requester_id} style={{ fontWeight: 600, color: "var(--ink)" }}>{people.get(r.requester_id)?.display_name ?? "Someone"}</PersonLink>
                    <span style={{ color: "var(--mute)" }}> · {timeAgo(r.created_at)}</span>
                    {r.message && <div>{r.message}</div>}
                  </div>
                  <form action={decideFullText.bind(null, id, r.id, "sent")}><button type="submit" style={{ ...btnPrimary, height: 30 }}>Send privately</button></form>
                  <form action={decideFullText.bind(null, id, r.id, "declined")}><button type="submit" style={{ ...btn, height: 30 }}>Decline</button></form>
                </div>
              ))}
            </Panel>
          )}

          <Panel>
            <div id="comments" style={{ scrollMarginTop: 72 }}><PanelHead>Discussion · {(comments ?? []).length}</PanelHead></div>
            {(comments ?? []).length === 0 && <Empty>No comments yet. Questions on the method, a replication, a related dataset: start here.</Empty>}
            {(comments ?? []).map((c: any) => (
              <div key={c.id} style={{ display: "flex", gap: 10, padding: "11px 14px", borderBottom: "1px solid var(--rule)" }}>
                <Avatar name={people.get(c.author_id)?.display_name ?? ""} url={people.get(c.author_id)?.avatar_url} size={28} />
                <div style={{ flex: 1, minWidth: 0, font: "400 13.5px/1.65 var(--sans)" }}>
                  <PersonLink id={c.author_id} style={{ fontWeight: 600, color: "var(--ink)" }}>{people.get(c.author_id)?.display_name ?? "Someone"}</PersonLink>
                  {paper.authorIds.includes(c.author_id) && <span style={{ marginLeft: 6, font: "600 11px/1 var(--sans)", color: "var(--ok)" }}>author</span>}
                  <span style={{ color: "var(--mute)", fontSize: 12 }}> · {timeAgo(c.created_at)}</span>
                  <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
                </div>
                {(c.author_id === me || isAuthor) && <form action={deletePaperComment.bind(null, id, c.id)}><button type="submit" aria-label="Delete comment" style={{ border: 0, background: "none", color: "var(--mute)", cursor: "pointer" }}>×</button></form>}
              </div>
            ))}
            <form action={commentOnPaper.bind(null, id)} style={{ padding: 14, display: "flex", gap: 8, alignItems: "flex-end" }}>
              <label htmlFor="pc-body" style={{ position: "absolute", left: -9999 }}>Comment</label>
              <textarea id="pc-body" name="body" rows={2} maxLength={4000} required style={{ ...field, flex: 1 }} placeholder="Ask the authors, or add what you found…" />
              <button type="submit" style={btnPrimary}>Comment</button>
            </form>
          </Panel>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <PanelHead>Authors on SciCollab</PanelHead>
            {paper.authorIds.map((a) => (
              <Link key={a} href={`/people/${a}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
                <Avatar name={people.get(a)?.display_name ?? ""} url={people.get(a)?.avatar_url} size={28} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", font: "600 13px/1.4 var(--sans)" }}>{people.get(a)?.display_name ?? "A member"}</span>
                  <span style={{ display: "block", font: "400 12px/1.4 var(--sans)", color: "var(--mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{people.get(a)?.institution ?? ""}</span>
                </span>
              </Link>
            ))}
            <div style={{ padding: "10px 14px", font: "400 12px/1.6 var(--sans)", color: "var(--mute)" }}>{(follows ?? []).length} following this paper</div>
          </Panel>
          {paper.doi && <Panel><PanelHead>Cite</PanelHead><div style={{ padding: 14, font: mono(11.5, 400, 1.7), overflowWrap: "anywhere" }}>{byline.slice(0, 3).join(", ")}{byline.length > 3 ? " et al." : ""} ({paper.year}). {paper.title}. {paper.venue}. https://doi.org/{paper.doi}</div></Panel>}
        </aside>
      </div>
    </Page>
  );
}
