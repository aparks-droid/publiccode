import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { hostedLive } from "./mode";

// Sign-in gate for the hosted site. Credentials come only from the hosting
// provider's environment settings (SITE_USER, SITE_PASSWORD and, for the
// website with real data, SITE_TOTP_SECRET); they are never stored in the
// repository. Without them the hosted site stays locked.
export const SESSION_COOKIE = "pp_session";
export const SESSION_HOURS = 12;

export const gateEnabled = () =>
  !!process.env.VERCEL || process.env.SITE_LOCK === "1";

// RFC 4648 base32, as shown by authenticator apps.
function base32(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.replace(/[\s=-]/g, "").toUpperCase();
  if (!/^[A-Z2-7]{16,}$/.test(clean)) return null;
  let bits = "";
  for (const c of clean) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const bytes = bits.match(/.{8}/g) || [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}
const totpKey = () => base32(process.env.SITE_TOTP_SECRET || "");

// The six-digit code an authenticator app shows for a 30-second step.
export function totpCode(key: Buffer, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", key).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const value = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

const credentials = () => {
  const user = process.env.SITE_USER || "";
  const password = process.env.SITE_PASSWORD || "";
  if (!user || password.length < 12) return null;
  const key = totpKey();
  // Real company data on the web requires a second factor.
  if (hostedLive() && !key) return null;
  return { user, password, key };
};
export const gateConfigured = () => !!credentials();
export const codeRequired = () => !!credentials()?.key;

const digest = (v: string) => createHash("sha256").update(v).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
// Changing the password or the authenticator secret ends every session.
const sign = (expires: number) => {
  const c = credentials();
  return c
    ? createHmac("sha256", `${c.user}\n${c.password}\n${process.env.SITE_TOTP_SECRET || ""}`)
        .update(`pp-site:${expires}`)
        .digest("hex")
    : "";
};

export function checkCredentials(user: unknown, password: unknown, code?: unknown, now = Date.now()) {
  const c = credentials();
  if (!c || typeof user !== "string" || typeof password !== "string") return false;
  // Evaluate every comparison so timing does not reveal which one failed.
  const userOk = same(user.trim(), c.user);
  const passOk = same(password, c.password);
  let codeOk = true;
  if (c.key) {
    const given = String(code ?? "").replace(/\s/g, "");
    const step = Math.floor(now / 30000);
    codeOk = false;
    // Allow one step either side for clock drift.
    for (const s of [step - 1, step, step + 1])
      if (/^\d{6}$/.test(given) && same(given, totpCode(c.key, s))) codeOk = true;
  }
  return userOk && passOk && codeOk;
}

export function newSession() {
  const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
  return { value: `${expires}.${sign(expires)}`, expires: new Date(expires) };
}

export function validSession(value: string | undefined) {
  if (!value || !credentials()) return false;
  const [raw, mac] = value.split(".");
  const expires = Number(raw);
  if (!expires || expires < Date.now() || !mac) return false;
  return same(mac, sign(expires));
}
