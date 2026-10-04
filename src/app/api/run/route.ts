import { readRecords } from "@/lib/server/records";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  assertLocal,
  configDirectory,
  failure,
  hostedLive,
  readConfig,
  workspaceDb,
} from "@/lib/server/local";
import { kinds } from "@/lib/server/connectors";
import { syncSource } from "@/lib/server/sync";
import { POST as analyze } from "../analyze/route";
let running = false;
export async function GET(req: Request) {
  try {
    assertLocal(req);
    const config = await readConfig();
    let status = {};
    try {
      status = JSON.parse(
        await readFile(join(configDirectory(), "monitor.json"), "utf8"),
      );
    } catch {}
    return Response.json({
      ...status,
      running,
      settings: config.monitoring || {
        enabled: false,
        minutes: 60,
        instructions: "",
      },
    });
  } catch (e) {
    return failure(e, 403);
  }
}
export async function POST(req: Request) {
  let acquired = false;
  try {
    assertLocal(req);
    if (hostedLive())
      throw Error(
        "Automatic checks run in the local copy. On the website, use Analyze on the Attention page.",
      );
    if (running) throw Error("A check is already running.");
    const config = await readConfig();
    const { automatic } = await req.json();
    if (automatic && !config.monitoring?.enabled)
      return Response.json({ skipped: true });
    running = true;
    acquired = true;
    const results: { source: string; synced?: number; error?: string }[] = [];
    for (const kind of kinds) {
      if (!config.connectors?.[kind]) continue;
      try {
        results.push({ source: kind, ...(await syncSource(kind)) });
      } catch (e) {
        results.push({
          source: kind,
          error: e instanceof Error ? e.message : "Sync failed.",
        });
      }
    }
    const { db, workspace } = await workspaceDb();
    const records = await readRecords(
      db,
      workspace.id,
      "source_id,external_id,content,metadata",
    );
    const hash = createHash("sha256")
      .update(
        JSON.stringify([
          records,
          config.monitoring?.instructions || "",
          new Date().toISOString().slice(0, 10),
        ]),
      )
      .digest("hex");
    const path = join(configDirectory(), "analysis-state.json");
    let previous = "";
    try {
      previous = JSON.parse(await readFile(path, "utf8")).hash;
    } catch {}
    let analysis: object = {
      skipped: "Connect an AI to analyze the synced records.",
    };
    if (results.some((r) => r.error))
      analysis = {
        skipped:
          "A source could not refresh. Previous attention items were kept; retry the failed source.",
      };
    else if (!records.length)
      analysis = { skipped: "No records to analyze yet." };
    else if (config.ai && (hash !== previous || !automatic)) {
      const response = await analyze(
        new Request(new URL("/api/analyze", req.url), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workspace: workspace.id }),
        }),
      );
      analysis = await response.json();
      if (response.ok) {
        await mkdir(configDirectory(), { recursive: true, mode: 0o700 });
        await writeFile(
          path,
          JSON.stringify({ hash, at: new Date().toISOString() }),
          { mode: 0o600 },
        );
      }
    } else if (config.ai)
      analysis = {
        skipped:
          "Records and guidelines have not changed since the last successful analysis today.",
      };
    return Response.json({
      sources: results,
      analysis,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    return failure(e);
  } finally {
    if (acquired) running = false;
  }
}
