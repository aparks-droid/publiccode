import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
const config = JSON.parse(await readFile(join(process.env.BRAIN_CONFIG_DIR || '.company-brain', 'connections.json'), 'utf8'));
const db = createClient(config.database.url, config.database.key, { auth: { persistSession: false, autoRefreshToken: false } });
let workspace;
function check(result) { if (result.error) throw Error(result.error.message); return result.data; }
try {
  if (check(await db.rpc('brain_server_ready')) !== true) throw Error('Private schema not ready.');
  workspace = check(await db.from('workspaces').insert({ name: '[Disposable verification workspace]' }).select('id').single()).id;
  const source = check(await db.from('sources').insert({ workspace_id: workspace, name: '[Disposable verification source]', kind: 'web', mode: 'live' }).select('id').single()).id;
  const records = [{ external_id: 'verification-1', title: 'Verification delivery', domain: 'operations', content: 'The verification delivery is scheduled for Friday.', metadata: {} }];
  check(await db.rpc('replace_source_records', { sid: source, wid: workspace, payload: records, summary: 'Disposable test' }));
  const found = check(await db.rpc('search_records', { workspace, query: 'verification', category: null }));
  if (found.length !== 1 || found[0].external_id !== 'verification-1') throw Error('Imported evidence was not retrievable.');
  check(await db.rpc('replace_source_records', { sid: source, wid: workspace, payload: [{ ...records[0], content: 'Updated verification delivery for Monday.' }], summary: 'Update test' }));
  const updated = check(await db.from('records').select('content').eq('workspace_id', workspace));
  if (updated.length !== 1 || !updated[0].content.includes('Monday')) throw Error('Idempotent update failed.');
  console.log('PASS: live Supabase schema, source snapshot write, full-text retrieval, and idempotent update.');
} finally {
  if (workspace) { check(await db.from('workspaces').delete().eq('id', workspace)); console.log('Disposable verification workspace removed; company records untouched.'); }
}
