import test, { after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

// An in-memory stand-in for the owner's Supabase REST API. No network.
process.env.SUPABASE_URL = "https://company-brain-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
delete process.env.VERCEL;
delete process.env.BRAIN_DEMO;
const configDir = await mkdtemp(join(tmpdir(), "brain-todo-tests-"));
process.env.BRAIN_CONFIG_DIR = configDir;
after(() => rm(configDir, { recursive: true, force: true }));
afterEach(() => test.mock.restoreAll());

const { POST } = await import("../src/app/api/records/route");
const { csvToRecords } = await import("../src/lib/csv");
const { xlsx } = await import("../src/lib/xlsx");

type Row = Record<string, unknown>;
function fakeSupabase(tables: Record<string, Row[]>) {
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
const call = (body: object, host = "127.0.0.1:3000") =>
  POST(
    new Request(`http://${host}/api/records`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: `http://${host}` },
      body: JSON.stringify(body),
    }),
  );

const workspace = { id: "ws-1", name: "ParksPacific Financial", created_at: "2026-10-01" };
const source = { id: "src-1", workspace_id: "ws-1", kind: "web", mode: "imported", name: "Client workbook" };
const imported = csvToRecords(
  "id,Type,Task,Priority,Client,Due Date,Status\n12,Marketing,Post on LinkedIn,***,MISC,12/31/26,\n13,Admin,File receipts,*,ADMIN,,\n",
  "To do list",
).map((r, i) => ({ ...r, id: `rec-${i + 1}`, workspace_id: "ws-1", source_id: "src-1", updated_at: "" }));

test("add, edit, mark done and delete change only the owner's workbook to-dos", async () => {
  const tables: Record<string, Row[]> = {
    workspaces: [workspace],
    sources: [source],
    records: structuredClone(imported),
  };
  fakeSupabase(tables);

  // Add uses the list's own column names and the import's id rule.
  let res = await call({ action: "save", fields: { item: "Call the bank", priority: "****", category: "ADMIN", due: "1/15/2027" } });
  assert.equal(res.status, 200, await res.clone().text());
  const added = tables.records.find((r) => (r.metadata as Row).task === "Call the bank")!;
  const meta = added.metadata as Row;
  assert.equal(meta.client, "ADMIN"); // the list keeps categories in "client"
  assert.equal(meta.due_date, "1/15/2027");
  assert.equal(meta.priority, "****");
  assert.equal(meta.status, "Open");
  assert.equal(meta.sheet, "To do list");
  assert.equal(added.external_id, `sheet-task-${meta.id}`);
  assert.equal(added.source_id, "src-1");
  assert.match(String(added.content), /Call the bank/);

  // Edit keeps the row's identity and its own column names.
  res = await call({ action: "save", id: "rec-1", fields: { item: "Post twice on LinkedIn", priority: "****", category: "MARKETING", due: "", status: "Open" } });
  assert.equal(res.status, 200);
  const edited = tables.records.find((r) => r.id === "rec-1")!;
  assert.equal(edited.external_id, imported[0].external_id);
  assert.equal((edited.metadata as Row).task, "Post twice on LinkedIn");
  assert.equal((edited.metadata as Row).client, "MARKETING");
  assert.equal((edited.metadata as Row).due_date, undefined);
  assert.equal((edited.metadata as Row).type, "marketing");

  // Mark done and reopen.
  await call({ action: "done", id: "rec-2", done: true });
  assert.equal((tables.records.find((r) => r.id === "rec-2")!.metadata as Row).status, "Done");
  await call({ action: "done", id: "rec-2", done: false });
  assert.equal((tables.records.find((r) => r.id === "rec-2")!.metadata as Row).status, "Open");

  // Delete removes exactly one row.
  res = await call({ action: "delete", id: "rec-2" });
  assert.equal(res.status, 200);
  assert.deepEqual(tables.records.map((r) => r.id).sort(), ["rec-1", String(added.id)].sort());
});

test("records outside the workbook, unknown ids and remote callers are refused", async () => {
  const tables: Record<string, Row[]> = {
    workspaces: [workspace],
    sources: [source, { id: "src-2", workspace_id: "ws-1", kind: "stripe", mode: "live", name: "Stripe" }],
    records: [...structuredClone(imported), { id: "pay-1", workspace_id: "ws-1", source_id: "src-2", external_id: "ch_1", metadata: {} }],
  };
  fakeSupabase(tables);
  assert.equal((await call({ action: "delete", id: "pay-1" })).status, 400);
  assert.equal((await call({ action: "delete", id: "nope" })).status, 400);
  assert.equal((await call({ action: "save", fields: { item: "  " } })).status, 400);
  assert.equal((await call({ action: "delete", id: "rec-1" }, "brain.example")).status, 400);
  assert.equal(tables.records.length, 3);
});

test("the Excel download is a valid workbook that re-imports to the same ids", () => {
  const bytes = xlsx("To do", ["id", "type", "task", "priority"], [["12", "marketing", "Post <now> & \"then\"", "***"], ["A-1", "task", "Call", 3]]);
  // Walk the zip's local headers and collect each part.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Record<string, string> = {};
  for (let at = 0; view.getUint32(at, true) === 0x04034b50; ) {
    const size = view.getUint32(at + 18, true);
    const nameLen = view.getUint16(at + 26, true);
    const name = new TextDecoder().decode(bytes.slice(at + 30, at + 30 + nameLen));
    const data = bytes.slice(at + 30 + nameLen, at + 30 + nameLen + size);
    parts[name] = view.getUint16(at + 8, true) === 8 ? inflateRawSync(data).toString() : new TextDecoder().decode(data);
    at += 30 + nameLen + size;
  }
  assert.deepEqual(
    Object.keys(parts).sort(),
    ["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"],
  );
  const sheet = parts["xl/worksheets/sheet1.xml"];
  assert.match(sheet, /Post &lt;now&gt; &amp; &quot;then&quot;/);
  assert.match(sheet, /<c r="D3"><v>3<\/v><\/c>/);
  // Same columns back through the CSV import give the same external ids.
  const again = csvToRecords("id,type,task,priority\n12,marketing,Post,***\nA-1,task,Call,*\n", "To do list");
  assert.deepEqual(again.map((r) => r.external_id), ["sheet-marketing-12", "sheet-task-A-1"]);
  assert.equal(imported[0].external_id, "sheet-marketing-12");
});
