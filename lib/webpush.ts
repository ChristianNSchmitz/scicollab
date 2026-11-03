import { createECDH, createHmac, createCipheriv, createPrivateKey, randomBytes, sign } from "node:crypto";

/**
 * Web Push without a package: the message is encrypted for the browser
 * (RFC 8291, aes128gcm) and the request signed with the site's VAPID key
 * (RFC 8292). The keys come from VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
 * (base64url; make a pair with `node scripts/vapid-keys.mjs`). Without them
 * nothing is sent and the settings page says so.
 */

export type PushSub = { endpoint: string; p256dh: string; auth: string };

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number): Buffer {
  const prk = createHmac("sha256", salt).update(ikm).digest();
  return createHmac("sha256", prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, length);
}

/** The encrypted body for one subscription (one record, RFC 8188). */
export function encryptPayload(payload: Buffer, sub: { p256dh: string; auth: string }, opts?: { salt?: Buffer; ecdh?: ReturnType<typeof createECDH> }): Buffer {
  const uaPublic = fromB64u(sub.p256dh);
  const authSecret = fromB64u(sub.auth);
  const ecdh = opts?.ecdh ?? createECDH("prime256v1");
  if (!opts?.ecdh) ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const ikm = hkdf(authSecret, shared, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]), 32);
  const salt = opts?.salt ?? randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

/** The VAPID Authorization header for an endpoint's origin. */
export function vapidHeader(endpoint: string, publicKey: string, privateKey: string, subject: string): string {
  const pub = fromB64u(publicKey);
  const key = createPrivateKey({ key: { kty: "EC", crv: "P-256", x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: privateKey }, format: "jwk" });
  const head = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = sign("sha256", Buffer.from(`${head}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${publicKey}`;
}

/** Push services this site sends to; anything else is refused (the endpoint comes from a browser). */
const PUSH_HOSTS = [/\.googleapis\.com$/, /\.push\.apple\.com$/, /\.mozilla\.com$/, /\.mozaws\.net$/, /\.notify\.windows\.com$/];
export const isPushEndpoint = (endpoint: string) => {
  try { const u = new URL(endpoint); return u.protocol === "https:" && PUSH_HOSTS.some((r) => r.test(u.hostname)); } catch { return false; }
};

/** Send one message. "gone" means the browser unsubscribed: the subscription can be deleted. */
export async function sendPush(sub: PushSub, message: { title: string; body: string; url: string }): Promise<"ok" | "gone" | "failed"> {
  if (!pushConfigured() || !isPushEndpoint(sub.endpoint)) return "failed";
  const subject = process.env.VAPID_SUBJECT || process.env.SCICOLLAB_SITE_URL || "https://scicollab.net";
  try {
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidHeader(sub.endpoint, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!, subject),
        "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "normal",
      },
      body: new Uint8Array(encryptPayload(Buffer.from(JSON.stringify(message)), sub)),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "ok" : "failed";
  } catch { return "failed"; }
}
