import { test } from "node:test";
import assert from "node:assert/strict";
import { csvToRecords } from "../src/lib/csv";
import {
  daysBetween,
  dueOf,
  isDone,
  parseDay,
  priorityOf,
  sheetRows,
  taskLabel,
  type RecordRow,
} from "../src/lib/brain";

const rows = (csv: string, tab: string) =>
  csvToRecords(csv, tab).map((r, i) => ({
    ...r,
    id: String(i),
    source_id: "s",
    updated_at: "",
  })) as unknown as RecordRow[];

test("a 'To do list' tab with its own headers reads as tasks", () => {
  const list = rows(
    "id,Task,Priority,Due Date,Status\n1,Call the bank,****,10/9/2026,\n2,**  File receipts,,,\n3,Old item,*,,Done\n",
    "To do list",
  );
  const tasks = sheetRows(list, "task");
  assert.equal(tasks.length, 3);
  assert.equal(taskLabel(tasks[0]), "Call the bank");
  assert.equal(priorityOf(tasks[0]), "****");
  assert.equal(priorityOf(tasks[1]), "**");
  assert.equal(dueOf(tasks[0]), "10/9/2026");
  assert.equal(dueOf(tasks[1]), "");
  assert.ok(isDone(tasks[2].metadata.status));
});

test("dates in common formats parse to the same day", () => {
  const from = parseDay("2026-10-04")!;
  for (const d of ["2026-10-09", "10/9/2026", "10/9/26", "Oct 9, 2026", "2026-10-09T08:00:00Z"])
    assert.equal(daysBetween(from, d), 5, d);
  assert.ok(isNaN(daysBetween(from, "")));
  assert.ok(isNaN(daysBetween(from, "someday")));
});

test("a Type column of the owner's own categories still reads as tasks", () => {
  const list = rows(
    "id,Type,Task,Status\n1,Marketing,Post on LinkedIn,\n2,Admin,File receipts,\n3,Client,Send dashboard,x\n",
    "To do list",
  );
  assert.equal(sheetRows(list, "task").length, 3);
  assert.equal(sheetRows(list, "task").filter((r) => isDone(r.metadata.status)).length, 1);
});

test("the tab decides: every row on a to-do tab is a to-do, whatever Type says", () => {
  const list = rows(
    "id,Type,Task\n1,Invoice follow-up,Chase the Kealoha invoice\n2,Meeting notes,Write up the call\n3,,Plain task\n",
    "To do list",
  );
  assert.equal(sheetRows(list, "task").length, 3);
  // Type still applies on a tab of no known kind.
  assert.equal(sheetRows(rows("id,type,item\n1,invoice,X\n", "Misc"), "invoice").length, 1);
});
