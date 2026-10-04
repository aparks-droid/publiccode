"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { prettyDate } from "@/lib/brain";
import {
  SETUP_STEP_IDS,
  type SetupProgress,
  type SetupStatus,
  type SetupStepId,
} from "@/lib/setup";
import type { Brain } from "@/lib/use-brain";
import { cn } from "@/lib/utils";

const statusTone: Record<SetupStatus, string> = {
  Sample: "border-[var(--ink-faint)] text-[var(--ink-muted)]",
  "Not connected": "border-[var(--border-cool)] text-[var(--ink-muted)]",
  Connected: "border-[var(--positive)] text-[var(--positive)]",
  "Needs attention": "border-[var(--negative)] text-[var(--negative)]",
  "Requires development": "border-[var(--caution)] text-[var(--caution)]",
};
const Status = ({ value }: { value: SetupStatus }) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center rounded-[2px] border px-2 py-0.5 text-xs font-medium",
      statusTone[value],
    )}
  >
    {value}
  </span>
);
const STORAGE = "pp-setup-progress";

// Saved choices: in the local copy they go to .company-brain/setup-plan.json;
// in the hosted preview they stay in this browser only.
function useProgress(preview: boolean, loaded: boolean) {
  const [progress, setProgress] = useState<SetupProgress>({});
  const [error, setError] = useState("");
  useEffect(() => {
    if (!loaded) return;
    if (preview) {
      try {
        // Reads browser storage after mount; nothing to render before it.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setProgress(JSON.parse(localStorage.getItem(STORAGE) || "{}"));
      } catch {}
      return;
    }
    void fetch("/api/setup-plan")
      .then((r) => r.json())
      .then((d) => d.progress && setProgress(d.progress))
      .catch(() => setError("Could not read saved setup progress."));
  }, [preview, loaded]);
  const save = async (step: SetupStepId, choice: string) => {
    const next = { ...progress, [step]: { choice, at: new Date().toISOString() } };
    setProgress(next);
    setError("");
    if (preview) {
      try {
        localStorage.setItem(STORAGE, JSON.stringify(next));
      } catch {}
      return;
    }
    const res = await fetch("/api/setup-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ step, choice }),
    }).catch(() => null);
    if (!res?.ok) setError("That choice could not be saved. Try again.");
  };
  return { progress, save, error };
}

type Step = {
  id: SetupStepId;
  title: string;
  why: string;
  status: SetupStatus;
  detail?: { label: string; status: SetupStatus; note: string }[];
  help: React.ReactNode;
  connect?: () => void;
  connectLabel: string;
  connectNote?: string;
};

export function FinishSetup({ brain }: { brain: Brain }) {
  const { progress, save, error } = useProgress(
    brain.preview || brain.hosted,
    brain.loaded,
  );
  const [helpOpen, setHelpOpen] = useState<SetupStepId | "">("");
  const sheet = brain.sources.find((s) => s.kind === "web");
  const sheetRecords = brain.from("web").length;
  const local = !brain.preview && !brain.hosted;
  const steps: Step[] = [
    {
      id: "database",
      title: "Your Supabase database",
      why: "Holds imported records in your own Supabase project. The public preview never connects to it.",
      status: brain.setupError
        ? "Needs attention"
        : brain.configured
          ? "Connected"
          : "Not connected",
      connect: local ? () => brain.setPage("settings") : undefined,
      connectLabel: "Open database form",
      connectNote: local
        ? undefined
        : brain.hosted
          ? "On the website the database is set in Vercel → Settings → Environment Variables."
          : "The database is connected from your local copy, never from this public preview.",
      help: (
        <>
          Create a project at supabase.com under your own account. In its SQL
          editor, run <code>supabase/setup.sql</code> once. Then copy the
          project URL and the secret (or service_role) key from Project
          Settings → API and enter them in the local app’s database form. The
          key is checked and stored only on your computer.
        </>
      ),
    },
    {
      id: "spreadsheet",
      title: "Client workbook (spreadsheet)",
      why: "Your selected source. Tasks, deliverables, invoices and follow-ups feed the daily brief.",
      status:
        sheet && sheet.mode !== "sample" && sheetRecords
          ? "Connected"
          : sheet?.status === "error"
            ? "Needs attention"
            : sheet?.mode === "sample"
              ? "Sample"
              : "Not connected",
      detail: [
        {
          label: "CSV import, up to 100 rows at a time",
          status:
            sheet && sheet.mode !== "sample" && sheetRecords
              ? "Connected"
              : "Not connected",
          note: sheetRecords && sheet?.mode !== "sample"
            ? `${sheetRecords} records imported${sheet?.last_sync ? ` · ${prettyDate(sheet.last_sync)}` : ""}`
            : "Export a sheet as CSV and import it in Sources.",
        },
        {
          label: "Automatic sync from Google Sheets or Excel",
          status: "Requires development",
          note: "No live spreadsheet connector exists yet. Imports are manual.",
        },
      ],
      connect:
        (local || brain.hosted) && brain.configured
          ? () => brain.setPage("sources")
          : undefined,
      connectLabel: "Import a CSV",
      connectNote:
        local || brain.hosted
          ? brain.configured
            ? undefined
            : "Connect the database first."
          : "Imports happen in your local copy.",
      help: (
        <>
          Export each tab of your workbook as CSV (File → Download → CSV in
          Google Sheets, or Save As → CSV in Excel). The tab name sets what a
          row is: anything imported under a to-do or Tasks tab is a to-do,
          whatever its own Type column says. Group rows with a{" "}
          <code>category</code> column; dates can be 12/31/26 or 2026-12-31.
          Keep a stable <code>id</code> column so
          re-importing updates rows instead of duplicating them. Leave out
          anything you don’t want stored, and remember your AI rules: client
          names reach an AI model only when you ask a question.
        </>
      ),
    },
    {
      id: "ai",
      title: "AI on the site",
      why: "Chat and analysis call OpenAI or Anthropic with your own API key. You choose after the site is published.",
      status: brain.connected ? "Connected" : "Not connected",
      connect: brain.openConnect,
      connectLabel: "Connect AI",
      help: (
        <>
          This uses an API key and API billing, separate from any ChatGPT or
          Claude subscription. Before any real client record reaches a model,
          check the provider’s API data terms: no training on your data, and
          zero data retention where your rules require it. In the preview, a
          key stays in this browser tab and only sample records are sent.
        </>
      ),
    },
    {
      id: "destinations",
      title: "Use it outside the site",
      why: "Claude, ChatGPT or Instinct can read Company Brain records. Chosen after publishing.",
      status: "Not connected",
      detail: [
        {
          label: "Claude",
          status: "Requires development",
          note: "The authenticated read-only connector is not included in this release.",
        },
        {
          label: "ChatGPT",
          status: "Requires development",
          note: "Needs an OAuth-based connector before it can read private data.",
        },
        {
          label: "Instinct",
          status: "Not connected",
          note: "GET /api/instinct serves the sample snapshot only. Live data requires development.",
        },
      ],
      connectLabel: "Choose destinations",
      connectNote: "Picked together with your AI choice after the site is published.",
      help: (
        <>
          These connections read records; they don’t import your AI
          conversation history. Each one is set up and tested separately, and
          none removes the authentication that protects private data.
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="pp-eyebrow">Finish setup</p>
        <h1 className="pp-title text-4xl">Connections, one at a time</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--ink-muted)]">
          Each step can wait. Choosing Later saves the decision and the rest of
          the site keeps working with what is already connected.
          {brain.preview &&
            " This is the public preview, so choices here stay in your browser and nothing is sent to a server."}
        </p>
      </header>
      {error && (
        <p role="alert" className="text-sm text-[var(--negative)]">
          {error}
        </p>
      )}
      <ol className="flex flex-col gap-4">
        {steps.map((step, n) => {
          const saved = progress[step.id];
          return (
            <li key={step.id} className="pp-feature p-5 pl-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 max-w-2xl">
                  <p className="font-heading text-2xl text-[var(--gold-deep)]">
                    {String(n + 1).padStart(2, "0")}
                  </p>
                  <h2 className="pp-title text-xl">{step.title}</h2>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    {step.why}
                  </p>
                </div>
                <Status value={step.status} />
              </div>
              {step.detail && (
                <ul className="mt-3 divide-y divide-[var(--border-cool)] border-y border-[var(--border-cool)]">
                  {step.detail.map((d) => (
                    <li
                      key={d.label}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{d.label}</span>
                        <span className="text-[var(--ink-muted)]">
                          {" "}
                          · {d.note}
                        </span>
                      </span>
                      <Status value={d.status} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  disabled={!step.connect}
                  onClick={() => {
                    void save(step.id, "now");
                    step.connect?.();
                  }}
                >
                  {step.connectLabel}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void save(step.id, "later")}
                >
                  Later
                </Button>
                <Button
                  variant="ghost"
                  aria-expanded={helpOpen === step.id}
                  onClick={() => {
                    setHelpOpen(helpOpen === step.id ? "" : step.id);
                    void save(step.id, "help");
                  }}
                >
                  I need help
                </Button>
                {saved?.choice === "later" && (
                  <span className="text-sm text-[var(--ink-faint)]">
                    Deferred by you · {prettyDate(saved.at)}
                  </span>
                )}
              </div>
              {step.connectNote && (
                <p className="mt-2 text-sm text-[var(--ink-faint)]">
                  {step.connectNote}
                </p>
              )}
              {helpOpen === step.id && (
                <p className="mt-3 rounded-[2px] bg-[var(--lavender)] p-4 text-sm leading-relaxed">
                  {step.help}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-[var(--ink-faint)]">
        {SETUP_STEP_IDS.filter((id) => progress[id]?.choice === "later").length}{" "}
        of {SETUP_STEP_IDS.length} steps deferred.
      </p>
    </div>
  );
}
