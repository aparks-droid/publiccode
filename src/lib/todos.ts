// To-do records created or edited in the app. They follow the same shape as
// rows imported from the spreadsheet (same column names, same id rule), so a
// downloaded workbook can be edited and re-imported without duplicates.
import { columnKey } from "./csv";
import type { RecordRow } from "./brain";

export type TodoFields = {
  item: string;
  priority: string;
  category: string;
  due: string;
  status: string;
};

const pick = (rows: RecordRow[], options: string[], fallback: string) =>
  options.find((k) => rows.some((r) => r.metadata[k] !== undefined)) || fallback;

// The column names this owner's list already uses ("task" vs "item", etc.).
export function todoKeys(rows: RecordRow[]) {
  return {
    item: pick(rows, ["item", "task", "to_do", "todo", "description", "title", "name", "action"], "item"),
    priority: pick(rows, ["priority", "pri", "rank"], "priority"),
    category: pick(rows, ["category", "section", "group", "heading", "client", "client_name"], "category"),
    due: pick(rows, ["due", "due_date", "deadline", "date_due", "date"], "due"),
    status: pick(rows, ["status", "state"], "status"),
    sheet: String(rows.find((r) => r.metadata.sheet)?.metadata.sheet || "Tasks"),
  };
}

export const todoExternalId = (type: string, id: string) =>
  `sheet-${columnKey(type) || "task"}-${id}`;

// Rebuild the searchable text the same way the CSV import does.
export function todoText(metadata: Record<string, unknown>, labelKey: string) {
  const label = String(metadata[labelKey] || "").trim() || "Untitled to-do";
  const content = Object.entries(metadata)
    .filter(([k, v]) => k !== "sheet" && v !== undefined && v !== null && String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join(". ");
  return { title: `Task — ${label}`.slice(0, 300), content: content.slice(0, 50000) };
}

export const cleanFields = (f: Partial<TodoFields>): TodoFields => {
  const s = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
  const priority = s(f.priority, 4);
  return {
    item: s(f.item, 1000),
    priority: /^\*{0,4}$/.test(priority) ? priority : "",
    category: s(f.category, 200),
    due: s(f.due, 40),
    status: s(f.status, 40),
  };
};
