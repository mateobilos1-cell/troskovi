# FinPlus — upute za postavljanje

Aplikacija je obična web stranica (HTML + CSS + JavaScript), bez ikakvog "buildanja".
Podaci i prijava idu preko **Supabase** (besplatno), a stranica se objavljuje na **Vercelu** (besplatno).

## 1. Supabase (baza + prijava)

1. Napravi račun na <https://supabase.com> i klikni **New project** (regija: *Central EU (Frankfurt)*).
2. Lijevo otvori **SQL Editor → New query**, zalijepi cijeli sadržaj `supabase/schema.sql` i klikni **Run**.
   Isto ponovi sa `supabase/incomes.sql` (tablica za prihode) pa sa `supabase/accounts.sql` (računi i kartice), `supabase/recurring.sql` (ponavljajući unosi) i `supabase/delete-account.sql` (brisanje računa iz aplikacije).
3. Otvori **Project Settings → API** (ili **Connect**) i kopiraj:
   - *Project URL* → u `config.js` kao `SUPABASE_URL`
   - *anon / publishable* ključ → u `config.js` kao `SUPABASE_ANON_KEY`
   (Nikad ne koristi *service_role / secret* ključ u aplikaciji.)

## 2. Objava na Vercel

1. Napravi račun na <https://github.com>, napravi novi repozitorij (npr. `troskovi`) i
   **Add file → Upload files** — prebaci sve datoteke iz ove mape.
2. Na <https://vercel.com> se prijavi preko GitHuba → **Add New → Project** → odaberi repozitorij →
   **Deploy** (bez ikakvih postavki, Framework: *Other*).
3. Dobit ćeš adresu tipa `https://troskovi-xxx.vercel.app`.

Svaki put kad promijeniš datoteku na GitHubu, Vercel sam objavi novu verziju.

## 3. Poveži adresu sa Supabaseom

U Supabaseu: **Authentication → URL Configuration**
- **Site URL**: tvoja Vercel adresa
- **Redirect URLs**: dodaj istu adresu

Tako će poveznice iz maila (potvrda računa, nova lozinka) voditi na tvoju aplikaciju.

## 4. Na iPhoneu

Otvori adresu u **Safariju** → **Dijeli** → **Dodaj na početni zaslon**. Napravi račun i prijavi se.

## Dobro je znati

- **Prijatelji**: svatko napravi svoj račun i vidi samo svoje troškove.
  Kad se svi registriraju, možeš zatvoriti registraciju: *Authentication → Sign In / Providers → Allow new users to sign up* (isključi).
- **Mailovi**: Supabaseov besplatni mail server šalje samo nekoliko mailova na sat — dovoljno za par ljudi.
- **Pauza**: besplatni Supabase projekt se pauzira nakon 7 dana bez ikakvog korištenja; ponovno ga pokreneš jednim klikom na supabase.com. Ako ga koristiš svakodnevno, to se ne događa.
- **Demo način**: dok je `config.js` prazan, aplikacija radi bez oblaka i sprema podatke samo u pregledniku — korisno za isprobavanje.
- **Kategorije** se mijenjaju na vrhu `app.js` (naziv, ikona, boja). Ne mijenjaj `id` postojećih kategorija jer je on spremljen u bazi.
