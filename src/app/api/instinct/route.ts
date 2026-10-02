import { createHash, timingSafeEqual } from "node:crypto";
import { demoSnapshot } from "@/lib/server/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const expected = process.env.INSTINCT_KEY_HASH ?? "";
  if (!/^[a-f0-9]{64}$/i.test(expected)) {
    return Response.json({ error: "Integration unavailable" }, { status: 503, headers });
  }

  const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token || !timingSafeEqual(createHash("sha256").update(token).digest(), Buffer.from(expected, "hex"))) {
    return Response.json({ error: "Invalid API key" }, {
      status: 401,
      headers: { ...headers, "WWW-Authenticate": "Bearer" },
    });
  }

  // The hosted website's /api/brain route uses this same bundled snapshot.
  return Response.json(demoSnapshot(), { headers });
}
