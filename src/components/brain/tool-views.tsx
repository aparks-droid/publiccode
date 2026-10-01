"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ArrowRight, MessageCircleQuestion } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  type RecordRow,
  currencyOf,
  paymentNet,
  failedOnce,
  initials,
  money,
  plural,
  prettyDate,
  stages,
  tone,
} from "@/lib/brain";
import type { Brain } from "@/lib/use-brain";

function Person({ name }: { name: unknown }) {
  return (
    <Avatar size="sm" className="rounded-md">
      <AvatarFallback className={cn("rounded-md font-medium", tone(name))}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
export function Stat({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="text-sm">{label}</CardDescription>
        <div
          className={cn(
            "text-2xl font-semibold tabular-nums",
            danger && "text-destructive",
          )}
        >
          {value}
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {hint}
      </CardContent>
    </Card>
  );
}
const sum = (rows: RecordRow[], key: string) =>
  rows.reduce((t, r) => t + (Number(r.metadata[key]) || 0), 0);
const stageDot: Record<string, string> = {
  Lead: "bg-zinc-400",
  Qualified: "bg-sky-500",
  Proposal: "bg-violet-500",
  Negotiation: "bg-amber-500",
  Won: "bg-emerald-500",
};
type Shared = { brain: Brain; onCustomer: (name: string) => void };
const Customer = ({
  name,
  onCustomer,
}: {
  name: unknown;
  onCustomer: (name: string) => void;
}) => (
  <button
    className="text-left font-medium underline-offset-4 hover:underline"
    onClick={() => onCustomer(String(name))}
  >
    {String(name)}
  </button>
);

export function PipelineView({ brain, onCustomer }: Shared) {
  const deals = brain.from("attio").filter((r) => r.metadata.type === "deal");
  const sourceStages = [
    ...new Set([
      ...stages,
      ...deals.map((d) => String(d.metadata.stage || "Unknown")),
    ]),
  ];
  const dealCurrency = currencyOf(deals);
  const dealMoney = (rows: RecordRow[]) =>
    dealCurrency
      ? money(sum(rows, "value"), dealCurrency)
      : "Multiple currencies";
  const open = deals.filter((d) => d.metadata.stage !== "Won");
  const won = deals.filter((d) => d.metadata.stage === "Won");
  // Deals that need someone to step in: something is blocking them.
  const stuck = open
    .filter((d) => d.metadata.blocker)
    .sort((a, b) => Number(b.metadata.value) - Number(a.metadata.value));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Open pipeline"
          value={dealMoney(open)}
          hint={`${plural(open.length, "open deal")}`}
        />
        <Stat
          label="Blocked"
          value={dealMoney(stuck)}
          hint={`${plural(stuck.length, "deal")} need intervention`}
          danger={stuck.length > 0}
        />
        <Stat
          label="In negotiation"
          value={money(
            sum(
              open.filter((d) => d.metadata.stage === "Negotiation"),
              "value",
            ),
          )}
          hint="Closest to signing"
        />
        <Stat
          label="Won"
          value={dealMoney(won)}
          hint={plural(won.length, "deal")}
        />
      </div>
      <Tabs defaultValue="attention">
        <TabsList>
          <TabsTrigger value="attention">Needs attention</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
        </TabsList>
        <TabsContent value="attention" className="flex flex-col gap-3">
          {stuck.map((d) => (
            <Card key={d.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Customer
                    name={d.metadata.company || d.metadata.name}
                    onCustomer={onCustomer}
                  />
                  <Badge variant="outline" className="gap-1.5">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        stageDot[String(d.metadata.stage)],
                      )}
                    />
                    {d.metadata.stage}
                  </Badge>
                  <span className="ml-auto tabular-nums">
                    {money(
                      Number(d.metadata.value),
                      String(d.metadata.currency || "USD"),
                    )}
                  </span>
                </CardTitle>
                <CardDescription className="text-sm">
                  {d.metadata.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Blocker</dt>
                    <dd>{d.metadata.blocker}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Why it fits</dt>
                    <dd>{d.metadata.fit || "Not assessed yet"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Owner</dt>
                    <dd>{d.metadata.owner}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Next action</dt>
                    <dd>
                      {d.metadata.next_step} (close{" "}
                      {prettyDate(d.metadata.close_date)})
                    </dd>
                  </div>
                </dl>
                <Button
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    brain.askQuestion(
                      `What is blocking the ${d.metadata.company || d.metadata.name} deal (${d.metadata.name}) and what should we do next?`,
                    )
                  }
                >
                  <MessageCircleQuestion /> Ask about this
                </Button>
              </CardContent>
            </Card>
          ))}
          {!stuck.length && (
            <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
              No imported deal is marked as blocked.
            </p>
          )}
        </TabsContent>
        <TabsContent value="board">
          <div className="grid grid-cols-5 gap-3 overflow-x-auto pb-2">
            {sourceStages.map((stage) => {
              const rows = deals.filter((d) => d.metadata.stage === stage);
              return (
                <div
                  key={stage}
                  className="flex min-w-[200px] flex-col gap-2 rounded-xl bg-muted/60 p-2"
                >
                  <div className="flex items-center gap-2 px-1 py-1 text-sm">
                    <span
                      className={cn("size-2 rounded-full", stageDot[stage])}
                    />
                    <span className="font-medium">{stage}</span>
                    <span className="text-muted-foreground">{rows.length}</span>
                    <span className="ml-auto tabular-nums text-muted-foreground">
                      {dealMoney(rows)}
                    </span>
                  </div>
                  {rows.map((d) => (
                    <Card key={d.id} size="sm" className="gap-2">
                      <CardHeader>
                        <CardTitle className="text-sm">
                          <Customer
                            name={d.metadata.company || d.metadata.name}
                            onCustomer={onCustomer}
                          />
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {d.metadata.name}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2 text-sm">
                        <span className="text-base font-semibold tabular-nums">
                          {money(
                            Number(d.metadata.value),
                            String(d.metadata.currency || "USD"),
                          )}
                          <span className="text-sm font-normal text-muted-foreground">
                            {" "}
                          </span>
                        </span>
                        <span className="flex items-start gap-1 text-muted-foreground">
                          <ArrowRight className="mt-0.5 size-3.5 shrink-0" />
                          {d.metadata.next_step}
                        </span>
                        <div className="flex items-center gap-2 border-t pt-2 text-muted-foreground">
                          <Person name={d.metadata.owner} />
                          {d.metadata.owner}
                          <span className="ml-auto">
                            {prettyDate(d.metadata.close_date).replace(
                              /, \d{4}$/,
                              "",
                            )}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {!rows.length && (
                    <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                      No deals
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="table">
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Close</TableHead>
                  <TableHead>Next step</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...deals]
                  .sort(
                    (a, b) =>
                      stages.indexOf(String(b.metadata.stage)) -
                      stages.indexOf(String(a.metadata.stage)),
                  )
                  .map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Customer
                          name={d.metadata.company || d.metadata.name}
                          onCustomer={onCustomer}
                        />
                      </TableCell>
                      <TableCell>{d.metadata.name}</TableCell>
                      <TableCell>{d.metadata.stage}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(
                          Number(d.metadata.value),
                          String(d.metadata.currency || "USD"),
                        )}
                      </TableCell>
                      <TableCell>{d.metadata.owner}</TableCell>
                      <TableCell>{prettyDate(d.metadata.close_date)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.metadata.next_step}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const revenueConfig = {
  revenue: { label: "Net revenue", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function RevenueView({ brain, onCustomer }: Shared) {
  const allPayments = brain
    .from("stripe")
    .filter((r) => r.metadata.type === "payment");
  const currencies = [
    ...new Set(allPayments.map((p) => String(p.metadata.currency || "USD"))),
  ];
  const [selectedCurrency, setCurrency] = useState("");
  const currency = currencies.includes(selectedCurrency)
    ? selectedCurrency
    : currencies[0] || "USD";
  const payments = allPayments.filter(
    (p) => String(p.metadata.currency || "USD") === currency,
  );
  const displayMoney = (value: number) => money(value, currency);
  const source = brain.sources.find((s) => s.kind === "stripe");
  const of = (status: string) =>
    payments.filter((p) => p.metadata.status === status);
  const paid = of("succeeded");
  const refunds = sum(of("refunded"), "amount") + sum(paid, "refunded");
  const byDate = [...payments].sort((a, b) =>
    String(a.metadata.date).localeCompare(String(b.metadata.date)),
  );
  const first = byDate[0]?.metadata.date;
  const last = byDate[byDate.length - 1]?.metadata.date;
  const currentMonth = String(last || "").slice(0, 7);
  // Refund amounts adjust their original charge month.
  const months = (() => {
    const map = new Map<
      string,
      { key: string; month: string; revenue: number }
    >();
    for (const p of byDate) {
      const status = p.metadata.status;
      if (status !== "succeeded" && status !== "refunded") continue;
      const key = String(p.metadata.date).slice(0, 7);
      const row = map.get(key) || {
        key,
        month: new Date(`${key}-15`).toLocaleDateString("en-US", {
          month: "short",
        }),
        revenue: 0,
      };
      row.revenue += paymentNet(p);
      map.set(key, row);
    }
    return [...map.values()];
  })();
  const customers = (() => {
    const map = new Map<string, number>();
    for (const p of paid)
      map.set(
        String(p.metadata.customer),
        (map.get(String(p.metadata.customer)) || 0) + Number(p.metadata.amount),
      );
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  })();
  const top = customers[0]?.[1] || 1;
  const owed = failedOnce(payments);
  return (
    <div className="flex flex-col gap-4">
      {currencies.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          Currency
          <select
            className="rounded-md border p-2"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
      <p className="text-sm text-muted-foreground">
        {prettyDate(first)} – {prettyDate(last)} · {currency} ·{" "}
        {source?.mode === "sample"
          ? "Sample data"
          : `Last synced ${prettyDate(source?.last_sync)}`}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Net revenue"
          value={displayMoney(sum(paid, "amount") - refunds)}
          hint={`${plural(paid.length, "payment")}, after ${displayMoney(refunds)} refunded`}
        />
        <Stat
          label="Latest imported month"
          value={displayMoney(
            sum(
              paid.filter((p) =>
                String(p.metadata.date).startsWith(currentMonth),
              ),
              "amount",
            ),
          )}
          hint="Latest imported month"
        />
        <Stat
          label="Failed payments"
          value={displayMoney(sum(owed, "amount"))}
          hint={`${plural(of("failed").length, "declined attempt")} ${plural(owed.length, "payment")}`}
          danger={owed.length > 0}
        />
        <Stat
          label="Paying customers"
          value={String(customers.length)}
          hint="With a successful payment"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue over time</CardTitle>
            <CardDescription className="text-sm">
              Imported payments minus refunds, grouped by the original charge
              month. This is a source snapshot, not a full accounting statement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueConfig} className="h-64 w-full">
              <BarChart data={months} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) => `${Number(v) / 1000}k`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {months.map((m) => (
                    <Cell
                      key={m.key}
                      fill="var(--color-revenue)"
                      fillOpacity={m.key === currentMonth ? 0.35 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By customer</CardTitle>
            <CardDescription className="text-sm">Total paid</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {customers.map(([name, total]) => (
              <div key={name} className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <Customer name={name} onCustomer={onCustomer} />
                  <span className="tabular-nums text-muted-foreground">
                    {displayMoney(total)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-chart-1"
                    style={{ width: `${(total / top) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...byDate].reverse().map((p) => (
              <TableRow key={p.id}>
                <TableCell>{prettyDate(p.metadata.date)}</TableCell>
                <TableCell>
                  <Customer
                    name={p.metadata.customer}
                    onCustomer={onCustomer}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.metadata.description}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.metadata.status === "refunded" ? "−" : ""}
                  {displayMoney(Number(p.metadata.amount))}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      p.metadata.status === "failed"
                        ? "destructive"
                        : p.metadata.status === "succeeded"
                          ? "secondary"
                          : "outline"
                    }
                    className="capitalize"
                  >
                    {p.metadata.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
