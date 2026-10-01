import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const workspace = "00000000-0000-4000-8000-000000000001",
  source = "00000000-0000-4000-8000-000000000002";
before(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid';`,
  );
  const sql = (
    await readFile(new URL("../supabase/setup.sql", import.meta.url), "utf8")
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(sql);
  await db.exec(
    "grant usage on schema public to service_role, anon, authenticated; grant all on all tables in schema public to service_role, anon, authenticated;",
  );
  await db.query("insert into workspaces(id,name) values($1,$2)", [
    workspace,
    "Test company",
  ]);
  await db.query(
    "insert into sources(id,workspace_id,name,kind,mode) values($1,$2,'Test Stripe','stripe','live')",
    [source, workspace],
  );
});
after(() => db.close());
const row = (id: string, content = "Test evidence") => ({
  external_id: id,
  title: "Test payment",
  domain: "finance",
  content,
  metadata: { amount: 100, currency: "USD" },
});

test("a fresh install executes the complete schema and exposes readiness only to service_role", async () => {
  await db.exec("set role service_role");
  const { rows } = await db.query<{ brain_server_ready: boolean }>(
    "select brain_server_ready()",
  );
  assert.equal(rows[0].brain_server_ready, true);
  await db.exec("reset role; set role anon");
  await assert.rejects(
    db.query("select brain_server_ready()"),
    /permission denied/,
  );
  const visible = await db.query("select * from workspaces");
  assert.equal(visible.rows.length, 0);
  await assert.rejects(
    db.query("insert into workspaces(name) values ('Forbidden')"),
    /row-level security/,
  );
  await db.exec("reset role");
});

test("sync replaces the bounded snapshot atomically and repeated external IDs update instead of duplicating", async () => {
  await db.exec("set role service_role");
  await db.query("select replace_source_records($1,$2,$3,$4)", [
    source,
    workspace,
    JSON.stringify([row("ch_1"), row("ch_2")]),
    "First snapshot",
  ]);
  await db.query("select replace_source_records($1,$2,$3,$4)", [
    source,
    workspace,
    JSON.stringify([row("ch_1", "Updated amount")]),
    "Second snapshot",
  ]);
  const records = await db.query<{ content: string; external_id: string }>(
    "select content,external_id from records",
  );
  assert.deepEqual(records.rows, [
    { content: "Updated amount", external_id: "ch_1" },
  ]);
  const state = await db.query<{ status: string; sync_summary: string }>(
    "select status,sync_summary from sources",
  );
  assert.equal(state.rows[0].status, "connected");
  assert.equal(state.rows[0].sync_summary, "Second snapshot");
  await db.exec("reset role");
});

test("a bad source record rolls back the entire sync and preserves the prior snapshot", async () => {
  await db.exec("set role service_role");
  await assert.rejects(
    db.query("select replace_source_records($1,$2,$3,$4)", [
      source,
      workspace,
      JSON.stringify([row("new"), { ...row("bad"), domain: "invalid" }]),
      "Failed snapshot",
    ]),
    /check constraint/,
  );
  const { rows } = await db.query<{ content: string }>(
    "select content from records",
  );
  assert.deepEqual(rows, [{ content: "Updated amount" }]);
  const search = await db.query<{ external_id: string }>(
    "select external_id from search_records($1,$2)",
    [workspace, "updated"],
  );
  assert.deepEqual(search.rows, [{ external_id: "ch_1" }]);
  await db.exec("reset role");
});
