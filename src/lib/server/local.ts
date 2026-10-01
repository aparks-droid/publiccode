import { mkdir, readFile, writeFile, rename, chmod } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Choice } from "../ai";

export type LocalConfig = {
  database?: { url: string; key: string };
  connectors?: Partial<
    Record<"slack" | "stripe" | "attio", { key: string; account: string }>
  >;
  ai?: Choice;
  monitoring?: { enabled: boolean; minutes: number; instructions: string };
};
export const demoMode = () =>
  !!process.env.VERCEL || process.env.BRAIN_DEMO === "1";
export function assertLocal(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("host") || url.host;
  const localHosts = ["localhost", "127.0.0.1", "[::1]"];
  let incoming: URL;
  try {
    incoming = new URL(`${url.protocol}//${host}`);
  } catch {
    throw Error("Invalid local address.");
  }
  if (
    demoMode() ||
    !localHosts.includes(url.hostname) ||
    !localHosts.includes(incoming.hostname)
  )
    throw Error(
      "Open your own copy at localhost to connect real company data.",
    );
  const origin = req.headers.get("origin");
  // Next can normalize req.url to localhost even when the browser uses 127.0.0.1.
  // Validate the origin against the independently allow-listed Host header.
  if (
    (origin && origin !== incoming.origin) ||
    req.headers.get("sec-fetch-site") === "cross-site"
  )
    throw Error("This request must come from your Company Brain window.");
  if (
    req.method !== "GET" &&
    !req.headers.get("content-type")?.includes("application/json")
  )
    throw Error("Send a JSON request from Company Brain.");
}
export const configDirectory = () =>
  process.env.BRAIN_CONFIG_DIR || join(process.cwd(), ".company-brain");
export async function readConfig(): Promise<LocalConfig> {
  if (demoMode()) return {};
  try {
    return JSON.parse(
      await readFile(join(configDirectory(), "connections.json"), "utf8"),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw Error("Could not read local connection settings.");
  }
}
let saving = Promise.resolve();
export async function updateConfig(
  update: (config: LocalConfig) => LocalConfig,
) {
  const operation = saving.then(async () => {
    if (demoMode())
      throw Error("Connections are saved only in your local copy.");
    const dir = configDirectory();
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await chmod(dir, 0o700);
    const file = join(dir, "connections.json");
    const tmp = `${file}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(update(await readConfig()), null, 2), {
      mode: 0o600,
    });
    await rename(tmp, file);
    await chmod(file, 0o600);
  });
  saving = operation.catch(() => {});
  return operation;
}
export async function database() {
  const config = await readConfig();
  const url = config.database?.url || process.env.SUPABASE_URL;
  const key = config.database?.key || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw Error("Connect your own Supabase project in Settings first.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function workspaceDb() {
  const db = await database();
  const { data: initial, error } = await db
    .from("workspaces")
    .select("id,name")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error)
    throw Error(
      "Apply the SQL in supabase/setup.sql to your project, then reconnect.",
    );
  let workspace = initial;
  if (!workspace) {
    const made = await db
      .from("workspaces")
      .insert({ name: "My company" })
      .select("id,name")
      .single();
    if (made.error) throw made.error;
    workspace = made.data;
  }
  return { db, workspace: workspace! };
}
export async function localChoice(choice: Choice): Promise<Choice> {
  const saved = (await readConfig()).ai;
  return choice.apiKey ? choice : saved || choice;
}
export function failure(e: unknown, status = 400) {
  return Response.json(
    {
      error:
        e instanceof Error ? e.message : "Something went wrong. Try again.",
    },
    { status },
  );
}
