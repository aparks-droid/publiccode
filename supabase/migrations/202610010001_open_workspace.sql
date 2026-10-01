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
