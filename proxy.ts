import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Next 16 replaces middleware.ts with proxy.ts. Refreshes the Supabase
 *  session cookie on every request and gates the authed routes. */
/* The design boards are an internal review — pricing strategy, the refused
   mechanics, the coverage audit and the open questions are all in there. They
   stay open in development and require a session anywhere else. */
// /api/cron checks its own secret; it has no session to offer.
const PUBLIC = ["/", "/login", "/signup", "/onboarding", "/api/cron"];
if (process.env.NODE_ENV !== "production" || process.env.SCICOLLAB_OPEN_BOARDS === "1") {
  PUBLIC.push("/boards");
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url || url.includes("placeholder")) {
    // Without a backend there is no session to check. In development that
    // should not stand in the way; in production it must not fail open, or a
    // misconfigured deploy silently publishes everything behind the gate.
    if (process.env.NODE_ENV !== "production" || isPublic) return response;
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    return NextResponse.redirect(to);
  }

  const supabase = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !isPublic) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.searchParams.set("next", pathname);
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
