// Turns a CSV export of the client workbook into Company Brain records.
// Read-only toward the spreadsheet: nothing is written back.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim()));
}

const domainFor: Record<string, string> = {
  invoice: "finance",
  deliverable: "operations",
  task: "company",
  prospect: "sales",
  engagement: "cx",
  note: "company",
};
const numeric = new Set(["amount", "fee", "value", "firm_revenue_m"]);
const key = (h: string) =>
  h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export type SheetRecord = {
  external_id: string;
  domain: string;
  title: string;
  content: string;
  metadata: Record<string, string | number>;
  source_url?: string;
};

// sheet: the tab name, used when a row has no type column of its own.
export function csvToRecords(text: string, sheet: string): SheetRecord[] {
  const [header, ...body] = parseCsv(text);
  if (!header || !body.length)
    throw Error("The CSV needs a header row and at least one data row.");
  const keys = header.map(key);
  if (keys.some((k) => !k)) throw Error("Every column needs a header.");
  const fallbackType = key(sheet).replace(/s$/, "") || "row";
  const seen = new Set<string>();
  return body.map((cells, n) => {
    const metadata: Record<string, string | number> = { sheet };
    keys.forEach((k, i) => {
      const raw = (cells[i] ?? "").trim();
      if (!raw) return;
      const num = Number(raw.replace(/[$,]/g, ""));
      metadata[k] = numeric.has(k) && raw && !isNaN(num) ? num : raw;
    });
    const type = key(String(metadata.type || fallbackType)) || "row";
    metadata.type = type;
    const id = String(metadata.id || metadata.invoice || "").trim();
    if (!id)
      throw Error(
        `Row ${n + 2} has no id. Add an id column so re-imports update rows instead of duplicating them.`,
      );
    const external_id = `sheet-${type}-${id}`;
    if (seen.has(external_id))
      throw Error(`Row ${n + 2} repeats id "${id}".`);
    seen.add(external_id);
    const name =
      metadata.title || metadata.item || metadata.description || metadata.client || id;
    const title = `${type[0].toUpperCase()}${type.slice(1)} — ${metadata.client && metadata.client !== name ? `${metadata.client}: ` : ""}${name}`;
    const content = header
      .map((h, i) => (cells[i]?.trim() ? `${h.trim()}: ${cells[i].trim()}` : ""))
      .filter(Boolean)
      .join(". ");
    const url = String(metadata.url || metadata.link || "");
    return {
      external_id,
      domain: domainFor[type] || "company",
      title: title.slice(0, 300),
      content: content.slice(0, 50000),
      metadata,
      ...(/^https?:\/\//.test(url) ? { source_url: url } : {}),
    };
  });
}
