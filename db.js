// Sloj za podatke: Supabase (oblak) ili demo način (localStorage) dok config.js nije popunjen.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;

let sb = null;
if (!isDemo) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const COLS = 'id, amount, category, note, spent_at, created_at';
const appUrl = () => location.origin + location.pathname;
const toUser = (u) => (u ? { id: u.id, email: u.email } : null);
const norm = (r) => ({ ...r, amount: Number(r.amount) });

function check({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------- Prijava ----------

export async function getUser() {
  if (isDemo) return demo.user();
  const { data } = await sb.auth.getSession();
  return toUser(data.session?.user);
}

export function onAuthChange(cb) {
  if (isDemo) return demo.listen(cb);
  // setTimeout: Supabase ne voli da se iz ovog callbacka odmah zovu drugi upiti
  sb.auth.onAuthStateChange((event, session) => setTimeout(() => cb(event, toUser(session?.user)), 0));
}

export async function signIn(email, password) {
  if (isDemo) return demo.signIn(email);
  check(await sb.auth.signInWithPassword({ email, password }));
}

export async function signUp(email, password) {
  if (isDemo) { demo.signIn(email); return { needsConfirmation: false }; }
  const data = check(await sb.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } }));
  return { needsConfirmation: !data.session };
}

export async function signOut() {
  if (isDemo) return demo.signOut();
  await sb.auth.signOut();
}

export async function resetPassword(email) {
  if (isDemo) return;
  check(await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl() }));
}

export async function updatePassword(password) {
  if (isDemo) return;
  check(await sb.auth.updateUser({ password }));
}

// ---------- Troškovi ----------

/** Troškovi s datumom u rasponu [from, to), najnoviji prvi. Datumi su 'YYYY-MM-DD'. */
export async function listExpenses(from, to) {
  if (isDemo) return demo.list(from, to);
  const rows = check(await sb.from('expenses').select(COLS)
    .gte('spent_at', from).lt('spent_at', to)
    .order('spent_at', { ascending: false }).order('created_at', { ascending: false }));
  return rows.map(norm);
}

/** Zadnje uneseni troškovi (po vremenu unosa). */
export async function listRecent(limit) {
  if (isDemo) return demo.recent(limit);
  const rows = check(await sb.from('expenses').select(COLS)
    .order('created_at', { ascending: false }).limit(limit));
  return rows.map(norm);
}

export async function addExpense(e) {
  if (isDemo) return demo.add(e);
  return norm(check(await sb.from('expenses').insert(e).select(COLS).single()));
}

export async function updateExpense(id, e) {
  if (isDemo) return demo.update(id, e);
  check(await sb.from('expenses').update(e).eq('id', id));
}

export async function deleteExpense(id) {
  if (isDemo) return demo.remove(id);
  check(await sb.from('expenses').delete().eq('id', id));
}

// ---------- Demo način ----------

const demo = (() => {
  const KEY = 'troskovi-demo';
  const listeners = [];
  let mem = null;

  const load = () => {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY)); } catch { /* nedostupno */ }
    mem ||= { user: null, rows: [] };
    return mem;
  };
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* nedostupno */ }
  };
  const emit = (event) => listeners.forEach((cb) => setTimeout(() => cb(event, mem.user), 0));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
  const byNewest = (a, b) => b.spent_at.localeCompare(a.spent_at) || b.created_at.localeCompare(a.created_at);

  function seed() {
    const cats = [
      ['namirnice', 8, 60, 'Konzum'], ['restorani', 2, 18, 'Kava'], ['prijevoz', 20, 60, 'Gorivo'],
      ['zabava', 10, 40, 'Kino'], ['pretplate', 8, 15, 'Netflix'], ['kupovina', 10, 80, ''],
      ['odjeca', 25, 90, ''], ['zdravlje', 5, 30, 'Ljekarna'],
    ];
    const now = new Date();
    const rows = [];
    for (let back = 45; back >= 0; back--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
      const n = Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const [category, min, max, note] = cats[Math.floor(Math.random() * cats.length)];
        const p = (x) => String(x).padStart(2, '0');
        rows.push({
          id: uid(), category, note,
          amount: Math.round((min + Math.random() * (max - min)) * 100) / 100,
          spent_at: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
          created_at: new Date(d.getTime() + i * 1000).toISOString(),
        });
      }
    }
    return rows;
  }

  return {
    user: () => load().user,
    listen: (cb) => listeners.push(cb),
    signIn(email) {
      load();
      mem.user = { id: 'demo', email: email || 'demo@primjer.hr' };
      if (!mem.rows.length) mem.rows = seed();
      save(); emit('SIGNED_IN');
    },
    signOut() { load(); mem.user = null; save(); emit('SIGNED_OUT'); },
    list: (from, to) => load().rows.filter((r) => r.spent_at >= from && r.spent_at < to).sort(byNewest),
    recent: (limit) => [...load().rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit),
    add(e) {
      const row = { id: uid(), note: null, created_at: new Date().toISOString(), ...e };
      load().rows.push(row); save();
      return row;
    },
    update(id, e) { const r = load().rows.find((x) => x.id === id); if (r) Object.assign(r, e); save(); },
    remove(id) { load(); mem.rows = mem.rows.filter((x) => x.id !== id); save(); },
  };
})();
