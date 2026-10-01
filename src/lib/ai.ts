export type Choice = { provider?: string; apiKey?: string; model?: string };
export type ConversationTurn = { role: "user" | "assistant"; content: string };
export function conversationHistory(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (turn) =>
        turn &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string" &&
        turn.content.trim(),
    )
    .slice(-12)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 8000) }));
}
// One place that turns "which AI did the user connect" into an answer.
export async function answerWith(
  choice: Choice,
  instructions: string,
  question: string,
  options: { history?: ConversationTurn[]; maxTokens?: number } = {},
): Promise<{ answer: string; model: string }> {
  const history = conversationHistory(options.history);
  if (choice.provider !== "openai" && choice.provider !== "anthropic")
    throw Error("Choose OpenAI or Claude and enter your API key.");
  // Every request uses the visitor's key. Never fall back to the owner's account.
  const key = typeof choice.apiKey === "string" ? choice.apiKey.trim() : "";
  if (!key) throw Error("Enter your API key to connect AI.");
  if (choice.provider === "openai") {
    const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        instructions,
        store: false,
        max_output_tokens: options.maxTokens || 4096,
        input: [...history, { role: "user", content: question }],
      }),
      signal: AbortSignal.timeout(90000),
    });
    const result = await res.json();
    if (!res.ok) {
      const quota = result.error?.code === "insufficient_quota";
      throw Error(
        res.status === 401
          ? "OpenAI rejected this API key. Check your key and try again."
          : quota
            ? "Enable API billing or add credits in your OpenAI project. A ChatGPT subscription does not include API credits."
            : res.status === 429
              ? "OpenAI is busy or this API key has reached its usage limit. Try again shortly."
              : res.status === 404
                ? "The configured OpenAI model is unavailable for this API key. Check the app’s model configuration."
                : `OpenAI could not connect (${res.status}). Check this API key’s permissions and billing.`,
      );
    }
    if (result.status !== "completed")
      throw Error(
        "OpenAI’s response did not finish. Try a narrower question or run the analysis again.",
      );
    const answer = (Array.isArray(result.output) ? result.output : [])
      .filter((item: { type: string }) => item.type === "message")
      .flatMap(
        (item: { content?: { type: string; text?: string }[] }) =>
          item.content || [],
      )
      .filter((part: { type: string }) => part.type === "output_text")
      .map((part: { text?: string }) => part.text || "")
      .join("\n")
      .trim();
    if (!answer) throw Error("OpenAI returned no answer. Try again.");
    return { answer, model: result.model || model };
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens || 4096,
      system: instructions,
      messages: [...history, { role: "user", content: question }],
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    const failure = await res.json().catch(() => null);
    const detail = String(failure?.error?.message || "");
    // Classify provider errors without displaying their raw payload or credentials.
    if (/workspace|organization.scope|scope.*organization/i.test(detail))
      throw Error(
        "Create an API key with Scope set to Default workspace (or another workspace), not Organization.",
      );
    throw Error(
      res.status === 401
        ? "Anthropic rejected this API key."
        : res.status === 429
          ? "Claude is busy or this API key has reached its usage limit. Try again shortly."
          : res.status === 404
            ? "The configured Claude model is unavailable for this API key. Check the app’s model configuration."
            : /credit|billing|balance/i.test(detail)
              ? "Add API credits in Claude Console, then connect again. A Claude subscription does not include API credits."
              : `Claude could not connect (${res.status}). Check this API key’s access and billing.`,
    );
  }
  const result = await res.json();
  if (result.stop_reason === "max_tokens")
    throw Error(
      "Claude’s response was cut short. Try a narrower question or run the analysis again.",
    );
  const answer = (Array.isArray(result.content) ? result.content : [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
    .trim();
  if (!answer) throw Error("Claude returned no answer. Try again.");
  return { answer, model: result.model || model };
}
