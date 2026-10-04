"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  Check,
  Download,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IssueDetails,
  IssueSummary,
  openByPriority,
} from "@/components/brain/attention";
import {
  asOfDate,
  daysBetween,
  dueOf,
  field,
  isDone,
  priorityOf,
  taskLabel,
  money,
  plural,
  prettyDate,
  sheetRows,
  toolName,
  type RecordRow,
} from "@/lib/brain";
import type { Brain } from "@/lib/use-brain";
import type { TodoFields } from "@/lib/todos";
import {
  TodoDialog,
  TodoPrintSheet,
  downloadTodos,
  fieldsOf,
} from "@/components/brain/todo-tools";
import { cn } from "@/lib/utils";

export const TAGLINE =
  "You may have to live with risk, but you never have to let it win.";

const prompts = [
  "What is overdue, and what should I handle first?",
  "Which clients owe us money past due?",
  "What have we promised clients this week?",
];

type Item = {
  id: string;
  label: string;
  client: string;
  category: string;
  due: string;
  days: number;
  priority: string;
  kind: string;
  done: boolean;
};

// Workbook items: every to-do (open or done) plus open deliverables and follow-ups.
function agenda(rows: RecordRow[], asOf: Date): Item[] {
  const open = (r: RecordRow) => !isDone(field(r, "status", "state", "done"));
  const item = (r: RecordRow, kind: string, label: string, due: string) => ({
    id: r.id,
    kind,
    label: label.replace(/^\s*\*+\s*/, "") || r.title,
    client: field(r, "client", "client_name", "customer", "firm"),
    category: field(r, "category", "section", "group", "heading"),
    due,
    days: daysBetween(asOf, due),
    priority: priorityOf(r),
    done: !open(r),
  });
  return [
    ...sheetRows(rows, "task").map((r) =>
      item(r, "Task", taskLabel(r), dueOf(r)),
    ),
    ...sheetRows(rows, "deliverable")
      .filter(open)
      .map((r) => item(r, "Deliverable", taskLabel(r), dueOf(r))),
    ...sheetRows(rows, "prospect").map((r) =>
      item(r, "Follow-up", field(r, "next_step") || taskLabel(r), field(r, "follow_up") || dueOf(r)),
    ),
  ];
}
const byPriority = (a: Item, b: Item) => b.priority.length - a.priority.length;

const dollars = (n: number) =>
  Number.isInteger(n)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n)
    : money(n);

const when = (days: number) =>
  days < 0
    ? `${plural(-days, "day")} overdue`
    : days === 0
      ? "Due today"
      : `In ${plural(days, "day")}`;

export function HomeOverview({
  brain,
  onCustomer,
}: {
  brain: Brain;
  onCustomer: (name: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<{
    id: string | null;
    fields: TodoFields | null;
  } | null>(null);
  const issues = openByPriority(brain.issues);
  const high = issues.filter((i) => i.priority === "high").length;
  const rows = brain.from("web");
  const sample = brain.sources.some(
    (s) => s.kind === "web" && s.mode === "sample",
  );
  const asOf = asOfDate(rows);
  const all = agenda(rows, asOf);
  // Every open to-do shows, whatever its due date; the owner decides what
  // matters. Highest priority first, then the order of the spreadsheet.
  const allTodos = all.filter((i) => i.kind === "Task");
  const openTodos = allTodos.filter((i) => !i.done).sort(byPriority);
  const todos = showDone
    ? [...openTodos, ...allTodos.filter((i) => i.done).sort(byPriority)]
    : openTodos;
  const top = openTodos.filter((i) => i.priority.length >= 4).length;
  // Deliverables and follow-ups keep their date order.
  const items = all
    .filter((i) => i.kind !== "Task")
    .sort(
      (a, b) =>
        (isNaN(a.days) ? 1e9 : a.days) - (isNaN(b.days) ? 1e9 : b.days) ||
        byPriority(a, b),
    );
  const invoices = sheetRows(rows, "invoice").filter(
    (r) => !isDone(r.metadata.status),
  );
  const pastDue = invoices.filter((r) => daysBetween(asOf, dueOf(r)) < 0);
  const pastDueTotal = pastDue.reduce(
    (t, r) => t + (Number(String(field(r, "amount", "balance", "total")).replace(/[$,]/g, "")) || 0),
    0,
  );
  const monthly = sheetRows(rows, "engagement").filter(
    (r) => r.metadata.basis === "monthly",
  );
  const monthlyTotal = monthly.reduce(
    (t, r) => t + (Number(r.metadata.fee) || 0),
    0,
  );
  const hasSheet = rows.length > 0;
  // Editing changes the owner's own database, so it is offered only in the
  // local copy with a connected database, and never on sample records.
  const editable = !brain.preview && brain.configured && !sample;
  const lockedHint = brain.preview
    ? "This is the public preview. Add, edit and delete work in your local copy."
    : sample
      ? "These are sample records. Import your own spreadsheet to edit to-dos here."
      : "Connect your database to add and edit to-dos.";
  // Account for every workbook row, so nothing disappears without a reason.
  const taskRows = sheetRows(rows, "task");
  const doneTasks = taskRows.filter((r) =>
    isDone(field(r, "status", "state", "done")),
  ).length;
  const listed = new Set(all.map((i) => i.id));
  const categories = [
    ...new Set(allTodos.map((i) => i.category || i.client).filter(Boolean)),
  ].sort();
  const elsewhere = rows.filter(
    (r) => !listed.has(r.id) && !taskRows.includes(r),
  ).length;
  const stats = [
    {
      label: "Open to-dos",
      value: hasSheet ? String(openTodos.length) : "—",
      hint: hasSheet ? "Every open item on your list" : "No to-do list loaded",
      tone: "",
    },
    {
      label: "Top priority ****",
      value: hasSheet ? String(top) : "—",
      hint: top ? "Listed first below" : "None marked ****",
      tone: top ? "text-[var(--gold-deep)]" : "",
    },
    {
      label: "Past-due receivables",
      value: hasSheet ? dollars(pastDueTotal) : "—",
      hint: hasSheet ? plural(pastDue.length, "invoice") : "No invoices loaded",
      tone: pastDue.length ? "text-[var(--negative)]" : "",
    },
    {
      label: "Monthly fees",
      value: hasSheet ? dollars(monthlyTotal) : "—",
      hint: hasSheet
        ? `${plural(monthly.length, "monthly engagement")}`
        : "No engagements loaded",
      tone: "",
    },
  ];
  const brief = hasSheet
    ? `${plural(openTodos.length, "open to-do")}${top ? `, ${top} at top priority` : ""}.${items.length ? ` ${items.length} ${items.length === 1 ? "deliverable or follow-up is" : "deliverables and follow-ups are"} open.` : ""} ${pastDue.length ? `${dollars(pastDueTotal)} is past due across ${plural(pastDue.length, "invoice")}.` : "No invoice is past due."} ${issues.length ? `${plural(issues.length, "issue")} need${issues.length === 1 ? "s" : ""} a decision${high ? `, ${high} of them high priority` : ""}.` : ""}`
    : "";
  const ask = (question: string) => {
    brain.setPage("chat");
    brain.askQuestion(question);
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="pp-eyebrow">
          Daily brief{hasSheet ? ` · ${prettyDate(asOf.toISOString())}` : ""}
        </p>
        <h1 className="pp-title text-4xl sm:text-[44px]">
          {brain.company || "Your company"}
        </h1>
        <p className="font-heading text-lg italic text-[var(--ink-muted)]">
          {TAGLINE}
        </p>
      </header>

      {sample && (
        <p className="pp-feature px-5 py-3 pl-6 text-sm text-[var(--ink-muted)]">
          <strong className="font-medium text-[var(--navy)]">
            Sample workbook.
          </strong>{" "}
          The law firms, invoices, tasks and notes below are invented to show
          how the brain works. No real client data appears here.
          {brain.preview ? "" : " Import your own spreadsheet to replace it."}
        </p>
      )}

      {hasSheet ? (
        <p className="max-w-3xl text-[15px] leading-relaxed">{brief}</p>
      ) : (
        <section className="pp-feature flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="max-w-xl">
            <h2 className="pp-title text-xl">
              Your spreadsheet isn’t connected yet
            </h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              The daily brief reads tasks, deliverables, invoices and
              follow-ups from your client workbook. Until it is imported there
              is nothing to count, so the figures below stay empty.
            </p>
          </div>
          <Button onClick={() => brain.setPage("setup")}>
            Finish setup <ArrowRight />
          </Button>
        </section>
      )}

      <section
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        aria-label="Daily figures"
      >
        {stats.map((stat) => (
          <div key={stat.label} className="pp-panel min-w-0 p-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              {stat.label}
            </p>
            <p
              className={cn(
                "mt-2 text-3xl font-medium tracking-tight tabular-nums text-[var(--navy)]",
                stat.tone,
              )}
            >
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">{stat.hint}</p>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <section
            className="pp-panel min-w-0 scroll-mt-24"
            aria-labelledby="todo-title"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-gold)] px-5 py-3">
              <div className="flex items-baseline gap-3">
                <h2 id="todo-title" className="pp-title text-xl">
                  To do
                </h2>
                <span className="text-sm text-[var(--ink-faint)]">
                  {openTodos.length} open · **** first
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  disabled={!editable}
                  title={editable ? undefined : lockedHint}
                  onClick={() => setEditing({ id: null, fields: null })}
                >
                  <Plus /> Add
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!taskRows.length}
                  onClick={() => {
                    document.body.classList.add("pp-printing");
                    const done = () => {
                      document.body.classList.remove("pp-printing");
                      window.removeEventListener("afterprint", done);
                    };
                    window.addEventListener("afterprint", done);
                    window.print();
                  }}
                >
                  <Printer /> Print
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!taskRows.length}
                  onClick={() => downloadTodos(taskRows, brain.company)}
                >
                  <Download /> Download
                </Button>
              </div>
            </div>
            {!editable && hasSheet && (
              <p className="border-b border-[var(--border-cool)] bg-[var(--paper)] px-5 py-2 text-sm text-[var(--ink-muted)]">
                {lockedHint}
              </p>
            )}
            <ul
              className="pp-scroll divide-y divide-[var(--border-cool)] overflow-y-auto"
              tabIndex={0}
              aria-label={`${plural(todos.length, "to-do")}, scrollable`}
            >
              {todos.map((i) => (
                <li
                  key={i.id}
                  className={cn(
                    "group flex items-start gap-3 px-5 py-3",
                    i.done && "bg-[var(--paper)]",
                  )}
                >
                  <span
                    className="w-8 shrink-0 pt-0.5 font-mono text-xs text-[var(--gold-deep)] sm:w-10 sm:text-sm"
                    aria-label={i.priority ? `Priority ${i.priority.length}` : undefined}
                  >
                    {i.priority}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        i.done && "text-[var(--ink-faint)] line-through",
                      )}
                    >
                      {i.label}
                    </p>
                    <p className="flex flex-wrap gap-x-3 text-sm text-[var(--ink-muted)]">
                      {(i.category || i.client) && (
                        <span>
                          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                            Category
                          </span>{" "}
                          {i.category || i.client}
                        </span>
                      )}
                      {i.due && (
                        <span className="tabular-nums">
                          {isNaN(i.days) ? i.due : `Due ${prettyDate(i.due)}`}
                        </span>
                      )}
                    </p>
                  </div>
                  {editable && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={i.done ? `Reopen: ${i.label}` : `Mark done: ${i.label}`}
                        title={i.done ? "Reopen" : "Mark done"}
                        disabled={brain.busy}
                        onClick={() => void brain.markTodoDone(i.id, !i.done)}
                      >
                        {i.done ? <RotateCcw /> : <Check />}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit: ${i.label}`}
                        title="Edit"
                        disabled={brain.busy}
                        onClick={() => {
                          const r = rows.find((x) => x.id === i.id);
                          if (r) setEditing({ id: i.id, fields: fieldsOf(r) });
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete: ${i.label}`}
                        title="Delete"
                        disabled={brain.busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete this to-do?\n\n"${i.label}"\n\nIt is removed from your Company Brain. Your spreadsheet isn't changed, so re-importing it would bring the row back.`,
                            )
                          )
                            void brain.deleteTodo(i.id);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
              {!todos.length && (
                <li className="flex items-start gap-3 px-5 py-5 text-sm text-[var(--ink-muted)]">
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--positive)]" />
                  {hasSheet || editable
                    ? "No open to-dos. Use Add to create one."
                    : "Your to-do list appears here once your spreadsheet is imported."}
                </li>
              )}
            </ul>
            {hasSheet && (
              <p className="flex flex-wrap items-center gap-x-2 border-t border-[var(--border-cool)] px-5 py-2 text-sm text-[var(--ink-faint)]">
                <span>
                  {plural(rows.length, "workbook row")}: {openTodos.length} open to-dos
                  {items.length ? `, ${items.length} deliverables and follow-ups` : ""}
                  {doneTasks ? `, ${doneTasks} marked done` : ""}
                  {elsewhere ? `, ${elsewhere} other records (invoices, notes and similar)` : ""}.
                </span>
                {doneTasks > 0 && (
                  <button
                    className="font-medium text-[var(--navy)] underline underline-offset-2"
                    onClick={() => setShowDone((v) => !v)}
                  >
                    {showDone ? "Hide done" : `Show done (${doneTasks})`}
                  </button>
                )}
              </p>
            )}
            <TodoPrintSheet rows={taskRows} company={brain.company} />
          </section>
          {editing && (
            <TodoDialog
              key={editing.id || "new"}
              open
              initial={editing.fields}
              categories={categories}
              busy={brain.busy}
              onClose={() => setEditing(null)}
              onSave={(f) => brain.saveTodo(editing.id, f)}
            />
          )}

          {items.length > 0 && (
            <section className="pp-panel min-w-0" aria-labelledby="agenda-title">
              <div className="flex items-baseline justify-between gap-2 border-b border-[var(--border-gold)] px-5 py-4">
                <h2 id="agenda-title" className="pp-title text-xl">
                  Deliverables and follow-ups
                </h2>
                <span className="text-sm text-[var(--ink-faint)]">
                  {items.length} open
                </span>
              </div>
              <ul
                className="pp-scroll divide-y divide-[var(--border-cool)] overflow-y-auto"
                tabIndex={0}
                aria-label={`${plural(items.length, "deliverable or follow-up")}, scrollable`}
              >
                {items.map((i) => (
                  <li key={i.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{i.label}</p>
                      <p className="text-sm text-[var(--ink-muted)]">
                        {i.kind}
                        {i.client && (
                          <>
                            {" · "}
                            <button
                              className="text-left underline-offset-2 hover:underline"
                              onClick={() => onCustomer(i.client)}
                            >
                              {i.client}
                            </button>
                          </>
                        )}
                      </p>
                    </div>
                    {!isNaN(i.days) && (
                      <span
                        className={cn(
                          "shrink-0 text-sm tabular-nums",
                          i.days < 0
                            ? "font-medium text-[var(--negative)]"
                            : "text-[var(--ink-muted)]",
                        )}
                      >
                        {when(i.days)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <section className="pp-panel min-w-0" aria-label="Needs attention">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-gold)] px-5 py-4">
              <h2 className="pp-title text-xl">
                Needs attention{" "}
                <span className="font-sans text-sm text-[var(--ink-faint)]">
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
            <div className="divide-y divide-[var(--border-cool)]">
              {issues.slice(0, 3).map((issue) => (
                <IssueSummary
                  key={issue.id}
                  issue={issue}
                  onClick={() => setSelected(issue.id)}
                />
              ))}
            </div>
            {!issues.length && (
              <p className="p-5 text-sm text-[var(--ink-muted)]">
                {brain.records.length
                  ? "No open issues. Run an analysis from Attention once AI is connected."
                  : "Issues appear after your records are imported and analyzed."}
              </p>
            )}
            {issues.some((i) => i.origin === "sample") && (
              <p className="border-t border-[var(--border-cool)] px-5 py-2 text-sm text-[var(--ink-faint)]">
                Sample analysis, prepared for the sample workbook
              </p>
            )}
          </section>

          <section
            className="pp-panel min-w-0 p-5"
            aria-labelledby="home-ask-title"
          >
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--gold-deep)]" />
              <h2 id="home-ask-title" className="pp-title text-xl">
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
                className="h-10 min-w-0 bg-white text-sm"
                aria-label="Ask about your business"
                placeholder="Ask about a client, invoice or deadline"
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
                  className="flex min-h-10 items-center justify-between gap-2 rounded-[2px] px-1 py-2 text-left text-sm text-[var(--ink-muted)] hover:bg-[var(--lavender)] hover:text-[var(--navy)] disabled:opacity-50"
                >
                  {prompt}
                  <ArrowRight className="size-3.5 shrink-0" />
                </button>
              ))}
            </div>
            <p className="mt-3 border-t border-[var(--border-cool)] pt-3 text-sm text-[var(--ink-faint)]">
              {brain.connected
                ? "Answers cite the records they come from."
                : "Chat starts once an AI connection test succeeds."}
            </p>
          </section>
        </div>
      </div>

      <footer
        className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[var(--border-gold)] pt-4 text-sm text-[var(--ink-muted)]"
        aria-label="Source status"
      >
        <span className="font-medium text-[var(--navy)]">Sources</span>
        {brain.sources.map((source) => (
          <button
            key={source.id}
            onClick={() => brain.setPage("sources")}
            className="flex min-h-8 items-center gap-1.5 hover:text-[var(--navy)]"
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                source.status === "error"
                  ? "bg-[var(--negative)]"
                  : source.mode === "sample"
                    ? "bg-[var(--ink-faint)]"
                    : "bg-[var(--positive)]",
              )}
            />
            <span className="font-medium text-[var(--navy)]">
              {source.kind === "web" ? source.name : toolName[source.kind] || source.name}
            </span>
            <span>
              ·{" "}
              {source.status === "error"
                ? "Needs attention"
                : source.mode === "sample"
                  ? "Sample"
                  : "Connected"}
            </span>
          </button>
        ))}
        {!brain.sources.length && <span>Spreadsheet · Not connected</span>}
        <span className="text-[var(--ink-faint)]">
          Payments, CRM and team chat are not selected sources.
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto min-h-10 text-sm"
          onClick={() => brain.setPage("setup")}
        >
          Finish setup <ArrowRight />
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
