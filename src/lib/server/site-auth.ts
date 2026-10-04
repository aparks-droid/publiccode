import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Sign-in gate for the hosted site. Credentials come only from the hosting
// provider's environment settings (SITE_USER, SITE_PASSWORD); they are never
// stored in the repository. Without them the hosted site stays locked.
export const SESSION_COOKIE = "pp_session";
export const SESSION_HOURS = 12;

export const gateEnabled = () =>
  !!process.env.VERCEL || process.env.SITE_LOCK === "1";
const credentials = () => {
  const user = process.env.SITE_USER || "";
  const password = process.env.SITE_PASSWORD || "";
  return user && password.length >= 12 ? { user, password } : null;
};
export const gateConfigured = () => !!credentials();

const digest = (v: string) => createHash("sha256").update(v).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
// Changing the password invalidates every existing session.
const sign = (expires: number) => {
  const c = credentials();
  return c
    ? createHmac("sha256", `${c.user}\n${c.password}`)
        .update(`pp-site:${expires}`)
        .digest("hex")
    : "";
};

export function checkCredentials(user: unknown, password: unknown) {
  const c = credentials();
  if (!c || typeof user !== "string" || typeof password !== "string")
    return false;
  // Evaluate both comparisons so timing does not reveal which one failed.
  const userOk = same(user.trim(), c.user);
  const passOk = same(password, c.password);
  return userOk && passOk;
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
