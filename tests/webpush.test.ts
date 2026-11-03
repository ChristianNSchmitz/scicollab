import { test } from "node:test";
import assert from "node:assert/strict";
import { createECDH, createHmac, createDecipheriv, randomBytes, createPublicKey, verify } from "node:crypto";
import { encryptPayload, vapidHeader, isPushEndpoint } from "../lib/webpush.ts";

const hkdf = (salt: Buffer, ikm: Buffer, info: Buffer, n: number) => {
  const prk = createHmac("sha256", salt).update(ikm).digest();
  return createHmac("sha256", prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, n);
};

test("a push message decrypts on the browser's side (RFC 8291)", () => {
  const ua = createECDH("prime256v1"); ua.generateKeys();
  const auth = randomBytes(16);
  const body = encryptPayload(Buffer.from('{"title":"Hi"}'), { p256dh: ua.getPublicKey().toString("base64url"), auth: auth.toString("base64url") });
  const salt = body.subarray(0, 16), idlen = body[20], asPublic = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  assert.equal(body.readUInt32BE(16), 4096);
  const shared = ua.computeSecret(asPublic);
  const ikm = hkdf(auth, shared, Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPublic]), 32);
  const d = createDecipheriv("aes-128-gcm", hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16), hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12));
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  assert.equal(plain.subarray(0, -1).toString(), '{"title":"Hi"}');
  assert.equal(plain[plain.length - 1], 2);
});

test("the VAPID header carries a valid ES256 signature", () => {
  const k = createECDH("prime256v1"); k.generateKeys();
  const pub = k.getPublicKey().toString("base64url");
  const h = vapidHeader("https://fcm.googleapis.com/fcm/send/abc", pub, k.getPrivateKey().toString("base64url"), "mailto:team@example.org");
  const m = h.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)!;
  assert.equal(m[4], pub);
  assert.equal(JSON.parse(Buffer.from(m[2], "base64url").toString()).aud, "https://fcm.googleapis.com");
  const raw = Buffer.from(pub, "base64url");
  const key = createPublicKey({ key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33).toString("base64url") }, format: "jwk" });
  assert.ok(verify("sha256", Buffer.from(`${m[1]}.${m[2]}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(m[3], "base64url")));
});

test("only real push services are accepted as endpoints", () => {
  assert.ok(isPushEndpoint("https://fcm.googleapis.com/fcm/send/x"));
  assert.ok(isPushEndpoint("https://web.push.apple.com/abc"));
  assert.equal(isPushEndpoint("https://evil.example.org/x"), false);
  assert.equal(isPushEndpoint("http://fcm.googleapis.com/x"), false);
});
