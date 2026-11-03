import { createClient } from "@/lib/supabase/server";
import { papersOf } from "@/lib/papers";
import { cvDocument, type CvEntry, type CvFormat } from "@/lib/cv";

export const dynamic = "force-dynamic";

/**
 * Your CV as a document in the DFG or ERC order: a page to print or save as
 * PDF, or (as=doc) a file Word opens. Only your own.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  const url = new URL(req.url);
  const format: CvFormat = url.searchParams.get("format") === "erc" ? "erc" : "dfg";
  const asDoc = url.searchParams.get("as") === "doc";

  const [{ data: p }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("display_name, role_title, institution, orcid, cv_summary, cv_papers").eq("id", user.id).maybeSingle(),
    supabase.from("cv_entries").select("*").eq("user_id", user.id),
  ]);
  const pubs = await papersOf(user.id, p?.orcid);
  const chosen = (p?.cv_papers ?? []) as string[];
  const papers = (chosen.length ? chosen.map((id) => pubs.find((x) => x.openalex_id === id)).filter((x): x is NonNullable<typeof x> => !!x)
    : [...pubs].sort((a, b) => b.cited_by_count - a.cited_by_count).slice(0, 10))
    .map((x) => ({ title: x.title, year: x.year, venue: x.venue, doi: x.doi, authors: (x.authors ?? []).map((a) => a.name), cited: x.cited_by_count }));

  const html = cvDocument(format, {
    name: p?.display_name ?? "", role: p?.role_title ?? "", institution: p?.institution ?? "", orcid: p?.orcid ?? null, summary: p?.cv_summary ?? "",
  }, (rows ?? []) as CvEntry[], papers, !asDoc);
  const file = `CV-${(p?.display_name ?? "me").replace(/[^A-Za-z0-9]+/g, "-")}-${format.toUpperCase()}`;
  return new Response(html, {
    headers: asDoc
      ? { "content-type": "application/msword; charset=utf-8", "content-disposition": `attachment; filename="${file}.doc"` }
      : { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}
