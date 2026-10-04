// Creates a new authenticator secret for the website's two-factor sign-in.
// Run on your own computer:  node scripts/new-totp-secret.mjs
// Then (1) add the key to your authenticator app (1Password, Google
// Authenticator, Microsoft Authenticator…) using "enter a setup key", and
// (2) paste the same key into Vercel as SITE_TOTP_SECRET. Don't share it.
import { randomBytes } from "node:crypto";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const bytes = randomBytes(20);
let bits = "";
for (const b of bytes) bits += b.toString(2).padStart(8, "0");
const key = bits.match(/.{5}/g).map((g) => alphabet[parseInt(g, 2)]).join("");
const account = encodeURIComponent("ParksPacific Company Brain");
console.log(`\nSetup key (time-based, 6 digits, 30 seconds):\n\n  ${key.match(/.{4}/g).join(" ")}\n`);
console.log(`Or, if your app accepts a link:\n\n  otpauth://totp/${account}?secret=${key}&issuer=ParksPacific&digits=6&period=30\n`);
