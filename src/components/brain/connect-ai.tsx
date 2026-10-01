"use client";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Brain } from "@/lib/use-brain";

// Every entry point uses the same two-step connection flow.
export function ConnectAi({ brain }: { brain: Brain }) {
  const [step, setStep] = useState<"choose" | "openai" | "anthropic">("choose");
  const [key, setKey] = useState("");
  const checking = brain.connection === "checking";

  function reset() {
    setStep("choose");
    setKey("");
  }

  return (
    <Dialog
      open={brain.connectOpen}
      onOpenChange={(open) => {
        if (!open && !checking) {
          brain.closeConnect();
          reset();
        }
      }}
      onOpenChangeComplete={(open) => !open && reset()}
    >
      <DialogContent
        className="gap-6 p-6 sm:max-w-sm"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="pr-8 text-xl">
            {step === "choose"
              ? "Connect AI"
              : step === "openai"
                ? "Use ChatGPT"
                : "Use Claude Code"}
          </DialogTitle>
        </DialogHeader>

        {step === "choose" ? (
          <div className="flex flex-col gap-3">
            <Button
              className="h-12 justify-start gap-3 bg-black px-4 text-base text-white hover:bg-black/85"
              disabled={checking}
              onClick={() => {
                brain.clearConnectionError();
                setStep("openai");
              }}
            >
              {checking ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/brand/openai.svg" alt="" className="size-5 invert" />
              )}
              Use ChatGPT
            </Button>
            <Button
              variant="outline"
              className="h-12 justify-start gap-3 border-[#e3dfd3] bg-[#f0eee6] px-4 text-base text-[#141413] hover:bg-[#e8e5da]"
              disabled={checking}
              onClick={() => {
                brain.clearConnectionError();
                setStep("anthropic");
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/claude.svg" alt="" className="size-5" />
              Use Claude Code
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (key.trim() && !checking) void brain.connect(step, key.trim());
            }}
          >
            <label className="flex flex-col gap-2 text-sm font-medium">
              {step === "openai" ? "OpenAI API key" : "Anthropic API key"}
              <Input
                autoFocus
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={step === "openai" ? "sk-…" : "sk-ant-…"}
                aria-describedby="api-key-scope"
                value={key}
                disabled={checking}
                className="h-11"
                onChange={(event) => setKey(event.target.value)}
              />
            </label>
            <p
              id="api-key-scope"
              className="text-sm leading-relaxed text-muted-foreground"
            >
              {step === "openai"
                ? "Use a key from your OpenAI API project with API billing enabled."
                : "When creating your key, set Scope to Default workspace (or another workspace), not Organization."}
            </p>
            <Button
              className="h-11"
              disabled={!key.trim() || checking}
              type="submit"
            >
              {checking && <Loader2 className="animate-spin" />}
              {checking ? "Connecting…" : "Connect"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="self-start"
              disabled={checking}
              onClick={() => {
                brain.clearConnectionError();
                reset();
              }}
            >
              <ArrowLeft /> Back
            </Button>
          </form>
        )}
        <p className="text-sm leading-relaxed text-muted-foreground">
          {brain.preview
            ? "Your key stays in this tab for the sample preview."
            : "Your key is saved on this computer for chat and attention checks."}{" "}
          API billing is separate from your subscription.
        </p>

        {brain.connection === "error" && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {brain.connectionError}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
