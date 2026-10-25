import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The files behind datasets and code files — demo store only.
 *
 * On the real platform a dataset row records where the data lives (a
 * repository, a DOI) and the files do not pass through SciCollab. The demo
 * has no repository to point at, so the persona set ships its example files
 * in demo-files/ and records the path in `file_path`. Nothing outside that
 * folder can be read, whatever the row says.
 *
 * Who may open a file is decided here and only here, for both the viewer and
 * the download, so the two cannot disagree.
 */

const ROOT = path.join(process.cwd(), "demo-files");

/** Absolute path for a stored relative path, or null if it would leave demo-files/. */
export function demoFilePath(rel: string | null | undefined): string | null {
  if (!rel || rel.includes("\0") || path.isAbsolute(rel)) return null;
  const abs = path.resolve(ROOT, rel);
  return abs.startsWith(ROOT + path.sep) ? abs : null;
}

export async function readDemoFile(rel: string | null | undefined): Promise<Buffer | null> {
  const abs = demoFilePath(rel);
  if (!abs) return null;
  try { return await readFile(abs); } catch { return null; }
}

type Client = SupabaseClient<any, "public", any>;
type Row = Record<string, any>;

export type FileAccess =
  | { ok: true; why: string }
  | { ok: false; why: string; askAt: { postId: string } | null };

export type ProjectFile = {
  project: Row;
  kind: "dataset" | "code";
  item: Row;
  access: FileAccess;
};

/**
 * One project file and whether `userId` may open it.
 *
 * - a private dataset: its owner only;
 * - a lab dataset, or any code in a lab project: the people on the project;
 * - a public dataset, or code in a public project: anyone signed in;
 * - and, whatever the above says, anyone a post has shared it with — openly,
 *   or by a granted access request — because the owner decided that there.
 */
export async function loadProjectFile(
  supabase: Client, userId: string, projectId: string, fileId: string,
): Promise<ProjectFile | null> {
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return null;

  const [{ data: ds }, { data: cf }] = await Promise.all([
    supabase.from("datasets").select("*").eq("id", fileId).eq("project_id", projectId).maybeSingle(),
    supabase.from("code_files").select("*").eq("id", fileId).eq("project_id", projectId).maybeSingle(),
  ]);
  const kind: "dataset" | "code" | null = ds ? "dataset" : cf ? "code" : null;
  const item = (ds ?? cf) as Row | null;
  if (!kind || !item) return null;

  const { data: members } = await supabase.from("project_members").select("user_id").eq("project_id", projectId);
  const isMember = (members ?? []).some((m: Row) => m.user_id === userId) || project.owner_id === userId;

  const { data: shared } = await supabase
    .from("post_attachments").select("*").eq(kind === "dataset" ? "dataset_id" : "code_file_id", fileId);
  const attachments = (shared ?? []) as Row[];
  const { data: requests } = attachments.length
    ? await supabase.from("access_requests").select("*").in("attachment_id", attachments.map((a) => a.id)).eq("requester_id", userId)
    : { data: [] as Row[] };

  const access = decide();
  return { project, kind, item, access };

  function decide(): FileAccess {
    if (kind === "dataset" && item!.owner_id === userId) return { ok: true, why: "Your dataset" };
    const visibility: string = kind === "dataset" ? item!.visibility : project!.visibility;

    if (visibility === "public") return { ok: true, why: "Public" };
    if (visibility === "lab" && isMember) return { ok: true, why: "You are on this project" };

    const open = attachments.find((a) => a.access === "open");
    if (open) return { ok: true, why: "Shared openly in a post" };
    const granted = (requests ?? []).find((r: Row) => r.status === "granted");
    if (granted) return { ok: true, why: "The owner granted you access" };

    const ask = attachments.find((a) => a.access === "on_request");
    return {
      ok: false,
      why: visibility === "private"
        ? "Private — only the owner can open it."
        : "Lab — only the people on this project can open it.",
      askAt: ask ? { postId: ask.post_id } : null,
    };
  }
}

/** A minimal CSV reader: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const TYPES: Record<string, string> = {
  ".csv": "text/csv", ".tsv": "text/tab-separated-values", ".py": "text/x-python", ".r": "text/plain",
  ".md": "text/markdown", ".txt": "text/plain", ".json": "application/json", ".yml": "text/yaml", ".yaml": "text/yaml",
};
export const contentTypeOf = (file: string) => {
  const t = TYPES[path.extname(file).toLowerCase()];
  return t ? `${t}; charset=utf-8` : "application/octet-stream";
};
export const baseName = (file: string) => path.basename(file);
