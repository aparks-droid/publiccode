"use client";
import { ArrowUp, Brain as BrainIcon, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/brain";
import type { Brain } from "@/lib/use-brain";

const suggestions = [
  "What needs our attention this week?",
  "Which customers owe us money?",
  "What is in the pipeline, and what is at risk?",
  "What is the team worried about?",
];

export function Chat({ brain }: { brain: Brain }) {
  const { messages, failed, asking, connected, draft } = brain;
  const empty = !messages.length && !failed && !asking;
  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] max-w-3xl flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Ask your brain
        </h1>
        {!empty && (
          <Button
            variant="outline"
            size="sm"
            disabled={asking}
            onClick={brain.newConversation}
          >
            New conversation
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <BrainIcon className="size-10 text-violet-600" />
            <p className="text-muted-foreground">
              Pick a question or write your own.
            </p>
            <div className="grid w-full gap-2 sm:grid-cols-2">
              {suggestions.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  className="h-auto justify-start whitespace-normal py-3 text-left"
                  onClick={() => brain.askQuestion(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col gap-1",
                  m.role === "user" && "items-end",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  {m.content}
                </div>
                {!!m.citations?.length && (
                  <details className="max-w-[85%] text-sm text-muted-foreground">
                    <summary className="cursor-pointer">
                      {plural(m.citations.length, "source record")}
                    </summary>
                    {m.citations.map((c) => (
                      <div key={c.number}>
                        [{c.number}] {c.title}
                      </div>
                    ))}
                  </details>
                )}
              </div>
            ))}
            {asking && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Reading your company
                records…
              </div>
            )}
            {failed && (
              <div
                role="alert"
                className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
              >
                <p className="font-medium">
                  This question was not answered: “{failed.question}”
                </p>
                <p className="text-destructive">{failed.error}</p>
                <Button
                  size="sm"
                  className="self-start"
                  onClick={() => brain.askQuestion(failed.question)}
                >
                  <RotateCcw /> Retry
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() && !asking) brain.askQuestion(draft);
        }}
      >
        <Textarea
          aria-label="Ask a question"
          placeholder="Ask anything about your company…"
          className="max-h-40 min-h-11 resize-none"
          value={draft}
          onChange={(e) => brain.setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (draft.trim() && !asking) brain.askQuestion(draft);
            }
          }}
        />
        <Button type="submit" disabled={asking || !draft.trim()}>
          {connected ? (
            <>
              <ArrowUp /> Ask
            </>
          ) : (
            "Connect AI & ask"
          )}
        </Button>
      </form>
    </div>
  );
}
