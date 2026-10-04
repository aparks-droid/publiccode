import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  gateConfigured,
  gateEnabled,
  validSession,
} from "@/lib/server/site-auth";

// Everything on the hosted site requires sign-in. The local copy (127.0.0.1)
// is unaffected unless SITE_LOCK=1 is set for testing.
const open = ["/login", "/api/login", "/api/instinct", "/robots.txt"];

export function proxy(request: NextRequest) {
  const noindex = { "X-Robots-Tag": "noindex, nofollow" };
  if (!gateEnabled()) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (open.includes(pathname)) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", noindex["X-Robots-Tag"]);
    return res;
  }
  if (!gateConfigured())
    return new NextResponse(
      "This site is locked. Sign-in has not been configured yet.",
      { status: 503, headers: { ...noindex, "Content-Type": "text/plain" } },
    );
  if (validSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", noindex["X-Robots-Tag"]);
    return res;
  }
  if (pathname.startsWith("/api/"))
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401, headers: noindex },
    );
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login, { headers: noindex });
}

export const config = {
  // Skip build assets only; every page, API route and image goes through the gate.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
