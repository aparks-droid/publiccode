create extension if not exists pgcrypto;
create table public.workspaces (id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references auth.users(id), name text not null default 'My company', created_at timestamptz not null default now());
create table public.sources (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, name text not null, kind text not null, status text not null default 'pending' check (status in ('pending','connected','error')), last_sync timestamptz, created_at timestamptz not null default now());
create table public.records (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, source_id uuid not null references public.sources(id) on delete cascade, external_id text not null, domain text not null check (domain in ('finance','operations','inventory','sales','marketing','cx','company')), title text not null, content text not null, source_url text, metadata jsonb not null default '{}', updated_at timestamptz not null default now(), unique(source_id,external_id));
create index records_search on public.records using gin (to_tsvector('english',title || ' ' || content));
create table public.messages (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, role text not null check(role in ('user','assistant')), content text not null, citations jsonb not null default '[]', created_at timestamptz not null default now());
alter table public.workspaces enable row level security;
alter table public.sources enable row level security;
alter table public.records enable row level security;
alter table public.messages enable row level security;
create policy workspace_owner on public.workspaces for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy source_owner on public.sources for all to authenticated using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=auth.uid())) with check(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=auth.uid()));
create policy record_owner on public.records for all to authenticated using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=auth.uid())) with check(exists(select 1 from public.workspaces w join public.sources s on s.workspace_id=w.id where w.id=records.workspace_id and s.id=records.source_id and w.owner_id=auth.uid()));
create policy message_owner on public.messages for all to authenticated using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=auth.uid())) with check(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=auth.uid()));
create function public.search_records(workspace uuid, query text, category text default null) returns setof public.records language sql stable security invoker set search_path=public as $$ select * from public.records where workspace_id=workspace and (category is null or domain=category) and (query='' or to_tsvector('english',title || ' ' || content) @@ websearch_to_tsquery('english',query)) order by updated_at desc limit 20 $$;
-- No sign-in: one open workspace per deployment. Anyone who can reach the app can read and change it.
-- Put real company data here only after adding protection (for example Vercel Deployment Protection).
alter table public.workspaces alter column owner_id drop not null;
drop policy workspace_owner on public.workspaces;
drop policy source_owner on public.sources;
drop policy record_owner on public.records;
drop policy message_owner on public.messages;
create policy open_workspaces on public.workspaces for all to anon, authenticated using (true) with check (true);
create policy open_sources on public.sources for all to anon, authenticated using (true) with check (true);
create policy open_records on public.records for all to anon, authenticated using (true) with check (true);
create policy open_messages on public.messages for all to anon, authenticated using (true) with check (true);
-- Issues are what the AI (or the sample company) says needs attention, grouped across sources.
-- sources.mode records how a source was filled: sample data, a manual import, or live sync.
alter table public.sources add column if not exists mode text not null default 'imported' check (mode in ('sample','imported','live'));
create table public.issues (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, title text not null, consequence text not null default '', category text not null default 'Operations', priority text not null default 'medium', owner text not null default '', due text not null default '', status text not null default '', action text not null default '', customer text not null default '', evidence jsonb not null default '[]', origin text not null default 'ai', model text not null default '', resolved boolean not null default false, created_at timestamptz not null default now());
alter table public.issues enable row level security;
create policy open_issues on public.issues for all to anon, authenticated using (true) with check (true);
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
