import { randomBytes } from "node:crypto";
import { create, CappedMap, deriveHmacKeySecret, randomInt } from "altcha-lib/frameworks/nextjs";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";

/**
 * Captcha for the public forms — ALTCHA, a proof-of-work check.
 *
 * Why this one: it is open source (MIT) and runs entirely on our own server.
 * No third-party script, no cookie, no tracking, no data leaving the site —
 * which keeps the public pages consistent with the EU-sovereignty line in the
 * architecture handbook. reCAPTCHA and Cloudflare Turnstile both send the
 * visitor to a US provider.
 *
 * How it works: the browser has to find a number that, run through a slow
 * hash a few thousand times, produces a key starting with a given prefix.
 * A person never notices (≈1 s); a bot sending thousands of messages pays
 * that cost on every one. The server checks the answer in a millisecond.
 *
 * Secret: ALTCHA_HMAC_SECRET signs the challenges so they cannot be forged.
 * In development a random one is made per server start. In production it
 * must be set — several server instances must share it — and the form says
 * it is unavailable rather than silently accepting unsigned answers.
 */

type Altcha = ReturnType<typeof create>;
type State = { altcha: Altcha; hmac: string; hmacKey: string };

const store = new CappedMap<string, boolean>({ maxSize: 10_000 });

/* Kept on globalThis so a dev-server hot reload does not change the secret
   between issuing a challenge and checking its answer. */
const g = globalThis as unknown as { __scCaptcha?: Promise<State | null> };

export function captchaConfigured(): boolean {
  return Boolean(process.env.ALTCHA_HMAC_SECRET) || process.env.NODE_ENV !== "production";
}

async function init(): Promise<State | null> {
  let master = process.env.ALTCHA_HMAC_SECRET ?? "";
  if (!master) {
    if (process.env.NODE_ENV === "production") return null;
    master = randomBytes(32).toString("hex");
  }
  const hmac = master;
  const hmacKey = await deriveHmacKeySecret(master);
  const altcha = create({
    deriveKey,
    hmacSignatureSecret: hmac,
    hmacKeySignatureSecret: hmacKey,
    store,
    createChallengeParameters: () => ({
      algorithm: "PBKDF2/SHA-256",
      cost: 5_000,
      counter: randomInt(10_000, 5_000), // (max, min)
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // ten minutes to fill the form
    }),
  });
  return { altcha, hmac, hmacKey };
}

function state(): Promise<State | null> {
  g.__scCaptcha ??= init();
  return g.__scCaptcha;
}

/** GET /api/captcha — hands the browser a fresh signed challenge. */
export async function challengeResponse(req: Request): Promise<Response> {
  const s = await state();
  if (!s) return Response.json({ error: "Captcha is not configured." }, { status: 503 });
  return s.altcha.challengeHandler(req);
}

/** Checks the payload the widget put in the form. Each payload works once. */
export async function verifyCaptcha(payload: unknown): Promise<boolean> {
  const s = await state();
  if (!s || typeof payload !== "string" || !payload) return false;
  try {
    const result = await s.altcha.verify(payload, deriveKey, s.hmac, s.hmacKey, store);
    return !result.error && Boolean(result.verification && "verified" in result.verification && result.verification.verified);
  } catch {
    return false;
  }
}
