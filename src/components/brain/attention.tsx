"use client";
import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageCircleQuestion,
  CircleHelp,
  UsersRound,
  TrendingUp,
  Settings2,
  Wallet,
  ContactRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  type Issue,
  categories,
  plural,
  prettyDate,
  prettyTime,
  toolName,
} from "@/lib/brain";
import type { Brain } from "@/lib/use-brain";

const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
const priorityStyle: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-border bg-muted text-muted-foreground",
};
const categoryStyle: Record<string, string> = {
  Customers: "border-sky-200 bg-sky-50 text-sky-900",
  Revenue: "border-violet-200 bg-violet-50 text-violet-900",
  Operations: "border-slate-200 bg-slate-100 text-slate-800",
  Finance: "border-emerald-200 bg-emerald-50 text-emerald-900",
  People: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
};
const categoryIcons = {
  Customers: UsersRound,
  Revenue: TrendingUp,
  Operations: Settings2,
  Finance: Wallet,
  People: ContactRound,
};
function CategoryLabel({ category }: { category: string }) {
  const Icon =
    categoryIcons[category as keyof typeof categoryIcons] || Settings2;
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-2 rounded-md border px-2.5 py-1 text-sm font-medium",
        categoryStyle[category],
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {category}
    </span>
  );
}
export function openByPriority(issues: Issue[]) {
  return issues
    .filter((issue) => !issue.resolved)
    .sort(
      (a, b) =>
        (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) ||
        (a.due || "9").localeCompare(b.due || "9"),
    );
}

// A summary is deliberately small; the full brief lives in the detail dialog.
export function IssueSummary({
  issue,
  onClick,
  highlightCategory = false,
}: {
  issue: Issue;
  onClick: () => void;
  highlightCategory?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-500"
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          issue.priority === "high"
            ? "bg-red-500"
            : issue.priority === "medium"
              ? "bg-amber-500"
              : "bg-zinc-400",
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {highlightCategory && (
          <span className="sm:w-32 sm:shrink-0">
            <CategoryLabel category={issue.category} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-snug sm:truncate">
            {issue.title}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            <span className="capitalize">{issue.priority}</span> ·{" "}
            {!highlightCategory && <>{issue.category} · </>}
            {issue.owner || "Unassigned"}
            {issue.due
              ? ` · Due ${prettyDate(issue.due).replace(/, \d{4}$/, "")}`
              : ""}
          </span>
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function IssueContent({
  issue,
  brain,
  onCustomer,
  onClose,
}: {
  issue: Issue;
  brain: Brain;
  onCustomer: (name: string) => void;
  onClose: () => void;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const evidence = issue.evidence
    .map((id) => brain.records.find((r) => r.external_id === id))
    .filter((r) => !!r);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn("capitalize", priorityStyle[issue.priority])}
        >
          {issue.priority}
        </Badge>
        <CategoryLabel category={issue.category} />
        {issue.customer && (
          <button
            className="text-sm underline underline-offset-4"
            onClick={() => {
              onClose();
              onCustomer(issue.customer);
            }}
          >
            {issue.customer}
          </button>
        )}
        {issue.resolved && <Badge variant="outline">Resolved</Badge>}
      </div>
      <p className="text-sm leading-relaxed">{issue.consequence}</p>
      <dl className="grid gap-3 rounded-lg bg-muted/60 p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Owner</dt>
          <dd className="mt-1 font-medium">{issue.owner || "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Due</dt>
          <dd className="mt-1 font-medium">
            {issue.due ? prettyDate(issue.due) : "No date"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="mt-1 font-medium">
            {issue.resolved ? "Resolved" : issue.status || "Open"}
          </dd>
        </div>
      </dl>
      {issue.action && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="mb-1 font-semibold">Next step</p>
          {issue.action}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            onClose();
            brain.askQuestion(
              `Brief me on this issue and recommend what to do: "${issue.title}".`,
            );
          }}
        >
          <MessageCircleQuestion /> Ask about this
        </Button>
        <Button
          variant="outline"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await brain.resolveIssue(issue.id, !issue.resolved);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Loader2 className="animate-spin" /> : <Check />}
          {issue.resolved ? "Reopen issue" : "Mark resolved"}
        </Button>
      </div>
      <div className="border-t pt-3">
        <Button
          size="sm"
          variant="ghost"
          className="-ml-2"
          aria-expanded={evidenceOpen}
          onClick={() => setEvidenceOpen(!evidenceOpen)}
        >
          <ChevronDown className={cn(evidenceOpen && "rotate-180")} />
          {evidenceOpen ? "Hide" : "View"} evidence ({evidence.length})
        </Button>
        {evidenceOpen && (
          <ul className="mt-3 flex flex-col gap-4 text-sm">
            {evidence.map((r) => (
              <li key={r.id} className="border-l-2 pl-3">
                <span className="font-medium">
                  {toolName[brain.kindOf(r)] || "Record"}
                </span>
                <span className="text-muted-foreground">
                  {r.metadata.author ? ` · ${r.metadata.author}` : ""}
                  {r.metadata.posted_at
                    ? ` · ${prettyDate(r.metadata.posted_at)}`
                    : ""}
                </span>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {r.metadata.text || r.content}
                </p>
              </li>
            ))}
            {!evidence.length && (
              <li className="text-muted-foreground">
                The supporting records are no longer in the brain.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export function IssueDetails({
  issue,
  brain,
  onCustomer,
  onClose,
}: {
  issue?: Issue;
  brain: Brain;
  onCustomer: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!issue} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto p-5 sm:max-w-xl"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="pr-7 text-xl leading-snug">
            {issue?.title}
          </DialogTitle>
        </DialogHeader>
        {issue && (
          <IssueContent
            key={issue.id}
            issue={issue}
            brain={brain}
            onCustomer={onCustomer}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Attention({
  brain,
  onCustomer,
}: {
  brain: Brain;
  onCustomer: (name: string) => void;
}) {
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const open = openByPriority(brain.issues);
  const resolved = brain.issues.filter((i) => i.resolved);
  const shown = open.filter((i) => !category || i.category === category);
  const latest = brain.issues[brain.issues.length - 1];
  const origin = !latest
    ? "Not analyzed yet"
    : latest.origin === "sample"
      ? "Sample analysis"
      : `Last analyzed ${prettyDate(latest.created_at)}, ${prettyTime(latest.created_at)}`;
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            Attention{" "}
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm text-amber-800">
              {open.length}
            </span>
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{origin}</span>
            <button
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-violet-500"
              onClick={() => setExplanationOpen(true)}
            >
              <CircleHelp className="size-4" /> How attention works
            </button>
          </div>
        </div>
        <Button
          variant="outline"
          className="min-h-10 px-3"
          disabled={brain.analyzing || !brain.records.length}
          onClick={brain.runAnalysis}
        >
          {brain.analyzing ? (
            <>
              <Loader2 className="animate-spin" /> Analyzing…
            </>
          ) : brain.connected ? (
            "Analyze again"
          ) : (
            "Connect AI & analyze"
          )}
        </Button>
      </header>
      {!!open.length && (
        <div className="flex flex-wrap gap-2">
          {["", ...categories].map((c) => {
            const count = c
              ? open.filter((i) => i.category === c).length
              : open.length;
            return (
              <Button
                key={c}
                size="sm"
                variant={category === c ? "default" : "outline"}
                className={cn(
                  "min-h-10 px-3 text-sm",
                  c && category === c && categoryStyle[c],
                )}
                aria-pressed={category === c}
                disabled={!count}
                onClick={() => setCategory(c)}
              >
                {c || "All"} {count}
              </Button>
            );
          })}
        </div>
      )}
      <section
        className="overflow-hidden rounded-xl border bg-background"
        aria-label="Issues needing attention"
      >
        <div className="divide-y">
          {shown.map((issue) => (
            <IssueSummary
              key={issue.id}
              issue={issue}
              highlightCategory
              onClick={() => setSelected(issue.id)}
            />
          ))}
        </div>
        {!shown.length && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {open.length
              ? `No open ${category.toLowerCase()} issues.`
              : !latest
                ? "Run an analysis after adding your sources."
                : "No open issues in the latest analysis."}
          </p>
        )}
      </section>
      {!!resolved.length && (
        <div className="text-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowResolved(!showResolved)}
          >
            {showResolved ? "Hide" : "Show"}{" "}
            {plural(resolved.length, "resolved issue")}
          </Button>
          {showResolved && (
            <div className="mt-2 divide-y overflow-hidden rounded-xl border">
              {resolved.map((issue) => (
                <IssueSummary
                  key={issue.id}
                  issue={issue}
                  highlightCategory
                  onClick={() => setSelected(issue.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
      <IssueDetails
        issue={brain.issues.find((i) => i.id === selected)}
        brain={brain}
        onCustomer={onCustomer}
        onClose={() => setSelected("")}
      />
      <Dialog open={explanationOpen} onOpenChange={setExplanationOpen}>
        <DialogContent
          className="max-h-[85dvh] overflow-y-auto p-6 sm:max-w-lg"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle className="pr-6 text-xl">
              How attention works
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-[15px] leading-relaxed">
            <p>
              <strong>
                Choose Analyze, or enable automatic checks in Sources.
              </strong>{" "}
              Your connected AI reviews a snapshot of the records in your brain,
              groups related problems, and suggests a priority and next step.
            </p>
            <p>
              <strong>
                High priority currently means money or a customer is at risk
                within days.
              </strong>{" "}
              This is an AI judgment. Each issue includes the supporting records
              so you can review it.
            </p>
            <p>
              <strong>Sample analysis is an example.</strong> Those issues were
              prepared for the demo company; they were not found by monitoring
              your business.
            </p>
            <p className="rounded-lg bg-muted p-3">
              In your local copy, Sources lets you set attention guidelines and
              a check interval. Your computer and the app must stay running.
              Automatic checks are off until you enable them.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
