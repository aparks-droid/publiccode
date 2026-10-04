"use client";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { prettyDate, toolName } from "@/lib/brain";
import type { Brain } from "@/lib/use-brain";
const connectors = [
  {
    kind: "slack",
    name: "Slack",
    description: "Conversations in channels you invite the app to",
    label: "Bot token",
    placeholder: "xoxb-…",
    href: "https://api.slack.com/apps",
    help: "Create an app in your Slack workspace. Add bot scopes channels:read, channels:history, groups:read and groups:history, then install it. Invite the app to the channels you want with /invite @your-app. Paste its Bot User OAuth Token here.",
    coverage:
      "Last 30 days · up to 20 channels and 300 messages per channel · top-level messages only",
  },
  {
    kind: "attio",
    name: "Attio",
    description: "CRM deals, stages, values and owners",
    label: "API key",
    placeholder: "Attio access token",
    href: "https://app.attio.com",
    help: "In Attio, open Settings → Developers and create an API key with record_permission:read and object_configuration:read. Your workspace needs the Deals object.",
    coverage: "Up to 1,000 deals · your original deal stages and attributes",
  },
  {
    kind: "stripe",
    name: "Stripe",
    description: "Payments, failed charges and refunds",
    label: "Restricted API key",
    placeholder: "rk_live_… or rk_test_…",
    href: "https://dashboard.stripe.com/apikeys",
    help: "Create a restricted key with read permission for Charges. Test keys import test data; live keys import live data. Company Brain only reads payments.",
    coverage:
      "Last 90 days · up to 1,000 charge attempts · not your full accounting ledger",
  },
];
export function Sources({ brain }: { brain: Brain }) {
  const [selected, setSelected] = useState(""),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false),
    [json, setJson] = useState("");
  const [instructions, setInstructions] = useState(
      brain.monitoring.instructions,
    ),
    [minutes, setMinutes] = useState(brain.monitoring.minutes),
    [enabled, setEnabled] = useState(brain.monitoring.enabled);
  const [worker, setWorker] = useState<{
    heartbeatAt?: string;
    lastCheck?: string;
    error?: string;
    running?: boolean;
    active?: boolean;
    result?: {
      analysis?: { error?: string; skipped?: string };
      sources?: { source: string; error?: string }[];
    };
  }>({});
  const c = connectors.find((x) => x.kind === selected);
  useEffect(() => {
    if (brain.preview) return;
    const check = () => {
      void fetch("/api/run")
        .then((r) => r.json())
        .then((data) =>
          setWorker({
            ...data,
            active:
              data.running ||
              (!!data.heartbeatAt &&
                Date.now() - new Date(data.heartbeatAt).getTime() < 35000),
          }),
        )
        .catch(() => {});
    };
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, [brain.preview]);
  const active = worker.active;
  const records = brain.records.filter((r) =>
    `${r.title} ${r.content}`.toLowerCase().includes(query.toLowerCase()),
  );
  const open = (kind: string, asImport = false) => {
    setSelected(kind);
    setImporting(asImport);
    setKey("");
    setJson("");
    setError("");
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {connectors.map((x) => {
          const s = brain.sources.find((s) => s.kind === x.kind),
            connected = brain.tokens[x.kind];
          return (
            <Card key={x.kind}>
              <CardHeader>
                <CardTitle>{x.name}</CardTitle>
                <CardDescription className="text-sm">
                  {x.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <Badge
                  variant="outline"
                  className={
                    s?.status === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : connected
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : ""
                  }
                >
                  {s?.status === "error"
                    ? "Needs reconnecting"
                    : connected
                      ? "Connected"
                      : s?.mode === "sample"
                        ? "Sample data"
                        : s?.mode === "imported"
                          ? "Imported records"
                          : "Not connected"}
                </Badge>
                <p>
                  {brain.from(x.kind).length} records
                  {s?.last_sync ? ` · ${prettyDate(s.last_sync)}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {s?.sync_summary || x.coverage}
                </p>
                {s?.sync_error && (
                  <p role="alert" className="text-destructive">
                    {s.sync_error}
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button
                  disabled={brain.busy || !brain.configured || brain.preview}
                  onClick={() =>
                    connected
                      ? void brain.syncSource(x.kind, x.name).catch(() => {})
                      : open(x.kind)
                  }
                >
                  {brain.busy && <Loader2 className="animate-spin" />}
                  {connected ? "Sync now" : `Connect ${x.name}`}
                </Button>
                {connected && (
                  <Button
                    variant="ghost"
                    disabled={brain.busy}
                    onClick={() =>
                      void brain.disconnectSource(x.kind).catch(() => {})
                    }
                  >
                    Disconnect
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={!brain.configured || brain.preview || brain.busy}
                  onClick={() => open(x.kind, true)}
                >
                  Import JSON
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      {!brain.preview && (
        <Card>
          <CardHeader>
            <CardTitle>Keep watch on your business</CardTitle>
            <CardDescription className="text-sm">
              Refresh connected sources, then ask your AI to find issues with
              supporting evidence. Checks run on this computer while Company
              Brain is running, even with the browser closed.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">
                {active ? "Local monitor running" : "Local monitor stopped"}
              </Badge>
              {worker.lastCheck && (
                <span className="text-sm text-muted-foreground">
                  Last check {new Date(worker.lastCheck).toLocaleString()}
                </span>
              )}
            </div>
            {!active && (
              <p className="text-sm text-muted-foreground">
                Start the app with <code>npm run dev</code> to start its monitor
                too.
              </p>
            )}
            <label className="grid gap-2 text-sm font-medium">
              What should get your attention?
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Example: Escalate failed payments over $500, customer commitments due within 3 days, and blocked renewals. Ignore routine status updates."
                className="min-h-24"
              />
            </label>
            <p className="text-sm text-muted-foreground">
              These are instructions for the AI’s judgement. Every issue must
              cite a stored record. Review recommendations before acting.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Check automatically
              </label>
              <label className="flex items-center gap-2 text-sm">
                Every
                <select
                  className="rounded-md border bg-background p-2"
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                >
                  <option value={15}>15 minutes</option>
                  <option value={60}>hour</option>
                  <option value={360}>6 hours</option>
                  <option value={1440}>day</option>
                </select>
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              Uses your saved AI key and its API billing. Automatic analysis
              runs only when data or guidelines change, or once a new day
              starts.
            </p>
            {(worker.error || worker.result?.analysis?.error) && (
              <p role="alert" className="text-sm text-destructive">
                {worker.error || worker.result?.analysis?.error}
              </p>
            )}
            {worker.result?.sources
              ?.filter((s) => s.error)
              .map((s) => (
                <p
                  key={s.source}
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {toolName[s.source]}: {s.error}
                </p>
              ))}
            {worker.result?.analysis?.skipped && (
              <p className="text-sm text-muted-foreground">
                {worker.result.analysis.skipped}
              </p>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            <Button
              disabled={brain.busy || !brain.configured}
              onClick={() =>
                void brain
                  .saveMonitoring({ enabled, minutes, instructions })
                  .catch(() => {})
              }
            >
              Save settings
            </Button>
            <Button
              variant="outline"
              disabled={brain.busy || !brain.configured}
              onClick={() => void brain.runCheck().catch(() => {})}
            >
              <RefreshCw className={brain.busy ? "animate-spin" : ""} />
              Sync & analyze now
            </Button>
          </CardFooter>
        </Card>
      )}
      {!brain.preview && !brain.sources.some((s) => s.mode !== "sample") && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div>
            <p className="font-medium">Explore a fictional company first</p>
            <p className="text-sm text-muted-foreground">
              Optional sample data. It stays separate from your real sources.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={brain.busy || !brain.configured}
            onClick={() => void brain.loadDemo()}
          >
            Load sample company
          </Button>
        </div>
      )}
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">
          Records{" "}
          <span className="font-normal text-muted-foreground">
            {records.length}
          </span>
        </h2>
        <Input
          aria-label="Search records"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search what your brain knows"
        />
        <div className="divide-y rounded-xl border">
          {records.slice(0, 60).map((r) => (
            <div className="p-4 text-sm" key={r.id}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {toolName[brain.kindOf(r)] || "Record"}
                </Badge>
                <span className="font-medium">{r.title}</span>
                {r.source_url &&
                  !/\.example\//.test(r.source_url) && (
                    <a
                      className="ml-auto underline"
                      href={r.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View source
                    </a>
                  )}
              </div>
              <p className="break-words text-muted-foreground">
                {r.content.slice(0, 1000)}
              </p>
            </div>
          ))}
          {!records.length && (
            <p className="p-6 text-sm text-muted-foreground">
              Connect a source to bring in your first records.
            </p>
          )}
        </div>
      </section>
      <Dialog
        open={!!c}
        onOpenChange={(open) => {
          if (!open && !brain.busy) {
            setSelected("");
            setKey("");
            setError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {importing ? "Import" : "Connect"} {c?.name}
            </DialogTitle>
            <DialogDescription>
              {importing
                ? "Paste up to 100 normalized JSON records. Nothing is changed in the source tool."
                : "Read-only access. Your token is saved on this computer after the first successful sync."}
            </DialogDescription>
          </DialogHeader>
          {c && (
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                try {
                  if (importing) {
                    const rows = JSON.parse(json);
                    if (!Array.isArray(rows) || !rows.length)
                      throw Error("Paste a JSON list of records.");
                    if (!(await brain.importRecords(c.kind, c.name, rows)))
                      return;
                  } else await brain.syncSource(c.kind, c.name, key.trim());
                  setKey("");
                  setSelected("");
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Could not connect.",
                  );
                }
              }}
            >
              {importing ? (
                <Textarea
                  aria-label="Records as JSON"
                  className="min-h-40 font-mono text-sm"
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  placeholder={
                    '[{"external_id":"record-1","domain":"operations","title":"Delivery update","content":"Your source text"}]'
                  }
                />
              ) : (
                <>
                  <p className="text-sm leading-relaxed">
                    {c.help}{" "}
                    <a
                      className="underline"
                      href={c.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open {c.name}
                    </a>
                  </p>
                  <label className="grid gap-2 text-sm font-medium">
                    {c.label}
                    <Input
                      autoFocus
                      type="password"
                      autoComplete="off"
                      value={key}
                      placeholder={c.placeholder}
                      onChange={(e) => setKey(e.target.value)}
                    />
                  </label>
                  <p className="text-sm text-muted-foreground">{c.coverage}</p>
                </>
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={brain.busy || !(importing ? json.trim() : key.trim())}
              >
                {brain.busy && <Loader2 className="animate-spin" />}
                {brain.busy
                  ? "Connecting & importing…"
                  : importing
                    ? "Import records"
                    : "Connect & sync"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
