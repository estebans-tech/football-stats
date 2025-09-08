# SQL-migreringar för footballs-stat

Detta repo innehåller SQL-skript för att sätta upp **profiler & invites**, samt **server-låsning av dagens session** i Supabase. Kör dem i **denna ordning** i Supabase SQL Editor.

## Förkrav

- Ett aktivt Supabase-projekt
- **Anonymous sign-ins** aktiverat i Auth (annars blir `auth.uid()` `NULL` i RPC:er)
- Du är inloggad i Supabase Dashboard och kör skripten mot rätt projekt

## Ordning

1. `01_auth_and_invites.sql`  
   Skapar `profiles`, `invites`, RLS-policy samt RPC:erna:
   - `redeem_invite(p_code text)` – löser in invite och sätter roll på profilen
   - `create_invite(p_role text, p_max_uses int, p_days_valid int)` – skapar invites (endast admin)

2. `02_session_lock.sql`  
   Skapar tabellen `session_locks` och RPC:
   - `set_session_lock(p_date text, p_locked boolean)` – sätter lås/olås för ett datum (endast admin)

3. `99_seeds.sql` *(valfritt)*  
   Exempel: skapar en admin-invite och visar de senaste invites.

> **Tips:** Kör filerna hela, i den ordning de står här. Skripten är idempotenta där det är rimligt (skapar om-finns-inte osv).

---

## Snabb körning

Öppna **SQL Editor** i Supabase och kör:

- `01_auth_and_invites.sql`
- `02_session_lock.sql`
- (valfritt) `99_seeds.sql`

När allt är klart kan du i appen:
- Gå till `/invite` och lösa in en invite (t.ex. från seeds)
- Som **admin** kan du gå till `/admin/invites` och skapa fler invites
- På Hem-sidan kan admin **Låsa/Låsa upp** dagens session (synkas via `session_locks`)

---

## Vanliga fel & åtgärder

**`auth.uid() is null`**  
- Anonymous sign-ins är inte aktiverat eller du anropar RPC utan session.  
  *Fixa:* Aktivera anonymous i Auth. Säkerställ att klienten loggar in anonymt före RPC (vår UI gör detta).

**`permission denied for function ...`**  
- Roll saknar `EXECUTE` för funktionen.  
  *Fixa:* Se att skriptet körts klart. Om du ändrat funktioner manuellt – lägg till:  
  `grant execute on function public.function_name(...) to authenticated;`

**`cannot change return type of existing function`**  
- Du försökte byta returtyp med `create or replace`.  
  *Fixa:* Droppa funktionen först, t.ex.:  
  `drop function if exists public.set_session_lock(text, boolean);`  
  och kör sedan `create or replace ...`.

**`relation "public.profiles" does not exist`**  
- Tabellerna är inte skapade.  
  *Fixa:* Kör `01_auth_and_invites.sql` först.

**400 Bad Request vid RPC**  
- Ofta SQL-fel inuti funktionen (t.ex. okvoterad kolumn `"date"`).  
  *Fixa:* Använd versionen i våra skript (vi citerar `"date"` och returnerar JSON där det behövs).

---

## Verifiering

Kör dessa snabball för att bekräfta att allt finns:

**Finns tabellerna?**
```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles','invites','session_locks')
order by table_name;

-- Finns funktioner?
select routine_name, data_type
from information_schema.routines
where specific_schema = 'public'
  and routine_name in ('redeem_invite','create_invite','set_session_lock')
order by routine_name;

-- Kör-rättigheter (bör vara true)
select
  has_function_privilege('authenticated','public.redeem_invite(text)','execute') as redeem_invite_exec,
  has_function_privilege('authenticated','public.create_invite(text,integer,integer)','execute') as create_invite_exec,
  has_function_privilege('authenticated','public.set_session_lock(text,boolean)','execute') as set_session_lock_exec;

```

## Vanliga fel

- auth.uid() is null – Anonymous sign-ins inte aktiverat eller RPC anropas utan session.
- permission denied for function ... – saknar GRANT EXECUTE → kör skripten igen.
- cannot change return type of existing function – droppa funktionen först, skapa om:
```sql
drop function if exists public.set_session_lock(text, boolean);

```

- relation "public.profiles" does not exist – kör 01_auth_and_invites.sql först.

## Noteringar
RPC:er körs som SECURITY DEFINER (ägare postgres) och kan därmed skriva förbi RLS enligt definierad logik.
set_session_lock returnerar JSON (inte table) för enklare klienthantering.