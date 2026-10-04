"use client";
import { useState } from "react";
import { Settings, Sparkles } from "lucide-react";
import { DatabaseSetup } from "@/components/brain/database-setup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Attention } from "@/components/brain/attention";
import { Chat } from "@/components/brain/chat";
import { ConnectAi } from "@/components/brain/connect-ai";
import { Customer } from "@/components/brain/customer";
import { Sources } from "@/components/brain/sources";
import { PipelineView, RevenueView } from "@/components/brain/tool-views";
import { HomeOverview } from "@/components/brain/home";
import { FinishSetup } from "@/components/brain/setup";
import { useBrain } from "@/lib/use-brain";

const allPages = [
  ["home", "Today"],
  ["attention", "Attention"],
  ["pipeline", "Pipeline"],
  ["revenue", "Revenue"],
  ["sources", "Sources"],
  ["setup", "Finish setup"],
  ["chat", "Ask your brain"],
];
const aiNames: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
};

export default function Home() {
  const brain = useBrain();
  const [customer, setCustomer] = useState("");
  const [name, setName] = useState<string | null>(null);
  const { page, setPage, connected, loaded, configured } = brain;
  const aiName = aiNames[brain.provider] || "";
  const deals = brain.from("attio").filter((r) => r.metadata.type === "deal");
  const payments = brain
    .from("stripe")
    .filter((r) => r.metadata.type === "payment");
  // Pipeline and Revenue read Attio and Stripe, which are not selected
  // sources here; show them only once such records exist.
  const pages = allPages.filter(
    ([id]) =>
      (id !== "pipeline" || deals.length) && (id !== "revenue" || payments.length),
  );
  const heading = (title: string, hint: string) => (
    <div className="mb-5">
      <h1 className="pp-title text-3xl">{title}</h1>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
  const placeholder = (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
  const needsData = (tool: string) => (
    <Card>
      <CardHeader>
        <CardTitle>Nothing from {tool} yet</CardTitle>
        <CardDescription className="text-sm">
          Set up {tool} or load the sample company on the Sources page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => setPage("sources")}>Go to Sources</Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-[var(--border-gold)] bg-[var(--paper)]/95 backdrop-blur">
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <button
            className="flex min-w-0 items-center gap-2 whitespace-nowrap font-semibold"
            onClick={() => setPage("home")}
          >
            <span className="parkspacific-mark" aria-hidden="true" />
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span className="truncate font-heading text-lg font-semibold tracking-wide text-[var(--navy)]">
                ParksPacific Financial
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--gold-deep)] sm:block">
                Company brain
              </span>
            </span>
          </button>
          {brain.demo && (
            <Badge
              variant="outline"
              className="rounded-[2px] border-[var(--gold)] bg-white text-[var(--gold-deep)]"
            >
              Sample<span className="hidden sm:inline">&nbsp;data</span>
            </Badge>
          )}
          <nav className="hidden gap-1 lg:flex">
            {pages.map(([id, label]) => (
              <Button
                key={id}
                size="sm"
                className="min-h-9 text-sm"
                variant={page === id ? "secondary" : "ghost"}
                aria-current={page === id ? "page" : undefined}
                onClick={() => setPage(id)}
              >
                {id === "chat" && <Sparkles />}
                {label}
              </Button>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {loaded &&
              (connected ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage("settings")}
                >
                  <span className="size-2 rounded-full bg-[var(--positive)]" />
                  <span className="hidden sm:inline">Connected to </span>
                  {aiName}
                </Button>
              ) : (
                <Button size="sm" onClick={brain.openConnect}>
                  Connect AI
                </Button>
              ))}
            <Button
              size="icon"
              variant={page === "settings" ? "secondary" : "ghost"}
              aria-label="Settings"
              onClick={() => setPage("settings")}
            >
              <Settings />
            </Button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t px-3 py-1.5 lg:hidden">
          {pages.map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              className="min-h-9 shrink-0 text-sm"
              variant={page === id ? "secondary" : "ghost"}
              onClick={() => setPage(id)}
            >
              {label}
            </Button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {!loaded ? (
          placeholder
        ) : (
          <>
            {brain.preview && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[2px] border border-[var(--border-gold)] bg-white px-4 py-3 text-sm">
                <span>
                  Public preview with sample records. Real company data is
                  connected only in the local copy.
                </span>
                <button
                  className="font-medium underline underline-offset-2"
                  onClick={() => setPage("setup")}
                >
                  Finish setup
                </button>
              </div>
            )}
            {brain.setupError && (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                {brain.setupError}
              </p>
            )}
            {!configured && !brain.preview && (
              <div className="mx-auto mb-6 max-w-2xl">
                <DatabaseSetup brain={brain} />
              </div>
            )}
            {(configured || brain.preview || page === "setup") && (
              <>
                {page === "home" && (
                  <HomeOverview brain={brain} onCustomer={setCustomer} />
                )}
                {page === "attention" && (
                  <Attention brain={brain} onCustomer={setCustomer} />
                )}
                {page === "pipeline" && (
                  <>
                    {heading("Pipeline", "Deals from Attio.")}
                    {deals.length ? (
                      <PipelineView brain={brain} onCustomer={setCustomer} />
                    ) : (
                      needsData("Attio")
                    )}
                  </>
                )}
                {page === "revenue" && (
                  <>
                    {heading("Revenue", "Payments from Stripe.")}
                    {payments.length ? (
                      <RevenueView brain={brain} onCustomer={setCustomer} />
                    ) : (
                      needsData("Stripe")
                    )}
                  </>
                )}
                {page === "sources" && (
                  <>
                    {heading(
                      "Sources",
                      "Where the brain's records come from, and everything it holds.",
                    )}
                    <Sources brain={brain} />
                  </>
                )}
                {page === "setup" && <FinishSetup brain={brain} />}
                {page === "chat" && <Chat brain={brain} />}
                {page === "settings" && (
                  <div className="mx-auto flex max-w-2xl flex-col gap-4">
                    {heading(
                      "Settings",
                      "Your company, your AI, your database.",
                    )}
                    <Card>
                      <CardHeader>
                        <CardTitle>Company name</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form
                          className="flex gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void brain.saveCompany(name ?? brain.company);
                            setName(null);
                          }}
                        >
                          <Input
                            aria-label="Company name"
                            value={name ?? brain.company}
                            onChange={(e) => setName(e.target.value)}
                          />
                          <Button
                            type="submit"
                            disabled={
                              name === null ||
                              !name.trim() ||
                              name.trim() === brain.company
                            }
                          >
                            Save
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>AI</CardTitle>
                        <CardDescription className="text-sm">
                          {connected
                            ? `Connected to ${aiName}${brain.answeredBy ? ` (${brain.answeredBy})` : ""}.`
                            : "Not connected."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex gap-2">
                        <Button
                          variant={connected ? "outline" : "default"}
                          onClick={brain.openConnect}
                        >
                          {connected ? "Change AI" : "Connect AI"}
                        </Button>
                        {connected && (
                          <Button variant="ghost" onClick={brain.disconnect}>
                            Disconnect
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                    {!brain.preview && configured && (
                      <DatabaseSetup brain={brain} />
                    )}
                    {brain.preview && (
                      <Button
                        variant="outline"
                        className="self-start"
                        onClick={async () => {
                          await fetch("/api/login", { method: "DELETE" });
                          window.location.assign("/login");
                        }}
                      >
                        Sign out
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
      <ConnectAi brain={brain} />
      <Customer name={customer} brain={brain} onClose={() => setCustomer("")} />
    </div>
  );
}
