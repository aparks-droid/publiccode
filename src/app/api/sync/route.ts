import {
  assertLocal,
  failure,
  readConfig,
  updateConfig,
} from "@/lib/server/local";
import { connectionStatus, kinds, type Kind } from "@/lib/server/connectors";
import { syncSource } from "@/lib/server/sync";
export async function GET(req: Request) {
  try {
    assertLocal(req);
    return Response.json(connectionStatus(await readConfig()));
  } catch (e) {
    return failure(e, 403);
  }
}
export async function POST(req: Request) {
  try {
    assertLocal(req);
    const { kind, key, action } = await req.json();
    if (!kinds.includes(kind)) throw Error("Choose Slack, Stripe or Attio.");
    if (action === "disconnect") {
      await updateConfig((c) => {
        const connectors = { ...c.connectors };
        delete connectors[kind as Kind];
        return { ...c, connectors };
      });
      return Response.json({ ok: true });
    }
    if (
      key !== undefined &&
      (typeof key !== "string" || !key.trim() || key.length > 10000)
    )
      throw Error("Enter a valid source key.");
    return Response.json(await syncSource(kind, key));
  } catch (e) {
    return failure(e);
  }
}
