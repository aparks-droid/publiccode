import { readRecords } from "@/lib/server/records";
import {
  assertLocal,
  demoMode,
  failure,
  readConfig,
  workspaceDb,
} from "@/lib/server/local";
import { connectionStatus } from "@/lib/server/connectors";
import { demoSnapshot } from "@/lib/server/demo";
import demo from "../../../../demo/parkspacific-financial.json";
export async function GET(req: Request) {
  if (demoMode()) return Response.json(demoSnapshot());
  try {
    assertLocal(req);
    const config = await readConfig();
    const settings = {
      tokens: connectionStatus(config),
      ai: config.ai
        ? { provider: config.ai.provider, model: config.ai.model }
        : null,
      monitoring: config.monitoring || {
        enabled: false,
        minutes: 60,
        instructions: "",
      },
    };
    if (!config.database && !process.env.SUPABASE_SERVICE_ROLE_KEY)
      return Response.json({
        configured: false,
        demo: false,
        ...settings,
        sources: [],
        records: [],
        issues: [],
        messages: [],
        company: "Your company",
        workspace: "",
      });
    const { db, workspace } = await workspaceDb();
    const results = await Promise.all([
      db
        .from("sources")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at"),
      readRecords(db, workspace.id).then((data) => ({ data, error: null })),
      db
        .from("issues")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at"),
      db
        .from("messages")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    for (const r of results) if (r.error) throw r.error;
    const [s, r, i, m] = results;
    const real = s.data!.some((x) => x.mode !== "sample");
    const sources = s.data!.filter((x) => !real || x.mode !== "sample");
    const ids = new Set(sources.map((x) => x.id));
    return Response.json({
      ...settings,
      configured: true,
      demo: false,
      project: new URL(
        config.database?.url || process.env.SUPABASE_URL!,
      ).hostname.split(".")[0],
      workspace: workspace.id,
      company: workspace.name,
      sources,
      records: r.data!.filter((x) => ids.has(x.source_id)),
      issues: i.data!.filter((x) => !real || x.origin !== "sample"),
      messages: m.data!.reverse(),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    assertLocal(req);
    const { db, workspace } = await workspaceDb();
    const body = await req.json();
    let result;
    if (body.action === "company") {
      if (typeof body.name !== "string" || !body.name.trim())
        throw Error("Enter a company name.");
      result = await db
        .from("workspaces")
        .update({ name: body.name.trim().slice(0, 160) })
        .eq("id", workspace.id);
    } else if (body.action === "resolve") {
      result = await db
        .from("issues")
        .update({ resolved: body.resolved === true })
        .eq("id", body.id)
        .eq("workspace_id", workspace.id);
    } else if (body.action === "messages") {
      if (
        !Array.isArray(body.messages) ||
        body.messages.length !== 2 ||
        body.messages.some(
          (m: { role: string; content: string }) =>
            !["user", "assistant"].includes(m.role) ||
            typeof m.content !== "string" ||
            m.content.length > 100000,
        )
      )
        throw Error("Invalid conversation.");
      result = await db.from("messages").insert(
        body.messages.map(
          (m: { role: string; content: string; citations?: unknown[] }) => ({
            workspace_id: workspace.id,
            role: m.role,
            content: m.content,
            citations: m.citations || [],
          }),
        ),
      );
    } else if (body.action === "clear-chat") {
      result = await db
        .from("messages")
        .delete()
        .eq("workspace_id", workspace.id);
    } else if (body.action === "sample") {
      const existing = await db
        .from("sources")
        .select("id")
        .eq("workspace_id", workspace.id)
        .neq("mode", "sample");
      if (existing.error) throw existing.error;
      if (existing.data?.length)
        throw Error(
          "Sample data is available only in an empty workspace. Your company records have been kept.",
        );
      for (const src of demo.sources) {
        let { data } = await db
          .from("sources")
          .select("id")
          .eq("workspace_id", workspace.id)
          .eq("kind", src.kind)
          .eq("mode", "sample")
          .maybeSingle();
        if (!data) {
          const made = await db
            .from("sources")
            .insert({
              workspace_id: workspace.id,
              kind: src.kind,
              name: src.name,
              mode: "sample",
            })
            .select("id")
            .single();
          if (made.error) throw made.error;
          data = made.data;
        }
        const saved = await db.from("records").upsert(
          src.records.map((r) => ({
            ...r,
            workspace_id: workspace.id,
            source_id: data!.id,
          })),
          { onConflict: "source_id,external_id" },
        );
        if (saved.error) throw saved.error;
        await db
          .from("sources")
          .update({ status: "connected", last_sync: new Date().toISOString() })
          .eq("id", data!.id);
      }
      const already = await db
        .from("issues")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("origin", "sample")
        .limit(1);
      if (!already.data?.length) {
        const saved = await db.from("issues").insert(
          demo.issues.map((i) => ({
            ...i,
            workspace_id: workspace.id,
            origin: "sample",
          })),
        );
        if (saved.error) throw saved.error;
      }
      result = await db
        .from("workspaces")
        .update({ name: demo.company })
        .eq("id", workspace.id);
    } else throw Error("Unknown action.");
    if (result?.error) throw result.error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
