create extension if not exists pgcrypto;

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  video_url text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;

drop policy if exists "Public read exercises" on public.exercises;
create policy "Public read exercises"
on public.exercises for select
to anon
using (true);

drop policy if exists "Public insert exercises" on public.exercises;
create policy "Public insert exercises"
on public.exercises for insert
to anon
with check (true);

drop policy if exists "Public update exercises" on public.exercises;
create policy "Public update exercises"
on public.exercises for update
to anon
using (true)
with check (true);

drop policy if exists "Public delete exercises" on public.exercises;
create policy "Public delete exercises"
on public.exercises for delete
to anon
using (true);
