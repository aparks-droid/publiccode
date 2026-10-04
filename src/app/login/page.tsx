"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SignIn() {
  const params = useSearchParams();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  useEffect(() => {
    void fetch("/api/login")
      .then((r) => r.json())
      .then((d) => setNeedsCode(!!d.codeRequired))
      .catch(() => {});
  }, []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = params.get("next") || "/";
  return (
    <form
      className="pp-feature grid w-full max-w-sm gap-4 p-8 pl-9"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ user, password, code }),
        }).catch(() => null);
        if (res?.ok)
          window.location.assign(next.startsWith("/") && !next.startsWith("//") ? next : "/");
        else {
          setError((await res?.json().catch(() => null))?.error || "Could not sign in.");
          setBusy(false);
        }
      }}
    >
      <div className="flex items-center gap-3">
        <span className="parkspacific-mark" aria-hidden="true" />
        <div>
          <p className="font-heading text-xl font-semibold text-[var(--navy)]">
            ParksPacific Financial
          </p>
          <p className="pp-eyebrow">Company brain</p>
        </div>
      </div>
      <h1 className="pp-title text-3xl">Sign in</h1>
      <label className="grid gap-1 text-sm font-medium">
        Username
        <Input
          autoComplete="username"
          className="h-11 bg-white"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          required
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Password
        <Input
          type="password"
          autoComplete="current-password"
          className="h-11 bg-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {needsCode && (
        <label className="grid gap-1 text-sm font-medium">
          Authenticator code
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            className="h-11 bg-white tracking-[0.3em]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--negative)]">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} Sign in
      </Button>
      <p className="font-heading text-base italic text-[var(--ink-muted)]">
        You may have to live with risk, but you never have to let it win.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Suspense>
        <SignIn />
      </Suspense>
    </main>
  );
}
