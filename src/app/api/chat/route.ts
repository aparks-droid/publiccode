import {
  assertLocal,
  database,
  demoMode,
  localChoice,
} from "@/lib/server/local";
import { demoSnapshot } from "@/lib/server/demo";
import {
  contextPrompt,
  prepareEvidence,
  type BrainRecord,
} from "@/lib/context";
import { answerWith, conversationHistory } from "@/lib/ai";
export async function POST(req: Request) {
  try {
    if (!demoMode()) assertLocal(req);
    const {
      question,
      workspace,
      apiKey,
      provider,
      model,
      history: prior,
    } = await req.json();
    const history = conversationHistory(prior);
    if (
      typeof question !== "string" ||
      !question.trim() ||
      question.length > 8000
    )
      return Response.json(
        { error: "Enter a question under 8,000 characters." },
        { status: 400 },
      );
    if (demoMode()) {
      const records = prepareEvidence(demoSnapshot().records as BrainRecord[]);
      const result = await answerWith(
        { provider, apiKey, model },
        contextPrompt(records),
        question,
        { history },
      );
      return Response.json({
        ...result,
        citations: records.map((r, i) => ({
          number: i + 1,
          id: r.id,
          title: r.title,
          url: r.source_url,
        })),
      });
    }
    const db = await database();
    const sourceResult = await db
      .from("sources")
      .select("id,mode")
      .eq("workspace_id", workspace);
    if (sourceResult.error) throw sourceResult.error;
    const realSources = (sourceResult.data || []).filter(
      (s) => s.mode !== "sample",
    );
    const allowed = realSources.length
      ? new Set(realSources.map((s) => s.id))
      : null;
    async function search(query: string): Promise<BrainRecord[]> {
      const found = await db.rpc("search_records", {
        workspace,
        query,
        category: null,
      });
      if (found.error) throw found.error;
      if (found.data.length < 20)
        return allowed
          ? found.data.filter((r: { source_id: string }) =>
              allowed.has(r.source_id),
            )
          : found.data;
      // Search each department when the SQL search's 20-record cap is hit,
      // so a batch of finance imports cannot hide matching customer/Slack records.
      const groups = await Promise.all(
        [
          "finance",
          "sales",
          "operations",
          "cx",
          "company",
          "inventory",
          "marketing",
        ].map((category) =>
          db.rpc("search_records", { workspace, query, category }),
        ),
      );
      for (const group of groups) if (group.error) throw group.error;
      const unique = new Map<string, BrainRecord>();
      // Interleave departments to retain coverage when the prompt budget is hit.
      for (let i = 0; i < 20; i++)
        for (const group of groups) {
          const record = group.data?.[i];
          if (record) unique.set(record.id, record);
        }
      return [...unique.values()].filter(
        (r) =>
          !allowed ||
          allowed.has((r as BrainRecord & { source_id: string }).source_id),
      );
    }
    let records = await search(question);
    // Follow-ups such as "Who owns it?" still need evidence about the last topic.
    const previousQuestion = history
      .filter((turn) => turn.role === "user")
      .at(-1)?.content;
    if (previousQuestion) {
      const related = await search(previousQuestion);
      const ids = new Set(records.map((r: { id: string }) => r.id));
      records = [
        ...records,
        ...related.filter((r: { id: string }) => !ids.has(r.id)),
      ];
    }
    if (!records.length) {
      const recent = await db
        .from("records")
        .select("*")
        .eq("workspace_id", workspace)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (recent.error) throw recent.error;
      records = (recent.data || []).filter(
        (r) => !allowed || allowed.has(r.source_id),
      );
    }
    records = prepareEvidence(records);
    const citations = records.map((r, i) => ({
      number: i + 1,
      id: r.id,
      title: r.title,
      url: r.source_url,
    }));
    if (!records.length)
      return Response.json({
        answer:
          "There is nothing in the brain yet. Connect a source or load the sample company first.",
        citations: [],
      });
    const result = await answerWith(
      await localChoice({ provider, apiKey, model }),
      contextPrompt(records),
      question,
      { history },
    );
    return Response.json({ ...result, citations });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not answer." },
      { status: 502 },
    );
  }
}
