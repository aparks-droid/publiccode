import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecordRow } from "../brain";
// PostgREST commonly caps each response at 1,000 rows. Page explicitly so one
// busy Slack source cannot silently hide finance/CRM rows from the local app.
export async function readRecords(
  db: SupabaseClient,
  workspace: string,
  columns = "*",
) {
  const records: RecordRow[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const result = await db
      .from("records")
      .select(columns)
      .eq("workspace_id", workspace)
      .order("id")
      .range(offset, offset + 499)
      .returns<RecordRow[]>();
    if (result.error) throw result.error;
    records.push(...(result.data || []));
    if ((result.data?.length || 0) < 500) break;
  }
  return records;
}
