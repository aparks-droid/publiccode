// A separate local process keeps checking while the browser tab is closed.
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
const base = process.env.BRAIN_URL || "http://127.0.0.1:3000";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw Error("The monitor only calls your local Company Brain.");
const dir =
  process.env.BRAIN_CONFIG_DIR || join(process.cwd(), ".company-brain");
await mkdir(dir, { recursive: true, mode: 0o700 });
const lock = join(dir, "monitor.pid"),
  statusFile = join(dir, "monitor.json");
try {
  const pid = Number(await readFile(lock, "utf8"));
  try {
    process.kill(pid, 0);
    throw Error("A Company Brain monitor is already running.");
  } catch (e) {
    if (e.code !== "ESRCH") throw e;
  }
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
await writeFile(lock, String(process.pid), { flag: "w", mode: 0o600 });
let stopped = false,
  next = 0,
  status = {};
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
console.log(
  "Company Brain monitor started. Enable automatic checks in Sources. Keep the app server and this process running.",
);
try {
  while (!stopped) {
    try {
      const res = await fetch(`${base}/api/run`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || "Could not reach Company Brain.");
      const settings = data.settings;
      status = {
        ...status,
        heartbeatAt: new Date().toISOString(),
        enabled: settings.enabled,
        nextCheck: settings.enabled
          ? new Date(Math.max(next, Date.now())).toISOString()
          : null,
        error: null,
      };
      await writeFile(statusFile, JSON.stringify(status), { mode: 0o600 });
      if (settings.enabled && Date.now() >= next) {
        const check = await fetch(`${base}/api/run`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ automatic: true }),
          signal: AbortSignal.timeout(900000),
        });
        const result = await check.json();
        if (!check.ok) throw Error(result.error || "Check failed.");
        next = Date.now() + settings.minutes * 60000;
        status = {
          ...status,
          heartbeatAt: new Date().toISOString(),
          lastCheck: result.checkedAt,
          result,
          nextCheck: new Date(next).toISOString(),
        };
        await writeFile(statusFile, JSON.stringify(status), { mode: 0o600 });
        console.log(
          `${result.checkedAt}: check completed${result.sources?.some((s) => s.error) ? " with source errors; see Sources" : ""}.`,
        );
      }
      if (!settings.enabled) next = 0;
    } catch (e) {
      status = {
        ...status,
        heartbeatAt: new Date().toISOString(),
        error: e.message,
      };
      await writeFile(statusFile, JSON.stringify(status), { mode: 0o600 });
      console.error(
        "Check could not finish. See Sources for details; retrying shortly.",
      );
      next = Date.now() + 60000;
    }
    await setTimeout(10000);
  }
} finally {
  await unlink(lock).catch(() => {});
  await writeFile(
    statusFile,
    JSON.stringify({
      ...status,
      heartbeatAt: null,
      stoppedAt: new Date().toISOString(),
    }),
    { mode: 0o600 },
  );
}
