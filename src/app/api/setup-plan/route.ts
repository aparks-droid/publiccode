import { mkdir, readFile, rename, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { assertLocal, configDirectory, demoMode, failure } from "@/lib/server/local";
import { SETUP_CHOICES, SETUP_STEP_IDS } from "@/lib/setup";

// Private, non-secret setup progress. It lives beside the local connections in
// .company-brain/setup-plan.json (ignored by Git) and is never served by the
// hosted preview.
const file = () => join(configDirectory(), "setup-plan.json");
async function readPlan(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(file(), "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw Error("Could not read setup progress.");
  }
}
const unavailable = () =>
  Response.json(
    { error: "Setup progress is saved only in your local copy." },
    { status: 404 },
  );

export async function GET(req: Request) {
  if (demoMode()) return unavailable();
  try {
    assertLocal(req);
    const plan = await readPlan();
    return Response.json({ progress: plan.app_progress || {} });
  } catch (e) {
    return failure(e);
  }
}

let saving = Promise.resolve();
export async function POST(req: Request) {
  if (demoMode()) return unavailable();
  try {
    assertLocal(req);
    const { step, choice } = await req.json();
    if (!SETUP_STEP_IDS.includes(step) || !SETUP_CHOICES.includes(choice))
      throw Error("Unknown setup step or choice.");
    const operation = saving.then(async () => {
      const plan = await readPlan();
      const progress = (plan.app_progress || {}) as Record<string, unknown>;
      progress[step] = { choice, at: new Date().toISOString() };
      plan.app_progress = progress;
      const dir = configDirectory();
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const tmp = `${file()}.${randomUUID()}.tmp`;
      await writeFile(tmp, JSON.stringify(plan, null, 2), { mode: 0o600 });
      await rename(tmp, file());
      await chmod(file(), 0o600);
      return progress;
    });
    saving = operation.then(() => {}).catch(() => {});
    return Response.json({ progress: await operation });
  } catch (e) {
    return failure(e);
  }
}
