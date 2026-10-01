import { answerWith } from "@/lib/ai";
import {
  assertLocal,
  demoMode,
  failure,
  readConfig,
  updateConfig,
} from "@/lib/server/local";
export async function GET(req: Request) {
  if (demoMode())
    return Response.json({ mode: "demo", providers: ["openai", "anthropic"] });
  try {
    assertLocal(req);
    const { ai } = await readConfig();
    return Response.json({
      mode: "local",
      provider: ai?.provider,
      model: ai?.model,
      connected: !!ai?.apiKey,
    });
  } catch (e) {
    return failure(e, 403);
  }
}
export async function POST(req: Request) {
  try {
    if (!demoMode()) assertLocal(req);
    const { action, provider, apiKey } = await req.json();
    if (action === "disconnect" && !demoMode()) {
      await updateConfig((c) => ({ ...c, ai: undefined }));
      return Response.json({ ok: true });
    }
    if (action !== "test")
      throw Error("Choose OpenAI or Claude and enter your API key.");
    const result = await answerWith(
      { provider, apiKey },
      "Reply with the single word OK.",
      "Connection test.",
    );
    if (!demoMode())
      await updateConfig((c) => ({
        ...c,
        ai: { provider, apiKey, model: result.model },
      }));
    return Response.json({ ok: true, model: result.model });
  } catch (e) {
    return failure(e);
  }
}
