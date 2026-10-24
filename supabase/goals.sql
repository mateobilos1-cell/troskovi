-- Ciljevi štednje (npr. "Ljetovanje: 1.000 € do lipnja") i uplate prema njima.
-- Pokreni jednom u Supabase → SQL Editor → New query → Run.

create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  icon        text not null default '🎯' check (char_length(icon) <= 16),
  color       text not null default '#007AFF' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  target      numeric(12, 2) not null check (target > 0),
  deadline    date,                                   -- prvi dan mjeseca do kojeg se štedi (neobavezno)
  created_at  timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals (user_id, created_at);

-- Uplata (pozitivan iznos) ili podizanje (negativan iznos)
create table if not exists public.goal_deposits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id     uuid not null references public.goals (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount <> 0),
  date        date not null default current_date,
  note        text check (char_length(note) <= 100),
  created_at  timestamptz not null default now()
);
create index if not exists goal_deposits_goal_idx on public.goal_deposits (goal_id, date desc);

alter table public.goals enable row level security;
alter table public.goal_deposits enable row level security;

drop policy if exists "goals_select_own" on public.goals;
drop policy if exists "goals_insert_own" on public.goals;
drop policy if exists "goals_update_own" on public.goals;
drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_select_own" on public.goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "goals_insert_own" on public.goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goals_update_own" on public.goals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goals_delete_own" on public.goals
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Uplata se smije vezati samo uz vlastiti cilj
drop policy if exists "deposits_select_own" on public.goal_deposits;
drop policy if exists "deposits_insert_own" on public.goal_deposits;
drop policy if exists "deposits_update_own" on public.goal_deposits;
drop policy if exists "deposits_delete_own" on public.goal_deposits;
create policy "deposits_select_own" on public.goal_deposits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "deposits_insert_own" on public.goal_deposits
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.goals g where g.id = goal_id and g.user_id = (select auth.uid())));
create policy "deposits_update_own" on public.goal_deposits
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.goals g where g.id = goal_id and g.user_id = (select auth.uid())));
create policy "deposits_delete_own" on public.goal_deposits
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.goals, public.goal_deposits to authenticated;
revoke all on public.goals, public.goal_deposits from anon;
