import { createClient } from "@/lib/supabase/server";
import { readPublications, type PubRow } from "@/lib/openalex/store";
import { examplePublications } from "@/lib/openalex/example";
import { DEMO_ORCID, normaliseOrcid } from "@/lib/openalex/sync";
import { isConfigured } from "@/lib/mode";

export const dynamic = "force-dynamic";

/**
 * Your publications as last synced from OpenAlex, as BibTeX (default) or CSV
 * with citation counts. Only your own: the publications table is readable by
 * its owner alone, and this route reads by the session's user id.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in first.", { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("orcid").eq("id", user.id).maybeSingle();
  const example = !isConfigured() && normaliseOrcid(profile?.orcid) === DEMO_ORCID;
  const pubs = (example ? examplePublications(user.id) : await readPublications(user.id))
    .sort((a, b) => (b.pub_date ?? `${b.year ?? 0}`).localeCompare(a.pub_date ?? `${a.year ?? 0}`));

  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "bib";
  const body = format === "csv" ? toCsv(pubs) : toBibtex(pubs);
  return new Response(body, {
    headers: {
      "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/x-bibtex; charset=utf-8",
      "content-disposition": `attachment; filename="publications.${format}"`,
    },
  });
}

function toCsv(pubs: PubRow[]): string {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    "title,year,venue,type,doi,citations,openalex_id",
    ...pubs.map((p) => [p.title, p.year, p.venue, p.type, p.doi, p.cited_by_count, p.openalex_id].map(cell).join(",")),
  ].join("\n");
}

/** Escapes what BibTeX treats specially; braces keep capitalisation as written. */
const tex = (s: string) => s.replace(/[\\{}]/g, "").replace(/([&%$#_])/g, "\\$1");

function toBibtex(pubs: PubRow[]): string {
  const used = new Set<string>();
  return pubs.map((p) => {
    const word = (p.title.match(/[A-Za-z]{4,}/)?.[0] ?? "work").toLowerCase();
    let key = `${word}${p.year ?? ""}`;
    for (let i = 2; used.has(key); i++) key = `${word}${p.year ?? ""}-${i}`;
    used.add(key);
    const type = p.type === "article" ? "article" : p.type === "book" ? "book" : "misc";
    const fields = [
      ["title", `{${tex(p.title)}}`],
      p.venue && [type === "article" ? "journal" : "howpublished", `{${tex(p.venue)}}`],
      p.year && ["year", String(p.year)],
      p.doi && ["doi", `{${p.doi}}`],
      !p.openalex_id.startsWith("W-example") && ["url", `{https://openalex.org/${p.openalex_id}}`],
      ["note", `{Cited by ${p.cited_by_count} (OpenAlex)}`],
    ].filter(Boolean) as [string, string][];
    return `@${type}{${key},\n${fields.map(([k, v]) => `  ${k} = ${v}`).join(",\n")}\n}`;
  }).join("\n\n") + "\n";
}
