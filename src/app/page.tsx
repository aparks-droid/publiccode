"use client";
import { useState } from "react";
import { Brain as BrainIcon, Settings, Sparkles } from "lucide-react";
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
import { useBrain } from "@/lib/use-brain";

const pages = [
  ["home", "Home"],
  ["attention", "Attention"],
  ["pipeline", "Pipeline"],
  ["revenue", "Revenue"],
  ["sources", "Sources"],
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
  const heading = (title: string, hint: string) => (
    <div className="mb-5">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
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
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <button
            className="flex min-w-0 items-center gap-2 whitespace-nowrap font-semibold"
            onClick={() => setPage("home")}
          >
            <BrainIcon className="size-5 shrink-0 text-violet-600" />
            <span className="truncate">Company Brain</span>
          </button>
          {brain.demo && (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-800"
            >
              Demo<span className="hidden sm:inline">&nbsp;data</span>
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
                  <span className="size-2 rounded-full bg-emerald-500" />
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
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
                <span>
                  Sample preview. Run your own copy to connect your company.
                </span>
                <a
                  className="font-medium underline"
                  href="https://github.com/how-to-ai-co/company-brain#start-here"
                  target="_blank"
                  rel="noreferrer"
                >
                  Get the repo & recipe
                </a>
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
            {(configured || brain.preview) && (
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
