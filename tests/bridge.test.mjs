import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
test("local Codex bridge enforces origin and pairing; account endpoint responds", async () => {
  const child = spawn(process.execPath, [
    "scripts/codex-bridge.mjs",
    "--origin",
    "http://localhost:3018",
  ]);
  let output = "";
  try {
    const token = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Bridge startup timeout")),
        15000,
      );
      child.stdout.on("data", (data) => {
        output += data;
        const match = output.match(/pairing token[^:]*: ([a-f0-9]{64})/i);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        reject(Error(`Bridge exited ${code}`));
      });
      child.stderr.on("data", () => {});
    });
    const wrongOrigin = await fetch("http://127.0.0.1:4318/account", {
      method: "POST",
      headers: {
        Origin: "https://untrusted.example",
        Authorization: `Bearer ${token}`,
      },
      body: "{}",
    });
    assert.equal(wrongOrigin.status, 403);
    const wrongToken = await fetch("http://127.0.0.1:4318/account", {
      method: "POST",
      headers: {
        Origin: "http://localhost:3018",
        Authorization: "Bearer invalid",
      },
      body: "{}",
    });
    assert.equal(wrongToken.status, 401);
    const account = await fetch("http://127.0.0.1:4318/account", {
      method: "POST",
      headers: {
        Origin: "http://localhost:3018",
        Authorization: `Bearer ${token}`,
      },
      body: "{}",
    });
    assert.equal(account.status, 200);
    assert.ok("account" in (await account.json()));
  } finally {
    child.kill("SIGINT");
  }
});
