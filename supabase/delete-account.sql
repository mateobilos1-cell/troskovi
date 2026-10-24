-- Brisanje vlastitog računa iz aplikacije (Postavke → Obriši račun).
-- Pokreni jednom u Supabase → SQL Editor → New query → Run.
--
-- Korisnik smije obrisati samo sebe (auth.uid()). Brisanjem korisnika baza sama briše
-- i sve njegove troškove, prihode, račune i ponavljajuće unose (on delete cascade).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Nisi prijavljen.';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
