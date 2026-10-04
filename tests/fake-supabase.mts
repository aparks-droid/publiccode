import test from "node:test";

export type Row = Record<string, unknown>;
// An in-memory stand-in for the owner's Supabase REST API. No network.
export function fakeSupabase(tables: Record<string, Row[]>) {
  let n = 0;
  test.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const table = url.pathname.replace("/rest/v1/", "");
    const rows = (tables[table] ||= []);
    const method = init?.method || "GET";
    const headers = new Headers(init?.headers);
    const filters = [...url.searchParams].filter(([k, v]) => /^(eq|neq)\./.test(v) && k !== "select");
    const match = (r: Row) =>
      filters.every(([k, v]) => {
        const [op, val] = [v.slice(0, v.indexOf(".")), v.slice(v.indexOf(".") + 1)];
        return op === "eq" ? String(r[k]) === val : String(r[k]) !== val;
      });
    const reply = (data: Row[]) => {
      if (headers.get("accept")?.startsWith("application/vnd.pgrst.object+json"))
        return data.length === 1
          ? Response.json(data[0])
          : Response.json({ code: "PGRST116", message: "not one row" }, { status: 406 });
      return Response.json(data);
    };
    if (method === "GET") {
      let found = rows.filter(match);
      const limit = Number(url.searchParams.get("limit") || 0);
      const range = headers.get("range");
      if (range) {
        const [a, b] = range.split("-").map(Number);
        found = found.slice(a, b + 1);
      }
      if (limit) found = found.slice(0, limit);
      return reply(found);
    }
    if (method === "POST") {
      const body = JSON.parse(String(init?.body));
      const made = (Array.isArray(body) ? body : [body]).map((r: Row) => ({ id: r.id || `row-${++n}`, ...r }));
      rows.push(...made);
      return reply(made);
    }
    if (method === "PATCH") {
      const body = JSON.parse(String(init?.body));
      const hit = rows.filter(match);
      hit.forEach((r) => Object.assign(r, body));
      return reply(hit);
    }
    if (method === "DELETE") {
      const keep = rows.filter((r) => !match(r));
      const gone = rows.length - keep.length;
      tables[table] = keep;
      return reply(new Array(gone).fill({}));
    }
    return new Response("unsupported", { status: 500 });
  });
}
