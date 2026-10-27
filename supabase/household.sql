-- Zajedničko kućanstvo: dvoje (ili više) ljudi dijeli zajedničke troškove.
-- Pokreni jednom u Supabase → SQL Editor → New query → Run (nakon schema.sql; ako koristiš račune, nakon accounts.sql).
--
-- Osobni troškovi i dalje vidi samo njihov vlasnik. Trošak označen kao zajednički (household_id)
-- vide i mogu uređivati svi članovi kućanstva; user_id pokazuje tko ga je unio.

create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  code        text not null unique,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid not null unique references auth.users (id) on delete cascade, -- jedno kućanstvo po korisniku
  display_name  text not null check (char_length(display_name) between 1 and 30),
  joined_at     timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table public.expenses add column if not exists household_id uuid references public.households (id) on delete set null;
create index if not exists expenses_household_idx on public.expenses (household_id, spent_at desc) where household_id is not null;

-- ---------- Pomoćne funkcije ----------

-- Je li prijavljeni korisnik član kućanstva (security definer: izbjegava beskonačnu petlju pravila)
create or replace function public.is_household_member(hid uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from public.household_members m where m.household_id = hid and m.user_id = (select auth.uid())) $$;

-- Pripada li račun (ZABA, Revolut...) osobi koja je unijela trošak
create or replace function public.account_belongs(acc uuid, owner uuid) returns boolean
  language plpgsql stable security definer set search_path = ''
  as $$
  begin
    if acc is null then return true; end if;
    return exists (select 1 from public.accounts a where a.id = acc and a.user_id = owner);
  exception when undefined_table then
    return true;
  end $$;

-- Novo kućanstvo s kodom za pridruživanje
create or replace function public.create_household(p_name text, p_display text) returns uuid
  language plpgsql security definer set search_path = ''
  as $$
  declare uid uuid := auth.uid(); hid uuid; c text;
  begin
    if uid is null then raise exception 'Nisi prijavljen.'; end if;
    if exists (select 1 from public.household_members where user_id = uid) then
      raise exception 'Već si u kućanstvu.';
    end if;
    loop
      c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      exit when not exists (select 1 from public.households where code = c);
    end loop;
    insert into public.households (name, code, created_by) values (trim(p_name), c, uid) returning id into hid;
    insert into public.household_members (household_id, user_id, display_name) values (hid, uid, trim(p_display));
    return hid;
  end $$;

-- Pridruživanje kodom
create or replace function public.join_household(p_code text, p_display text) returns uuid
  language plpgsql security definer set search_path = ''
  as $$
  declare uid uuid := auth.uid(); hid uuid;
  begin
    if uid is null then raise exception 'Nisi prijavljen.'; end if;
    if exists (select 1 from public.household_members where user_id = uid) then
      raise exception 'Već si u kućanstvu.';
    end if;
    select id into hid from public.households where code = upper(trim(p_code));
    if hid is null then raise exception 'Kod nije ispravan.'; end if;
    if (select count(*) from public.household_members where household_id = hid) >= 6 then
      raise exception 'Kućanstvo je puno.';
    end if;
    insert into public.household_members (household_id, user_id, display_name) values (hid, uid, trim(p_display));
    return hid;
  end $$;

-- Izlazak: tvoji zajednički troškovi postaju osobni; prazno kućanstvo se briše
create or replace function public.leave_household() returns void
  language plpgsql security definer set search_path = ''
  as $$
  declare uid uuid := auth.uid(); hid uuid;
  begin
    select household_id into hid from public.household_members where user_id = uid;
    if hid is null then return; end if;
    update public.expenses set household_id = null where user_id = uid and household_id = hid;
    delete from public.household_members where user_id = uid;
    delete from public.households h where h.id = hid
      and not exists (select 1 from public.household_members m where m.household_id = hid);
  end $$;

revoke all on function public.create_household(text, text), public.join_household(text, text), public.leave_household() from public, anon;
grant execute on function public.create_household(text, text), public.join_household(text, text), public.leave_household() to authenticated;
grant execute on function public.is_household_member(uuid), public.account_belongs(uuid, uuid) to authenticated;

-- ---------- Pravila pristupa ----------

alter table public.households enable row level security;
alter table public.household_members enable row level security;

drop policy if exists "households_select_member" on public.households;
create policy "households_select_member" on public.households
  for select to authenticated using (public.is_household_member(id));
drop policy if exists "households_update_member" on public.households;
create policy "households_update_member" on public.households
  for update to authenticated using (public.is_household_member(id)) with check (public.is_household_member(id));

drop policy if exists "members_select_member" on public.household_members;
create policy "members_select_member" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "members_update_self" on public.household_members;
create policy "members_update_self" on public.household_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, update on public.households, public.household_members to authenticated;
revoke all on public.households, public.household_members from anon;

-- Troškovi: svoje + zajednički troškovi kućanstva
drop policy if exists "expenses_select_own" on public.expenses;
drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;
drop policy if exists "expenses_delete_own" on public.expenses;

create policy "expenses_select_own" on public.expenses
  for select to authenticated using (
    (select auth.uid()) = user_id
    or (household_id is not null and public.is_household_member(household_id)));

create policy "expenses_delete_own" on public.expenses
  for delete to authenticated using (
    (select auth.uid()) = user_id
    or (household_id is not null and public.is_household_member(household_id)));

-- Unos i uređivanje: račun mora pripadati osobi koja je unijela trošak (stupac postoji samo uz accounts.sql)
do $$
declare acc_check text := 'true';
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'expenses' and column_name = 'account_id') then
    acc_check := 'public.account_belongs(account_id, user_id)';
  end if;

  execute format($p$
    create policy "expenses_insert_own" on public.expenses
      for insert to authenticated with check (
        (select auth.uid()) = user_id
        and (household_id is null or public.is_household_member(household_id))
        and %s)$p$, acc_check);

  execute format($p$
    create policy "expenses_update_own" on public.expenses
      for update to authenticated
      using ((select auth.uid()) = user_id
             or (household_id is not null and public.is_household_member(household_id)))
      with check (
        ((select auth.uid()) = user_id
         or (household_id is not null and public.is_household_member(household_id)))
        and (household_id is null or public.is_household_member(household_id))
        and %s)$p$, acc_check);
end $$;
