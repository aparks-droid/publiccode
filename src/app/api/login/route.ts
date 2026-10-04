import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  checkCredentials,
  gateConfigured,
  newSession,
} from "@/lib/server/site-auth";

export const dynamic = "force-dynamic";
const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  if (!gateConfigured()) return json({ error: "Sign-in is not configured." }, 503);
  if (!req.headers.get("content-type")?.includes("application/json"))
    return json({ error: "Send the sign-in form." }, 400);
  // Next can normalize req.url, so compare the browser's Origin with the Host
  // header the request actually arrived on.
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (origin && (!host || new URL(origin).host !== host))
    return json({ error: "Sign in from this site." }, 403);
  if (req.headers.get("sec-fetch-site") === "cross-site")
    return json({ error: "Sign in from this site." }, 403);
  const { user, password } = await req.json().catch(() => ({}));
  if (!checkCredentials(user, password)) {
    // Slow repeated guesses a little.
    await new Promise((r) => setTimeout(r, 800));
    return json({ error: "That username and password don’t match." }, 401);
  }
  const session = newSession();
  (await cookies()).set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure:
      (req.headers.get("x-forwarded-proto") || new URL(req.url).protocol).startsWith("https"),
    sameSite: "lax",
    path: "/",
    expires: session.expires,
  });
  return json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
}
