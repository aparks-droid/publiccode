import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import readline from "node:readline";
const origin = process.argv[process.argv.indexOf("--origin") + 1];
if (!origin || !/^https?:\/\//.test(origin)) {
  console.error(
    "Usage: npm run bridge -- --origin https://your-company-brain.vercel.app",
  );
  process.exit(1);
}
const allowedOrigin = new URL(origin).origin;
const token = randomBytes(32).toString("hex");
const home = path.join(homedir(), ".company-brain-codex");
const cwd = path.join(home, "workspace");
await mkdir(cwd, { recursive: true, mode: 0o700 });
await chmod(home, 0o700);
const child = spawn("codex", ["app-server"], {
  cwd,
  env: { PATH: process.env.PATH, HOME: homedir(), CODEX_HOME: home },
  stdio: ["pipe", "pipe", "pipe"],
});
let seq = 0;
const pending = new Map();
const turns = new Map();
function rpc(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(Error("Codex request timed out"));
    }, 120000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
  });
}
readline.createInterface({ input: child.stdout }).on("line", (line) => {
  let m;
  try {
    m = JSON.parse(line);
  } catch {
    return;
  }
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    clearTimeout(p.timer);
    if (m.error) p.reject(Error(m.error.message));
    else p.resolve(m.result);
    return;
  }
  if (m.id && m.method) {
    child.stdin.write(
      JSON.stringify({
        id: m.id,
        error: {
          code: -32601,
          message: "Tools and approvals are not available in Company Brain",
        },
      }) + "\n",
    );
    return;
  }
  const state = turns.get(m.params?.threadId);
  if (!state) return;
  if (m.method === "item/agentMessage/delta") state.answer += m.params.delta;
  if (m.method === "turn/completed") {
    turns.delete(m.params.threadId);
    clearTimeout(state.timer);
    if (m.params.turn.status === "completed")
      state.resolve({ answer: state.answer });
    else
      state.reject(Error(m.params.turn.error?.message || "Codex turn failed"));
  }
});
child.on("error", () => {
  console.error("Could not start Codex. Install the Codex CLI and try again.");
  process.exit(1);
});
child.on("exit", () => {
  console.error("Codex stopped. Restart the bridge.");
  process.exit(1);
});
await rpc("initialize", {
  clientInfo: { name: "company_brain", version: "1.0.0" },
});
child.stdin.write(JSON.stringify({ method: "initialized", params: {} }) + "\n");
const server = http.createServer(async (req, res) => {
  const headers = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin",
    "Content-Type": "application/json",
  };
  if (req.headers.origin !== allowedOrigin) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  const incoming = Buffer.from(
    (req.headers.authorization || "").replace(/^Bearer /, ""),
  );
  const expected = Buffer.from(token);
  if (
    req.method !== "POST" ||
    incoming.length !== expected.length ||
    !timingSafeEqual(incoming, expected)
  ) {
    res.writeHead(401, headers);
    res.end(JSON.stringify({ error: "Invalid bridge pairing token" }));
    return;
  }
  try {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 300000) throw Error("Request too large");
    }
    const body = JSON.parse(raw || "{}");
    let result;
    if (req.url === "/login")
      result = await rpc("account/login/start", { type: "chatgpt" });
    else if (req.url === "/account") result = await rpc("account/read", {});
    else if (req.url === "/logout") result = await rpc("account/logout", {});
    else if (req.url === "/chat") {
      if (typeof body.question !== "string" || typeof body.system !== "string")
        throw Error("Question and workspace context required");
      const { thread } = await rpc("thread/start", {
        cwd,
        approvalPolicy: "never",
        sandbox: "readOnly",
        ephemeral: true,
        config: {
          "features.shell_tool": false,
          "features.unified_exec": false,
          web_search: "disabled",
        },
        developerInstructions:
          body.system +
          "\nAnswer from provided context only. Never read local files or use tools.",
      });
      result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          turns.delete(thread.id);
          void rpc("turn/interrupt", { threadId: thread.id }).catch(() => {});
          reject(Error("Codex answer timed out"));
        }, 120000);
        turns.set(thread.id, { resolve, reject, answer: "", timer });
        rpc("turn/start", {
          threadId: thread.id,
          input: [{ type: "text", text: body.question }],
        }).catch((e) => {
          clearTimeout(timer);
          turns.delete(thread.id);
          reject(e);
        });
      });
    } else {
      res.writeHead(404, headers);
      res.end(JSON.stringify({ error: "Unknown endpoint" }));
      return;
    }
    res.writeHead(200, headers);
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: e.message }));
  }
});
server.listen(4318, "127.0.0.1", () => {
  console.log(
    `Company Brain bridge: http://127.0.0.1:4318\nAllowed app: ${allowedOrigin}\nPairing token (paste into Model settings): ${token}\nCodex credentials are isolated in ${home}. Keep this terminal running.`,
  );
});
process.on("SIGINT", () => {
  child.kill();
  server.close();
  process.exit(0);
});
