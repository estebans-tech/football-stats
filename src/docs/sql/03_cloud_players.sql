-- Tabell (cloud)
create table if not exists public.players (
  id text primary key,
  club_id uuid not null,
  name text not null,
  nickname text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- uppdatera updated_at automatiskt
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_players_updated on public.players;
create trigger trg_players_updated
before update on public.players
for each row execute function public.set_updated_at();

-- RLS
alter table public.players enable row level security;

-- read: alla inloggade i samma klubb
drop policy if exists "players read" on public.players;
create policy "players read"
  on public.players for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.active is true
        and p.club_id = players.club_id
    )
  );

-- insert: admin/editor i sin klubb
drop policy if exists "players insert" on public.players;
create policy "players insert"
  on public.players for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.active is true
        and p.club_id = players.club_id
        and p.role in ('admin','editor')
    )
  );

-- update: admin/editor i sin klubb
drop policy if exists "players update" on public.players;
create policy "players update"
  on public.players for update
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.active is true
        and p.club_id = players.club_id
        and p.role in ('admin','editor')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.active is true
        and p.club_id = players.club_id
        and p.role in ('admin','editor')
    )
  );
