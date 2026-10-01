"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { Brain } from "@/lib/use-brain";
export function DatabaseSetup({ brain }: { brain: Brain }) {
  const [url, setUrl] = useState(""),
    [key, setKey] = useState(""),
    [error, setError] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {brain.configured ? "Your database" : "Start with your own database"}
        </CardTitle>
        <CardDescription className="text-sm">
          Your company records live in your Supabase project. Connection keys
          stay on this computer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {brain.configured ? (
          <p className="text-sm">
            Connected to <strong>{brain.project}</strong>.
          </p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              try {
                await brain.connectDatabase(url.trim(), key.trim());
                setKey("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not connect.");
              }
            }}
          >
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Create a Supabase project
                </a>{" "}
                for your company.
              </li>
              <li>
                In its SQL editor, run the contents of{" "}
                <code>supabase/setup.sql</code> from this repo.
              </li>
              <li>
                Copy the project URL and secret key from Project Settings → API
                Keys.
              </li>
            </ol>
            <label className="grid gap-2 text-sm font-medium">
              Project URL
              <Input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Supabase secret key
              <Input
                type="password"
                required
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sb_secret_… or legacy service_role key"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              disabled={brain.busy || !url.trim() || !key.trim()}
              type="submit"
            >
              {brain.busy && <Loader2 className="animate-spin" />}Connect
              database
            </Button>
            <p className="text-sm text-muted-foreground">
              Stored in the ignored .company-brain folder. Never committed or
              sent to the browser again.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
