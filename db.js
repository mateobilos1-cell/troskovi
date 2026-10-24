// Sloj za podatke: Supabase (oblak) ili demo način (localStorage) dok config.js nije popunjen.
// Iznad oba sloja je spremanje na uređaj: zadnji podaci se prikazuju odmah (i bez interneta),
// a novi unosi bez veze čekaju u redu i šalju se kad se veza vrati.
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
  overviewHidden: 'overview_hidden', // dijelovi kartice Pregled koje korisnik ne želi vidjeti
  overviewOrder: 'overview_order', // redoslijed dijelova kartice Pregled
  // vlastite kategorije: { expense: { custom:[{id,label,icon,color}], hidden:[id], over:{id:{label,icon,color}}, order:[id] }, income: {…} }
  categories: 'categories',
};
const toSettings = (meta = {}) => ({
  trackAccounts: !!meta.track_accounts,
  defaultAccount: meta.default_account || null,
  trackBudgets: !!meta.track_budgets,
  budgets: { total: meta.budgets?.total ?? null, cats: meta.budgets?.cats ?? {} },
  overviewHidden: Array.isArray(meta.overview_hidden) ? meta.overview_hidden : [],
  overviewOrder: Array.isArray(meta.overview_order) ? meta.overview_order : [],
  categories: meta.categories && typeof meta.categories === 'object' ? meta.categories : {},
});
const toUser = (u) => (u ? { id: u.id, email: u.email, settings: toSettings(u.user_metadata) } : null);

function check({ data, error }) {
  if (error) throw error;
  return data;
}

/** Je li greška nastala zbog veze (nema interneta), a ne zbog podataka. */
export const isNetworkError = (e) => !navigator.onLine
  || /failed to fetch|load failed|networkerror|network request failed/i.test(String(e?.message || e));

// Stupac account_id čita/piše se samo kad je praćenje računa uključeno,
// pa aplikacija radi i ako accounts.sql još nije pokrenut.
let withAccounts = false;
export function useAccounts(on) { withAccounts = !!on; }
// Isto za recurring_id (recurring.sql)
let withRecurring = false;
export function useRecurring(on) { withRecurring = !!on; }

// ---------- Spremanje na uređaj ----------

const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* pun ili nedostupan */ } },
};
let userId = null;      // čiji se podaci spremaju
let freshUntil = 0;     // nakon promjene se podaci kratko vrijeme čitaju ravno s mreže
const touch = () => { freshUntil = Date.now() + 4000; };

const changeListeners = [];
let changeTimer;
/** Poziva se kad u pozadini stignu noviji podaci od prikazanih (ili se promijeni red čekanja). */
export function onDataChange(cb) { changeListeners.push(cb); }
function emitChange() {
  clearTimeout(changeTimer);
  changeTimer = setTimeout(() => changeListeners.forEach((cb) => cb()), 60);
}

// Vrati spremljeno odmah i osvježi u pozadini; bez spremljenog (ili nakon promjene) čekaj mrežu.
async function cached(key, fetcher, { fresh = false } = {}) {
  if (!userId) return fetcher();
  const k = `fp:${userId}:c:${key}`;
  const hit = ls.get(k);
  let servedStale = false;
  const refresh = fetcher().then((data) => {
    const changed = JSON.stringify(data) !== JSON.stringify(hit);
    ls.set(k, data);
    if (servedStale && changed) emitChange();
    return data;
  });
  if (hit && !fresh && Date.now() > freshUntil) {
    servedStale = true;
    refresh.catch(() => {});
    return hit;
  }
  try {
    return await refresh;
  } catch (e) {
    if (hit && isNetworkError(e)) return hit;
    throw e;
  }
}

// ---------- Red čekanja za unose bez interneta ----------

const qkey = () => `fp:${userId}:queue`;
const queue = () => (userId && ls.get(qkey())) || [];
const setQueue = (q) => { ls.set(qkey(), q); emitChange(); };
export const pendingCount = () => queue().length;
const pendingOf = (kind) => queue().filter((q) => q.kind === kind)
  .map((q) => ({ account_id: null, recurring_id: null, ...q.entry, id: q.id, created_at: q.created_at, pending: true }));

let flushing = false;
/** Šalje unose iz reda čekanja. Vraća broj poslanih. */
export async function flushQueue() {
  if (flushing || !userId || !queue().length || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    if (!isDemo) await sb.auth.getSession(); // osvježi prijavu ako je istekla dok nije bilo veze
    for (const item of queue()) {
      try {
        await R.insert(item.kind, item.entry, item.id);
      } catch (e) {
        if (!isNetworkError(e)) console.warn('Unos nije poslan:', e);
        break; // pokušat će se ponovno kasnije
      }
      ls.set(qkey(), queue().filter((x) => x.id !== item.id));
      sent++;
    }
  } finally {
    flushing = false;
  }
  if (sent) { touch(); emitChange(); }
  return sent;
}

// ---------- Prijava ----------

export async function getUser() {
  if (isDemo) return setUserId(demo.user());
  const { data, error } = await sb.auth.getSession();
  let user = toUser(data.session?.user);
  // bez veze se prijava ne može osvježiti — nastavi kao zadnji prijavljeni korisnik
  if (!user && error && isNetworkError(error)) user = ls.get('fp:last-user');
  return setUserId(user);
}

function setUserId(user) {
  userId = user?.id || null;
  if (user && !isDemo) ls.set('fp:last-user', user);
  return user;
}

export function onAuthChange(cb) {
  if (isDemo) return demo.listen((event, user) => cb(event, setUserId(user)));
  // setTimeout: Supabase ne voli da se iz ovog callbacka odmah zovu drugi upiti
  sb.auth.onAuthStateChange((event, session) => setTimeout(() => {
    if (event === 'INITIAL_SESSION') return; // početno stanje već daje getUser()
    const user = toUser(session?.user);
    if (event === 'SIGNED_OUT') localStorage.removeItem('fp:last-user');
    cb(event, user ? setUserId(user) : (event === 'SIGNED_OUT' ? setUserId(null) : null));
  }, 0));
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
  // spremljeni podaci se brišu; unosi koji čekaju vezu ostaju za iduću prijavu istog korisnika
  if (userId) {
    Object.keys(localStorage).filter((k) => k.startsWith(`fp:${userId}:c:`)).forEach((k) => localStorage.removeItem(k));
  }
  if (isDemo) return demo.signOut();
  localStorage.removeItem('fp:last-user');
  await sb.auth.signOut();
}

/**
 * Trajno briše korisnikov račun i sve njegove podatke (supabase/delete-account.sql).
 * Prije brisanja ponovno provjerava lozinku, da nitko s otključanim telefonom ne obriše tuđi račun.
 */
export async function deleteAccount(email, password) {
  const clearLocal = (id) => {
    Object.keys(localStorage).filter((k) => k.startsWith(`fp:${id}:`) || k === 'fp:last-user')
      .forEach((k) => localStorage.removeItem(k));
  };
  if (isDemo) {
    clearLocal('demo');
    return demo.deleteAll();
  }
  check(await sb.auth.signInWithPassword({ email, password }));
  const id = userId;
  check(await sb.rpc('delete_my_account'));
  clearLocal(id);
  await sb.auth.signOut({ scope: 'local' }).catch(() => {});
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
  const settings = toSettings(data.user.user_metadata);
  const last = ls.get('fp:last-user');
  if (last) ls.set('fp:last-user', { ...last, settings });
  return settings;
}

// ---------- Supabase ----------
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
const ACC_COLS = 'id, name, short, color, created_at';
const REC_COLS = 'id, kind, amount, category, note, account_id, day, start_month, last_month, active, created_at';
const normRec = (r) => ({ ...r, amount: Number(r.amount) });
const GOAL_COLS = 'id, name, icon, color, target, deadline, created_at';
const DEP_COLS = 'id, goal_id, amount, date, note, created_at';
const normGoal = (g, deps = []) => ({
  ...g, target: Number(g.target), saved: Math.round(deps.reduce((s, d) => s + Number(d.amount), 0) * 100) / 100,
});

const supa = {
  async list(kind, from, to) {
    const { table, dateCol } = TABLES[kind];
    const rows = check(await sb.from(table).select(cols(dateCol))
      .gte(dateCol, from).lt(dateCol, to)
      .order(dateCol, { ascending: false }).order('created_at', { ascending: false }));
    return rows.map((r) => fromRow(r, dateCol));
  },
  async recent(kind, limit) {
    const { table, dateCol } = TABLES[kind];
    const rows = check(await sb.from(table).select(cols(dateCol))
      .order('created_at', { ascending: false }).limit(limit));
    return rows.map((r) => fromRow(r, dateCol));
  },
  // id dolazi s uređaja, pa ponovno slanje istog unosa (npr. nakon prekida veze) ne stvara duplikat
  async insert(kind, e, id) {
    const { table, dateCol } = TABLES[kind];
    check(await sb.from(table).upsert({ ...toRow(e, dateCol), id }, { onConflict: 'id', ignoreDuplicates: true }));
  },
  async update(kind, id, e) {
    const { table, dateCol } = TABLES[kind];
    check(await sb.from(table).update(toRow(e, dateCol)).eq('id', id));
  },
  async remove(kind, id) {
    check(await sb.from(TABLES[kind].table).delete().eq('id', id));
  },
  async addRecurringEntries(kind, entries) {
    const { table, dateCol } = TABLES[kind];
    check(await sb.from(table).upsert(entries.map((e) => toRow(e, dateCol)),
      { onConflict: `recurring_id,${dateCol}`, ignoreDuplicates: true }));
  },
  accounts: async () => check(await sb.from('accounts').select(ACC_COLS).order('created_at')),
  addAccount: async (a) => check(await sb.from('accounts').insert(a).select(ACC_COLS).single()),
  async updateAccount(id, a) { check(await sb.from('accounts').update(a).eq('id', id)); },
  async removeAccount(id) { check(await sb.from('accounts').delete().eq('id', id)); },
  recurring: async () => check(await sb.from('recurring').select(REC_COLS).order('created_at')).map(normRec),
  addRecurring: async (r) => normRec(check(await sb.from('recurring').insert(r).select(REC_COLS).single())),
  async updateRecurring(id, r) { check(await sb.from('recurring').update(r).eq('id', id)); },
  async removeRecurring(id) { check(await sb.from('recurring').delete().eq('id', id)); },
  // ciljevi štednje; saved = zbroj uplata
  async goals() {
    const rows = check(await sb.from('goals').select(`${GOAL_COLS}, goal_deposits(amount)`).order('created_at'));
    return rows.map(({ goal_deposits: deps, ...g }) => normGoal(g, deps));
  },
  addGoal: async (g) => normGoal(check(await sb.from('goals').insert(g).select(GOAL_COLS).single()), []),
  async updateGoal(id, g) { check(await sb.from('goals').update(g).eq('id', id)); },
  async removeGoal(id) { check(await sb.from('goals').delete().eq('id', id)); },
  deposits: async (goalId) => check(await sb.from('goal_deposits').select(DEP_COLS).eq('goal_id', goalId)
    .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(100))
    .map((d) => ({ ...d, amount: Number(d.amount) })),
  async addDeposit(d) { check(await sb.from('goal_deposits').insert(d)); },
  async removeDeposit(id) { check(await sb.from('goal_deposits').delete().eq('id', id)); },
};

// ---------- Javne funkcije (spremanje na uređaj + mreža) ----------

const flags = () => `${withAccounts ? 'a' : ''}${withRecurring ? 'r' : ''}`;
const byNewest = (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);

/** Zapisi s datumom u rasponu [from, to), najnoviji prvi. Datumi su 'YYYY-MM-DD'. */
export async function list(kind, from, to) {
  const rows = await cached(`list:${kind}:${from}:${to}:${flags()}`, () => R.list(kind, from, to));
  const pending = pendingOf(kind).filter((r) => r.date >= from && r.date < to);
  return pending.length ? [...pending, ...rows].sort(byNewest) : rows;
}

/** Zadnje uneseni zapisi (po vremenu unosa). */
export async function listRecent(kind, limit) {
  const rows = await cached(`recent:${kind}:${limit}:${flags()}`, () => R.recent(kind, limit));
  const pending = pendingOf(kind);
  return pending.length
    ? [...pending, ...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit)
    : rows;
}

/** Novi unos. Bez veze se sprema u red čekanja i vraća s oznakom pending. */
export async function add(kind, e) {
  const id = crypto.randomUUID();
  try {
    await R.insert(kind, e, id);
    touch();
    return { ...e, id };
  } catch (err) {
    if (!isNetworkError(err) || e.recurring_id) throw err;
    const item = { kind, id, entry: e, created_at: new Date().toISOString() };
    setQueue([...queue(), item]);
    return { ...e, id, pending: true };
  }
}

// Unos koji još čeka vezu mijenja se/briše samo na uređaju
function editQueued(id, fn) {
  const q = queue();
  const i = q.findIndex((x) => x.id === id);
  if (i < 0) return false;
  fn(q, i);
  setQueue(q);
  return true;
}

export async function update(kind, id, e) {
  if (editQueued(id, (q, i) => { q[i].entry = { ...q[i].entry, ...e }; })) return;
  await R.update(kind, id, e);
  touch();
}

export async function remove(kind, id) {
  if (editQueued(id, (q, i) => q.splice(i, 1))) return;
  await R.remove(kind, id);
  touch();
}

/** Dodaje više zapisa iz ponavljajućih pravila; već postojeći (isto pravilo + datum) se preskaču. */
export async function addRecurringEntries(kind, entries) {
  if (!entries.length) return;
  await R.addRecurringEntries(kind, entries);
  touch();
}

// Računi (ZABA, Revolut, gotovina...)
export const listAccounts = () => cached('accounts', () => R.accounts());
export async function addAccount(a) { const r = await R.addAccount(a); touch(); return r; }
export async function updateAccount(id, a) { await R.updateAccount(id, a); touch(); }
export async function removeAccount(id) { await R.removeAccount(id); touch(); }

// Ponavljajući unosi (pravila); fresh = obavezno s mreže
export const listRecurring = (fresh = false) => cached('recurring', () => R.recurring(), { fresh });
export async function addRecurring(r) { const x = await R.addRecurring(r); touch(); return x; }
export async function updateRecurring(id, r) { await R.updateRecurring(id, r); touch(); }
export async function removeRecurring(id) { await R.removeRecurring(id); touch(); }

// Ciljevi štednje i uplate (goals.sql)
export const listGoals = () => cached('goals', () => R.goals());
export async function addGoal(g) { const x = await R.addGoal(g); touch(); return x; }
export async function updateGoal(id, g) { await R.updateGoal(id, g); touch(); }
export async function removeGoal(id) { await R.removeGoal(id); touch(); }
export const listDeposits = (goalId) => cached(`deposits:${goalId}`, () => R.deposits(goalId));
export async function addDeposit(d) { await R.addDeposit(d); touch(); }
export async function removeDeposit(id) { await R.removeDeposit(id); touch(); }

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
    mem.goals ||= [];
    mem.deposits ||= [];
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
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const ofKind = (kind) => load().items.filter((r) => r.kind === kind)
    .map(({ kind: _k, ...r }) => ({ account_id: null, recurring_id: null, ...r }));

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
    goals: () => copy(load().goals.map((g) => normGoal(g, mem.deposits.filter((d) => d.goal_id === g.id)))),
    addGoal(g) {
      const row = { id: uid(), icon: '🎯', color: '#007AFF', deadline: null, created_at: new Date().toISOString(), ...g };
      load().goals.push(row); save();
      return normGoal(copy(row), []);
    },
    updateGoal(id, g) { const x = load().goals.find((y) => y.id === id); if (x) Object.assign(x, g); save(); },
    removeGoal(id) {
      load();
      mem.goals = mem.goals.filter((x) => x.id !== id);
      mem.deposits = mem.deposits.filter((d) => d.goal_id !== id);
      save();
    },
    deposits: (goalId) => copy(load().deposits.filter((d) => d.goal_id === goalId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))),
    addDeposit(d) { load().deposits.push({ id: uid(), note: null, created_at: new Date().toISOString(), ...d }); save(); },
    removeDeposit(id) { load(); mem.deposits = mem.deposits.filter((d) => d.id !== id); save(); },
    deleteAll() {
      mem = { user: null, items: [], accounts: [], recurring: [], goals: [], deposits: [] };
      save(); emit('SIGNED_OUT');
    },
    saveSettings(meta) {
      load();
      mem.user.meta = { ...mem.user.meta, ...meta };
      mem.user.settings = toSettings(mem.user.meta);
      save();
      return mem.user.settings;
    },
    // podaci (isti oblik kao supa)
    list: (kind, from, to) => copy(ofKind(kind).filter((r) => r.date >= from && r.date < to).sort(byNewest)),
    recent: (kind, limit) => copy(ofKind(kind).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit)),
    insert(kind, e, id) {
      load();
      if (mem.items.some((x) => x.id === id)) return;
      mem.items.push({ note: null, account_id: null, created_at: new Date().toISOString(), ...e, id, kind });
      save();
    },
    update(kind, id, e) { const r = load().items.find((x) => x.id === id); if (r) Object.assign(r, e); save(); },
    remove(kind, id) { load(); mem.items = mem.items.filter((x) => x.id !== id); save(); },
    addRecurringEntries(kind, entries) {
      load();
      entries.forEach((e) => {
        if (mem.items.some((x) => x.recurring_id === e.recurring_id && x.date === e.date)) return;
        mem.items.push({ id: uid(), kind, note: null, account_id: null, created_at: new Date().toISOString(), ...e });
      });
      save();
    },
    accounts: () => copy(load().accounts),
    addAccount(a) {
      const row = { id: uid(), short: null, created_at: new Date().toISOString(), ...a };
      load().accounts.push(row); save();
      return copy(row);
    },
    updateAccount(id, a) { const r = load().accounts.find((x) => x.id === id); if (r) Object.assign(r, a); save(); },
    removeAccount(id) {
      load();
      mem.accounts = mem.accounts.filter((x) => x.id !== id);
      mem.items.forEach((r) => { if (r.account_id === id) r.account_id = null; });
      save();
    },
    recurring: () => copy(load().recurring),
    addRecurring(r) {
      const row = { id: uid(), active: true, last_month: null, account_id: null, created_at: new Date().toISOString(), ...r };
      load().recurring.push(row); save();
      return copy(row);
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

// U demo načinu se gubitak veze može isprobati: localStorage 'fp-demo-offline' = '1' ili isključen internet
const DATA_OPS = ['list', 'recent', 'insert', 'update', 'remove', 'addRecurringEntries', 'accounts', 'addAccount',
  'updateAccount', 'removeAccount', 'recurring', 'addRecurring', 'updateRecurring', 'removeRecurring',
  'goals', 'addGoal', 'updateGoal', 'removeGoal', 'deposits', 'addDeposit', 'removeDeposit'];
const demoRemote = Object.fromEntries(DATA_OPS.map((op) => [op, async (...args) => {
  await new Promise((r) => setTimeout(r, 120)); // kao da ide preko mreže
  if (!navigator.onLine || localStorage.getItem('fp-demo-offline') === '1') throw new TypeError('Failed to fetch');
  return demo[op](...args);
}]));

const R = isDemo ? demoRemote : supa;
