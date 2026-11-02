import { NextResponse } from "next/server";
import { sessionUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { isConfigured } from "@/lib/mode";
import { canReadPost } from "@/lib/social/groups";
import { POST_FILE_BUCKET } from "@/lib/posts/files";

/**
 * Open a file attached to a post, for whoever can read the post. Against
 * Supabase: a redirect to a signed link valid for a minute. In demo mode the
 * file is sent from here, sandboxed so it can never act as a page of this site.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await sessionUser();
  if (!user) return new NextResponse("Sign in first.", { status: 401 });
  if (!isRowId(id)) return new NextResponse("Not found.", { status: 404 });
  const { data: f } = await supabase.from("post_files").select("post_id, name, mime, path").eq("id", id).maybeSingle();
  if (!f || !(await canReadPost(supabase, { id: f.post_id }, user.id))) return new NextResponse("Not found.", { status: 404 });

  if (isConfigured()) {
    const { data } = await supabase.storage.from(POST_FILE_BUCKET).createSignedUrl(f.path, 60);
    if (!data?.signedUrl) return new NextResponse("Not found.", { status: 404 });
    return NextResponse.redirect(data.signedUrl, 302);
  }
  const m = /^data:([^;]*);base64,(.*)$/.exec(f.path);
  if (!m) return new NextResponse("Not found.", { status: 404 });
  const viewable = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(m[1]);
  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: {
      "Content-Type": viewable ? m[1] : "application/octet-stream",
      "Content-Disposition": `${viewable ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
