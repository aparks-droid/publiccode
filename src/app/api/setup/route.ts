import { createClient } from "@supabase/supabase-js";
import {
  assertLocal,
  failure,
  readConfig,
  updateConfig,
} from "@/lib/server/local";
export async function POST(req: Request) {
  try {
    assertLocal(req);
    const body = await req.json();
    if (body.action === "database") {
      const { url, key } = body;
      if (
        typeof url !== "string" ||
        !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)
      )
        throw Error(
          "Enter your Supabase project URL, such as https://your-project.supabase.co.",
        );
      if (typeof key !== "string" || !key.trim())
        throw Error(
          "Enter your Supabase secret key (or legacy service_role key).",
        );
      const db = createClient(url, key.trim(), {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const check = await db.rpc("brain_server_ready");
      if (check.error || check.data !== true)
        throw Error(
          "Use a secret/service_role key and run supabase/setup.sql in your project's SQL editor first.",
        );
      const previous = await readConfig();
      await updateConfig((c) => ({
        ...c,
        database: { url, key: key.trim() },
        ...(previous.database?.url && previous.database.url !== url
          ? {
              connectors: {},
              monitoring: { enabled: false, minutes: 60, instructions: "" },
            }
          : {}),
      }));
      return Response.json({ ok: true });
    }
    if (body.action === "monitoring") {
      const minutes = Number(body.minutes);
      if (!Number.isInteger(minutes) || minutes < 15 || minutes > 1440)
        throw Error("Choose an interval between 15 and 1,440 minutes.");
      await updateConfig((c) => ({
        ...c,
        monitoring: {
          enabled: body.enabled === true,
          minutes,
          instructions: String(body.instructions || "").slice(0, 4000),
        },
      }));
      return Response.json({ ok: true });
    }
    throw Error("Unknown setting.");
  } catch (e) {
    return failure(e);
  }
}
