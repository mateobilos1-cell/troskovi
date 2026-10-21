-- Računi (ZABA, PBZ, Revolut, gotovina...) — po izboru se vežu uz troškove i prihode.
-- Pokreni jednom u Supabase → SQL Editor → New query → Run (nakon schema.sql i incomes.sql).

create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  short       text check (char_length(short) <= 4),
  color       text not null default '#8E8E93',
  created_at  timestamptz not null default now()
);
create index if not exists accounts_user_idx on public.accounts (user_id, created_at);

alter table public.accounts enable row level security;

drop policy if exists "accounts_select_own" on public.accounts;
drop policy if exists "accounts_insert_own" on public.accounts;
drop policy if exists "accounts_update_own" on public.accounts;
drop policy if exists "accounts_delete_own" on public.accounts;

create policy "accounts_select_own" on public.accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "accounts_insert_own" on public.accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "accounts_update_own" on public.accounts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "accounts_delete_own" on public.accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.accounts to authenticated;
revoke all on public.accounts from anon;

-- Veza troškova i prihoda s računom (brisanje računa samo makne oznaku, zapisi ostaju)
alter table public.expenses add column if not exists account_id uuid references public.accounts (id) on delete set null;
alter table public.incomes  add column if not exists account_id uuid references public.accounts (id) on delete set null;

-- Zapis se smije vezati samo uz vlastiti račun
create or replace function public.owns_account(acc uuid) returns boolean
  language sql stable set search_path = ''
  as $$ select acc is null or exists (select 1 from public.accounts a where a.id = acc and a.user_id = (select auth.uid())) $$;

drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;
create policy "expenses_insert_own" on public.expenses
  for insert to authenticated with check ((select auth.uid()) = user_id and public.owns_account(account_id));
create policy "expenses_update_own" on public.expenses
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_account(account_id));

drop policy if exists "incomes_insert_own" on public.incomes;
drop policy if exists "incomes_update_own" on public.incomes;
create policy "incomes_insert_own" on public.incomes
  for insert to authenticated with check ((select auth.uid()) = user_id and public.owns_account(account_id));
create policy "incomes_update_own" on public.incomes
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_account(account_id));
