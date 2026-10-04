"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  dueOf,
  field,
  isDone,
  parseDay,
  priorityOf,
  prettyDate,
  taskLabel,
  type RecordRow,
} from "@/lib/brain";
import type { TodoFields } from "@/lib/todos";
import { xlsx } from "@/lib/xlsx";

const categoryOf = (r: RecordRow) =>
  field(r, "category", "section", "group", "heading", "client", "client_name");
const statusOf = (r: RecordRow) => field(r, "status", "state") || "Open";

export const fieldsOf = (r: RecordRow): TodoFields => ({
  item: taskLabel(r).replace(/^\s*\*+\s*/, ""),
  priority: priorityOf(r),
  category: categoryOf(r),
  due: dueOf(r),
  status: statusOf(r),
});

// Accepts 12/31/26 or a picked date; stores what the owner typed, in their format.
const asInputDate = (v: string) => {
  const d = parseDay(v);
  return d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : "";
};

export function TodoDialog({
  open,
  initial,
  categories,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: TodoFields | null;
  categories: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (f: TodoFields) => Promise<boolean>;
}) {
  const blank: TodoFields = { item: "", priority: "**", category: "", due: "", status: "Open" };
  const [f, setF] = useState<TodoFields>(initial || blank);
  const [error, setError] = useState("");
  const set = (k: keyof TodoFields) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit to-do" : "Add a to-do"}</DialogTitle>
          <DialogDescription>
            Saved to your own database. Your spreadsheet isn’t changed; use
            Download to bring it up to date.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!f.item.trim()) return setError("Enter the to-do.");
            setError("");
            if (await onSave(f)) onClose();
          }}
        >
          <label className="grid gap-1 text-sm font-medium">
            To-do
            <Input
              autoFocus
              className="bg-white"
              value={f.item}
              maxLength={1000}
              onChange={(e) => set("item")(e.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Priority
              <select
                className="h-9 rounded-[2px] border bg-white px-2 font-mono text-sm"
                value={f.priority}
                onChange={(e) => set("priority")(e.target.value)}
              >
                <option value="****">**** highest</option>
                <option value="***">***</option>
                <option value="**">**</option>
                <option value="*">* lowest</option>
                <option value="">none</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Due date (optional)
              <Input
                type="date"
                className="bg-white"
                value={asInputDate(f.due)}
                onChange={(e) => {
                  const d = parseDay(e.target.value);
                  set("due")(
                    d ? `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` : "",
                  );
                }}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-medium">
            Category
            <Input
              className="bg-white"
              list="todo-categories"
              value={f.category}
              maxLength={200}
              onChange={(e) => set("category")(e.target.value)}
            />
            <datalist id="todo-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          {initial && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isDone(f.status)}
                onChange={(e) => set("status")(e.target.checked ? "Done" : "Open")}
              />
              Done
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-[var(--negative)]">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {initial ? "Save changes" : "Add to-do"}
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Every to-do row, open ones first by priority, then done ones.
export function orderedTodos(rows: RecordRow[]) {
  const rank = (r: RecordRow) => (isDone(statusOf(r)) ? 10 : 0) - priorityOf(r).length;
  return rows.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map((x) => x.r);
}

// An Excel workbook of the to-do list, with the original column names and ids
// so it can be edited and imported again without creating duplicates.
export function downloadTodos(rows: RecordRow[], company: string) {
  const preferred = ["id", "type", "priority", "item", "task", "to_do", "todo", "description", "category", "section", "group", "client", "due", "due_date", "deadline", "status"];
  const skip = new Set(["sheet", "as_of"]);
  const keys = new Set<string>();
  rows.forEach((r) => Object.keys(r.metadata).forEach((k) => !skip.has(k) && keys.add(k)));
  const header = [
    ...preferred.filter((k) => keys.has(k)),
    ...[...keys].filter((k) => !preferred.includes(k)).sort(),
  ];
  const body = orderedTodos(rows).map((r) =>
    header.map((k) => {
      const v = r.metadata[k];
      return typeof v === "number" ? v : String(v ?? "");
    }),
  );
  const bytes = xlsx("To do", header, body);
  const url = URL.createObjectURL(
    new Blob([bytes.buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  const day = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${(company || "Company").replace(/[^\w-]+/g, "-")}-to-do-${day}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Shown only when printing: the whole to-do list as a plain table.
export function TodoPrintSheet({ rows, company }: { rows: RecordRow[]; company: string }) {
  const list = orderedTodos(rows);
  return (
    <div className="pp-print-area hidden print:block" aria-hidden="true">
      <h1 className="font-heading text-2xl">{company} — To do</h1>
      <p className="mb-3 text-xs">
        Printed {prettyDate(new Date().toISOString())} · {list.length} items (
        {list.filter((r) => !isDone(statusOf(r))).length} open)
      </p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="w-12 py-1 pr-2">Priority</th>
            <th className="py-1 pr-2">To-do</th>
            <th className="py-1 pr-2">Category</th>
            <th className="w-24 py-1 pr-2">Due</th>
            <th className="w-16 py-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id} className="break-inside-avoid border-b border-gray-300 align-top">
              <td className="py-1 pr-2 font-mono">{priorityOf(r)}</td>
              <td className="py-1 pr-2">{taskLabel(r).replace(/^\s*\*+\s*/, "")}</td>
              <td className="py-1 pr-2">{categoryOf(r)}</td>
              <td className="py-1 pr-2">
                {parseDay(dueOf(r)) ? prettyDate(dueOf(r)) : dueOf(r)}
              </td>
              <td className="py-1">{statusOf(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
