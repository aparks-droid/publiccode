import test, { after, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeSupabase, type Row } from "./fake-supabase.mjs";

// The owner's private website: real data behind password + authenticator code.
const configDir = await mkdtemp(join(tmpdir(), "brain-hosted-tests-"));
process.env.BRAIN_CONFIG_DIR = configDir;
after(() => rm(configDir, { recursive: true, force: true }));
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // RFC 6238 test key
const env = {
  VERCEL: "1",
  BRAIN_HOSTED: "1",
  SITE_USER: "aaron",
  SITE_PASSWORD: "a-long-test-password",
  SITE_TOTP_SECRET: SECRET,
  SUPABASE_URL: "https://company-brain-test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-key",
  BRAIN_ANTHROPIC_API_KEY: "test-anthropic-key",
};
beforeEach(() => {
  delete process.env.BRAIN_DEMO;
  delete process.env.SITE_LOCK;
  Object.assign(process.env, env);
});
afterEach(() => test.mock.restoreAll());
after(() => {
  for (const k of Object.keys(env)) delete process.env[k];
});

const auth = await import("../src/lib/server/site-auth");
const local = await import("../src/lib/server/local");
const { GET: brainGet } = await import("../src/app/api/brain/route");
const { POST: records } = await import("../src/app/api/records/route");
const { POST: run } = await import("../src/app/api/run/route");
const { POST: login } = await import("../src/app/api/login/route");

const key = Buffer.from("12345678901234567890");
const codeAt = (ms: number) => auth.totpCode(key, Math.floor(ms / 30000));
const session = () => `${auth.SESSION_COOKIE}=${auth.newSession().value}`;
const req = (path: string, init: { method?: string; body?: object; cookie?: string; origin?: string } = {}) =>
  new Request(`https://brain.example${path}`, {
    method: init.method || (init.body ? "POST" : "GET"),
    headers: {
      host: "brain.example",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
      origin: init.origin || "https://brain.example",
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });

test("authenticator codes match RFC 6238 and are required on the website", () => {
  assert.equal(auth.totpCode(key, 1), "287082");
  assert.equal(auth.totpCode(key, Math.floor(1111111109 / 30)), "081804");
  const now = 1_700_000_000_000;
  assert.ok(auth.checkCredentials("aaron", "a-long-test-password", codeAt(now), now));
  assert.ok(auth.checkCredentials("aaron", "a-long-test-password", codeAt(now - 30000), now), "one step of drift");
  assert.ok(!auth.checkCredentials("aaron", "a-long-test-password", codeAt(now - 120000), now), "old code");
  assert.ok(!auth.checkCredentials("aaron", "a-long-test-password", "", now), "missing code");
  assert.ok(!auth.checkCredentials("aaron", "wrong-password-here", codeAt(now), now));
  // Without an authenticator secret the website stays locked.
  delete process.env.SITE_TOTP_SECRET;
  assert.equal(auth.gateConfigured(), false);
  assert.equal(auth.validSession(auth.newSession().value), false);
});

test("previews without BRAIN_HOSTED stay sample-only; the website does not", () => {
  assert.equal(local.demoMode(), false);
  assert.equal(local.hostedLive(), true);
  delete process.env.BRAIN_HOSTED;
  assert.equal(local.demoMode(), true);
  assert.equal(local.hostedLive(), false);
});

test("website settings come from Vercel and cannot be written", async () => {
  const config = await local.readConfig();
  assert.equal(config.ai?.provider, "anthropic");
  assert.equal(config.ai?.apiKey, "test-anthropic-key");
  assert.equal(config.database, undefined); // read from SUPABASE_* by database()
  await assert.rejects(local.updateConfig((c) => c), /managed in Vercel/);
});

test("every data route needs a signed-in session from the site itself", async () => {
  const tables: Record<string, Row[]> = {
    workspaces: [{ id: "ws-1", name: "ParksPacific Financial", created_at: "2026-10-01" }],
    sources: [{ id: "src-1", workspace_id: "ws-1", kind: "web", mode: "imported", name: "Client workbook", status: "connected" }],
    records: [{ id: "rec-1", workspace_id: "ws-1", source_id: "src-1", external_id: "sheet-task-1", domain: "company", title: "Task — Call the bank", content: "task: Call the bank", metadata: { sheet: "To do list", type: "task", id: "1", task: "Call the bank", status: "Open" } }],
    issues: [],
    messages: [],
  };
  fakeSupabase(tables);
  // Signed out: refused.
  assert.equal((await brainGet(req("/api/brain"))).status, 400);
  assert.equal((await records(req("/api/records", { body: { action: "delete", id: "rec-1" } }))).status, 400);
  // Forged or cross-site: refused.
  assert.equal((await brainGet(req("/api/brain", { cookie: `${auth.SESSION_COOKIE}=9999999999999.abc` }))).status, 400);
  assert.equal(
    (await records(req("/api/records", { body: { action: "delete", id: "rec-1" }, cookie: session(), origin: "https://evil.example" }))).status,
    400,
  );
  assert.equal(tables.records.length, 1);
  // Signed in: the owner's real records, flagged as the website.
  const res = await brainGet(req("/api/brain", { cookie: session() }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.demo, false);
  assert.equal(data.hosted, true);
  assert.equal(data.configured, true);
  assert.equal(data.records.length, 1);
  assert.equal(data.ai.provider, "anthropic");
  assert.equal(JSON.stringify(data).includes("test-anthropic-key"), false, "keys never reach the browser");
  assert.equal(JSON.stringify(data).includes("test-only-key"), false);
  // To-do changes work when signed in.
  const done = await records(req("/api/records", { body: { action: "done", id: "rec-1", done: true }, cookie: session() }));
  assert.equal(done.status, 200);
  assert.equal((tables.records[0].metadata as Row).status, "Done");
  // Automatic checks are local-only.
  const checked = await run(req("/api/run", { body: {}, cookie: session() }));
  assert.equal(checked.status, 400);
  assert.match((await checked.json()).error, /local copy/);
});

test("sign-in needs the code and refuses repeated guessing", async () => {
  const attempt = (code: string, ip = "203.0.113.9") =>
    login(
      new Request("https://brain.example/api/login", {
        method: "POST",
        headers: { "content-type": "application/json", host: "brain.example", origin: "https://brain.example", "x-forwarded-for": ip },
        body: JSON.stringify({ user: "aaron", password: "a-long-test-password", code }),
      }),
    );
  test.mock.method(globalThis, "setTimeout", (fn: () => void) => (fn(), 0));
  assert.equal((await attempt("000000")).status, 401);
  const ok = await attempt(codeAt(Date.now()), "203.0.113.10");
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("set-cookie") || "", /pp_session=.*HttpOnly.*Secure/i);
  for (let i = 0; i < 8; i++) await attempt("111111", "198.51.100.7");
  assert.equal((await attempt(codeAt(Date.now()), "198.51.100.7")).status, 429);
});
