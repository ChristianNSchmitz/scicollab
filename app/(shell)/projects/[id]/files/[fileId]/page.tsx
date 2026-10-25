import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isConfigured } from "@/lib/mode";
import { loadProjectFile, readDemoFile, parseCsv } from "@/lib/demo/files";
import { Page, Panel, PanelHead, Empty, Visibility, btnPrimary, mono } from "@/components/ui";
import { bytes, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * One file from a project — a dataset or a piece of code — opened in place.
 *
 * Demo store only: on the real platform the files live in the owner's
 * repository and the dataset row says where. The access decision is made in
 * lib/demo/files.ts, the same function the download uses.
 */

const PREVIEW_ROWS = 40;
const MAX_INLINE = 2_000_000;

export default async function ProjectFile({
  params,
}: {
  params: Promise<{ id: string; fileId: string }>;
}) {
  if (isConfigured()) notFound();
  const { id, fileId } = await params;
  const { supabase, user } = await requireUser();

  const found = await loadProjectFile(supabase, user.id, id, fileId);
  if (!found) notFound();
  const { project, kind, item, access } = found;

  const title = kind === "dataset" ? item.title : item.path;
  const back = `/projects/${project.id}?tab=${kind === "dataset" ? "data" : "code"}`;
  const download = `/projects/${project.id}/files/${item.id}/download`;
  const meta = kind === "dataset"
    ? [bytes(item.size_bytes), item.licence, `deposited ${timeAgo(item.created_at)}`].filter(Boolean).join(" · ")
    : [item.language, bytes(item.size_bytes), `changed ${timeAgo(item.updated_at ?? item.created_at)}`].filter(Boolean).join(" · ");

  const head = (
    <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", marginBottom: 12, font: mono(11.5) }}>
      <Link href={back} style={{ color: "var(--ink)" }}>← {project.title}</Link>
      <span style={{ color: "var(--mute)" }}>·</span>
      <Visibility value={kind === "dataset" ? item.visibility : project.visibility} />
      <span style={{ color: "var(--mute)" }}>{meta}</span>
    </div>
  );

  if (!access.ok) {
    let askTitle = "";
    if (access.askAt) {
      const { data: post } = await supabase.from("posts").select("id, title").eq("id", access.askAt.postId).maybeSingle();
      askTitle = post?.title ?? "";
    }
    return (
      <Page title={title} lede={kind === "dataset" ? item.summary || undefined : undefined}>
        {head}
        <Panel style={{ borderColor: "var(--flag)" }}>
          <PanelHead>Not shared with you</PanelHead>
          <div style={{ padding: 14, font: "400 13.5px/1.65 var(--sans)" }}>
            <p style={{ margin: 0 }}>{access.why} You can see that it exists and what shape it is; the contents stay with the owner.</p>
            {access.askAt && (
              <p style={{ margin: "10px 0 0" }}>
                The owner shares it on request in{" "}
                <Link href={`/posts/${access.askAt.postId}`} style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {askTitle || "a post"}
                </Link>
                {" "}— ask there.
              </p>
            )}
          </div>
        </Panel>
      </Page>
    );
  }

  const raw = item.file_path ? await readDemoFile(item.file_path) : null;
  const actions = raw ? (
    <a href={download} style={{ ...btnPrimary, textDecoration: "none" }} download>Download</a>
  ) : undefined;

  return (
    <Page title={title} lede={kind === "dataset" ? item.summary || undefined : item.last_change ? `Last change: ${item.last_change}` : undefined} actions={actions}>
      {head}
      <div style={{ font: mono(10.5), color: "var(--ok)", marginBottom: 12 }}>{access.why.toUpperCase()}</div>
      {!raw ? (
        <Panel>
          <Empty>
            {kind === "dataset"
              ? "The files are not uploaded here. They stay where the owner keeps them — the entry records what they are."
              : "This file has no stored contents."}
          </Empty>
        </Panel>
      ) : raw.length > MAX_INLINE ? (
        <Panel><Empty>Too large to show here ({bytes(raw.length)}). Download it instead.</Empty></Panel>
      ) : /\.csv$/i.test(item.file_path) ? (
        <CsvPreview text={raw.toString("utf8")} />
      ) : (
        <CodeView text={raw.toString("utf8")} label={item.path ?? item.file_path} />
      )}
    </Page>
  );
}

function CsvPreview({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  // Leading "#" lines are notes about the file (provenance, units), not rows.
  const notes: string[] = [];
  while (lines.length && lines[0].startsWith("#")) notes.push(lines.shift()!.replace(/^#\s?/, ""));
  const rows = parseCsv(lines.join("\n")).filter((r) => r.some((c) => c.trim() !== ""));
  const [header = [], ...body] = rows;
  const shown = body.slice(0, PREVIEW_ROWS);
  const numeric = header.map((_, j) => shown.length > 0 && shown.every((r) => r[j] === "" || r[j] === undefined || !isNaN(Number(r[j]))));

  return (
    <Panel>
      <PanelHead>
        Table · {body.length.toLocaleString("en")} rows × {header.length} columns
        {body.length > shown.length ? ` · first ${shown.length} shown` : ""}
      </PanelHead>
      {notes.length > 0 && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)", font: mono(11.5, 400, 1.6), color: "var(--mute)" }}>
          {notes.map((n, i) => <div key={i}>{n}</div>)}
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", font: mono(11.5, 400, 1.45) }}>
          <thead>
            <tr>
              {header.map((h, j) => (
                <th key={j} scope="col" style={{ textAlign: numeric[j] ? "right" : "left", padding: "7px 10px", borderBottom: "1px solid var(--ink)", whiteSpace: "nowrap", fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>
                {header.map((_, j) => (
                  <td key={j} style={{ textAlign: numeric[j] ? "right" : "left", padding: "5px 10px", borderBottom: "1px solid var(--rule)", whiteSpace: "nowrap" }}>{r[j] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {body.length > shown.length && (
        <div style={{ padding: "10px 14px", font: mono(11), color: "var(--mute)" }}>
          {(body.length - shown.length).toLocaleString("en")} more rows in the file.
        </div>
      )}
    </Panel>
  );
}

function CodeView({ text, label }: { text: string; label: string }) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  const width = String(lines.length).length;
  return (
    <Panel>
      <PanelHead>{label} · {lines.length} line{lines.length === 1 ? "" : "s"}</PanelHead>
      <div style={{ overflowX: "auto", background: "var(--bg)" }}>
        <pre aria-label={`${label} source`} style={{ margin: 0, padding: "10px 0", font: mono(12.5, 400, 1.55), color: "var(--ink)" }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: "flex", whiteSpace: "pre" }}>
              <span aria-hidden="true" style={{ display: "inline-block", minWidth: `${width + 3}ch`, padding: "0 12px 0 14px", textAlign: "right", color: "var(--mute)", userSelect: "none", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ paddingRight: 14 }}>{l || " "}</span>
            </div>
          ))}
        </pre>
      </div>
    </Panel>
  );
}

