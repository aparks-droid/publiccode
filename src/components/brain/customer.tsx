"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { failedOnce, money, plural, prettyDate, currencyOf } from "@/lib/brain";
import type { Brain } from "@/lib/use-brain";

// Everything the brain knows about one customer, across every source.
export function Customer({
  name,
  brain,
  onClose,
}: {
  name: string;
  brain: Brain;
  onClose: () => void;
}) {
  const mine = (v: unknown) => String(v || "") === name;
  const deals = brain
    .from("attio")
    .filter(
      (r) =>
        r.metadata.type === "deal" &&
        mine(r.metadata.company || r.metadata.name),
    );
  const payments = brain
    .from("stripe")
    .filter((r) => r.metadata.type === "payment" && mine(r.metadata.customer));
  const currency = currencyOf(payments);
  const displayMoney = (n: number) =>
    currency ? money(n, currency) : "Multiple currencies";
  const paid = payments
    .filter((p) => p.metadata.status === "succeeded")
    .reduce((t, p) => t + Number(p.metadata.amount), 0);
  const owed = failedOnce(payments);
  const first = name.split(" ")[0];
  const mentions = brain
    .from("slack")
    .filter((r) => String(r.metadata.text || r.content).includes(first))
    .sort((a, b) =>
      String(b.metadata.posted_at).localeCompare(String(a.metadata.posted_at)),
    );
  const issues = brain.issues.filter((i) => !i.resolved && mine(i.customer));
  const sheet = brain
    .from("web")
    .filter((r) => mine(r.metadata.client))
    .sort((a, b) =>
      String(a.metadata.type).localeCompare(String(b.metadata.type)),
    );
  const block = (title: string, children: React.ReactNode) => (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
  const none = (
    <p className="text-sm text-muted-foreground">Nothing on record.</p>
  );
  return (
    <Dialog open={!!name} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>
            {plural(issues.length, "open issue")} ·{" "}
            {plural(sheet.length, "workbook record")}
            {payments.length ? ` · ${displayMoney(paid)} paid` : ""}
            {owed.length
              ? ` · ${money(owed.reduce((t, p) => t + Number(p.metadata.amount), 0))} in failed payments`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {block(
          "Open issues",
          issues.length
            ? issues.map((i) => (
                <div key={i.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">{i.title}</div>
                  <div className="text-muted-foreground">
                    {i.owner} · {i.due ? `due ${prettyDate(i.due)}` : "no date"}{" "}
                    · {i.status}
                  </div>
                </div>
              ))
            : none,
        )}
        {block(
          "From your workbook",
          sheet.length
            ? sheet.map((r) => (
                <div key={r.id} className="rounded-[2px] border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-[2px] capitalize">
                      {String(r.metadata.type)}
                    </Badge>
                    <span className="font-medium">{r.title.replace(/^[^—]*— /, "")}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{r.content}</p>
                </div>
              ))
            : none,
        )}
        {!!deals.length && block(
          "Deals",
          deals.length
            ? deals.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
                >
                  <span className="font-medium">{d.metadata.name}</span>
                  <Badge variant="outline">{d.metadata.stage}</Badge>
                  <span className="ml-auto tabular-nums">
                    {money(Number(d.metadata.value))}
                  </span>
                  <span className="w-full text-muted-foreground">
                    Next: {d.metadata.next_step}
                  </span>
                </div>
              ))
            : none,
        )}
        {!!payments.length && block(
          "Payments",
          payments.length ? (
            <div className="rounded-lg border p-3 text-sm">
              {plural(
                payments.filter((p) => p.metadata.status === "succeeded")
                  .length,
                "successful payment",
              )}{" "}
              totalling {displayMoney(paid)}.
              {owed.map((p) => (
                <div key={p.id} className="text-destructive">
                  {money(Number(p.metadata.amount))} failed on{" "}
                  {prettyDate(p.metadata.date)} — check the source for
                  collection status.
                </div>
              ))}
            </div>
          ) : (
            none
          ),
        )}
        {!!mentions.length && block(
          "What the team is saying",
          mentions.length
            ? mentions.slice(0, 6).map((m) => (
                <div key={m.id} className="text-sm">
                  <span className="font-medium">{m.metadata.author}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · #{m.metadata.channel} · {prettyDate(m.metadata.posted_at)}
                  </span>
                  <p className="text-muted-foreground">
                    {m.metadata.text || m.content}
                  </p>
                </div>
              ))
            : none,
        )}
        <Button
          onClick={() => {
            onClose();
            brain.askQuestion(
              `Brief me on ${name}: what is going on, what have we promised, what is due, and what do they owe us?`,
            );
          }}
        >
          Ask about {name}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
