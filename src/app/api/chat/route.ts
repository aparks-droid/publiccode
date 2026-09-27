import { scopedClient } from "@/lib/supabase";
import { contextPrompt } from "@/lib/context";
export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token)
      return Response.json(
        { error: "Sign in to your workspace first." },
        { status: 401 },
      );
    const db = scopedClient(token);
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return Response.json(
        { error: "Your session expired. Sign in again." },
        { status: 401 },
      );
    const { question, workspace, domain, apiKey, provider, model } =
      await req.json();
    if (
      typeof question !== "string" ||
      !question.trim() ||
      question.length > 8000
    )
      return Response.json(
        { error: "Enter a question under 8,000 characters." },
        { status: 400 },
      );
    const { data: ws } = await db
      .from("workspaces")
      .select("id")
      .eq("id", workspace)
      .single();
    if (!ws)
      return Response.json({ error: "Workspace not found." }, { status: 403 });
    const { data: found, error } = await db.rpc("search_records", {
      workspace,
      query: question,
      category: domain || null,
    });
    if (error) throw error;
    let records = found || [];
    if (!records.length) {
      let q = db
        .from("records")
        .select("*")
        .eq("workspace_id", workspace)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (domain) q = q.eq("domain", domain);
      const recent = await q;
      if (recent.error) throw recent.error;
      records = recent.data || [];
    }
    const citations = records.map(
      (
        r: {
          id: string;
          title: string;
          source_url: string;
          updated_at: string;
        },
        i: number,
      ) => ({
        number: i + 1,
        id: r.id,
        title: r.title,
        url: r.source_url,
        updated_at: r.updated_at,
      }),
    );
    if (provider === "codex")
      return Response.json({ system: contextPrompt(records), citations });
    if (!records.length)
      return Response.json({
        answer:
          "There are no records in this scope yet. Connect a source and import records to ask questions about your business.",
        citations: [],
      });
    if (typeof apiKey !== "string" || !apiKey)
      return Response.json(
        { error: "Add your Anthropic API key in Model settings." },
        { status: 400 },
      );
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:
          typeof model === "string" && model.startsWith("claude-")
            ? model
            : "claude-sonnet-4-6",
        max_tokens: 2000,
        system: contextPrompt(records),
        messages: [{ role: "user", content: question }],
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!upstream.ok)
      return Response.json(
        {
          error:
            upstream.status === 401
              ? "Anthropic rejected this API key."
              : `Anthropic returned ${upstream.status}. Check your model, billing, and key permissions.`,
        },
        { status: 502 },
      );
    const result = await upstream.json();
    const answer = result.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");
    return Response.json({ answer, citations });
  } catch {
    return Response.json(
      {
        error:
          "Could not query your workspace. Check the backend connection and try again.",
      },
      { status: 500 },
    );
  }
}
