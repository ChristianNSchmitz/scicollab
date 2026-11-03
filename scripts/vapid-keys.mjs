// Prints a VAPID key pair for push notifications (lib/webpush.ts).
// Put both lines into .env.local (or the hosting provider's settings) and restart.
import { createECDH } from "node:crypto";
const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
console.log(`VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString("base64url")}`);
console.log(`VAPID_PRIVATE_KEY=${ecdh.getPrivateKey().toString("base64url")}`);
