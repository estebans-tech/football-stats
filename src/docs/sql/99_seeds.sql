-- Skapa en admin-invite (30 dagar, max 5 användningar)
insert into public.invites (club_id, code, role, max_uses, expires_at)
values (gen_random_uuid(), 'ADMIN-2026', 'admin', 5, now() + interval '30 days');

-- Kolla senaste invites
select code, role, max_uses, redeemed_count, expires_at
from public.invites
order by created_at desc
limit 10;
