/**
 * Files shared inside a group (supabase/13-group-workspace.sql): protocols,
 * SOPs, slides, small tables. Stored in the private group-files bucket and
 * handed out through short-lived links by app/api/group-files/[id].
 */

export const FILE_BUCKET = "group-files";
/** Under the 4 MB server action limit (next.config.ts) and the bucket's limit. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024 - 64 * 1024;

const ALLOWED = ["pdf", "doc", "docx", "odt", "rtf", "txt", "md", "csv", "tsv", "xls", "xlsx", "ods",
  "ppt", "pptx", "odp", "png", "jpg", "jpeg", "webp", "svg", "zip", "json", "xml", "fcs", "R", "r", "py", "ipynb"];
export const FILE_ACCEPT = ALLOWED.map((e) => `.${e}`).join(",");

export function allowedFile(name: string): boolean {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  return ALLOWED.includes(ext) || ALLOWED.includes(ext.toLowerCase());
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
