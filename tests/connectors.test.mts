import test, { afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pullSource } from "../src/lib/server/connectors";
import { assertLocal, readConfig, updateConfig } from "../src/lib/server/local";
const directory = await mkdtemp(join(tmpdir(), "brain-connectors-"));
process.env.BRAIN_CONFIG_DIR = directory;
delete process.env.VERCEL;
delete process.env.BRAIN_DEMO;
after(() => rm(directory, { recursive: true, force: true }));
afterEach(() => test.mock.restoreAll());

test("local keys persist with private file permissions and concurrent changes are preserved", async () => {
  await Promise.all([
    updateConfig((c) => ({
      ...c,
      connectors: { slack: { key: "test-slack-key", account: "Example" } },
    })),
    updateConfig((c) => ({
      ...c,
      ai: { provider: "openai", apiKey: "test-ai-key" },
    })),
  ]);
  const stored = await readConfig();
  assert.equal(stored.ai?.apiKey, "test-ai-key");
  assert.equal(stored.connectors?.slack?.key, "test-slack-key");
  assert.equal(
    (await stat(join(directory, "connections.json"))).mode & 0o777,
    0o600,
  );
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
});

test("local control rejects remote hosts, foreign origins, form posts and hosted saving", () => {
  const json = { "content-type": "application/json" };
  assert.doesNotThrow(() =>
    assertLocal(
      new Request("http://127.0.0.1:3000/api/sync", {
        method: "POST",
        headers: { ...json, origin: "http://127.0.0.1:3000" },
      }),
    ),
  );
  assert.doesNotThrow(() =>
    assertLocal(
      new Request("http://localhost:3000/api/sync", {
        method: "POST",
        headers: {
          ...json,
          host: "127.0.0.1:3000",
          origin: "http://127.0.0.1:3000",
        },
      }),
    ),
  );
  for (const req of [
    new Request("https://brain.example/api/sync"),
    new Request("http://localhost:3000/api/sync", {
      headers: { origin: "https://evil.example" },
    }),
    new Request("http://localhost:3000/api/sync", { method: "POST" }),
    new Request("http://localhost:3000/api/sync", {
      headers: { "sec-fetch-site": "cross-site" },
    }),
    new Request("http://localhost:3000/api/sync", {
      headers: { host: "evil.example" },
    }),
  ])
    assert.throws(() => assertLocal(req));
  process.env.VERCEL = "1";
  assert.throws(() =>
    assertLocal(new Request("http://localhost:3000/api/sync")),
  );
  delete process.env.VERCEL;
});

test("Slack follows channel and history cursors and preserves links and coverage", async () => {
  let histories = 0;
  test.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = new URL(String(input));
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer xoxb-test",
      );
      if (u.pathname.endsWith("auth.test"))
        return Response.json({
          ok: true,
          team: "Example",
          url: "https://example.slack.com/",
        });
      if (u.pathname.endsWith("conversations.list"))
        return Response.json({
          ok: true,
          channels: [{ id: "C1", name: "ops", is_member: true }],
          response_metadata: {},
        });
      histories++;
      if (histories === 1) {
        assert.equal(u.searchParams.get("cursor"), "");
        return Response.json({
          ok: true,
          messages: [
            {
              ts: "1790810000.000001",
              user: "U1",
              text: "Order delayed",
              reply_count: 2,
            },
          ],
          response_metadata: { next_cursor: "page2" },
        });
      }
      assert.equal(u.searchParams.get("cursor"), "page2");
      return Response.json({
        ok: true,
        messages: [
          { ts: "1790810001.000002", user: "U2", text: "Production paused" },
        ],
        response_metadata: {},
      });
    },
  );
  const result = await pullSource("slack", "xoxb-test");
  assert.equal(result.records.length, 2);
  assert.match(
    result.records[0].source_url!,
    /archives\/C1\/p1790810000000001/,
  );
  assert.match(result.summary, /Thread replies are not included/);
});

test("Stripe follows pages and preserves currency, partial refunds, and payment identity", async () => {
  let page = 0;
  test.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    page++;
    assert.equal(url.pathname, "/v1/charges");
    if (page === 2)
      assert.equal(url.searchParams.get("starting_after"), "ch_1");
    return Response.json({
      has_more: page === 1,
      data: [
        {
          id: `ch_${page}`,
          amount: page === 1 ? 10000 : 5000,
          amount_refunded: page === 1 ? 2500 : 0,
          currency: page === 1 ? "usd" : "jpy",
          created: 1790810000,
          status: "succeeded",
          payment_intent: "pi_1",
          billing_details: { name: "Sample customer" },
          livemode: false,
        },
      ],
    });
  });
  const result = await pullSource("stripe", "rk_test_fixture");
  assert.equal(result.records[0].metadata.net, 75);
  assert.equal(result.records[1].metadata.amount, 5000);
  assert.equal(result.records[0].metadata.payment_intent, "pi_1");
  assert.equal(result.account, "Stripe test data");
});

test("Attio fetches real deal attributes rather than invented stages or values", async () => {
  test.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(
        String(input),
        "https://api.attio.com/v2/objects/deals/records/query",
      );
      assert.deepEqual(JSON.parse(String(init?.body)), {
        limit: 100,
        offset: 0,
      });
      return Response.json({
        data: [
          {
            id: { record_id: "deal-1" },
            web_url: "https://app.attio.com/record/deal-1",
            values: {
              name: [{ value: "Example renewal" }],
              stage: [{ status: { title: "Contract review" } }],
              value: [{ currency_value: 48000, currency_code: "EUR" }],
            },
          },
        ],
      });
    },
  );
  const result = await pullSource("attio", "attio-test-key");
  assert.equal(result.records[0].metadata.stage, "Contract review");
  assert.equal(result.records[0].metadata.value, 48000);
  assert.equal(result.records[0].metadata.currency, "EUR");
});

test("provider auth and rate-limit failures never echo the key", async () => {
  test.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { error: { message: "secret-provider-payload" } },
      { status: 401 },
    ),
  );
  await assert.rejects(
    pullSource("stripe", "rk_test_secret"),
    /rejected this key/,
  );
  test.mock.restoreAll();
  test.mock.method(globalThis, "fetch", async () =>
    Response.json({}, { status: 429, headers: { "retry-after": "45" } }),
  );
  await assert.rejects(pullSource("attio", "secret"), /45 seconds/);
  assert.doesNotMatch(
    await readFile(join(directory, "connections.json"), "utf8"),
    /rk_test_secret/,
  );
});

test("the brain pages beyond the database response cap to include every connected source", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { readRecords } = await import("../src/lib/server/records");
  const pages: number[] = [];
  test.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const offset = Number(url.searchParams.get("offset") || 0);
    pages.push(offset);
    return Response.json(
      Array.from({ length: offset < 1000 ? 500 : 1 }, (_, n) => ({
        id: String(offset + n),
        source_id: offset < 1000 ? "slack" : "stripe",
      })),
    );
  });
  const rows = await readRecords(
    createClient("https://test.supabase.co", "test-key"),
    "test-workspace",
  );
  assert.equal(rows.length, 1001);
  assert.equal(rows[1000].source_id, "stripe");
  assert.deepEqual(pages, [0, 500, 1000]);
});
