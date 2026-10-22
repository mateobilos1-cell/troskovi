// Sloj za podatke: Supabase (oblak) ili demo način (localStorage) dok config.js nije popunjen.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// ?demo radi samo lokalno (localhost) — za isprobavanje bez diranja pravih podataka
const forceDemo = ['localhost', '127.0.0.1'].includes(location.hostname)
  && new URLSearchParams(location.search).has('demo');
export const isDemo = forceDemo || !SUPABASE_URL || !SUPABASE_ANON_KEY;

let sb = null;
if (!isDemo) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const appUrl = () => location.origin + location.pathname;

// Postavke korisnika žive u user_metadata (nije potrebna posebna tablica)
// Naziv u aplikaciji → naziv u user_metadata
const SETTING_KEYS = {
  trackAccounts: 'track_accounts',
  defaultAccount: 'default_account',
  trackBudgets: 'track_budgets',
  budgets: 'budgets', // { total: 800, cats: { restorani: 60, ... } }
};
const toSettings = (meta = {}) => ({
  trackAccounts: !!meta.track_accounts,
  defaultAccount: meta.default_account || null,
  trackBudgets: !!meta.track_budgets,
  budgets: { total: meta.budgets?.total ?? null, cats: meta.budgets?.cats ?? {} },
});
const toUser = (u) => (u ? { id: u.id, email: u.email, settings: toSettings(u.user_metadata) } : null);

function check({ data, error }) {
  if (error) throw error;
  return data;
}

// Stupac account_id čita/piše se samo kad je praćenje računa uključeno,
// pa aplikacija radi i ako accounts.sql još nije pokrenut.
let withAccounts = false;
export function useAccounts(on) { withAccounts = !!on; }
// Isto za recurring_id (recurring.sql)
let withRecurring = false;
export function useRecurring(on) { withRecurring = !!on; }

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

/** Sprema postavke (vidi SETTING_KEYS) i vraća nove. */
export async function saveSettings(patch) {
  const meta = {};
  Object.entries(SETTING_KEYS).forEach(([k, metaKey]) => { if (k in patch) meta[metaKey] = patch[k]; });
  if (isDemo) return demo.saveSettings(meta);
  const data = check(await sb.auth.updateUser({ data: meta }));
  return toSettings(data.user.user_metadata);
}

// ---------- Računi (ZABA, Revolut, gotovina...) ----------

const ACC_COLS = 'id, name, short, color, created_at';

export async function listAccounts() {
  if (isDemo) return demo.accounts();
  return check(await sb.from('accounts').select(ACC_COLS).order('created_at'));
}

export async function addAccount(a) {
  if (isDemo) return demo.addAccount(a);
  return check(await sb.from('accounts').insert(a).select(ACC_COLS).single());
}

export async function updateAccount(id, a) {
  if (isDemo) return demo.updateAccount(id, a);
  check(await sb.from('accounts').update(a).eq('id', id));
}

export async function removeAccount(id) {
  if (isDemo) return demo.removeAccount(id);
  check(await sb.from('accounts').delete().eq('id', id));
}

// ---------- Troškovi i prihodi ----------
// kind je 'expense' (tablica expenses) ili 'income' (tablica incomes).
// Aplikacija uvijek radi s poljem `date`; ovdje se prevodi u stupac pojedine tablice.

const TABLES = {
  expense: { table: 'expenses', dateCol: 'spent_at' },
  income: { table: 'incomes', dateCol: 'received_at' },
};

function fromRow(r, dateCol) {
  return {
    id: r.id, amount: Number(r.amount), category: r.category, note: r.note,
    date: r[dateCol], account_id: r.account_id ?? null, recurring_id: r.recurring_id ?? null, created_at: r.created_at,
  };
}
function toRow(e, dateCol) {
  const row = { amount: e.amount, category: e.category, note: e.note };
  if (e.date) row[dateCol] = e.date;
  if (withAccounts && 'account_id' in e) row.account_id = e.account_id;
  if (withRecurring && e.recurring_id) row.recurring_id = e.recurring_id;
  return row;
}
const cols = (dateCol) => `id, amount, category, note, ${dateCol}, created_at`
  + `${withAccounts ? ', account_id' : ''}${withRecurring ? ', recurring_id' : ''}`;

/** Zapisi s datumom u rasponu [from, to), najnoviji prvi. Datumi su 'YYYY-MM-DD'. */
export async function list(kind, from, to) {
  if (isDemo) return demo.list(kind, from, to);
  const { table, dateCol } = TABLES[kind];
  const rows = check(await sb.from(table).select(cols(dateCol))
    .gte(dateCol, from).lt(dateCol, to)
    .order(dateCol, { ascending: false }).order('created_at', { ascending: false }));
  return rows.map((r) => fromRow(r, dateCol));
}

/** Zadnje uneseni zapisi (po vremenu unosa). */
export async function listRecent(kind, limit) {
  if (isDemo) return demo.recent(kind, limit);
  const { table, dateCol } = TABLES[kind];
  const rows = check(await sb.from(table).select(cols(dateCol))
    .order('created_at', { ascending: false }).limit(limit));
  return rows.map((r) => fromRow(r, dateCol));
}

export async function add(kind, e) {
  if (isDemo) return demo.add(kind, e);
  const { table, dateCol } = TABLES[kind];
  return fromRow(check(await sb.from(table).insert(toRow(e, dateCol)).select(cols(dateCol)).single()), dateCol);
}

export async function update(kind, id, e) {
  if (isDemo) return demo.update(id, e);
  const { table, dateCol } = TABLES[kind];
  check(await sb.from(table).update(toRow(e, dateCol)).eq('id', id));
}

export async function remove(kind, id) {
  if (isDemo) return demo.remove(id);
  check(await sb.from(TABLES[kind].table).delete().eq('id', id));
}

/** Dodaje više zapisa iz ponavljajućih pravila; već postojeći (isto pravilo + datum) se preskaču. */
export async function addRecurringEntries(kind, entries) {
  if (!entries.length) return;
  if (isDemo) return demo.addRecurringEntries(kind, entries);
  const { table, dateCol } = TABLES[kind];
  check(await sb.from(table).upsert(entries.map((e) => toRow(e, dateCol)),
    { onConflict: `recurring_id,${dateCol}`, ignoreDuplicates: true }));
}

// ---------- Ponavljajući unosi (pravila) ----------

const REC_COLS = 'id, kind, amount, category, note, account_id, day, start_month, last_month, active, created_at';
const normRec = (r) => ({ ...r, amount: Number(r.amount) });

export async function listRecurring() {
  if (isDemo) return demo.recurring();
  return check(await sb.from('recurring').select(REC_COLS).order('created_at')).map(normRec);
}

export async function addRecurring(r) {
  if (isDemo) return demo.addRecurring(r);
  return normRec(check(await sb.from('recurring').insert(r).select(REC_COLS).single()));
}

export async function updateRecurring(id, r) {
  if (isDemo) return demo.updateRecurring(id, r);
  check(await sb.from('recurring').update(r).eq('id', id));
}

export async function removeRecurring(id) {
  if (isDemo) return demo.removeRecurring(id);
  check(await sb.from('recurring').delete().eq('id', id));
}

// ---------- Demo način ----------

const demo = (() => {
  const KEY = 'troskovi-demo';
  const listeners = [];
  let mem = null;

  const load = () => {
    if (mem) return mem;
    try { mem = JSON.parse(localStorage.getItem(KEY)); } catch { /* nedostupno */ }
    mem ||= { user: null, items: [] };
    mem.accounts ||= [];
    mem.recurring ||= [];
    // stari demo format (samo troškovi)
    if (mem.rows) {
      mem.items = mem.rows.map(({ spent_at, ...r }) => ({ ...r, kind: 'expense', date: spent_at }));
      delete mem.rows;
    }
    if (mem.user && !mem.items.some((r) => r.kind === 'income')) mem.items.push(...seedIncomes());
    if (mem.user && !mem.user.meta) {
      const s = mem.user.settings || {};
      mem.user.meta = { track_accounts: !!s.trackAccounts, default_account: s.defaultAccount || null };
    }
    if (mem.user) mem.user.settings = toSettings(mem.user.meta);
    return mem;
  };
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* nedostupno */ }
  };
  const emit = (event) => listeners.forEach((cb) => setTimeout(() => cb(event, mem.user), 0));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
  const p = (x) => String(x).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const byNewest = (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);
  const ofKind = (kind) => load().items.filter((r) => r.kind === kind).map((r) => ({ account_id: null, ...r }));

  function seedExpenses() {
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
        rows.push({
          id: uid(), kind: 'expense', category, note,
          amount: Math.round((min + Math.random() * (max - min)) * 100) / 100,
          date: iso(d), created_at: new Date(d.getTime() + i * 1000).toISOString(),
        });
      }
    }
    return rows;
  }

  function seedIncomes() {
    const now = new Date();
    const rows = [];
    for (const back of [1, 0]) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 10);
      if (d > now) continue;
      rows.push(
        { id: uid(), kind: 'income', category: 'placa', note: null, amount: 1000, date: iso(d), created_at: d.toISOString() },
        { id: uid(), kind: 'income', category: 'topli_obrok', note: null, amount: 100, date: iso(d), created_at: d.toISOString() },
      );
    }
    return rows;
  }

  return {
    user: () => load().user,
    listen: (cb) => listeners.push(cb),
    signIn(email) {
      load();
      mem.user = { id: 'demo', email: email || 'demo@primjer.hr', meta: {}, settings: toSettings() };
      if (!mem.items.length) mem.items = [...seedExpenses(), ...seedIncomes()];
      save(); emit('SIGNED_IN');
    },
    signOut() { load(); mem.user = null; save(); emit('SIGNED_OUT'); },
    saveSettings(meta) {
      load();
      mem.user.meta = { ...mem.user.meta, ...meta };
      mem.user.settings = toSettings(mem.user.meta);
      save();
      return mem.user.settings;
    },
    accounts: () => [...load().accounts],
    addAccount(a) {
      const row = { id: uid(), short: null, created_at: new Date().toISOString(), ...a };
      load().accounts.push(row); save();
      return row;
    },
    updateAccount(id, a) { const r = load().accounts.find((x) => x.id === id); if (r) Object.assign(r, a); save(); },
    removeAccount(id) {
      load();
      mem.accounts = mem.accounts.filter((x) => x.id !== id);
      mem.items.forEach((r) => { if (r.account_id === id) r.account_id = null; });
      save();
    },
    list: (kind, from, to) => ofKind(kind).filter((r) => r.date >= from && r.date < to).sort(byNewest),
    recent: (kind, limit) => ofKind(kind).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit),
    add(kind, e) {
      const row = { id: uid(), kind, note: null, account_id: null, created_at: new Date().toISOString(), ...e };
      load().items.push(row); save();
      return row;
    },
    update(id, e) { const r = load().items.find((x) => x.id === id); if (r) Object.assign(r, e); save(); },
    remove(id) { load(); mem.items = mem.items.filter((x) => x.id !== id); save(); },
    addRecurringEntries(kind, entries) {
      load();
      entries.forEach((e) => {
        if (mem.items.some((x) => x.recurring_id === e.recurring_id && x.date === e.date)) return;
        mem.items.push({ id: uid(), kind, note: null, account_id: null, created_at: new Date().toISOString(), ...e });
      });
      save();
    },
    recurring: () => [...load().recurring],
    addRecurring(r) {
      const row = { id: uid(), active: true, last_month: null, account_id: null, created_at: new Date().toISOString(), ...r };
      load().recurring.push(row); save();
      return row;
    },
    updateRecurring(id, r) { const x = load().recurring.find((y) => y.id === id); if (x) Object.assign(x, r); save(); },
    removeRecurring(id) {
      load();
      mem.recurring = mem.recurring.filter((x) => x.id !== id);
      mem.items.forEach((x) => { if (x.recurring_id === id) x.recurring_id = null; });
      save();
    },
  };
})();
