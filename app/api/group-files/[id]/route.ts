import { NextResponse } from "next/server";
import { sessionUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { isConfigured } from "@/lib/mode";
import { roleIn, isCurrent } from "@/lib/social/groups";
import { FILE_BUCKET } from "@/lib/social/group-files";

/**
 * Download one file shared in a group, for the group's current members.
 * Against Supabase: a redirect to a signed link valid for a minute. In demo
 * mode the file is kept inline and sent from here. Always as a download,
 * never rendered as a page of this site.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await sessionUser();
  if (!user) return new NextResponse("Sign in first.", { status: 401 });
  if (!isRowId(id)) return new NextResponse("Not found.", { status: 404 });
  const { data: f } = await supabase.from("group_files").select("group_id, name, mime, path").eq("id", id).maybeSingle();
  // The database hides the row from non-members; the demo store does not, so ask.
  if (!f || !isCurrent(await roleIn(supabase, f.group_id, user.id))) return new NextResponse("Not found.", { status: 404 });

  if (isConfigured()) {
    const { data } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(f.path, 60, { download: f.name });
    if (!data?.signedUrl) return new NextResponse("Not found.", { status: 404 });
    return NextResponse.redirect(data.signedUrl, 302);
  }
  const m = /^data:[^;]*;base64,(.*)$/.exec(f.path);
  if (!m) return new NextResponse("Not found.", { status: 404 });
  return new NextResponse(Buffer.from(m[1], "base64"), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
