import { assertLocal, workspaceDb } from "@/lib/server/local";
export async function POST(req: Request) {
  try {
    assertLocal(req);
    const { db, workspace } = await workspaceDb();
    const { source, kind, name, records } = await req.json();
    if (!Array.isArray(records) || !records.length || records.length > 100)
      return Response.json({ error: "Supply 1–100 records" }, { status: 400 });
    let s;
    if (source) {
      const result = await db
        .from("sources")
        .select("id,workspace_id")
        .eq("id", source)
        .eq("workspace_id", workspace.id)
        .eq("mode", "imported")
        .single();
      if (result.error) throw result.error;
      s = result.data;
    } else {
      if (!["slack", "stripe", "attio", "web"].includes(kind))
        throw Error("Unknown source.");
      const existing = await db
        .from("sources")
        .select("id,workspace_id")
        .eq("workspace_id", workspace.id)
        .eq("kind", kind)
        .eq("mode", "imported")
        .limit(1)
        .maybeSingle();
      s = existing.data;
      if (!s) {
        const made = await db
          .from("sources")
          .insert({
            workspace_id: workspace.id,
            kind,
            name: String(name || kind).slice(0, 100),
            mode: "imported",
          })
          .select("id,workspace_id")
          .single();
        if (made.error) throw made.error;
        s = made.data;
      }
    }
    const domains = [
      "finance",
      "operations",
      "inventory",
      "sales",
      "marketing",
      "cx",
      "company",
    ];
    if (
      records.some(
        (r) =>
          typeof r.external_id !== "string" ||
          !r.external_id ||
          typeof r.title !== "string" ||
          typeof r.content !== "string" ||
          r.content.length > 50000 ||
          !domains.includes(r.domain),
      )
    )
      return Response.json(
        {
          error:
            "Each record needs external_id, title, content (max 50,000 characters), and a valid domain",
        },
        { status: 400 },
      );
    const rows = records.map((r) => ({
      source_id: s.id,
      workspace_id: s.workspace_id,
      external_id: r.external_id,
      title: r.title,
      content: r.content,
      domain: r.domain,
      source_url:
        typeof r.source_url === "string" && /^https?:\/\//.test(r.source_url)
          ? r.source_url
          : null,
      metadata: r.metadata || {},
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db
      .from("records")
      .upsert(rows, { onConflict: "source_id,external_id" });
    if (error) throw error;
    await db
      .from("sources")
      .update({
        status: "connected",
        mode: "imported",
        last_sync: new Date().toISOString(),
      })
      .eq("id", s.id);
    return Response.json({ imported: rows.length });
  } catch {
    return Response.json(
      { error: "Import failed. Check your record format and permissions." },
      { status: 400 },
    );
  }
}
