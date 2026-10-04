export type Source = {
  id: string;
  name: string;
  kind: string;
  status: string;
  mode: "sample" | "imported" | "live";
  last_sync?: string;
  sync_error?: string;
  sync_summary?: string;
};
export type Issue = {
  id: string;
  title: string;
  consequence: string;
  category: string;
  priority: string;
  owner: string;
  due: string;
  status: string;
  action: string;
  customer: string;
  evidence: string[];
  origin: string;
  model: string;
  resolved: boolean;
  created_at: string;
};
export const categories = [
  "Revenue",
  "Finance",
  "Customers",
  "People",
  "Operations",
];
export const toolName: Record<string, string> = {
  slack: "Slack",
  attio: "Attio",
  stripe: "Stripe",
  web: "Spreadsheet",
};
export type RecordRow = {
  id: string;
  external_id: string;
  title: string;
  domain: string;
  content: string;
  updated_at: string;
  source_id: string;
  source_url?: string;
  metadata: Record<string, string | number | undefined>;
};
export type Citation = { number: number; title: string; url?: string };
export type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};
export const stages = ["Lead", "Qualified", "Proposal", "Negotiation", "Won"];
export const money = (n: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toLocaleString("en-US")} ${currency}`;
  }
};
export const currencyOf = (rows: RecordRow[]) => {
  const currencies = [
    ...new Set(rows.map((r) => String(r.metadata.currency || "USD"))),
  ];
  return currencies.length > 1 ? "" : currencies[0] || "USD";
};
export const paymentNet = (p: RecordRow) =>
  typeof p.metadata.net === "number"
    ? p.metadata.net
    : Number(p.metadata.amount || 0) *
      (p.metadata.status === "succeeded"
        ? 1
        : p.metadata.status === "refunded"
          ? -1
          : 0);
export const plural = (n: number, word: string) =>
  `${n} ${word}${n === 1 ? "" : "s"}`;
// Dates arrive as YYYY-MM-DD or a full ISO timestamp.
const parse = (v: unknown) =>
  new Date(String(v).length === 10 ? `${v}T12:00:00` : String(v));
export const prettyDate = (v: unknown) => {
  const d = parse(v);
  return isNaN(d.getTime())
    ? String(v || "")
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};
export const prettyTime = (v: unknown) => {
  const d = parse(v);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};
export const initials = (name: unknown) =>
  String(name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
// Stable pastel per person, so avatars are recognisable without photos.
const tones = [
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
];
export const tone = (name: unknown) => {
  const s = String(name || "");
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 997;
  return tones[h % tones.length];
};
// A retried charge fails more than once; count the money owed only once.
export const failedOnce = (payments: RecordRow[]) => {
  const seen = new Set<string>();
  return payments.filter((p) => {
    const key = String(p.metadata.payment_intent || p.external_id);
    if (p.metadata.status !== "failed" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Spreadsheet (workbook) rows. Imported tabs name things their own way
// ("To do list", "Bills", "Due date"), so types, fields and dates are read
// tolerantly rather than requiring the template's exact headers.
const kindOf = (value: unknown) => {
  const t = String(value || "").toLowerCase();
  if (/task|to.?do|action/.test(t)) return "task";
  if (/invoice|bill|receivable/.test(t)) return "invoice";
  if (/deliverable/.test(t)) return "deliverable";
  if (/prospect|pipeline|lead|opportunit/.test(t)) return "prospect";
  if (/engagement|retainer|contract/.test(t)) return "engagement";
  if (/note|meeting/.test(t)) return "note";
  return "";
};
// A "type" column is often a category of the owner's own (Admin, Marketing),
// so fall back to the tab name when it isn't one of the workbook kinds.
export const typeOf = (r: RecordRow) =>
  kindOf(r.metadata.type) || kindOf(r.metadata.sheet) || String(r.metadata.type || "");
export const sheetRows = (rows: RecordRow[], type: string) =>
  rows.filter((r) => typeOf(r) === type);
// First non-empty value among several possible column names.
export const field = (r: RecordRow, ...keys: string[]) => {
  for (const k of keys) {
    const v = r.metadata[k];
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }
  return "";
};
export const taskLabel = (r: RecordRow) =>
  field(r, "item", "task", "to_do", "todo", "description", "title", "name", "action") ||
  r.title;
export const dueOf = (r: RecordRow) =>
  field(r, "due", "due_date", "deadline", "date_due", "close_date", "date");
// Priority as leading asterisks (**** highest), from a priority column or the item text.
export const priorityOf = (r: RecordRow) => {
  const p = field(r, "priority", "pri", "rank");
  if (/^\*+$/.test(p)) return p;
  if (/^[1-4]$/.test(p)) return "*".repeat(5 - Number(p));
  return /^\s*(\*+)/.exec(taskLabel(r))?.[1] || "";
};
// Accepts 2026-10-09, 2026-10-09T…, 10/9/2026, 10/9/26 and "Oct 9, 2026".
export const parseDay = (v: unknown): Date | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return new Date(y, +m[1] - 1, +m[2], 12);
  }
  const d = new Date(s);
  return isNaN(d.getTime())
    ? null
    : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
};
const today = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12);
};
// The reference date for a workbook: its export date when rows carry one,
// so a sample snapshot keeps reading the same way; otherwise today.
export const asOfDate = (rows: RecordRow[]) => {
  const dates = rows
    .map((r) => parseDay(r.metadata.as_of))
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime());
  return dates.length ? dates[dates.length - 1] : today();
};
export const daysBetween = (from: Date, to: unknown) => {
  const d = parseDay(to);
  return d ? Math.round((d.getTime() - from.getTime()) / 86400000) : NaN;
};
export const isDone = (status: unknown) =>
  /^(complete|completed|done|closed|paid|delivered|cancell?ed|x|yes|true|✓|✔)$/i.test(
    String(status || "").trim(),
  );
