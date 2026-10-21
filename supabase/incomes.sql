-- Prihodi (plaća, topli obrok...). Pokreni jednom u Supabase → SQL Editor → New query → Run.

create table if not exists public.incomes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount       numeric(12, 2) not null check (amount > 0),
  category     text not null,
  note         text check (char_length(note) <= 200),
  received_at  date not null default current_date,
  created_at   timestamptz not null default now()
);

create index if not exists incomes_user_received_idx on public.incomes (user_id, received_at desc);
create index if not exists incomes_user_created_idx on public.incomes (user_id, created_at desc);

-- Svatko vidi i mijenja samo svoje prihode.
alter table public.incomes enable row level security;

drop policy if exists "incomes_select_own" on public.incomes;
drop policy if exists "incomes_insert_own" on public.incomes;
drop policy if exists "incomes_update_own" on public.incomes;
drop policy if exists "incomes_delete_own" on public.incomes;

create policy "incomes_select_own" on public.incomes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "incomes_insert_own" on public.incomes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "incomes_update_own" on public.incomes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "incomes_delete_own" on public.incomes
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.incomes to authenticated;
revoke all on public.incomes from anon;
