import { challengeResponse } from "@/lib/captcha";

/** A fresh captcha challenge for the contact form. Public, never cached. */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return challengeResponse(req);
}
