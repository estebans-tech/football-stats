-- Sessions (dagens spel)
create table if not exists public.sessions (
  id text primary key,
  club_id uuid not null,
  "date" text not null,                  -- YYYY-MM-DD
  status text not null default 'open',   -- 'open' | 'locked'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Matches (match # inom en session)
create table if not exists public.matches (
  id text primary key,
  club_id uuid not null,
  session_id text not null references public.sessions(id) on delete cascade,
  order_no int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Lineups (laguppställning per halvlek/lag)
create table if not exists public.lineups (
  id text primary key,
  club_id uuid not null,
  match_id text not null references public.matches(id) on delete cascade,
  half smallint not null,                -- 1 | 2
  team text not null,                    -- 'A' | 'B' (UI visar Röd/Svart)
  player_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Goals (målposter)
create table if not exists public.goals (
  id text primary key,
  club_id uuid not null,
  match_id text not null references public.matches(id) on delete cascade,
  half smallint not null,                -- 1 | 2
  team text not null,                    -- 'A' | 'B'
  scorer_id text not null,
  assist_id text,
  minute int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_sessions_updated on public.sessions;
create trigger trg_sessions_updated before update on public.sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_matches_updated on public.matches;
create trigger trg_matches_updated before update on public.matches
for each row execute function public.set_updated_at();

drop trigger if exists trg_lineups_updated on public.lineups;
create trigger trg_lineups_updated before update on public.lineups
for each row execute function public.set_updated_at();

drop trigger if exists trg_goals_updated on public.goals;
create trigger trg_goals_updated before update on public.goals
for each row execute function public.set_updated_at();

-- RLS
alter table public.sessions enable row level security;
alter table public.matches  enable row level security;
alter table public.lineups  enable row level security;
alter table public.goals    enable row level security;

-- Hjälpvillkor: samma klubb
-- (vi duplicerar club_id på alla tabeller för enkel RLS)

-- SELECT: alla roller i samma klubb får läsa
create policy if not exists "sessions select" on public.sessions
  for select using (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = sessions.club_id)
  );

create policy if not exists "matches select" on public.matches
  for select using (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = matches.club_id)
  );

create policy if not exists "lineups select" on public.lineups
  for select using (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = lineups.club_id)
  );

create policy if not exists "goals select" on public.goals
  for select using (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = goals.club_id)
  );

-- INSERT/UPDATE: endast admin/editor i samma klubb
create policy if not exists "sessions upsert" on public.sessions
  for insert with check (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = sessions.club_id
              and p.role in ('admin','editor'))
  );
create policy if not exists "sessions update" on public.sessions
  for update using (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = sessions.club_id
              and p.role in ('admin','editor'))
  )
  with check (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = sessions.club_id
              and p.role in ('admin','editor'))
  );

create policy if not exists "matches upsert" on public.matches
  for insert with check (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = matches.club_id
              and p.role in ('admin','editor'))
  );
create policy if not exists "matches update" on public.matches
  for update using (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = matches.club_id
              and p.role in ('admin','editor'))
  )
  with check (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = matches.club_id
              and p.role in ('admin','editor'))
  );

create policy if not exists "lineups upsert" on public.lineups
  for insert with check (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = lineups.club_id
              and p.role in ('admin','editor'))
  );
create policy if not exists "lineups update" on public.lineups
  for update using (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = lineups.club_id
              and p.role in ('admin','editor'))
  )
  with check (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = lineups.club_id
              and p.role in ('admin','editor'))
  );

create policy if not exists "goals upsert" on public.goals
  for insert with check (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = goals.club_id
              and p.role in ('admin','editor'))
  );
create policy if not exists "goals update" on public.goals
  for update using (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = goals.club_id
              and p.role in ('admin','editor'))
  )
  with check (
    exists (select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.active is true
              and p.club_id = goals.club_id
              and p.role in ('admin','editor'))
  );
