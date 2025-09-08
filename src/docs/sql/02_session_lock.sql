-- Tabell för låsstatus per datum
create table if not exists public.session_locks (
  "date" text primary key,
  locked boolean not null default false,
  locked_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.session_locks enable row level security;

drop policy if exists "read locks" on public.session_locks;
create policy "read locks"
  on public.session_locks for select using (true);

-- RPC (JSON-retur; citera "date")
drop function if exists public.set_session_lock(text, boolean);

create or replace function public.set_session_lock(p_date text, p_locked boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof public.profiles%rowtype;
  v_row  public.session_locks%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;

  select * into v_prof from public.profiles where user_id = auth.uid();

  -- ✅ tillåt båda
  if v_prof.role not in ('admin','editor') then
    raise exception 'forbidden';
  end if;

  insert into public.session_locks ("date", locked, locked_by, updated_at)
  values (p_date, p_locked, auth.uid(), now())
  on conflict ("date") do update
    set locked     = excluded.locked,
        locked_by  = excluded.locked_by,
        updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'date',       v_row."date",
    'locked',     v_row.locked,
    'updated_at', v_row.updated_at
  );
end;
$$;

grant execute on function public.set_session_lock(text, boolean) to authenticated;
