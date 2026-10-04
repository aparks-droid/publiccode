import {
  SESSION_COOKIE,
  checkCredentials,
  codeRequired,
  gateConfigured,
  newSession,
} from "@/lib/server/site-auth";

// Repeated wrong guesses from one address are slowed and then refused for a
// while. (Per server instance; the authenticator code is the main defence.)
const failures = new Map<string, { count: number; until: number }>();
const clientOf = (req: Request) =>
  (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();

export function GET() {
  return Response.json(
    { codeRequired: codeRequired() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

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
  const who = clientOf(req);
  const record = failures.get(who);
  if (record && record.count >= 8 && record.until > Date.now())
    return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
  const { user, password, code } = await req.json().catch(() => ({}));
  if (!checkCredentials(user, password, code)) {
    const next = record && record.until > Date.now() ? record.count + 1 : 1;
    failures.set(who, { count: next, until: Date.now() + 15 * 60 * 1000 });
    await new Promise((r) => setTimeout(r, 800));
    return json(
      {
        error: codeRequired()
          ? "That username, password and code don’t match."
          : "That username and password don’t match.",
      },
      401,
    );
  }
  failures.delete(who);
  const session = newSession();
  const secure = (req.headers.get("x-forwarded-proto") || new URL(req.url).protocol).startsWith("https");
  return Response.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": `${SESSION_COOKIE}=${session.value}; Path=/; Expires=${session.expires.toUTCString()}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
      },
    },
  );
}

export async function DELETE() {
  return Response.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": `${SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`,
      },
    },
  );
}
