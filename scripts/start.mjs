import { spawn } from "node:child_process";
const production = process.argv.includes("--production");
const port = process.env.PORT || "3000";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    production ? "start" : "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  { stdio: "inherit" },
);
const monitor = spawn(process.execPath, ["scripts/monitor.mjs"], {
  stdio: "inherit",
  env: { ...process.env, BRAIN_URL: `http://127.0.0.1:${port}` },
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  monitor.kill("SIGTERM");
  server.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => {
  stop();
  process.exitCode = code || 0;
});
monitor.on("exit", (code) => {
  if (code && !stopping)
    console.error(
      "The monitor stopped. Restart the app to resume automatic checks.",
    );
});
