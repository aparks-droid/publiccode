import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { GET } from "../src/app/api/instinct/route";
import { demoSnapshot } from "../src/lib/server/demo";

const key = "test-only-instinct-key";
const digest = createHash("sha256").update(key).digest("hex");
const originalHash = process.env.INSTINCT_KEY_HASH;
afterEach(() => {
  if (originalHash === undefined) delete process.env.INSTINCT_KEY_HASH;
  else process.env.INSTINCT_KEY_HASH = originalHash;
});
const request = (authorization?: string) => new Request("https://example.com/api/instinct", {
  headers: authorization ? { authorization } : {},
});

test("website reader requires a valid Bearer key and returns only the website snapshot", async () => {
  process.env.INSTINCT_KEY_HASH = digest;
  for (const authorization of [undefined, "Bearer wrong", `Basic ${key}`, `Bearer ${key} extra`]) {
    const result = GET(request(authorization));
    assert.equal(result.status, 401);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.equal(result.headers.get("www-authenticate"), "Bearer");
    assert.deepEqual(await result.json(), { error: "Invalid API key" });
  }
  const result = GET(request(`Bearer ${key}`));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.deepEqual(await result.json(), demoSnapshot());
  assert.equal(GET(request(`bearer ${key}`)).status, 200);
});

test("website reader fails closed with missing or malformed configuration", () => {
  for (const value of ["", "bad-config", "f".repeat(63), "z".repeat(64)]) {
    process.env.INSTINCT_KEY_HASH = value;
    assert.equal(GET(request(`Bearer ${key}`)).status, 503);
  }
});
