import { scopedClient } from "@/lib/supabase";
export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token)
      return Response.json(
        { error: "Bearer workspace session required" },
        { status: 401 },
      );
    const db = scopedClient(token);
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return Response.json({ error: "Invalid session" }, { status: 401 });
    const { source, records } = await req.json();
    if (!Array.isArray(records) || !records.length || records.length > 100)
      return Response.json({ error: "Supply 1–100 records" }, { status: 400 });
    const { data: s } = await db
      .from("sources")
      .select("id,workspace_id")
      .eq("id", source)
      .single();
    if (!s)
      return Response.json({ error: "Source not found" }, { status: 403 });
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
      .update({ status: "connected", last_sync: new Date().toISOString() })
      .eq("id", s.id);
    return Response.json({ imported: rows.length });
  } catch {
    return Response.json(
      { error: "Import failed. Check your record format and permissions." },
      { status: 400 },
    );
  }
}
