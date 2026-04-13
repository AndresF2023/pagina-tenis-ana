-- Ejecuta TODO este script en Supabase: SQL Editor > New query > Run.
-- Si puedes insertar pero la web no muestra filas, casi siempre faltan GRANT o la politica SELECT para rol anon.

create extension if not exists pgcrypto;

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  video_url text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Asegura default en id (evita 22P02 si el Table Editor envia cadena vacia en id).
alter table public.exercises
  alter column id set default gen_random_uuid();

-- Insercion manual sin tocar id (SQL Editor):
-- insert into public.exercises (title, description, video_url)
-- values ('Mi ejercicio', 'Descripcion', 'https://www.youtube.com/watch?v=XXXXXXXXXXX');

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

grant usage on schema public to anon;
grant select, insert, update, delete on table public.exercises to anon;
