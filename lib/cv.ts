/**
 * The CV on a profile (supabase/21-researcher.sql, cv_entries): positions,
 * education, grants, awards, teaching, supervision, talks, memberships,
 * service to the community, career breaks. Exported in the order of the DFG
 * CV template and of the ERC CV (components of Part B1).
 */

export const CV_KINDS = ["position", "education", "grant", "award", "teaching", "supervision", "talk", "membership", "service", "break", "other"] as const;
export type CvKind = (typeof CV_KINDS)[number];
export type CvEntry = { id: string; user_id: string; kind: CvKind; title: string; org: string; place: string; start_on: string; end_on: string; detail: string };

export const CV_LABEL: Record<CvKind, { label: string; hint: string; title: string; org: string }> = {
  position:    { label: "Positions", hint: "Posts held, current first", title: "Position, e.g. Postdoctoral researcher", org: "Institution and department" },
  education:   { label: "Education and degrees", hint: "Degrees, habilitation, board certification", title: "Degree, e.g. Dr. med., PhD, Habilitation", org: "University" },
  grant:       { label: "Grants and funding", hint: "Third-party funding, your role", title: "Grant, e.g. DFG Walter Benjamin fellowship", org: "Funder, number, your role, amount" },
  award:       { label: "Awards and fellowships", hint: "Prizes and fellowships", title: "Award", org: "Awarded by" },
  teaching:    { label: "Teaching", hint: "Courses and lectures", title: "Course or lecture", org: "Institution" },
  supervision: { label: "Supervision", hint: "Students and postdocs you supervised", title: "e.g. 3 doctoral students, 2 master's theses", org: "Institution" },
  talk:        { label: "Invited talks", hint: "Talks at meetings and institutes", title: "Title of the talk", org: "Meeting or institute" },
  membership:  { label: "Memberships", hint: "Societies, boards, consortia", title: "Society or board", org: "Role" },
  service:     { label: "Service to the community", hint: "Reviewing, editing, committees, organising meetings", title: "e.g. Reviewer for Nature Neuroscience", org: "Journal, funder or committee" },
  break:       { label: "Career breaks", hint: "Parental leave, care, illness: funders extend eligibility for them", title: "e.g. Parental leave", org: "" },
  other:       { label: "Other", hint: "Anything else that belongs on a CV", title: "Entry", org: "Where" },
};

/** "2019-04" or "2019"; the end may be empty for "today". */
export const validMonth = (s: string) => s === "" || /^\d{4}(-(0[1-9]|1[0-2]))?$/.test(s);
export const span = (e: Pick<CvEntry, "start_on" | "end_on" | "kind">) =>
  !e.start_on && !e.end_on ? "" : e.start_on && !e.end_on ? (["position", "membership", "service", "teaching", "supervision"].includes(e.kind) ? `since ${e.start_on}` : e.start_on) : e.start_on && e.end_on && e.start_on !== e.end_on ? `${e.start_on} – ${e.end_on}` : e.end_on || e.start_on;

/** Newest first: what is going on now, then by start. */
export const sortCv = (a: CvEntry, b: CvEntry) =>
  Number(!b.end_on && !!b.start_on) - Number(!a.end_on && !!a.start_on) || (b.start_on || b.end_on).localeCompare(a.start_on || a.end_on);

export type CvFormat = "dfg" | "erc";
/** The sections of each format, in its order, each with the kinds that go in it. */
export const FORMAT: Record<CvFormat, { name: string; note: string; sections: { title: string; kinds: CvKind[] | "summary" | "papers" }[] }> = {
  dfg: {
    name: "DFG",
    note: "Ordered as in the DFG CV template. Check the current form on dfg.de before you submit; the DFG asks for at most ten publications.",
    sections: [
      { title: "Academic education and degrees", kinds: ["education"] },
      { title: "Positions", kinds: ["position"] },
      { title: "Career breaks", kinds: ["break"] },
      { title: "Scientific profile", kinds: "summary" },
      { title: "Selected publications (at most ten)", kinds: "papers" },
      { title: "Third-party funding", kinds: ["grant"] },
      { title: "Awards and fellowships", kinds: ["award"] },
      { title: "Supervision and teaching", kinds: ["supervision", "teaching"] },
      { title: "Commitment to the research community", kinds: ["service", "membership"] },
      { title: "Invited talks", kinds: ["talk"] },
      { title: "Other", kinds: ["other"] },
    ],
  },
  erc: {
    name: "ERC",
    note: "Ordered as the ERC Curriculum vitae and track record (Part B1). The ERC asks for at most two pages for the CV; check the current work programme.",
    sections: [
      { title: "Education", kinds: ["education"] },
      { title: "Current and previous positions", kinds: ["position"] },
      { title: "Fellowships and awards", kinds: ["award"] },
      { title: "Supervision of graduate students and postdoctoral fellows", kinds: ["supervision"] },
      { title: "Teaching activities", kinds: ["teaching"] },
      { title: "Commissions of trust, reviewing, organisation of meetings", kinds: ["service"] },
      { title: "Memberships of scientific societies", kinds: ["membership"] },
      { title: "Career breaks", kinds: ["break"] },
      { title: "Research profile", kinds: "summary" },
      { title: "Track record: up to ten publications", kinds: "papers" },
      { title: "Research grants", kinds: ["grant"] },
      { title: "Invited presentations", kinds: ["talk"] },
      { title: "Other", kinds: ["other"] },
    ],
  },
};

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type CvPerson = { name: string; role: string; institution: string; orcid: string | null; email?: string | null; summary: string };
export type CvPaper = { title: string; year: number | null; venue: string; doi: string | null; authors: string[]; cited: number };

/**
 * The CV as a standalone HTML document: printable to PDF from the browser,
 * and opened by Word when saved as .doc.
 */
export function cvDocument(format: CvFormat, who: CvPerson, entries: CvEntry[], papers: CvPaper[], toolbar = true): string {
  const f = FORMAT[format];
  const rows = (kinds: CvKind[]) => entries.filter((e) => kinds.includes(e.kind)).sort(sortCv);
  const section = (title: string, body: string) => body ? `<h2>${esc(title)}</h2>${body}` : "";
  const parts = f.sections.map((s) => {
    if (s.kinds === "summary") return section(s.title, who.summary ? `<p>${esc(who.summary).replace(/\n/g, "<br>")}</p>` : "");
    if (s.kinds === "papers") return section(s.title, papers.length ? `<ol>${papers.slice(0, 10).map((p) =>
      `<li>${esc(p.authors.slice(0, 6).join(", "))}${p.authors.length > 6 ? " et al." : ""} (${esc(p.year ?? "n.d.")}). ${esc(p.title)}. <i>${esc(p.venue)}</i>.${p.doi ? ` https://doi.org/${esc(p.doi)}` : ""}</li>`).join("")}</ol>` : "");
    const list = rows(s.kinds);
    return section(s.title, list.length ? `<table>${list.map((e) =>
      `<tr><td class="when">${esc(span(e))}</td><td><b>${esc(e.title)}</b>${e.org ? `, ${esc(e.org)}` : ""}${e.place ? `, ${esc(e.place)}` : ""}${e.detail ? `<div class="d">${esc(e.detail)}</div>` : ""}</td></tr>`).join("")}</table>` : "");
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CV ${esc(who.name)} (${f.name})</title>
<style>
body{font:11pt/1.45 Arial,Helvetica,sans-serif;color:#111;max-width:760px;margin:32px auto;padding:0 24px}
h1{font-size:16pt;margin:0 0 4px}h2{font-size:11.5pt;margin:18px 0 6px;padding-bottom:3px;border-bottom:1px solid #999}
.who{color:#333;margin:0 0 4px}.note{font-size:9pt;color:#666;margin:14px 0 0}
table{border-collapse:collapse;width:100%}td{vertical-align:top;padding:3px 0}td.when{width:130px;color:#333;padding-right:12px;white-space:nowrap}
.d{color:#444;font-size:10pt}ol{padding-left:20px;margin:0}li{margin:0 0 5px}
.bar{position:sticky;top:0;background:#fff;padding:8px 0;border-bottom:1px solid #ddd;margin-bottom:16px;font:13px Arial}
.bar button,.bar a{font:13px Arial;margin-right:8px}
@media print{.bar,.note{display:none}body{margin:0}}
</style></head><body>
${toolbar ? `<div class="bar"><button onclick="print()">Print or save as PDF</button><a href="?format=${format}&as=doc">Download for Word</a><a href="?format=${format === "dfg" ? "erc" : "dfg"}">${format === "dfg" ? "ERC" : "DFG"} layout</a></div>` : ""}
<h1>${esc(who.name)}</h1>
<p class="who">${esc([who.role, who.institution].filter(Boolean).join(", "))}</p>
${who.orcid ? `<p class="who">ORCID: https://orcid.org/${esc(who.orcid)}</p>` : ""}
${parts || "<p>No entries yet.</p>"}
<p class="note">${esc(f.note)}</p>
</body></html>`;
}
