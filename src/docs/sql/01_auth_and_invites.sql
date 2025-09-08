-- Extensions (UUID)
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Tabeller
create table if not exists public.profiles (
  user_id uuid primary key,
  club_id uuid,
  display_name text,
  role text check (role in ('admin','editor','viewer')),
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid,
  code text unique not null,
  role text check (role in ('admin','editor','viewer')) not null,
  max_uses int default 1,
  redeemed_count int default 0,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.invites enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- RPC: redeem_invite (behåll RETURNS TABLE för enkelhet)
create or replace function public.redeem_invite(p_code text)
returns table(role text, club_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using hint = 'Sign in before redeeming invite';
  end if;

  select * into v_inv from public.invites where code = p_code;
  if not found then raise exception 'invalid_code'; end if;
  if v_inv.expires_at is not null and now() > v_inv.expires_at then raise exception 'expired'; end if;
  if v_inv.max_uses is not null and v_inv.redeemed_count >= v_inv.max_uses then raise exception 'max_uses_reached'; end if;

  insert into public.profiles as p (user_id, club_id, role, active)
  values (auth.uid(), v_inv.club_id, v_inv.role, true)
  on conflict (user_id) do update
    set role = excluded.role,
        club_id = excluded.club_id,
        active = true;

  update public.invites
  set redeemed_count = redeemed_count + 1
  where id = v_inv.id;

  return query select v_inv.role::text, v_inv.club_id::uuid;
end;
$$;

revoke all on function public.redeem_invite(text) from public;
grant execute on function public.redeem_invite(text) to authenticated;

-- RPC: create_invite (RETURNS TABLE – supabase-js returnerar array; UI tar första raden)
create or replace function public.create_invite(p_role text, p_max_uses int, p_days_valid int)
returns table(code text, role text, max_uses int, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof public.profiles%rowtype;
  v_code text;
  v_inv public.invites%rowtype;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into v_prof from public.profiles where user_id = auth.uid();
  if v_prof.role is distinct from 'admin' then raise exception 'forbidden'; end if;

  v_code := upper(
    coalesce(p_role,'editor') || '-' ||
    to_char(now(), 'MMDD') || '-' ||
    substr(replace(gen_random_uuid()::text,'-',''),1,6)
  );

  insert into public.invites (club_id, code, role, max_uses, expires_at, created_by)
  values (
    v_prof.club_id,
    v_code,
    coalesce(p_role,'editor'),
    coalesce(p_max_uses, 1),
    now() + make_interval(days => coalesce(p_days_valid, 30)),
    auth.uid()
  )
  returning * into v_inv;

  return query select v_inv.code, v_inv.role, v_inv.max_uses, v_inv.expires_at;
end;
$$;

revoke all on function public.create_invite(text,int,int) from public;
grant execute on function public.create_invite(text,int,int) to authenticated;
