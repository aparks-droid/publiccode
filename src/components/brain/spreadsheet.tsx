"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prettyDate } from "@/lib/brain";
import { csvToRecords } from "@/lib/csv";
import type { Brain } from "@/lib/use-brain";

// The selected source: a client workbook exported as CSV, one tab at a time.
export function SpreadsheetSource({ brain }: { brain: Brain }) {
  const [sheet, setSheet] = useState("Tasks");
  const [text, setText] = useState("");
  const [file, setFile] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const source = brain.sources.find((s) => s.kind === "web");
  const count = brain.from("web").length;
  const status =
    source?.status === "error"
      ? "Needs attention"
      : source && source.mode !== "sample" && count
        ? "Connected"
        : source?.mode === "sample"
          ? "Sample"
          : "Not connected";
  const disabled = brain.preview || !brain.configured;
  async function submit() {
    setError("");
    setWorking(true);
    try {
      const records = csvToRecords(text, sheet.trim() || "Sheet");
      for (let i = 0; i < records.length; i += 100) {
        const ok = await brain.importRecords(
          "web",
          "Client workbook",
          records.slice(i, i + 100),
        );
        if (!ok)
          throw Error(
            i
              ? `Stopped after ${i} rows. Earlier rows were saved; fix the file and import again.`
              : "Nothing was imported. Your previous records are unchanged.",
          );
      }
      setText("");
      setFile("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import this file.");
    } finally {
      setWorking(false);
    }
  }
  return (
    <section className="pp-feature grid gap-4 p-5 pl-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="pp-eyebrow">Your selected source</p>
          <h2 className="pp-title text-2xl">Client workbook (spreadsheet)</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Import a CSV export of one tab at a time: tasks, deliverables,
            invoices, prospects, engagements or notes. The tab name decides the
            kind of row. Each row needs an <code>id</code>; a{" "}
            <code>category</code> column groups to-dos; an optional{" "}
            <code>url</code> column links back to the original sheet.
          </p>
        </div>
        <span className="rounded-[2px] border border-[var(--border-cool)] px-2 py-0.5 text-xs font-medium">
          {status}
        </span>
      </div>
      <p className="text-sm">
        {count} records
        {source?.last_sync ? ` · last import ${prettyDate(source.last_sync)}` : ""}
        <span className="text-[var(--ink-muted)]">
          {" "}
          · Automatic Google Sheets or Excel sync requires development.
        </span>
      </p>
      {disabled ? (
        <p className="text-sm text-[var(--ink-muted)]">
          {brain.preview
            ? "Imports run in your local copy only. The public preview shows the sample workbook."
            : "Connect your database first, then import."}
        </p>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-wrap gap-3">
            <label className="grid gap-1 text-sm font-medium">
              Tab name
              <Input
                className="w-48 bg-white"
                value={sheet}
                onChange={(e) => setSheet(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                className="text-sm"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setFile(f.name);
                  setText(await f.text());
                  if (sheet === "Tasks")
                    setSheet(f.name.replace(/\.csv$/i, "").replace(/.* - /, ""));
                }}
              />
            </label>
          </div>
          {file && (
            <p className="text-sm text-[var(--ink-muted)]">
              {file} · {Math.max(0, text.trim().split(/\r?\n/).length - 1)} data rows
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-[var(--negative)]">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="justify-self-start"
            disabled={working || brain.busy || !text.trim()}
          >
            {working && <Loader2 className="animate-spin" />}
            {working ? "Importing…" : "Import rows"}
          </Button>
        </form>
      )}
    </section>
  );
}
