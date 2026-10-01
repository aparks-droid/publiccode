"use client";
import { useState } from "react";
import { ArrowRight, ArrowUp, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IssueDetails,
  IssueSummary,
  openByPriority,
} from "@/components/brain/attention";
import {
  failedOnce,
  money,
  plural,
  prettyDate,
  toolName,
  currencyOf,
  paymentNet,
} from "@/lib/brain";
import type { Brain } from "@/lib/use-brain";
import { cn } from "@/lib/utils";

const prompts = [
  "What needs my decision this week?",
  "Where is our revenue at risk?",
];

export function HomeOverview({
  brain,
  onCustomer,
}: {
  brain: Brain;
  onCustomer: (name: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const issues = openByPriority(brain.issues);
  const high = issues.filter((i) => i.priority === "high").length;
  const deals = brain
    .from("attio")
    .filter((r) => r.metadata.type === "deal" && r.metadata.stage !== "Won");
  const payments = brain
    .from("stripe")
    .filter((r) => r.metadata.type === "payment");
  const paymentCurrency = currencyOf(payments);
  const dealCurrency = currencyOf(deals);
  const owed = failedOnce(payments);
  const sum = (rows: typeof payments, key: string) =>
    rows.reduce((total, r) => total + (Number(r.metadata[key]) || 0), 0);
  const dates = payments
    .map((p) => String(p.metadata.date || ""))
    .filter(Boolean)
    .sort();
  const shortDate = (date: string) => prettyDate(date).replace(/, \d{4}$/, "");
  const period = dates.length
    ? `${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}`
    : "No payments loaded";
  const stats = [
    {
      label: "Net revenue",
      value: payments.length
        ? paymentCurrency
          ? money(
              payments.reduce((n, p) => n + paymentNet(p), 0),
              paymentCurrency,
            )
          : "Multiple currencies"
        : "—",
      hint: period,
      page: "revenue",
    },
    {
      label: "Open pipeline",
      value: deals.length
        ? dealCurrency
          ? money(sum(deals, "value"), dealCurrency)
          : "Multiple currencies"
        : "—",
      hint: `${plural(deals.length, "deal")} · deal value`,
      page: "pipeline",
    },
    {
      label: "Failed payments",
      value: payments.length
        ? paymentCurrency
          ? money(sum(owed, "amount"), paymentCurrency)
          : "Multiple currencies"
        : "—",
      hint: owed.length ? "Failed payments" : "No failed payments",
      page: "revenue",
      danger: owed.length > 0,
    },
    {
      label: "Needs attention",
      value: String(issues.length),
      hint: high ? `${high} high priority` : "Open issues",
      page: "attention",
      attention: high > 0,
    },
  ];
  const ask = (question: string) => {
    brain.setPage("chat");
    brain.askQuestion(question);
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="mb-1 text-sm text-muted-foreground">Home</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {brain.company || "Your company"}
        </h1>
      </header>

      <section
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        aria-label="Business overview"
      >
        {stats.map((stat) => (
          <button
            key={stat.label}
            onClick={() => brain.setPage(stat.page)}
            className="group min-w-0 rounded-xl border bg-background p-4 text-left transition-colors hover:border-zinc-400 focus-visible:outline-2 focus-visible:outline-violet-500"
          >
            <span className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
              {stat.label}
              <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </span>
            <span
              className={cn(
                "mt-2 block text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl",
                stat.danger && "text-red-700",
                stat.attention && "text-amber-700",
              )}
            >
              {stat.value}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {stat.hint}
            </span>
          </button>
        ))}
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section
          className="min-w-0 overflow-hidden rounded-xl border"
          aria-label="Top priorities"
        >
          <div className="flex items-center justify-between gap-2 border-b bg-amber-50/60 px-4 py-3">
            <h2 className="text-sm font-semibold">
              Needs attention{" "}
              <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-800">
                {issues.length}
              </span>
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-10 text-sm"
              onClick={() => brain.setPage("attention")}
            >
              View all <ArrowRight />
            </Button>
          </div>
          <div className="divide-y">
            {issues.slice(0, 3).map((issue) => (
              <IssueSummary
                key={issue.id}
                issue={issue}
                onClick={() => setSelected(issue.id)}
              />
            ))}
          </div>
          {!issues.length && (
            <div className="flex items-start gap-3 p-5 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <div>
                <p className="font-medium">
                  {brain.issues.length
                    ? "No open issues"
                    : "Your brief starts here"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {brain.records.length
                    ? "Run an analysis from Attention to check your company records."
                    : "Add your sources to start building your company brain."}
                </p>
              </div>
            </div>
          )}
          {issues.some((i) => i.origin === "sample") && (
            <p className="border-t px-4 py-2 text-sm text-muted-foreground">
              Sample analysis · {Math.min(issues.length, 3)} of {issues.length}{" "}
              open issues
            </p>
          )}
        </section>

        <section
          className="min-w-0 rounded-xl border p-4"
          aria-labelledby="home-ask-title"
        >
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-violet-600" />
            <h2 id="home-ask-title" className="text-sm font-semibold">
              Ask your brain
            </h2>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (brain.draft.trim() && !brain.asking) ask(brain.draft);
            }}
          >
            <Input
              className="h-10 min-w-0 text-sm"
              aria-label="Ask about your business"
              placeholder="What’s happening in the business?"
              value={brain.draft}
              onChange={(event) => brain.setDraft(event.target.value)}
            />
            <Button
              type="submit"
              className="size-10"
              aria-label={
                brain.connected ? "Ask question" : "Connect AI and ask question"
              }
              disabled={!brain.draft.trim() || brain.asking}
            >
              <ArrowUp />
            </Button>
          </form>
          <div className="mt-3 flex flex-col">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                disabled={brain.asking}
                onClick={() => ask(prompt)}
                className="flex items-center justify-between gap-2 min-h-10 rounded-md px-1 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-50"
              >
                {prompt}
                <ArrowRight className="size-3.5 shrink-0" />
              </button>
            ))}
          </div>
          <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">
            Answers from your company’s sources.
          </p>
        </section>
      </div>

      <footer
        className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-4 text-sm text-muted-foreground"
        aria-label="Source status"
      >
        <span className="font-medium">Sources</span>
        {brain.sources.map((source) => (
          <button
            key={source.id}
            onClick={() => brain.setPage("sources")}
            className="flex min-h-8 items-center gap-1.5 rounded-md hover:text-foreground focus-visible:outline-2 focus-visible:outline-violet-500"
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                source.status === "error"
                  ? "bg-red-500"
                  : source.mode === "live" && source.status === "connected"
                    ? "bg-emerald-500"
                    : "bg-zinc-400",
              )}
            />
            <span className="font-medium text-foreground">
              {toolName[source.kind] || source.name}
            </span>
            <span>
              ·{" "}
              {source.status === "error"
                ? "Needs setup"
                : source.mode === "sample"
                  ? "Sample"
                  : source.mode === "imported"
                    ? "Imported"
                    : source.status === "connected"
                      ? "Live"
                      : "Not connected"}
            </span>
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto min-h-10 text-sm"
          onClick={() => brain.setPage("sources")}
        >
          {brain.sources.length ? "Manage sources" : "Connect a source"}
          <ArrowRight />
        </Button>
      </footer>
      <IssueDetails
        issue={brain.issues.find((issue) => issue.id === selected)}
        brain={brain}
        onCustomer={onCustomer}
        onClose={() => setSelected("")}
      />
    </div>
  );
}
