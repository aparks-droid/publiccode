-- Local starter: the local server holds the service-role key. Browsers have no DB access.
drop policy if exists open_workspaces on public.workspaces;
drop policy if exists open_sources on public.sources;
drop policy if exists open_records on public.records;
drop policy if exists open_messages on public.messages;
drop policy if exists open_issues on public.issues;
create or replace function public.brain_server_ready() returns boolean language sql stable security invoker set search_path=public as $$ select current_user = 'service_role' $$;
revoke all on function public.brain_server_ready() from public, anon, authenticated;
grant execute on function public.brain_server_ready() to service_role;
alter table public.sources add column if not exists sync_error text;
alter table public.sources add column if not exists sync_summary text;
-- Replace the connector's bounded snapshot atomically; a failed sync keeps its previous snapshot.
create or replace function public.replace_source_records(sid uuid, wid uuid, payload jsonb, summary text)
returns integer language plpgsql security invoker set search_path=public as $$
begin
  if not exists(select 1 from public.sources where id=sid and workspace_id=wid and mode='live') then raise exception 'Unknown live source'; end if;
  insert into public.records (source_id,workspace_id,external_id,domain,title,content,source_url,metadata,updated_at)
  select sid,wid,r.external_id,r.domain,r.title,r.content,r.source_url,coalesce(r.metadata,'{}'::jsonb),now()
  from jsonb_to_recordset(payload) as r(external_id text,domain text,title text,content text,source_url text,metadata jsonb)
  on conflict(source_id,external_id) do update set domain=excluded.domain,title=excluded.title,content=excluded.content,source_url=excluded.source_url,metadata=excluded.metadata,updated_at=now();
  delete from public.records where source_id=sid and external_id not in (select value->>'external_id' from jsonb_array_elements(payload));
  update public.sources set status='connected',last_sync=now(),sync_error=null,sync_summary=summary where id=sid;
  return jsonb_array_length(payload);
end $$;
revoke all on function public.replace_source_records(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.replace_source_records(uuid,uuid,jsonb,text) to service_role;
