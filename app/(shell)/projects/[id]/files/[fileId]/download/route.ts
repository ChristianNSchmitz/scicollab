import { NextResponse } from "next/server";
import { sessionUser } from "@/lib/session";
import { isConfigured } from "@/lib/mode";
import { loadProjectFile, readDemoFile, contentTypeOf, baseName } from "@/lib/demo/files";

/**
 * Download one project file — demo store only.
 *
 * Same access decision as the viewer (lib/demo/files.ts). Refusals are a
 * plain 404 rather than a 403, so the response does not confirm that a file
 * the person may not open exists.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  if (isConfigured()) return new NextResponse("Not found", { status: 404 });
  const { id, fileId } = await params;
  const { supabase, user } = await sessionUser();
  if (!user) return new NextResponse("Sign in first", { status: 401 });

  const found = await loadProjectFile(supabase, user.id, id, fileId);
  if (!found || !found.access.ok || !found.item.file_path) return new NextResponse("Not found", { status: 404 });

  const raw = await readDemoFile(found.item.file_path);
  if (!raw) return new NextResponse("Not found", { status: 404 });

  const name = baseName(found.item.file_path).replace(/[^\w.\-]+/g, "_");
  return new NextResponse(new Uint8Array(raw), {
    headers: {
      "Content-Type": contentTypeOf(found.item.file_path),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(raw.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
