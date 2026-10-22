-- Ponavljajući unosi (plaća, Netflix, najam...) koji se sami dodaju svaki mjesec.
-- Pokreni jednom u Supabase → SQL Editor → New query → Run (nakon schema.sql i incomes.sql).

create table if not exists public.recurring (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('expense', 'income')),
  amount       numeric(12, 2) not null check (amount > 0),
  category     text not null,
  note         text check (char_length(note) <= 200),
  account_id   uuid,                                   -- račun (ako se prate računi)
  day          smallint not null check (day between 1 and 31),
  start_month  date not null,                          -- prvi mjesec u kojem se dodaje (1. u mjesecu)
  last_month   date,                                   -- zadnji mjesec za koji je unos dodan
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists recurring_user_idx on public.recurring (user_id);

alter table public.recurring enable row level security;

drop policy if exists "recurring_select_own" on public.recurring;
drop policy if exists "recurring_insert_own" on public.recurring;
drop policy if exists "recurring_update_own" on public.recurring;
drop policy if exists "recurring_delete_own" on public.recurring;

create policy "recurring_select_own" on public.recurring
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "recurring_insert_own" on public.recurring
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recurring_update_own" on public.recurring
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recurring_delete_own" on public.recurring
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.recurring to authenticated;
revoke all on public.recurring from anon;

-- Veza unosa s pravilom. Jedinstvenost (pravilo, datum) sprječava dupli unos
-- ako se aplikacija otvori na dva uređaja u isto vrijeme.
alter table public.expenses add column if not exists recurring_id uuid references public.recurring (id) on delete set null;
alter table public.incomes  add column if not exists recurring_id uuid references public.recurring (id) on delete set null;

do $$ begin
  alter table public.expenses add constraint expenses_recurring_once unique (recurring_id, spent_at);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.incomes add constraint incomes_recurring_once unique (recurring_id, received_at);
exception when duplicate_object or duplicate_table then null; end $$;
