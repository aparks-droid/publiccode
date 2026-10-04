import { randomUUID } from "node:crypto";
import { assertLocal, failure, workspaceDb } from "@/lib/server/local";
import { readRecords } from "@/lib/server/records";
import type { RecordRow } from "@/lib/brain";
import { cleanFields, todoExternalId, todoKeys, todoText } from "@/lib/todos";

// Add, edit, mark done and delete to-dos in the owner's imported workbook.
// Local copy only; the hosted preview never reaches this (assertLocal).
export async function POST(req: Request) {
  try {
    assertLocal(req);
    const { db, workspace } = await workspaceDb();
    const body = await req.json();
    const action = String(body.action || "");

    // The workbook source: the imported "web" source, created on first add.
    const found = await db
      .from("sources")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("kind", "web")
      .eq("mode", "imported")
      .limit(1)
      .maybeSingle();
    if (found.error) throw found.error;
    let sourceId = found.data?.id as string | undefined;

    const own = async (id: unknown) => {
      if (typeof id !== "string" || !sourceId) throw Error("That to-do was not found.");
      const r = await db
        .from("records")
        .select("id,metadata")
        .eq("id", id)
        .eq("workspace_id", workspace.id)
        .eq("source_id", sourceId)
        .maybeSingle();
      if (r.error) throw r.error;
      if (!r.data) throw Error("That to-do was not found. Only imported or added to-dos can be changed.");
      return r.data as { id: string; metadata: Record<string, unknown> };
    };
    const rows = (await readRecords(db, workspace.id)).filter(
      (r: { source_id: string }) => r.source_id === sourceId,
    ) as RecordRow[];
    const keys = todoKeys(rows);
    const save = async (id: string, metadata: Record<string, unknown>) => {
      const res = await db
        .from("records")
        .update({ ...todoText(metadata, keys.item), metadata, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("workspace_id", workspace.id);
      if (res.error) throw res.error;
    };

    if (action === "delete") {
      const r = await own(body.id);
      const res = await db.from("records").delete().eq("id", r.id).eq("workspace_id", workspace.id);
      if (res.error) throw res.error;
      return Response.json({ ok: true });
    }
    if (action === "done") {
      const r = await own(body.id);
      const statusKey = Object.keys(r.metadata).find((k) => ["status", "state"].includes(k)) || keys.status;
      await save(r.id, { ...r.metadata, [statusKey]: body.done === false ? "Open" : "Done" });
      return Response.json({ ok: true });
    }
    if (action !== "save") throw Error("Unknown action.");

    const f = cleanFields(body.fields || {});
    if (!f.item) throw Error("Enter the to-do.");
    if (body.id) {
      const r = await own(body.id);
      const m = { ...r.metadata };
      // Write each field back under the column name this row already uses.
      const keyFor = (options: string[], fallback: string) =>
        options.find((k) => m[k] !== undefined) || fallback;
      const set = (k: string, v: string) => {
        if (v) m[k] = v;
        else delete m[k];
      };
      set(keyFor(["item", "task", "to_do", "todo", "description", "title", "name", "action"], keys.item), f.item);
      set(keyFor(["priority", "pri", "rank"], keys.priority), f.priority);
      set(keyFor(["category", "section", "group", "heading", "client", "client_name"], keys.category), f.category);
      set(keyFor(["due", "due_date", "deadline", "date_due", "date"], keys.due), f.due);
      set(keyFor(["status", "state"], keys.status), f.status || "Open");
      await save(r.id, m);
      return Response.json({ ok: true });
    }

    if (!sourceId) {
      const made = await db
        .from("sources")
        .insert({ workspace_id: workspace.id, kind: "web", name: "Client workbook", mode: "imported", status: "connected" })
        .select("id")
        .single();
      if (made.error) throw made.error;
      sourceId = made.data.id;
    }
    const id = `A-${Date.now().toString(36)}-${randomUUID().slice(0, 4)}`;
    const metadata: Record<string, unknown> = { sheet: keys.sheet, type: "task", id };
    metadata[keys.item] = f.item;
    if (f.priority) metadata[keys.priority] = f.priority;
    if (f.category) metadata[keys.category] = f.category;
    if (f.due) metadata[keys.due] = f.due;
    metadata[keys.status] = f.status || "Open";
    const res = await db.from("records").insert({
      workspace_id: workspace.id,
      source_id: sourceId,
      external_id: todoExternalId("task", id),
      domain: "company",
      ...todoText(metadata, keys.item),
      metadata,
      updated_at: new Date().toISOString(),
    });
    if (res.error) throw res.error;
    return Response.json({ ok: true, id });
  } catch (e) {
    return failure(e);
  }
}
