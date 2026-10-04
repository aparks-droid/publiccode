import { answerWith } from "@/lib/ai";
import {
  assertLocal,
  demoMode,
  failure,
  hostedLive,
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
      mode: hostedLive() ? "hosted" : "local",
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
    // On the website the key lives in Vercel; it can be tested, not changed here.
    if (hostedLive()) {
      const { ai } = await readConfig();
      if (action !== "test" || !ai?.apiKey)
        throw Error(
          "On the website, Claude is set in Vercel → Settings → Environment Variables (BRAIN_ANTHROPIC_API_KEY).",
        );
      const result = await answerWith(ai, "Reply with the single word OK.", "Connection test.");
      return Response.json({ ok: true, model: result.model });
    }
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
