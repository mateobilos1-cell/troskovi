-- Pokreni jednom u Supabase → SQL Editor → New query → Run.

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  category    text not null,
  note        text check (char_length(note) <= 200),
  spent_at    date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists expenses_user_spent_idx on public.expenses (user_id, spent_at desc);
create index if not exists expenses_user_created_idx on public.expenses (user_id, created_at desc);

-- Svatko vidi i mijenja samo svoje troškove.
alter table public.expenses enable row level security;

drop policy if exists "expenses_select_own" on public.expenses;
drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;
drop policy if exists "expenses_delete_own" on public.expenses;

create policy "expenses_select_own" on public.expenses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "expenses_insert_own" on public.expenses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "expenses_update_own" on public.expenses
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "expenses_delete_own" on public.expenses
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.expenses to authenticated;
revoke all on public.expenses from anon;
