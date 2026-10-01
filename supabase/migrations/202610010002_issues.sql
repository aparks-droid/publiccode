-- Issues are what the AI (or the sample company) says needs attention, grouped across sources.
-- sources.mode records how a source was filled: sample data, a manual import, or live sync.
alter table public.sources add column if not exists mode text not null default 'imported' check (mode in ('sample','imported','live'));
create table public.issues (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, title text not null, consequence text not null default '', category text not null default 'Operations', priority text not null default 'medium', owner text not null default '', due text not null default '', status text not null default '', action text not null default '', customer text not null default '', evidence jsonb not null default '[]', origin text not null default 'ai', model text not null default '', resolved boolean not null default false, created_at timestamptz not null default now());
alter table public.issues enable row level security;
create policy open_issues on public.issues for all to anon, authenticated using (true) with check (true);
