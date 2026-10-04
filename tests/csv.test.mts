import { test } from "node:test";
import assert from "node:assert/strict";
import { csvToRecords, parseCsv } from "../src/lib/csv";

test("parses quoted fields, escaped quotes and CRLF", () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n'), [
    ["a", "b"],
    ["x, y", 'say "hi"'],
  ]);
});

test("turns workbook rows into ingestible records with stable ids", () => {
  const rows = csvToRecords(
    "id,type,client,amount,due,status,url\nPPF-1,invoice,Acme LLP,\"$1,500\",2026-10-15,Open,https://docs.google.com/x\n",
    "Invoices",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].external_id, "sheet-invoice-PPF-1");
  assert.equal(rows[0].domain, "finance");
  assert.equal(rows[0].metadata.amount, 1500);
  assert.equal(rows[0].metadata.client, "Acme LLP");
  assert.equal(rows[0].source_url, "https://docs.google.com/x");
  assert.match(rows[0].content, /due: 2026-10-15/);
});

test("uses the tab name as the type and rejects missing or repeated ids", () => {
  assert.equal(csvToRecords("id,item\n1,Call\n", "Tasks")[0].metadata.type, "task");
  assert.throws(() => csvToRecords("item\nCall\n", "Tasks"), /no id/);
  assert.throws(() => csvToRecords("id\n1\n1\n", "Tasks"), /repeats id/);
});
