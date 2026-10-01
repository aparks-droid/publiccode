import { pullSource, type Kind } from "./connectors";
import { readConfig, updateConfig, workspaceDb } from "./local";
const running = new Set<Kind>();
export async function syncSource(kind: Kind, newKey?: string) {
  if (running.has(kind))
    throw Error("This source is already syncing. Wait for it to finish.");
  running.add(kind);
  const { db, workspace } = await workspaceDb().catch((e) => {
    running.delete(kind);
    throw e;
  });
  try {
    const config = await readConfig();
    const key = newKey || config.connectors?.[kind]?.key;
    if (!key) throw Error("Connect this source first.");
    // Verify provider access before saving a key or marking the source connected.
    const pulled = await pullSource(kind, key);
    const existing = await db
      .from("sources")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("kind", kind)
      .eq("mode", "live")
      .limit(1)
      .maybeSingle();
    if (existing.error) throw existing.error;
    let id = existing.data?.id;
    if (!id) {
      const made = await db
        .from("sources")
        .insert({
          workspace_id: workspace.id,
          kind,
          name: { slack: "Slack", stripe: "Stripe", attio: "Attio" }[kind],
          mode: "live",
        })
        .select("id")
        .single();
      if (made.error) throw made.error;
      id = made.data.id;
    }
    const saved = await db.rpc("replace_source_records", {
      sid: id,
      wid: workspace.id,
      payload: pulled.records,
      summary: pulled.summary,
    });
    if (saved.error)
      throw Error(
        "Could not save the sync. Check that supabase/setup.sql has been applied. Previous records are kept.",
      );
    if (newKey)
      await updateConfig((c) => ({
        ...c,
        connectors: {
          ...c.connectors,
          [kind]: { key: newKey.trim(), account: pulled.account },
        },
      }));
    return {
      synced: pulled.records.length,
      account: pulled.account,
      summary: pulled.summary,
    };
  } catch (e) {
    await db
      .from("sources")
      .update({
        status: "error",
        sync_error: e instanceof Error ? e.message : "Sync failed.",
      })
      .eq("workspace_id", workspace.id)
      .eq("kind", kind)
      .eq("mode", "live");
    throw e;
  } finally {
    running.delete(kind);
  }
}
