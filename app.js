import * as db from './db.js';

// ---------- Kategorije ----------
// id se sprema u bazu — ne mijenjaj postojeće id-jeve, slobodno mijenjaj nazive, ikone i boje.
const EXPENSE_CATEGORIES = [
  { id: 'namirnice', label: 'Namirnice', icon: '🛒', color: '#34C759' },
  { id: 'restorani', label: 'Kafići', icon: '☕', color: '#FF9500' },
  { id: 'prijevoz', label: 'Prijevoz', icon: '🚗', color: '#007AFF' },
  { id: 'stanovanje', label: 'Stanovanje', icon: '🏠', color: '#5856D6' },
  { id: 'zabava', label: 'Zabava', icon: '🎉', color: '#FF2D55' },
  { id: 'odjeca', label: 'Odjeća', icon: '👕', color: '#AF52DE' },
  { id: 'zdravlje', label: 'Zdravlje', icon: '💊', color: '#5AC8FA' },
  { id: 'pretplate', label: 'Pretplate', icon: '📱', color: '#FF3B30' },
  { id: 'kupovina', label: 'Kupovina', icon: '🛍️', color: '#FFCC00' },
  { id: 'putovanja', label: 'Putovanja', icon: '✈️', color: '#30B0C7' },
  { id: 'pokloni', label: 'Pokloni', icon: '🎁', color: '#A2845E' },
  { id: 'ostalo', label: 'Ostalo', icon: '📦', color: '#8E8E93' },
];
const INCOME_CATEGORIES = [
  { id: 'placa', label: 'Plaća', icon: '💼', color: '#34C759' },
  { id: 'topli_obrok', label: 'Topli obrok', icon: '🍽️', color: '#FF9500' },
  { id: 'honorar', label: 'Honorar', icon: '🧾', color: '#007AFF' },
  { id: 'bonus', label: 'Bonus', icon: '⭐', color: '#FFCC00' },
  { id: 'poklon', label: 'Poklon', icon: '🎁', color: '#FF2D55' },
  { id: 'povrat', label: 'Povrat novca', icon: '↩️', color: '#5AC8FA' },
  { id: 'prodaja', label: 'Prodaja', icon: '🏷️', color: '#AF52DE' },
  { id: 'ostalo', label: 'Ostalo', icon: '💰', color: '#8E8E93' },
];

// Sve što se razlikuje između troškova i prihoda
const KINDS = {
  expense: {
    cats: EXPENSE_CATEGORIES,
    sign: '',
    totalLabel: 'Ukupno potrošeno',
    breakdown: 'Na što trošiš',
    listTitle: 'Troškovi',
    editTitle: 'Uredi trošak',
    deleteLabel: 'Obriši trošak',
    empty: 'Nema troškova u ovom mjesecu.',
    color: 'var(--tint)',
    moreIsGood: false,
  },
  income: {
    cats: INCOME_CATEGORIES,
    sign: '+',
    totalLabel: 'Ukupno zarađeno',
    breakdown: 'Odakle dolazi novac',
    listTitle: 'Prihodi',
    editTitle: 'Uredi prihod',
    deleteLabel: 'Obriši prihod',
    empty: 'Nema prihoda u ovom mjesecu.',
    color: 'var(--green)',
    moreIsGood: true,
  },
};
// Brzi odabir kod dodavanja računa (boje i kratice su samo za prepoznavanje)
const ACCOUNT_PRESETS = [
  { name: 'Zagrebačka banka', short: 'ZABA', color: '#E30613' },
  { name: 'PBZ', short: 'PBZ', color: '#0057A8' },
  { name: 'Erste', short: 'ERS', color: '#2870ED' },
  { name: 'OTP banka', short: 'OTP', color: '#52AE30' },
  { name: 'Raiffeisen', short: 'RBA', color: '#C9A400' },
  { name: 'Addiko', short: 'ADK', color: '#00A3E0' },
  { name: 'HPB', short: 'HPB', color: '#0F4C81' },
  { name: 'Revolut', short: 'R', color: '#1C1C1E' },
  { name: 'Aircash', short: 'AC', color: '#00A99D' },
  { name: 'KEKS Pay', short: 'K', color: '#FF6B00' },
  { name: 'Gotovina', short: '💵', color: '#34C759' },
  { name: 'Kreditna kartica', short: '💳', color: '#5856D6' },
];
const ACCOUNT_COLORS = ['#FF3B30', '#FF9500', '#C9A400', '#34C759', '#00A99D', '#007AFF', '#0F4C81', '#5856D6', '#AF52DE', '#FF2D55', '#8E8E93', '#1C1C1E'];
const initials = (name) => name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || '?';
const accBadge = (a, cls = '') => `<span class="acc-badge ${cls} ${[...(a.short || '')].length > 2 ? 'long' : ''}" style="--c:${a.color}">${esc(a.short || initials(a.name))}</span>`;

// ---------- Kategorije korisnika ----------
// Ugrađene kategorije (KINDS[kind].cats) + korisnikove promjene iz postavki:
// vlastite kategorije, promijenjen naziv/ikona/boja, sakrivene i redoslijed.
const catConf = (kind) => {
  const c = state.user?.settings?.categories?.[kind] || {};
  return { custom: c.custom || [], hidden: c.hidden || [], over: c.over || {}, order: c.order || [] };
};
let catMemo = { settings: null, lists: {} };
/** Sve kategorije (i sakrivene), po korisnikovom redoslijedu. */
function allCats(kind) {
  const settings = state.user?.settings;
  if (catMemo.settings !== settings) catMemo = { settings, lists: {} };
  if (catMemo.lists[kind]) return catMemo.lists[kind];
  const { custom, hidden, over, order } = catConf(kind);
  const list = [...KINDS[kind].cats.map((c) => ({ ...c, ...cleanCat(over[c.id]), builtin: true })),
    ...custom.map((c) => ({ id: c.id, label: 'Kategorija', icon: '🏷️', color: '#8E8E93', ...cleanCat(c), builtin: false }))]
    .map((c) => ({ ...c, hidden: hidden.includes(c.id) }));
  const pos = (id) => { const i = order.indexOf(id); return i < 0 ? order.length + list.findIndex((c) => c.id === id) : i; };
  list.sort((a, b) => pos(a.id) - pos(b.id));
  catMemo.lists[kind] = list;
  return list;
}
// Korisnikov unos (naziv, emoji, boja) — sigurno za ispis u HTML
// Prvi emoji u tekstu (ili prvi znak ako emojija nema)
const firstGrapheme = (s) => {
  const str = String(s || '').trim();
  if (!str) return '';
  const parts = window.Intl?.Segmenter ? [...new Intl.Segmenter().segment(str)].map((x) => x.segment) : [...str];
  return parts.find((g) => /\p{Extended_Pictographic}/u.test(g)) || parts.find((g) => !/[\s<>&"']/.test(g)) || '';
};
function cleanCat(c) {
  if (!c) return {};
  const out = {};
  if (typeof c.label === 'string' && c.label.trim()) out.label = c.label.trim().slice(0, 24);
  const icon = firstGrapheme(c.icon).replace(/[<>&"']/g, '');
  if (icon) out.icon = icon;
  if (/^#[0-9a-f]{6}$/i.test(c.color || '')) out.color = c.color;
  return out;
}
/** Kategorije koje se nude kod unosa. */
const visibleCats = (kind) => allCats(kind).filter((c) => !c.hidden);
const cat = (kind, id) => allCats(kind).find((c) => c.id === id) || allCats(kind).find((c) => c.id === 'ostalo') || KINDS[kind].cats.at(-1);

const MONTHS = ['siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj',
  'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'];
const WEEKDAYS = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];

// ---------- Pomoćne funkcije ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmt = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' });
const money = (n) => fmt.format(n);
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt.format(Math.abs(n));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDate(new Date());
const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const daysIn = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const monthName = (d) => { const m = MONTHS[d.getMonth()]; return m[0].toUpperCase() + m.slice(1); };
const sum = (rows) => rows.reduce((s, r) => s + r.amount, 0);
const parseAmount = (s) => {
  const v = Number(String(s).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN;
};
const CHEVRON_L = '<svg viewBox="0 0 14 14"><path d="M9 2 4 7l5 5"/></svg>';
const CHEVRON_R = '<svg viewBox="0 0 14 14"><path d="m5 2 5 5-5 5"/></svg>';

function dayLabel(iso) {
  const t = new Date();
  const y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
  if (iso === isoDate(t)) return 'Danas';
  if (iso === isoDate(y)) return 'Jučer';
  const [yy, mm, dd] = iso.split('-').map(Number);
  const d = new Date(yy, mm - 1, dd);
  const wd = WEEKDAYS[d.getDay()];
  return `${wd[0].toUpperCase() + wd.slice(1)}, ${dd}. ${mm}.${yy === t.getFullYear() ? '' : ` ${yy}.`}`;
}

let toastTimer;
function toast(text, isError = false) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.toggle('err', isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), isError ? 4000 : 2000);
}

const isMissingTable = (e) => ['PGRST205', '42P01'].includes(e?.code) || /could not find the table|does not exist/i.test(e?.message || '');

function errorText(e) {
  const code = e?.code || '';
  const msg = String(e?.message || e || '');
  if (code === 'invalid_credentials' || /invalid login/i.test(msg)) return 'Pogrešan e-mail ili lozinka.';
  if (code === 'email_not_confirmed' || /not confirmed/i.test(msg)) return 'E-mail još nije potvrđen — otvori poveznicu koju smo ti poslali.';
  if (code === 'user_already_exists' || /already registered/i.test(msg)) return 'Račun s tim e-mailom već postoji. Prijavi se.';
  if (code === 'weak_password' || /password should be/i.test(msg)) return 'Lozinka mora imati barem 6 znakova.';
  if (/rate limit|too many/i.test(msg)) return 'Previše pokušaja. Pričekaj malo pa pokušaj ponovno.';
  if (db.isNetworkError(e)) return 'Nema veze s internetom.';
  if (isMissingTable(e) && /accounts|account_id/.test(msg)) return 'Tablica za račune još ne postoji — pokreni supabase/accounts.sql u Supabaseu.';
  if (isMissingTable(e)) return 'Tablica za prihode još ne postoji — pokreni supabase/incomes.sql u Supabaseu.';
  return msg || 'Nešto je pošlo po zlu.';
}

// Polje za iznos raste sa sadržajem pa je iznos uvijek centriran uz "€"
function wireAmount(input, autoWidth = true) {
  const fit = () => { if (autoWidth) input.style.width = `${Math.max((input.value || input.placeholder).length, 1) + 0.2}ch`; };
  input.addEventListener('input', () => {
    // dopušta samo brojeve i jedan decimalni zarez
    let s = input.value.replace('.', ',').replace(/[^\d,]/g, '');
    const i = s.indexOf(',');
    if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, '').slice(0, 2);
    input.value = s;
    fit();
  });
  fit();
}

// ---------- Stanje ----------
const state = {
  user: null,
  started: false,
  recovering: false,
  view: 'trosak',
  month: monthStart(new Date()),
  overviewKind: 'expense',
  filterCat: null,
  filterAcc: null, // id računa ili 'none'
  logView: 'kalendar', // dnevnik u Pregledu: 'kalendar' ili 'popis'
  selDay: null,
  pick: { expense: null, income: null },
  accounts: [],
  recurring: [],
  recurringReady: false, // false dok recurring.sql nije pokrenut
};

const tracking = () => !!state.user?.settings?.trackAccounts;
const budgeting = () => !!state.user?.settings?.trackBudgets;

// ---------- Ponavljajući unosi ----------
const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
// Datum u mjesecu m za zadani dan (31. u veljači → zadnji dan veljače)
const dueDate = (m, day) => new Date(m.getFullYear(), m.getMonth(), Math.min(day, daysIn(m)));
// Prvi mjesec od kojeg pravilo vrijedi ako ga dodaješ danas: ovaj, ili sljedeći ako je dan već prošao
const firstMonthFor = (day) => {
  const now = new Date();
  const m = monthStart(now);
  return dueDate(m, day).getDate() >= now.getDate() ? m : addMonths(m, 1);
};

async function loadRecurring() {
  try {
    state.recurring = await db.listRecurring();
    state.recurringReady = true;
  } catch (e) {
    state.recurring = [];
    state.recurringReady = false;
    if (!isMissingTable(e)) toast(errorText(e), true);
  }
  db.useRecurring(state.recurringReady);
}

// Dodaje sve unose kojima je došao dan (i one propuštene dok aplikacija nije bila otvorena)
let runningRecurring = false;
async function runRecurring() {
  if (!state.recurringReady || runningRecurring || !navigator.onLine) return 0;
  runningRecurring = true;
  let added = 0;
  try {
    state.recurring = await db.listRecurring(true); // svježe s mreže, da se ništa ne doda dvaput
    const now = new Date();
    const thisMonth = monthStart(now);
    for (const rule of state.recurring.filter((r) => r.active)) {
      let m = rule.last_month ? addMonths(parseIso(rule.last_month), 1) : parseIso(rule.start_month);
      const entries = [];
      let last = null;
      while (m <= thisMonth && dueDate(m, rule.day) <= now) {
        entries.push({
          amount: rule.amount, category: rule.category, note: rule.note,
          date: isoDate(dueDate(m, rule.day)), recurring_id: rule.id,
          ...(tracking() ? { account_id: accById(rule.account_id)?.id || null } : {}),
        });
        last = m;
        m = addMonths(m, 1);
      }
      if (!entries.length) continue;
      await db.addRecurringEntries(rule.kind, entries);
      rule.last_month = isoDate(last);
      await db.updateRecurring(rule.id, { last_month: rule.last_month });
      added += entries.length;
    }
  } catch (e) {
    if (!db.isNetworkError(e)) toast(errorText(e), true); // bez veze: pokušat će opet kasnije
  } finally {
    runningRecurring = false;
  }
  if (added) toast(`↻ Dodano ponavljajućih unosa: ${added}`);
  return added;
}
const accById = (id) => state.accounts.find((a) => a.id === id) || null;

// Učitava račune ako je praćenje uključeno. Ako tablica još ne postoji, praćenje se privremeno gasi.
async function loadAccounts() {
  db.useAccounts(tracking());
  state.accounts = [];
  if (!tracking()) return;
  try {
    state.accounts = await db.listAccounts();
  } catch (e) {
    db.useAccounts(false);
    state.user.settings = { ...state.user.settings, trackAccounts: false };
    toast(errorText(e), true);
  }
}

// ---------- Pokretanje ----------
boot();

async function boot() {
  if (db.isDemo) document.body.classList.add('demo');
  $$('.tabbar button').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
  $('#sheet-backdrop').addEventListener('click', closeSheet);

  // Veliki naslov se pri skrolanju "skupi" u traku na vrhu, kao na iOS-u
  const onScroll = () => $('#navbar').classList.toggle('scrolled', window.scrollY > $('#title').offsetHeight - 4);
  window.addEventListener('scroll', onScroll, { passive: true });

  // Aplikacija se sprema na uređaj (brže otvaranje i rad bez interneta)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'update') toast('Nova verzija je spremna — zatvori i ponovno otvori aplikaciju');
    });
  }

  // Aplikacija s početnog zaslona zna ostati otvorena danima — kod povratka pošalji unose koji čekaju
  // i provjeri ponavljajuće unose
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  window.addEventListener('online', syncNow);
  window.addEventListener('offline', updateSyncBanner);
  db.onDataChange(onDataChanged);

  db.onAuthChange((event, user) => {
    if (event === 'PASSWORD_RECOVERY') return showRecovery();
    setUser(user);
  });
  setUser(await db.getUser());
}

// Pošalji unose koji čekaju vezu i dodaj ponavljajuće unose kojima je došao dan
async function syncNow() {
  updateSyncBanner();
  if (!state.user || $('#app').hidden) return;
  const sent = await db.flushQueue();
  if (sent) toast(`☁️ Poslano unosa: ${sent}`);
  if (await runRecurring()) onDataChanged();
  updateSyncBanner();
}

// Stigli su noviji podaci od prikazanih — osvježi ekran bez animacija i bez diranja forme
function onDataChanged() {
  updateSyncBanner();
  if (!state.user || $('#app').hidden || !$('#sheet').hidden) return;
  if (state.view === 'trosak') return renderEntryExtra('expense');
  if (state.view === 'prihod') return renderEntryExtra('income');
  if (document.activeElement?.tagName === 'INPUT') return; // npr. upisuje budžet u postavkama
  render();
}

const plural = (n, one, few, many) => {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
};

function updateSyncBanner() {
  const el = $('#sync-banner');
  if (!el) return;
  const n = state.user ? db.pendingCount() : 0;
  const offline = !navigator.onLine;
  let text = '';
  if (n) text = `⏳ ${n} ${plural(n, 'unos čeka', 'unosa čekaju', 'unosa čeka')} slanje${offline ? ' · nema veze' : ''}`;
  else if (offline) text = '📡 Nema veze — prikazani su zadnji spremljeni podaci';
  el.textContent = text;
  el.hidden = !text;
}


function setUser(user) {
  if (state.recovering) return;
  const same = (state.user?.id ?? null) === (user?.id ?? null);
  state.user = user;
  if (same && state.started) return;
  state.started = true;
  if (user) {
    $('#auth').hidden = true;
    $('#app').hidden = false;
    Promise.all([loadAccounts(), loadRecurring()]).then(() => {
      go('trosak');
      syncNow();
    });
  }
  else { closeSheet(); $('#app').hidden = true; showAuth('login'); }
}

// ---------- Prijava i registracija ----------
function showAuth(mode, message) {
  const el = $('#auth');
  el.hidden = false;
  const isLogin = mode === 'login';
  const isReset = mode === 'reset';
  el.innerHTML = `
    <div class="brand">
      <img src="icons/icon-192.png" alt="">
      <h1>${isReset ? 'Nova lozinka' : 'Fin<span class="plus">+</span>'}</h1>
      <p>${isReset ? 'Poslat ćemo ti poveznicu za novu lozinku.' : 'Prati prihode i troškove i ostani u plusu.'}</p>
    </div>
    ${isReset ? '' : `
    <div class="segmented">
      <button type="button" data-mode="login" class="${isLogin ? 'on' : ''}">Prijava</button>
      <button type="button" data-mode="signup" class="${!isLogin ? 'on' : ''}">Novi račun</button>
    </div>`}
    <form id="auth-form" novalidate>
      <div class="group">
        <label class="row"><input class="row-input" name="email" type="email" autocomplete="email"
          autocapitalize="off" placeholder="E-mail" required></label>
        ${isReset ? '' : `<label class="row"><input class="row-input" name="password" type="password"
          autocomplete="${isLogin ? 'current-password' : 'new-password'}"
          placeholder="${isLogin ? 'Lozinka' : 'Lozinka (barem 6 znakova)'}" required minlength="6"></label>`}
      </div>
      <div class="msg"></div>
      <button class="btn-filled" type="submit">${isReset ? 'Pošalji poveznicu' : isLogin ? 'Prijavi se' : 'Napravi račun'}</button>
    </form>
    ${isLogin ? '<button type="button" class="btn-plain" data-mode="reset">Zaboravljena lozinka?</button>' : ''}
    ${isReset ? '<button type="button" class="btn-plain" data-mode="login">Natrag na prijavu</button>' : ''}
  `;
  $$('[data-mode]', el).forEach((b) => b.addEventListener('click', () => showAuth(b.dataset.mode)));

  const form = $('#auth-form');
  const msg = $('.msg', form);
  const setMsg = (text, ok = false) => { msg.textContent = text; msg.className = `msg ${ok ? 'ok' : 'err'}`; };
  if (message) setMsg(message, true);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = form.email.value.trim();
    const password = form.password?.value ?? '';
    if (!email.includes('@')) return setMsg('Upiši ispravan e-mail.');
    if (!isReset && password.length < 6) return setMsg('Lozinka mora imati barem 6 znakova.');

    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    setMsg('');
    try {
      if (isReset) {
        await db.resetPassword(email);
        setMsg('Poslano! Otvori poveznicu iz maila i postavi novu lozinku.', true);
      } else if (isLogin) {
        await db.signIn(email, password);
      } else {
        const { needsConfirmation } = await db.signUp(email, password);
        if (needsConfirmation) setMsg('Gotovo! Provjeri mail i otvori poveznicu za potvrdu, zatim se prijavi ovdje.', true);
      }
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      btn.disabled = false;
    }
  });
}

function showRecovery() {
  state.recovering = true;
  closeSheet();
  $('#app').hidden = true;
  const el = $('#auth');
  el.hidden = false;
  el.innerHTML = `
    <div class="brand"><img src="icons/icon-192.png" alt=""><h1>Nova lozinka</h1><p>Upiši novu lozinku za svoj račun.</p></div>
    <form id="pw-form" novalidate>
      <div class="group">
        <label class="row"><input class="row-input" name="password" type="password" autocomplete="new-password" placeholder="Nova lozinka (barem 6 znakova)"></label>
      </div>
      <div class="msg"></div>
      <button class="btn-filled" type="submit">Spremi lozinku</button>
    </form>`;
  const form = $('#pw-form');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msg = $('.msg', form);
    if (form.password.value.length < 6) { msg.className = 'msg err'; msg.textContent = 'Lozinka mora imati barem 6 znakova.'; return; }
    try {
      await db.updatePassword(form.password.value);
      state.recovering = false;
      toast('Lozinka je promijenjena');
      state.started = false;
      setUser(await db.getUser());
    } catch (e) {
      msg.className = 'msg err';
      msg.textContent = errorText(e);
    }
  });
}

// ---------- Navigacija ----------
const TITLES = { trosak: 'Novi trošak', prihod: 'Novi prihod', pregled: 'Pregled', postavke: 'Postavke' };

function go(view) {
  state.view = view;
  lastDonutKey = null;
  $('#title').textContent = TITLES[view];
  $('#nav-title').textContent = TITLES[view];
  $$('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  window.scrollTo(0, 0);
  $('#navbar').classList.remove('scrolled');
  // sadržaj nove kartice lagano "izroni", a brojke se odbroje do iznosa
  const v = $('#view');
  v.classList.remove('entering');
  void v.offsetWidth; // ponovno pokreni animaciju
  v.classList.add('entering');
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => v.classList.remove('entering'), 800);
  state.countNext = true;
  render();
}
let enterTimer;

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Brojke s data-count="iznos" odbroje se od nule (samo kod ulaska u karticu ili promjene mjeseca)
function countUp(root) {
  if (!state.countNext) return;
  state.countNext = false;
  if (reduceMotion()) return;
  $$('[data-count]', root).forEach((el) => {
    const to = Number(el.dataset.count);
    const fmtFn = el.dataset.fmt === 'signed' ? signed : money;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min((t - start) / 650, 1);
      el.textContent = fmtFn(to * (1 - (1 - p) ** 3));
      if (p < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function render() {
  const view = state.view;
  try {
    if (view === 'trosak') await renderEntry('expense');
    else if (view === 'prihod') await renderEntry('income');
    else if (view === 'pregled') await renderPregled();
    else renderPostavke();
  } catch (e) {
    if (db.isNetworkError(e) && view === 'pregled' && state.view === view) {
      $('#view').innerHTML = `
        <div class="month-nav">
          <button type="button" id="prev-m" aria-label="Prethodni mjesec">${CHEVRON_L}</button>
          <span class="m">${monthName(state.month)} ${state.month.getFullYear()}.</span>
          <button type="button" id="next-m" aria-label="Sljedeći mjesec">${CHEVRON_R}</button>
        </div>
        <div class="group empty">📡 Nema veze, a podaci za ovaj mjesec još nisu spremljeni na uređaj.<br>Prikazat će se čim se veza vrati.</div>`;
      $('#prev-m').addEventListener('click', () => changeMonth(-1));
      $('#next-m').addEventListener('click', () => changeMonth(1));
      return;
    }
    toast(errorText(e), true);
  }
}

// ---------- Zajednički dijelovi ----------
function catButtons(kind, selected) {
  // sakrivena kategorija se ipak prikaže ako je odabrana (npr. kod uređivanja starog unosa)
  return allCats(kind).filter((c) => !c.hidden || c.id === selected).map((c) => `
    <button type="button" class="cat ${c.id === selected ? 'on' : ''}" data-cat="${c.id}" style="--c:${c.color}">
      <span class="sq">${c.icon}</span><span class="lbl">${esc(c.label)}</span>
    </button>`).join('');
}

function wireCats(root, onPick) {
  $$('.cat', root).forEach((b) => b.addEventListener('click', () => {
    $$('.cat', root).forEach((x) => x.classList.toggle('on', x === b));
    onPick(b.dataset.cat);
  }));
}

// Iznos, kategorije, bilješka i datum — isto za unos i uređivanje
function accountRow(account) {
  if (!tracking()) return '';
  return state.accounts.length
    ? `<label class="row"><span class="label">Račun</span>
        <select class="pill-select account" aria-label="Račun">
          <option value="">Bez računa</option>
          ${state.accounts.map((a) => `<option value="${a.id}" ${a.id === account ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
        </select></label>`
    : `<button type="button" class="row go-accounts"><span class="label">Račun</span><span class="value tinted">Dodaj u postavkama</span><span class="chev"></span></button>`;
}

function amountGroup(kind, amount) {
  return `
    <div class="group amount-group">
      <label class="amount-line">
        ${kind === 'income' ? '<span class="cur sign">+</span>' : ''}
        <input class="amount" inputmode="decimal" placeholder="0,00" value="${esc(amount)}" autocomplete="off" enterkeyhint="done" aria-label="Iznos">
        <span class="cur">€</span>
      </label>
    </div>`;
}

function entryFields(kind, { amount = '', category = null, note = '', date = today(), account = null, repeat = false } = {}) {
  return `
    ${amountGroup(kind, amount)}
    <div class="group"><div class="cats">${catButtons(kind, category)}</div></div>
    <div class="group">
      <label class="row"><input class="row-input note" placeholder="Bilješka (neobavezno)" maxlength="100" value="${esc(note)}" autocomplete="off"></label>
      <label class="row"><span class="label">Datum</span><input class="pill-date date" type="date" value="${date}" max="${today()}" aria-label="Datum"></label>
      ${accountRow(account)}
      ${repeat && state.recurringReady ? `<label class="row"><span class="label">Ponavljaj svaki mjesec</span>
        <input type="checkbox" class="switch repeat"></label>` : ''}
    </div>`;
}

// Polja forme u objekt za spremanje (account_id samo kad je praćenje računa uključeno)
function readFields(form) {
  const e = {
    amount: parseAmount($('.amount', form).value),
    note: $('.note', form).value.trim() || null,
    date: $('.date', form).value || today(),
  };
  const sel = $('.account', form);
  if (tracking() && sel) e.account_id = sel.value || null;
  return e;
}

function wireFields(form) {
  wireAmount($('.amount', form));
  $('.go-accounts', form)?.addEventListener('click', () => { closeSheet(); go('postavke'); });
}

function itemRow(kind, r, showDate = false) {
  const c = cat(kind, r.category);
  const acc = tracking() ? accById(r.account_id) : null;
  const sub = [showDate ? dayLabel(r.date) : null, acc ? esc(acc.name) : null, r.note ? esc(r.note) : null].filter(Boolean).join(' · ');
  return `
    <button class="row item" data-id="${r.id}" data-kind="${kind}" style="--c:${c.color}">
      <span class="ico-sq">${c.icon}</span>
      <span class="main"><span class="t">${esc(c.label)}${r.recurring_id ? ' <span class="rep" title="Ponavljajući unos">↻</span>' : ''}${r.pending ? ' <span class="pend" title="Čeka vezu">⏳</span>' : ''}</span>${sub ? `<span class="s">${sub}</span>` : ''}</span>
      <span class="amt ${kind === 'income' ? 'pos' : ''}">${KINDS[kind].sign}${money(r.amount)}</span>
      <span class="chev"></span>
    </button>`;
}

function wireItems(kind, root, rows) {
  $$('.item', root).forEach((b) => b.addEventListener('click', () => {
    const r = rows.find((x) => x.id === b.dataset.id);
    if (r) openEdit(kind, r);
  }));
}

// ---------- Unos troška / prihoda ----------
async function renderEntry(kind) {
  const view = state.view;
  const v = $('#view');
  // Forma se prikaže odmah; brojke i zadnji unosi stignu kad se učitaju.
  v.innerHTML = `
    <form id="add-form" novalidate>
      ${entryFields(kind, { category: state.pick[kind], account: accById(state.user.settings.defaultAccount)?.id, repeat: true })}
      <button class="btn-filled ${kind === 'income' ? 'green' : ''}" type="submit">Spremi</button>
    </form>
    <div id="entry-extra"></div>`;

  const form = $('#add-form');
  const amountEl = $('.amount', form);
  wireFields(form);
  wireCats(form, (id) => { state.pick[kind] = id; });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fields = readFields(form);
    const { amount } = fields;
    if (!(amount > 0)) { amountEl.focus(); return toast('Upiši iznos', true); }
    const category = state.pick[kind];
    if (!category) return toast('Odaberi kategoriju', true);
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      // "Ponavljaj svaki mjesec": prvo pravilo, pa ovaj unos kao njegov prvi mjesec
      let rule = null;
      if ($('.repeat', form)?.checked) {
        const d = parseIso(fields.date);
        const month = isoDate(monthStart(d));
        rule = await db.addRecurring({
          kind, amount, category, note: fields.note, account_id: fields.account_id ?? null,
          day: d.getDate(), start_month: month, last_month: month,
        });
        state.recurring.push(rule);
      }
      const row = await db.add(kind, { ...fields, category, ...(rule ? { recurring_id: rule.id } : {}) });
      let saved = `${cat(kind, category).icon}  ${KINDS[kind].sign}${money(amount)} spremljeno`;
      if (row.pending) saved = `💾 ${KINDS[kind].sign}${money(amount)} spremljeno na uređaj — poslat će se kad se vrati veza`;
      if (rule) saved += ` · ponavlja se svakog ${rule.day}.`;
      const hint = kind === 'expense' ? await budgetHint(category, fields.date).catch(() => null) : null;
      toast(hint ? `${saved} · ${hint.text}` : saved, hint?.over);
      updateSyncBanner();
      // kvačica na gumbu pa prazna forma za idući unos
      btn.classList.add('done');
      btn.innerHTML = '<svg viewBox="0 0 24 24" class="check"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
      if (!reduceMotion()) await sleep(550);
      if (rule) await runRecurring(); // ako je datum u prošlom mjesecu, dodaj i propuštene mjesece
      state.pick[kind] = null;
      window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
      if (state.view === view) await renderEntry(kind);
    } catch (e) {
      toast(errorText(e), true);
      btn.disabled = false;
    }
  });

  await renderEntryExtra(kind);
}

// Brojke i zadnji unosi ispod forme (osvježava se i sam, kad stignu noviji podaci)
async function renderEntryExtra(kind) {
  const view = state.view;
  const m = monthStart(new Date());
  const from = isoDate(m);
  const to = isoDate(addMonths(m, 1));
  const [monthRows, recent, other] = await Promise.all([
    db.list(kind, from, to),
    db.listRecent(kind, 8),
    kind === 'income' ? db.list('expense', from, to) : null,
  ]);
  const extra = $('#entry-extra');
  if (state.view !== view || !extra) return;

  // data-count: brojka se odbroji do iznosa
  const num = (n, fmt = 'money') => `data-count="${n}" data-fmt="${fmt}">${fmt === 'signed' ? signed(n) : money(n)}`;
  let stats;
  if (kind === 'expense') {
    stats = `
      <div class="stat"><div class="k">Danas</div><div class="v" ${num(sum(monthRows.filter((r) => r.date === today())))}</div></div>
      <div class="stat"><div class="k">${monthName(m)}</div><div class="v" ${num(sum(monthRows))}</div></div>`;
  } else {
    const balance = sum(monthRows) - sum(other);
    stats = `
      <div class="stat"><div class="k">Prihodi · ${MONTHS[m.getMonth()]}</div><div class="v pos" ${num(sum(monthRows))}</div></div>
      <div class="stat"><div class="k">Bilanca</div><div class="v ${balance < 0 ? 'neg' : ''}" ${num(balance, 'signed')}</div></div>`;
  }

  const first = !extra.hasChildNodes();
  extra.classList.toggle('extra-in', first && !reduceMotion());
  extra.innerHTML = `
    <div class="stats">${stats}</div>
    <div class="section-title"><span>Zadnji unosi</span></div>
    ${recent.length
      ? `<div class="group">${recent.map((r) => itemRow(kind, r, true)).join('')}</div>`
      : `<div class="group empty">${kind === 'income' ? 'Još nema prihoda. Upiši plaću ili drugi prihod gore.' : 'Još nema unosa. Upiši prvi trošak gore.'}</div>`}`;
  wireItems(kind, extra, recent);
  countUp(extra);
}

// ---------- Budžeti ----------
// Stanje budžeta za jedan iznos: koliko je potrošeno od limita i koliko smije dnevno do kraja mjeseca
function budgetStatus(spent, limit, m, isCurrent) {
  const pct = (spent / limit) * 100;
  const daysLeft = isCurrent ? daysIn(m) - new Date().getDate() + 1 : 0;
  return {
    pct,
    left: limit - spent,
    perDay: daysLeft > 0 ? (limit - spent) / daysLeft : null,
    level: pct > 100 ? 'over' : pct >= 80 ? 'warn' : 'ok',
  };
}

function budgetCard(m, exp, isCurrent) {
  if (!budgeting()) return '';
  const { total, cats } = state.user.settings.budgets;
  const catIds = Object.keys(cats).filter((id) => cats[id] > 0);
  if (!total && !catIds.length) {
    return `<div class="group budgets"><div class="k">Budžet</div>
      <div class="sub">Budžeti su uključeni, ali još nisi postavio nijedan iznos. Postavi ih u <b>Postavkama</b>.</div></div>`;
  }
  // gdje bi "trebao" biti s obzirom na dan u mjesecu
  const pace = isCurrent ? (new Date().getDate() / daysIn(m)) * 100 : null;

  const line = (icon, label, spent, limit) => {
    const s = budgetStatus(spent, limit, m, isCurrent);
    let note;
    if (s.left < 0) note = `<span class="neg">${money(-s.left)} preko budžeta</span>`;
    else if (s.perDay != null) note = `ostalo ${money(s.left)} · ~${money(s.perDay)}/dan`;
    else note = `ostalo ${money(s.left)}`;
    return `
      <div class="b-line">
        <div class="b-top"><span>${icon} ${label}</span><span class="b-amt"><b>${money(spent)}</b> od ${money(limit)}</span></div>
        <div class="bbar ${s.level}"><i style="width:${Math.min(s.pct, 100)}%"></i>${pace != null ? `<em style="left:${pace}%"></em>` : ''}</div>
        <div class="b-note">${note}</div>
      </div>`;
  };

  const spentBy = (id) => sum(exp.filter((r) => r.category === id));
  const rows = catIds
    .map((id) => ({ id, spent: spentBy(id), limit: cats[id] }))
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);

  return `
    <div class="group budgets">
      <div class="k">Budžet</div>
      ${total ? line('📊', 'Ukupno', sum(exp), total) : ''}
      ${rows.map((r) => line(cat('expense', r.id).icon, esc(cat('expense', r.id).label), r.spent, r.limit)).join('')}
      ${pace != null ? '<div class="b-legend"><em></em>gdje bi trebao biti danas</div>' : ''}
    </div>`;
}

// Kratka poruka nakon spremanja troška: koliko je ostalo u budžetu kategorije (ili ukupnom)
async function budgetHint(category, date) {
  if (!budgeting()) return null;
  const m = monthStart(new Date());
  if (date.slice(0, 7) !== isoDate(m).slice(0, 7)) return null; // samo za tekući mjesec
  const { total, cats } = state.user.settings.budgets;
  const limit = cats[category] || total;
  if (!limit) return null;
  const rows = await db.list('expense', isoDate(m), isoDate(addMonths(m, 1)));
  const spent = sum(cats[category] ? rows.filter((r) => r.category === category) : rows);
  const label = cats[category] ? cat('expense', category).label : 'Ukupni budžet';
  const left = limit - spent;
  return left >= 0
    ? { text: `${label}: ostalo ${money(left)}`, over: false }
    : { text: `${label}: ${money(-left)} preko budžeta!`, over: true };
}

// ---------- Prsten (donut) po kategorijama ----------
const DONUT = { r: 80, w: 22, gap: 3 };
const DONUT_C = 2 * Math.PI * DONUT.r;
let lastDonutKey = null; // animira se samo kad se promijeni mjesec ili vrsta, ne kod odabira

function donutChart(kind, catList, total, caption) {
  // Kategorije ispod 3 % spajaju se u jedan sivi dio da prsten ne bude pun tankih trakica
  const parts = [];
  const small = { ids: [], v: 0, color: '#AEAEB2' };
  catList.forEach(([id, v]) => {
    if (v / total >= 0.03 || catList.length <= 2) parts.push({ ids: [id], v, color: cat(kind, id).color });
    else { small.ids.push(id); small.v += v; }
  });
  if (small.v > 0) parts.push(small);

  const sel = state.filterCat;
  const gap = parts.length > 1 ? DONUT.gap : 0;
  let offset = gap / 2;
  const segs = parts.map((p) => {
    const len = (p.v / total) * DONUT_C;
    const dash = Math.max(len - gap, 0.8);
    const on = sel && p.ids.includes(sel);
    const html = `<circle class="seg ${sel && !on ? 'dim' : ''} ${on ? 'on' : ''}" ${p.ids.length === 1 ? `data-cat="${p.ids[0]}"` : ''}
      cx="100" cy="100" r="${DONUT.r}" stroke="${p.color}" stroke-width="${DONUT.w}"
      data-dash="${dash}" stroke-dasharray="${dash} ${DONUT_C}" stroke-dashoffset="${-offset}"/>`;
    offset += len;
    return html;
  }).join('');

  let center;
  if (sel) {
    const v = catList.find(([id]) => id === sel)?.[1] || 0;
    const c = cat(kind, sel);
    center = `<span class="dc-k">${c.icon} ${esc(c.label)}</span>
      <span class="dc-v">${money(v)}</span><span class="dc-p">${Math.round((v / total) * 100)}% od ukupno</span>`;
  } else {
    center = `<span class="dc-k">${esc(caption)}</span><span class="dc-v">${money(total)}</span>
      <span class="dc-p">${catList.length} ${catList.length === 1 ? 'kategorija' : catList.length < 5 ? 'kategorije' : 'kategorija'}</span>`;
  }
  return `
    <div class="donut">
      <svg viewBox="0 0 200 200" aria-hidden="true"><g transform="rotate(-90 100 100)">
        <circle class="track" cx="100" cy="100" r="${DONUT.r}" stroke-width="${DONUT.w}"/>${segs}
      </g></svg>
      <div class="donut-center">${center}</div>
    </div>`;
}

function animateDonut(root, key) {
  if (key === lastDonutKey) return;
  lastDonutKey = key;
  const segs = $$('.donut .seg', root);
  segs.forEach((s) => { s.style.transition = 'none'; s.setAttribute('stroke-dasharray', `0 ${DONUT_C}`); });
  requestAnimationFrame(() => requestAnimationFrame(() => segs.forEach((s) => {
    s.style.transition = '';
    s.setAttribute('stroke-dasharray', `${s.dataset.dash} ${DONUT_C}`);
  })));
}

// ---------- Pregled ----------
async function renderPregled() {
  const m = state.month;
  const prev = addMonths(m, -1);
  const from = isoDate(prev);
  const to = isoDate(addMonths(m, 1));
  let incomeError = null;
  const [expRows, incRows] = await Promise.all([
    db.list('expense', from, to),
    // ako tablica za prihode još nije napravljena, pregled troškova i dalje radi
    db.list('income', from, to).catch((e) => { incomeError = e; return []; }),
  ]);
  if (state.view !== 'pregled') return;

  const mFrom = isoDate(m);
  const now = new Date();
  const isCurrent = m.getTime() === monthStart(now).getTime();
  const curOf = (rows) => rows.filter((r) => r.date >= mFrom);
  const income = sum(curOf(incRows));
  const spent = sum(curOf(expRows));

  // ----- Bilanca: prihodi − troškovi -----
  const balance = income - spent;
  let balanceBody;
  if (incomeError) {
    balanceBody = `<div class="sub">${esc(errorText(incomeError))}</div>`;
  } else if (income === 0) {
    balanceBody = `<div class="sub">Za ovaj mjesec još nema prihoda. Dodaj ih na kartici <b>Prihod</b> pa ćeš ovdje vidjeti koliko ti ostaje.</div>`;
  } else {
    const pct = Math.round((spent / income) * 100);
    balanceBody = `
      <div class="meter ${pct > 100 ? 'over' : ''}"><i style="width:${Math.min(pct, 100)}%"></i></div>
      <div class="sub">${pct > 100
        ? `Potrošio si ${pct - 100}% više nego što si zaradio.`
        : `Potrošio si ${pct}% prihoda.`}</div>`;
  }

  // ----- Detalji za odabranu vrstu (troškovi ili prihodi) -----
  const kind = state.overviewKind;
  const K = KINDS[kind];
  const rows = kind === 'income' ? incRows : expRows;
  const cur = curOf(rows);
  const prevRows = rows.filter((r) => r.date < mFrom);
  const total = sum(cur);

  // Usporedba: za tekući mjesec gleda isto razdoblje prošlog mjeseca (1. – današnji dan)
  const cutoff = isCurrent ? `${isoDate(prev).slice(0, 8)}${pad(now.getDate())}` : null;
  const prevTotal = sum(cutoff ? prevRows.filter((r) => r.date <= cutoff) : prevRows);
  const daysElapsed = isCurrent ? now.getDate() : daysIn(m);
  let delta = '';
  if (prevTotal > 0 && total > 0) {
    const pct = Math.round(((total - prevTotal) / prevTotal) * 100);
    const span = isCurrent ? 'isto razdoblje prošlog mjeseca' : MONTHS[prev.getMonth()];
    const good = (pct > 0) === K.moreIsGood;
    delta = pct === 0
      ? `<div class="delta">Jednako kao ${span}</div>`
      : `<div class="delta ${good ? 'down' : 'up'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% ${pct > 0 ? 'više' : 'manje'} nego ${span} (${money(prevTotal)})</div>`;
  }

  const byCat = {};
  cur.forEach((r) => { byCat[r.category] = (byCat[r.category] || 0) + r.amount; });
  const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  const days = daysIn(m);
  const perDay = Array(days).fill(0);
  cur.forEach((r) => { perDay[Number(r.date.slice(8, 10)) - 1] += r.amount; });
  const maxDay = Math.max(...perDay, 1);
  const bars = perDay.map((val, i) => {
    const h = val > 0 ? Math.max(3, (val / maxDay) * 90) : 0;
    const isToday = isCurrent && i === now.getDate() - 1;
    return `<rect x="${i * 10 + 1.5}" y="${96 - h}" width="7" height="${h}" rx="2.5"
      fill="${isToday ? K.color : `color-mix(in srgb, ${K.color} 45%, var(--card))`}"><title>${i + 1}. — ${money(val)}</title></rect>`;
  }).join('');

  // Po računima (samo kad je praćenje uključeno)
  const accKey = (r) => (accById(r.account_id) ? r.account_id : 'none');
  const accLabel = (key) => (key === 'none' ? { name: 'Bez računa', short: '–', color: '#8E8E93' } : accById(key));
  let accList = [];
  if (tracking() && state.accounts.length) {
    const byAcc = {};
    cur.forEach((r) => { byAcc[accKey(r)] = (byAcc[accKey(r)] || 0) + r.amount; });
    accList = Object.entries(byAcc).sort((a, b) => b[1] - a[1]);
  }
  const maxAcc = accList[0]?.[1] || 1;
  if (!tracking()) state.filterAcc = null;

  const shown = cur.filter((r) => (!state.filterCat || r.category === state.filterCat)
    && (!state.filterAcc || accKey(r) === state.filterAcc));
  const groups = [];
  shown.forEach((r) => {
    const g = groups[groups.length - 1];
    if (g && g.date === r.date) g.rows.push(r);
    else groups.push({ date: r.date, rows: [r] });
  });
  const listHtml = groups.length ? groups.map((g) => `
      <div class="group-header"><span>${dayLabel(g.date)}</span><span>${K.sign}${money(sum(g.rows))}</span></div>
      <div class="group">${g.rows.map((r) => itemRow(kind, r)).join('')}</div>`).join('')
    : `<div class="group empty">${K.empty}</div>`;
  const filtered = !!(state.filterCat || state.filterAcc);

  // Dnevnik: odabrani dan u kalendaru (u tekućem mjesecu zadano je danas)
  if (!state.selDay || state.selDay.slice(0, 7) !== mFrom.slice(0, 7)) state.selDay = isCurrent ? today() : null;

  // Dijelovi i redoslijed koje je korisnik odabrao u Postavkama → Kartica Pregled
  const show = (key) => !state.user.settings.overviewHidden.includes(key);
  const nothing = !overviewParts().some((p) => show(p.key)) && !filtered;

  const parts = {
    balance: show('balance') ? `
    <div class="group total balance">
      <div class="k">Bilanca</div>
      <div class="big ${balance < 0 ? 'neg' : income > 0 ? 'pos' : ''}" data-count="${balance}" data-fmt="signed">${signed(balance)}</div>
      <div class="split">
        <div><span class="dot" style="background:var(--green)"></span>Prihodi<b class="pos">${money(income)}</b></div>
        <div><span class="dot" style="background:var(--tint)"></span>Troškovi<b>${money(spent)}</b></div>
      </div>
      ${balanceBody}
    </div>` : '',

    budgets: show('budgets') ? budgetCard(m, curOf(expRows), isCurrent) : '',

    total: show('total') ? `
    <div class="group total">
      <div class="k">${K.totalLabel}</div>
      <div class="big ${kind === 'income' && total > 0 ? 'pos' : ''}" data-count="${total}">${money(total)}</div>
      <div class="sub">${cur.length} ${cur.length === 1 ? 'unos' : 'unosa'} · prosjek ${money(total / daysElapsed)} dnevno</div>
      ${delta}
      <div class="chart">
        <svg viewBox="0 0 ${days * 10} 96" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>
        <div class="axis"><span>1.</span><span>${Math.ceil(days / 2)}.</span><span>${days}.</span></div>
      </div>
    </div>` : '',

    categories: catList.length && show('categories') ? `
    <div class="section-title"><span>${K.breakdown}</span></div>
    <div class="group">
      ${donutChart(kind, catList, total, `${monthName(m)}`)}
      ${catList.map(([id, val]) => {
        const c = cat(kind, id);
        return `
        <button type="button" class="row cat-row legend ${state.filterCat === id ? 'on' : ''} ${state.filterCat && state.filterCat !== id ? 'dim' : ''}" data-cat="${id}" style="--c:${c.color}">
          <span class="ico-sq">${c.icon}</span>
          <span class="main"><span class="top"><span>${esc(c.label)}<span class="p">${Math.round((val / total) * 100)}%</span></span><span>${money(val)}</span></span></span>
        </button>`;
      }).join('')}
    </div>` : '',

    accounts: accList.length && show('accounts') ? `
    <div class="section-title"><span>Po računima</span></div>
    <div class="group">
      ${accList.map(([key, val]) => {
        const a = accLabel(key);
        return `
        <button type="button" class="row cat-row acc-row ${state.filterAcc === key ? 'on' : ''}" data-acc="${key}" style="--c:${a.color}">
          ${accBadge(a)}
          <span class="main">
            <span class="top"><span>${esc(a.name)}<span class="p">${Math.round((val / total) * 100)}%</span></span><span>${money(val)}</span></span>
            <span class="bar"><i style="width:${(val / maxAcc) * 100}%"></i></span>
          </span>
        </button>`;
      }).join('')}
    </div>` : '',

    // s uključenim filtrom (kategorija/račun) ovdje je popis filtriranih unosa, inače dnevnik
    journal: filtered ? `
    <div class="section-title">
      <span>${K.listTitle}</span>
      <span class="chips">
        ${state.filterCat ? `<button type="button" class="filter-chip" id="clear-cat">${cat(kind, state.filterCat).icon} ${esc(cat(kind, state.filterCat).label)} <span class="x">✕</span></button>` : ''}
        ${state.filterAcc ? `<button type="button" class="filter-chip" id="clear-acc">${esc(accLabel(state.filterAcc)?.name)} <span class="x">✕</span></button>` : ''}
      </span>
    </div>
    ${listHtml}` : show('journal') ? `
    <div class="section-title"><span>Dnevnik</span></div>
    <div class="segmented" id="log-switch">
      <button type="button" data-log="kalendar">Kalendar</button>
      <button type="button" data-log="popis">Popis</button>
    </div>
    <div id="log"></div>` : '',
  };

  // Prekidač Troškovi | Prihodi ide ispred prvog dijela koji ga koristi
  const kindSwitch = `
    <div class="segmented" id="kind-switch">
      <button type="button" data-kind="expense" class="${kind === 'expense' ? 'on' : ''}">Troškovi</button>
      <button type="button" data-kind="income" class="${kind === 'income' ? 'on' : ''}">Prihodi</button>
    </div>`;
  let switchPlaced = false;
  const body = overviewOrder().map((key) => {
    if (!parts[key]) return '';
    if (KIND_PARTS.includes(key) && !switchPlaced) {
      switchPlaced = true;
      return kindSwitch + parts[key];
    }
    return parts[key];
  }).join('');

  const v = $('#view');
  v.innerHTML = `
    <div class="month-nav">
      <button type="button" id="prev-m" aria-label="Prethodni mjesec">${CHEVRON_L}</button>
      <span class="m">${monthName(m)} ${m.getFullYear()}.</span>
      <button type="button" id="next-m" aria-label="Sljedeći mjesec" ${isCurrent ? 'disabled' : ''}>${CHEVRON_R}</button>
    </div>

    ${nothing ? `<div class="group empty">Svi dijelovi Pregleda su skriveni.<br>
      <button type="button" class="btn-plain" id="go-layout">Odaberi što prikazati</button></div>` : ''}

    ${body}
  `;
  $('#go-layout')?.addEventListener('click', openOverviewLayout);

  const resetFilters = () => { state.filterCat = null; state.filterAcc = null; };
  $('#prev-m').addEventListener('click', () => changeMonth(-1));
  $('#next-m').addEventListener('click', () => changeMonth(1));
  $('#clear-cat')?.addEventListener('click', () => { state.filterCat = null; render(); });
  $('#clear-acc')?.addEventListener('click', () => { state.filterAcc = null; render(); });
  $$('#kind-switch button', v).forEach((b) => b.addEventListener('click', () => {
    if (state.overviewKind === b.dataset.kind) return;
    state.overviewKind = b.dataset.kind;
    resetFilters();
    render();
  }));
  $$('.cat-row[data-cat]', v).forEach((b) => b.addEventListener('click', () => {
    state.filterCat = state.filterCat === b.dataset.cat ? null : b.dataset.cat;
    render();
  }));
  $$('.donut .seg[data-cat]', v).forEach((s) => s.addEventListener('click', () => {
    state.filterCat = state.filterCat === s.dataset.cat ? null : s.dataset.cat;
    render();
  }));
  animateDonut(v, `${isoDate(m)}|${kind}`);
  countUp(v);
  $$('.acc-row', v).forEach((b) => b.addEventListener('click', () => {
    state.filterAcc = state.filterAcc === b.dataset.acc ? null : b.dataset.acc;
    render();
  }));

  if (filtered) {
    wireItems(kind, v, cur);
  } else {
    // Dnevnik se osvježava lokalno (bez novog učitavanja) kod odabira dana ili prebacivanja prikaza
    const ctx = { m, kind, cur, listHtml, exp: curOf(expRows), inc: curOf(incRows) };
    $$('#log-switch button', v).forEach((b) => b.addEventListener('click', () => {
      state.logView = b.dataset.log;
      renderLog(ctx);
    }));
    renderLog(ctx);
  }
}

// ---------- Dnevnik: kalendar ili popis ----------
const WEEK_SHORT = ['P', 'U', 'S', 'Č', 'P', 'S', 'N'];
// Kratki iznos za ćeliju kalendara: 24, 245, 1,2k
const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '').replace('.', ',')}k` : String(Math.round(n)));

// Mijenja mjesec za cijeli Pregled. Iz kalendara (keepCalendar) zadržava kalendar na istom mjestu na ekranu.
let changingMonth = false;
async function changeMonth(delta, keepCalendar = false) {
  const next = addMonths(state.month, delta);
  if (changingMonth || next > monthStart(new Date())) return;
  changingMonth = true;
  const before = keepCalendar ? $('.cal')?.getBoundingClientRect().top : null;
  state.month = next;
  state.filterCat = null;
  state.filterAcc = null;
  state.calAnim = keepCalendar ? (delta > 0 ? 'from-right' : 'from-left') : null;
  state.countNext = true;
  try {
    await render();
    const after = $('.cal')?.getBoundingClientRect().top;
    if (before != null && after != null) window.scrollBy(0, after - before);
  } finally {
    changingMonth = false;
  }
}

function calendarHtml(m, exp, inc) {
  const days = daysIn(m);
  const lead = (new Date(m.getFullYear(), m.getMonth(), 1).getDay() + 6) % 7; // tjedan počinje ponedjeljkom
  const e = Array(days + 1).fill(0);
  const i = Array(days + 1).fill(0);
  exp.forEach((r) => { e[Number(r.date.slice(8, 10))] += r.amount; });
  inc.forEach((r) => { i[Number(r.date.slice(8, 10))] += r.amount; });
  const max = Math.max(...e, 1);
  const t = today();
  const prefix = isoDate(m).slice(0, 8);

  let cells = '<span></span>'.repeat(lead);
  for (let d = 1; d <= days; d++) {
    const iso = prefix + pad(d);
    // jačina boje prati koliko je potrošeno tog dana
    const heat = e[d] > 0 ? Math.round(10 + (e[d] / max) * 45) : 0;
    cells += `
      <button type="button" class="day ${iso === t ? 'today' : ''} ${iso === state.selDay ? 'sel' : ''} ${iso > t ? 'future' : ''}"
        data-day="${iso}" style="--heat:${heat}%" aria-label="${d}. — ${money(e[d])}">
        <span class="dn">${d}</span>
        <span class="da">${e[d] > 0 ? compact(e[d]) : ''}</span>
        ${i[d] > 0 ? '<span class="di"></span>' : ''}
      </button>`;
  }
  const isCurrent = m.getTime() === monthStart(new Date()).getTime();
  const anim = state.calAnim || '';
  state.calAnim = null; // animacija samo jednom, ne kod odabira dana
  return `
    <div class="group cal">
      <div class="cal-head">
        <span class="cal-title">${monthName(m)} ${m.getFullYear()}.</span>
        <span class="cal-nav">
          <button type="button" class="cal-prev" aria-label="Prethodni mjesec">${CHEVRON_L}</button>
          <button type="button" class="cal-next" aria-label="Sljedeći mjesec" ${isCurrent ? 'disabled' : ''}>${CHEVRON_R}</button>
        </span>
      </div>
      <div class="wk">${WEEK_SHORT.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="grid ${anim}">${cells}</div>
      <div class="cal-legend"><span><i class="lg-heat"></i>potrošeno (€)</span><span><i class="di"></i>prihod</span></div>
    </div>`;
}

function dayHtml(iso, exp, inc) {
  if (!iso) return '<div class="group empty">Dodirni dan u kalendaru da vidiš njegove troškove i prihode.</div>';
  const de = exp.filter((r) => r.date === iso);
  const di = inc.filter((r) => r.date === iso);
  const totals = [de.length ? `−${money(sum(de))}` : '', di.length ? `<span class="pos">+${money(sum(di))}</span>` : '']
    .filter(Boolean).join(' · ');
  const rows = [...di.map((r) => itemRow('income', r)), ...de.map((r) => itemRow('expense', r))];
  return `
    <div class="group-header"><span>${dayLabel(iso)}</span><span>${totals}</span></div>
    ${rows.length ? `<div class="group">${rows.join('')}</div>` : '<div class="group empty">Nema unosa za ovaj dan.</div>'}`;
}

function renderLog(ctx) {
  const el = $('#log');
  if (!el) return;
  $$('#log-switch button').forEach((b) => b.classList.toggle('on', b.dataset.log === state.logView));
  if (state.logView === 'popis') {
    el.innerHTML = ctx.listHtml;
    wireItems(ctx.kind, el, ctx.cur);
    return;
  }
  el.innerHTML = `${calendarHtml(ctx.m, ctx.exp, ctx.inc)}<div id="day-detail">${dayHtml(state.selDay, ctx.exp, ctx.inc)}</div>`;
  $$('.day', el).forEach((b) => b.addEventListener('click', () => {
    state.selDay = b.dataset.day;
    renderLog(ctx);
  }));
  $('.cal-prev', el).addEventListener('click', () => changeMonth(-1, true));
  $('.cal-next', el).addEventListener('click', () => changeMonth(1, true));

  // Povlačenje prstom lijevo/desno po kalendaru mijenja mjesec
  const cal = $('.cal', el);
  let sx = 0;
  let sy = 0;
  cal.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  cal.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) changeMonth(dx < 0 ? 1 : -1, true);
  }, { passive: true });
  $$('.item', el).forEach((b) => b.addEventListener('click', () => {
    const rows = b.dataset.kind === 'income' ? ctx.inc : ctx.exp;
    const r = rows.find((x) => x.id === b.dataset.id);
    if (r) openEdit(b.dataset.kind, r);
  }));
}

// ---------- Postavke ----------
function renderPostavke() {
  const v = $('#view');
  const def = state.user.settings.defaultAccount;
  const shownParts = overviewParts().filter((p) => !state.user.settings.overviewHidden.includes(p.key)).length;
  v.innerHTML = `
    <div class="group-header"><span>Prikaz</span></div>
    <div class="group">
      <button type="button" class="row" id="overview-layout" style="--sep-left:60px">
        <span class="ico-sq" style="--c:var(--tint)">📊</span>
        <span class="label">Kartica Pregled</span>
        <span class="value">${shownParts} od ${overviewParts().length}</span><span class="chev"></span>
      </button>
    </div>

    <div class="group-header"><span>Kategorije</span></div>
    <div class="group">
      <button type="button" class="row" id="cats-expense" style="--sep-left:60px">
        <span class="ico-sq" style="--c:var(--tint)">🛒</span>
        <span class="label">Kategorije troškova</span>
        <span class="value">${visibleCats('expense').length}</span><span class="chev"></span>
      </button>
      <button type="button" class="row" id="cats-income" style="--sep-left:60px">
        <span class="ico-sq" style="--c:var(--green)">💼</span>
        <span class="label">Kategorije prihoda</span>
        <span class="value">${visibleCats('income').length}</span><span class="chev"></span>
      </button>
    </div>
    <div class="group-footer">Dodaj svoje kategorije, promijeni naziv, ikonu ili boju i sakrij one koje ne koristiš.</div>

    <div class="group-header"><span>Računi i kartice</span></div>
    <div class="group">
      <label class="row"><span class="label">Prati račune</span>
        <input type="checkbox" class="switch" id="track-toggle" ${tracking() ? 'checked' : ''}></label>
    </div>
    <div class="group-footer">Uz svaki trošak i prihod možeš odabrati račun ili karticu — npr. ZABA, PBZ, Revolut ili gotovinu — i u Pregledu vidjeti koliko ide s kojeg.</div>

    ${tracking() ? `
    <div class="group">
      ${state.accounts.map((a) => `
        <button type="button" class="row acc-item" data-id="${a.id}">
          ${accBadge(a)}
          <span class="label">${esc(a.name)}</span>
          ${a.id === def ? '<span class="value">Zadani</span>' : ''}
          <span class="chev"></span>
        </button>`).join('')}
      <button type="button" class="row tinted add-acc" id="add-acc"><span class="plus-ico">+</span><span class="label">Dodaj račun</span></button>
    </div>` : ''}

    ${recurringSection()}

    <div class="group-header"><span>Budžeti</span></div>
    <div class="group">
      <label class="row"><span class="label">Prati budžete</span>
        <input type="checkbox" class="switch" id="budget-toggle" ${budgeting() ? 'checked' : ''}></label>
    </div>
    <div class="group-footer">Postavi mjesečni limit za ukupne troškove i pojedine kategorije. Vrijedi svaki mjesec i kreće ispočetka prvog u mjesecu.</div>

    ${budgeting() ? `
    <div class="group budget-form">
      ${budgetRow('total', '<span class="ico-sq" style="--c:var(--tint)">📊</span>', '<b>Ukupno mjesečno</b>')}
    </div>
    <div class="group-header"><span>Po kategorijama</span></div>
    <div class="group budget-form">
      ${allCats('expense').filter((c) => !c.hidden || state.user.settings.budgets.cats[c.id]).map((c) => budgetRow(c.id, `<span class="ico-sq" style="--c:${c.color}">${c.icon}</span>`, esc(c.label))).join('')}
    </div>
    <div class="group-footer">Ostavi prazno za kategorije koje ne želiš pratiti.</div>` : ''}


    <div class="group-header"><span>Korisnik</span></div>
    <div class="group">
      <div class="row"><span class="label">E-mail</span><span class="value">${esc(state.user?.email)}</span></div>
    </div>

    <div class="group-header"><span>Dodaj na početni zaslon</span></div>
    <div class="group">
      <div class="row"><span class="label">1. Otvori stranicu u Safariju</span></div>
      <div class="row"><span class="label">2. Dodirni <b>Dijeli</b> ⎋</span></div>
      <div class="row"><span class="label">3. Odaberi <b>Dodaj na početni zaslon</b></span></div>
    </div>
    ${db.isDemo ? '<div class="group-footer">Demo način: podaci su samo u ovom pregledniku.</div>' : ''}

    <div class="group">
      <button type="button" class="row center destructive" id="logout">Odjava</button>
    </div>
  `;
  $('#logout').addEventListener('click', async () => {
    try { await db.signOut(); } catch (e) { toast(errorText(e), true); }
  });

  const toggle = $('#track-toggle');
  toggle.addEventListener('change', async () => {
    const on = toggle.checked;
    toggle.disabled = true;
    try {
      if (on) {
        db.useAccounts(true);
        state.accounts = await db.listAccounts(); // ujedno provjera da postoji tablica
      }
      state.user.settings = await db.saveSettings({ trackAccounts: on });
      await loadAccounts();
      if (!on) state.filterAcc = null;
    } catch (e) {
      db.useAccounts(tracking());
      toast(errorText(e), true);
    }
    renderPostavke();
  });

  $('#add-acc')?.addEventListener('click', () => openAccount(null));
  $$('.acc-item', v).forEach((b) => b.addEventListener('click', () => openAccount(accById(b.dataset.id))));

  wireRecurringSection(v);
  $('#overview-layout').addEventListener('click', openOverviewLayout);
  $('#cats-expense').addEventListener('click', () => openCategories('expense'));
  $('#cats-income').addEventListener('click', () => openCategories('income'));

  const btoggle = $('#budget-toggle');
  btoggle.addEventListener('change', async () => {
    btoggle.disabled = true;
    try {
      state.user.settings = await db.saveSettings({ trackBudgets: btoggle.checked });
    } catch (e) { toast(errorText(e), true); }
    renderPostavke();
  });

  // Iznos se sprema kad korisnik završi s upisom (izađe iz polja)
  $$('.budget-input', v).forEach((inp) => {
    wireAmount(inp, false);
    inp.addEventListener('change', async () => {
      const budgets = { total: null, cats: {} };
      $$('.budget-input', v).forEach((x) => {
        const n = parseAmount(x.value);
        if (!(n > 0)) return;
        if (x.dataset.key === 'total') budgets.total = n;
        else budgets.cats[x.dataset.key] = n;
      });
      try {
        state.user.settings = await db.saveSettings({ budgets });
        toast('Budžet spremljen');
      } catch (e) { toast(errorText(e), true); }
    });
  });
}

// ---------- Postavke: prikaz kartice Pregled ----------
const OVERVIEW_PARTS = [
  { key: 'balance', icon: '⚖️', label: 'Bilanca', desc: 'Prihodi minus troškovi u mjesecu' },
  { key: 'budgets', icon: '🎯', label: 'Budžeti', desc: 'Koliko ti je ostalo do limita', available: () => budgeting() },
  { key: 'total', icon: '📊', label: 'Ukupno i graf po danima', desc: 'Zbroj, dnevni prosjek i usporedba s prošlim mjesecom' },
  { key: 'categories', icon: '🍩', label: 'Po kategorijama', desc: 'Prsten i popis kategorija' },
  { key: 'accounts', icon: '💳', label: 'Po računima', desc: 'Koliko ide s kojeg računa', available: () => tracking() },
  { key: 'journal', icon: '🗓️', label: 'Dnevnik', desc: 'Kalendar i popis svih unosa' },
];
// dijelovi koji ovise o prekidaču Troškovi | Prihodi
const KIND_PARTS = ['total', 'categories', 'accounts', 'journal'];
// Redoslijed svih dijelova: spremljeni, a novi (koji nisu u spremljenom) na kraj
function overviewOrder() {
  const keys = OVERVIEW_PARTS.map((p) => p.key);
  const saved = state.user.settings.overviewOrder.filter((k) => keys.includes(k));
  return [...saved, ...keys.filter((k) => !saved.includes(k))];
}
// samo dijelovi koji imaju smisla (npr. budžeti tek kad su uključeni), po redoslijedu
const overviewParts = () => overviewOrder()
  .map((k) => OVERVIEW_PARTS.find((p) => p.key === k))
  .filter((p) => !p.available || p.available());

function openOverviewLayout() {
  const hidden = new Set(state.user.settings.overviewHidden);
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <div class="sheet-bar">
      <div class="grab"></div>
      <div class="bar-row">
        <span></span>
        <h2>Kartica Pregled</h2>
        <button type="button" class="right" id="o-done">Gotovo</button>
      </div>
    </div>
    <div class="group-header"><span>Prikaži i poredaj</span></div>
    <div class="group" id="layout-list">
      ${overviewParts().map((p) => `
        <label class="row layout-row" data-key="${p.key}">
          <span class="handle" aria-label="Povuci za promjenu redoslijeda"><i></i><i></i><i></i></span>
          <span class="ico-sq" style="--c:var(--tint)">${p.icon}</span>
          <span class="main"><span class="t">${p.label}</span><span class="s">${p.desc}</span></span>
          <input type="checkbox" class="switch" data-key="${p.key}" ${hidden.has(p.key) ? '' : 'checked'}>
        </label>`).join('')}
    </div>
    <div class="group-footer">Povuci ≡ gore ili dolje za promjenu redoslijeda. Isključeni dijelovi se ne prikazuju u Pregledu; podaci se ne brišu i uvijek ih možeš ponovno uključiti.</div>`;
  openSheet();

  wireReorder($('#layout-list'), async (visibleOrder) => {
    // dijelovi koji se trenutno ne nude (npr. budžeti isključeni) ostaju na svom mjestu
    let i = 0;
    const shown = new Set(visibleOrder);
    const order = overviewOrder().map((k) => (shown.has(k) ? visibleOrder[i++] : k));
    try {
      state.user.settings = await db.saveSettings({ overviewOrder: order });
    } catch (e) { toast(errorText(e), true); }
  });

  const close = () => { closeSheet(); render(); };
  $('#o-done').addEventListener('click', close);
  $$('.switch', sheet).forEach((sw) => sw.addEventListener('change', async () => {
    if (sw.checked) hidden.delete(sw.dataset.key); else hidden.add(sw.dataset.key);
    try {
      state.user.settings = await db.saveSettings({ overviewHidden: [...hidden] });
    } catch (e) {
      sw.checked = !sw.checked;
      toast(errorText(e), true);
    }
  }));
}

// ---------- Postavke: vlastite kategorije ----------
const CAT_EMOJI = ['🛒', '☕', '🍔', '🍺', '🚗', '⛽', '🚌', '🏠', '💡', '🎉', '🎬', '🎮', '👕', '💇', '💊', '🏋️', '📱', '💻', '🛍️', '✈️',
  '🎁', '🐶', '🧒', '📚', '🎓', '🚬', '🧾', '📦', '💼', '💰', '⭐', '🏷️'];
const CAT_COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#30B0C7', '#5AC8FA', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#A2845E', '#8E8E93'];

// Mijenja postavke kategorija jedne vrste i sprema ih uz profil
async function saveCatConf(kind, change) {
  const all = JSON.parse(JSON.stringify(state.user.settings.categories || {}));
  const conf = { custom: [], hidden: [], over: {}, order: [], ...(all[kind] || {}) };
  change(conf);
  all[kind] = conf;
  state.user.settings = await db.saveSettings({ categories: all });
}

function openCategories(kind) {
  const title = kind === 'income' ? 'Kategorije prihoda' : 'Kategorije troškova';
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <div class="sheet-bar">
      <div class="grab"></div>
      <div class="bar-row">
        <span></span>
        <h2>${title}</h2>
        <button type="button" class="right" id="c-done">Gotovo</button>
      </div>
    </div>
    <div class="group" id="cat-list">
      ${allCats(kind).map((c) => `
        <div class="row layout-row cat-manage ${c.hidden ? 'is-hidden' : ''}" data-key="${c.id}" style="--c:${c.color}">
          <span class="handle" aria-label="Povuci za promjenu redoslijeda"><i></i><i></i><i></i></span>
          <button type="button" class="cm-edit">
            <span class="ico-sq">${c.icon}</span>
            <span class="main"><span class="t">${esc(c.label)}</span><span class="s">${c.builtin ? 'ugrađena' : 'vlastita'}${c.hidden ? ' · skrivena' : ''}</span></span>
          </button>
          <input type="checkbox" class="switch" aria-label="Prikaži kod unosa" ${c.hidden ? '' : 'checked'}>
        </div>`).join('')}
      <button type="button" class="row tinted add-acc" id="c-add"><span class="plus-ico">+</span><span class="label">Nova kategorija</span></button>
    </div>
    <div class="group-footer">Dodirni kategoriju za promjenu naziva, ikone ili boje. Prekidač je skriva iz unosa; stari unosi ostaju u svojoj kategoriji. Povuci ≡ za redoslijed.</div>`;
  openSheet();

  const close = () => { closeSheet(); render(); };
  $('#c-done').addEventListener('click', close);
  $('#c-add').addEventListener('click', () => openCategoryEdit(kind, null));
  $$('.cm-edit', sheet).forEach((b) => b.addEventListener('click', () => {
    openCategoryEdit(kind, cat(kind, b.closest('.cat-manage').dataset.key));
  }));
  $$('.cat-manage .switch', sheet).forEach((sw) => sw.addEventListener('change', async () => {
    const row = sw.closest('.cat-manage');
    const id = row.dataset.key;
    if (!sw.checked && visibleCats(kind).length <= 1) {
      sw.checked = true;
      return toast('Barem jedna kategorija mora ostati vidljiva', true);
    }
    try {
      await saveCatConf(kind, (c) => {
        c.hidden = c.hidden.filter((x) => x !== id);
        if (!sw.checked) c.hidden.push(id);
      });
      row.classList.toggle('is-hidden', !sw.checked);
      $('.s', row).textContent = `${cat(kind, id).builtin ? 'ugrađena' : 'vlastita'}${sw.checked ? '' : ' · skrivena'}`;
    } catch (e) {
      sw.checked = !sw.checked;
      toast(errorText(e), true);
    }
  }));
  wireReorder($('#cat-list'), async (order) => {
    try { await saveCatConf(kind, (c) => { c.order = order; }); } catch (e) { toast(errorText(e), true); }
  });
}

// Nova (c = null) ili postojeća kategorija: naziv, ikona, boja
function openCategoryEdit(kind, c) {
  const isNew = !c;
  let icon = c?.icon || '🏷️';
  let color = c?.color || CAT_COLORS.at(6);
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <div class="sheet-bar">
      <div class="grab"></div>
      <div class="bar-row">
        <button type="button" class="left" id="ce-back">Natrag</button>
        <h2>${isNew ? 'Nova kategorija' : 'Uredi kategoriju'}</h2>
        <button type="submit" class="right" form="cat-form">Spremi</button>
      </div>
    </div>
    <form id="cat-form" novalidate>
      <div class="cat-preview"><span class="sq" id="ce-preview"></span></div>
      <div class="group">
        <label class="row"><input class="row-input" id="ce-name" placeholder="Naziv (npr. Teretana)" maxlength="24" value="${esc(c?.label)}" autocomplete="off"></label>
      </div>
      <div class="group-header"><span>Ikona</span></div>
      <div class="group">
        <div class="emoji-grid">${CAT_EMOJI.map((e) => `<button type="button" class="emoji-opt" data-e="${e}">${e}</button>`).join('')}</div>
        <label class="row"><span class="label">Ili upiši svoj emoji</span><input class="pill-select" id="ce-emoji" maxlength="8" autocomplete="off" style="width:64px;text-align:center"></label>
      </div>
      <div class="group-header"><span>Boja</span></div>
      <div class="group"><div class="row colors">
        ${CAT_COLORS.map((x) => `<button type="button" class="color-dot" data-c="${x}" style="--c:${x}" aria-label="Boja"></button>`).join('')}
      </div></div>
      ${isNew ? '' : c.builtin
        ? '<div class="group"><button type="button" class="row center tinted" id="ce-reset">Vrati izvorni naziv, ikonu i boju</button></div>'
        : '<div class="group"><button type="button" class="row center destructive" id="ce-del">Obriši kategoriju</button></div>'}
    </form>`;
  openSheet();

  const form = $('#cat-form');
  const refresh = () => {
    const p = $('#ce-preview');
    p.textContent = icon;
    p.style.setProperty('--c', color);
    $$('.emoji-opt', form).forEach((b) => b.classList.toggle('on', b.dataset.e === icon));
    $$('.color-dot', form).forEach((d) => d.classList.toggle('on', d.dataset.c === color));
  };
  refresh();
  $$('.emoji-opt', form).forEach((b) => b.addEventListener('click', () => { icon = b.dataset.e; $('#ce-emoji').value = ''; refresh(); }));
  $('#ce-emoji').addEventListener('input', (e) => { const g = firstGrapheme(e.target.value); if (g) { icon = g; refresh(); } });
  $$('.color-dot', form).forEach((d) => d.addEventListener('click', () => { color = d.dataset.c; refresh(); }));
  $('#ce-back').addEventListener('click', () => openCategories(kind));

  $('#ce-reset')?.addEventListener('click', async () => {
    try {
      await saveCatConf(kind, (conf) => { delete conf.over[c.id]; });
      toast('Vraćeno na izvorno');
      openCategories(kind);
    } catch (e) { toast(errorText(e), true); }
  });
  $('#ce-del')?.addEventListener('click', async () => {
    if (!confirm(`Obrisati kategoriju „${c.label}"? Unosi u njoj prikazivat će se kao „${cat(kind, 'ostalo').label}".`)) return;
    try {
      await saveCatConf(kind, (conf) => {
        conf.custom = conf.custom.filter((x) => x.id !== c.id);
        conf.hidden = conf.hidden.filter((x) => x !== c.id);
        conf.order = conf.order.filter((x) => x !== c.id);
      });
      toast('Kategorija obrisana');
      openCategories(kind);
    } catch (e) { toast(errorText(e), true); }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const label = $('#ce-name').value.trim();
    if (!label) { $('#ce-name').focus(); return toast('Upiši naziv kategorije', true); }
    if (allCats(kind).some((x) => x.id !== c?.id && x.label.toLowerCase() === label.toLowerCase())) {
      return toast('Kategorija s tim nazivom već postoji', true);
    }
    const look = cleanCat({ label, icon, color });
    try {
      await saveCatConf(kind, (conf) => {
        if (isNew) conf.custom.push({ id: `c${Date.now().toString(36)}`, ...look });
        else if (c.builtin) conf.over[c.id] = look;
        else conf.custom = conf.custom.map((x) => (x.id === c.id ? { ...x, ...look } : x));
      });
      toast(isNew ? 'Kategorija dodana' : 'Promjene spremljene');
      openCategories(kind);
    } catch (e) { toast(errorText(e), true); }
  });
}

// Promjena redoslijeda povlačenjem ručice ≡ (kao u iOS postavkama)
function wireReorder(list, onDone) {
  $$('.handle', list).forEach((h) => {
    h.addEventListener('click', (e) => e.preventDefault()); // ne prebacuj prekidač u istom retku
    h.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      const row = h.closest('.layout-row');
      const rows = $$('.layout-row', list);
      const from = rows.indexOf(row);
      const rects = rows.map((r) => r.getBoundingClientRect());
      const height = rects[from].height;
      const startY = ev.clientY;
      const minDy = rects[0].top - rects[from].top;
      const maxDy = rects[rects.length - 1].bottom - rects[from].bottom;
      let to = from;
      row.classList.add('dragging');
      try { h.setPointerCapture(ev.pointerId); } catch { /* prst je već podignut */ }

      const move = (e) => {
        const dy = Math.max(minDy, Math.min(maxDy, e.clientY - startY));
        row.style.transform = `translateY(${dy}px)`;
        const center = rects[from].top + height / 2 + dy;
        to = rects.findIndex((r) => center < r.bottom);
        if (to < 0) to = rects.length - 1;
        // ostali retci se razmaknu da naprave mjesta
        rows.forEach((r, i) => {
          if (r === row) return;
          let shift = 0;
          if (from < to && i > from && i <= to) shift = -height;
          if (from > to && i >= to && i < from) shift = height;
          r.style.transform = shift ? `translateY(${shift}px)` : '';
        });
      };
      const up = () => {
        h.removeEventListener('pointermove', move);
        h.removeEventListener('pointerup', up);
        h.removeEventListener('pointercancel', up);
        row.classList.remove('dragging');
        rows.forEach((r) => { r.style.transition = 'none'; r.style.transform = ''; });
        if (to !== from) {
          if (to > from) rows[to].after(row); else rows[to].before(row);
        }
        requestAnimationFrame(() => rows.forEach((r) => { r.style.transition = ''; }));
        if (to !== from) onDone($$('.layout-row', list).map((r) => r.dataset.key));
      };
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', up);
      h.addEventListener('pointercancel', up);
    });
  });
}

// ---------- Postavke: ponavljajući unosi ----------
function recurringSection() {
  const header = '<div class="group-header"><span>Ponavljajući unosi</span></div>';
  if (!state.recurringReady) {
    return `${header}<div class="group"><div class="row"><span class="label muted-text">Za ovu opciju jednom pokreni <b>supabase/recurring.sql</b> u Supabaseu.</span></div></div>`;
  }
  const rows = state.recurring.map((r) => {
    const c = cat(r.kind, r.category);
    const sub = [r.note ? esc(c.label) : null, `svakog ${r.day}.`, r.active ? null : 'pauzirano'].filter(Boolean).join(' · ');
    return `
      <button type="button" class="row item rec-item ${r.active ? '' : 'paused'}" data-id="${r.id}" style="--c:${c.color}">
        <span class="ico-sq">${c.icon}</span>
        <span class="main"><span class="t">${esc(r.note || c.label)}</span><span class="s">${sub}</span></span>
        <span class="amt ${r.kind === 'income' ? 'pos' : ''}">${KINDS[r.kind].sign}${money(r.amount)}</span>
        <span class="chev"></span>
      </button>`;
  }).join('');
  return `${header}
    <div class="group">
      ${rows}
      <button type="button" class="row tinted add-acc" id="add-rec"><span class="plus-ico">+</span><span class="label">Dodaj ponavljajući unos</span></button>
    </div>
    <div class="group-footer">Plaća, najam, pretplate… Dodaju se sami na zadani dan u mjesecu kad otvoriš aplikaciju. Ako mjesec ima manje dana, unos ide na zadnji dan.</div>`;
}

function wireRecurringSection(v) {
  $('#add-rec', v)?.addEventListener('click', () => openRecurring(null));
  $$('.rec-item', v).forEach((b) => b.addEventListener('click', () => openRecurring(state.recurring.find((r) => r.id === b.dataset.id))));
}

// Dodavanje (rule = null) ili uređivanje ponavljajućeg unosa
function openRecurring(rule, kind = rule?.kind || 'expense', draft = {}) {
  const isNew = !rule;
  let picked = draft.category ?? rule?.category ?? null;
  const amount = draft.amount ?? (rule ? rule.amount.toFixed(2).replace('.', ',') : '');
  const day = draft.day ?? rule?.day ?? new Date().getDate();
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <div class="sheet-bar">
      <div class="grab"></div>
      <div class="bar-row">
        <button type="button" class="left" id="r-cancel">Odustani</button>
        <h2>${isNew ? 'Novi ponavljajući' : 'Ponavljajući unos'}</h2>
        <button type="submit" class="right" form="rec-form">${isNew ? 'Dodaj' : 'Spremi'}</button>
      </div>
    </div>
    <form id="rec-form" novalidate>
      ${isNew ? `
      <div class="segmented" id="r-kind">
        <button type="button" data-kind="expense" class="${kind === 'expense' ? 'on' : ''}">Trošak</button>
        <button type="button" data-kind="income" class="${kind === 'income' ? 'on' : ''}">Prihod</button>
      </div>` : ''}
      ${amountGroup(kind, amount)}
      <div class="group"><div class="cats">${catButtons(kind, picked)}</div></div>
      <div class="group">
        <label class="row"><input class="row-input note" placeholder="Bilješka (npr. Netflix)" maxlength="100" value="${esc(draft.note ?? rule?.note)}" autocomplete="off"></label>
        <label class="row"><span class="label">Dan u mjesecu</span>
          <select class="pill-select r-day" aria-label="Dan u mjesecu">
            ${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${i + 1 === day ? 'selected' : ''}>${i + 1}.</option>`).join('')}
          </select></label>
        ${accountRow(rule?.account_id ?? accById(state.user.settings.defaultAccount)?.id)}
        ${isNew ? '' : `<label class="row"><span class="label">Aktivno</span><input type="checkbox" class="switch r-active" ${rule.active ? 'checked' : ''}></label>`}
      </div>
      <div class="group-footer">${isNew
        ? 'Prvi unos dodaje se na idući takav dan. Ako je unos za ovaj mjesec već prošao, a želiš ga, dodaj ga ručno s opcijom „Ponavljaj svaki mjesec".'
        : 'Promjene vrijede za buduće unose. Već dodani unosi ostaju kakvi jesu.'}</div>
      ${isNew ? '' : '<div class="group"><button type="button" class="row center destructive" id="r-del">Obriši ponavljajući unos</button></div>'}
    </form>`;
  openSheet();

  const form = $('#rec-form');
  wireFields(form);
  wireCats(form, (id) => { picked = id; });
  $('#r-cancel').addEventListener('click', closeSheet);

  // promjena vrste (trošak/prihod) mijenja kategorije, ostalo se zadržava
  $$('#r-kind button', form).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.kind === kind) return;
    openRecurring(null, b.dataset.kind, {
      amount: $('.amount', form).value, note: $('.note', form).value, day: Number($('.r-day', form).value),
    });
  }));

  $('#r-del')?.addEventListener('click', async () => {
    if (!confirm('Obrisati ponavljajući unos? Već dodani unosi ostaju.')) return;
    try {
      await db.removeRecurring(rule.id);
      state.recurring = state.recurring.filter((r) => r.id !== rule.id);
      closeSheet();
      toast('Obrisano');
      render();
    } catch (e) { toast(errorText(e), true); }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const amountVal = parseAmount($('.amount', form).value);
    if (!(amountVal > 0)) return toast('Upiši iznos', true);
    if (!picked) return toast('Odaberi kategoriju', true);
    const d = Number($('.r-day', form).value);
    const data = {
      amount: amountVal, category: picked, note: $('.note', form).value.trim() || null, day: d,
      account_id: tracking() ? ($('.account', form)?.value || null) : (rule?.account_id ?? null),
    };
    try {
      if (isNew) {
        const created = await db.addRecurring({ kind, ...data, start_month: isoDate(firstMonthFor(d)), last_month: null });
        state.recurring.push(created);
      } else {
        const active = $('.r-active', form).checked;
        // Nakon pauze kreće ispočetka, bez nadoknade propuštenih mjeseci
        if (active && !rule.active) Object.assign(data, { start_month: isoDate(firstMonthFor(d)), last_month: null });
        data.active = active;
        await db.updateRecurring(rule.id, data);
        Object.assign(rule, data);
      }
      closeSheet();
      toast(isNew ? 'Ponavljajući unos dodan' : 'Promjene spremljene');
      await runRecurring();
      render();
    } catch (e) { toast(errorText(e), true); }
  });
}

function budgetRow(key, icon, label) {
  const b = state.user.settings.budgets;
  const val = key === 'total' ? b.total : b.cats[key];
  return `
    <label class="row budget-row">
      ${icon}<span class="label">${label}</span>
      <span class="budget-pill"><input class="budget-input" data-key="${key}" inputmode="decimal" enterkeyhint="done"
        placeholder="—" value="${val ? String(val).replace('.', ',') : ''}" autocomplete="off" aria-label="Budžet"><span>€</span></span>
    </label>`;
}

// Dodavanje (a = null) ili uređivanje računa
function openAccount(a) {
  const isNew = !a;
  let color = a?.color || ACCOUNT_COLORS[5];
  let preset = null;
  const isDefault = !isNew && state.user.settings.defaultAccount === a.id;
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <div class="sheet-bar">
      <div class="grab"></div>
      <div class="bar-row">
        <button type="button" class="left" id="a-cancel">Odustani</button>
        <h2>${isNew ? 'Novi račun' : 'Uredi račun'}</h2>
        <button type="submit" class="right" form="acc-form">${isNew ? 'Dodaj' : 'Spremi'}</button>
      </div>
    </div>
    <form id="acc-form" novalidate>
      ${isNew ? `
      <div class="group-header"><span>Brzi odabir</span></div>
      <div class="group"><div class="cats presets">
        ${ACCOUNT_PRESETS.map((p, i) => `
          <button type="button" class="cat preset" data-i="${i}" style="--c:${p.color}">
            ${accBadge(p, 'big')}<span class="lbl">${esc(p.name)}</span>
          </button>`).join('')}
      </div></div>` : ''}
      <div class="group">
        <label class="row"><span id="a-preview">${accBadge({ name: a?.name || '?', short: a?.short, color })}</span>
          <input class="row-input" id="a-name" placeholder="Naziv (npr. ZABA tekući)" maxlength="40" value="${esc(a?.name)}" autocomplete="off"></label>
        <div class="row colors">
          ${ACCOUNT_COLORS.map((c) => `<button type="button" class="color-dot ${c === color ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="Boja"></button>`).join('')}
        </div>
      </div>
      <div class="group">
        <label class="row"><span class="label">Zadani račun</span><input type="checkbox" class="switch" id="a-default" ${isDefault ? 'checked' : ''}></label>
      </div>
      <div class="group-footer">Zadani račun je unaprijed odabran kod svakog novog unosa.</div>
      ${isNew ? '' : `<div class="group"><button type="button" class="row center destructive" id="a-del">Obriši račun</button></div>`}
    </form>`;
  openSheet();

  const form = $('#acc-form');
  const nameEl = $('#a-name');
  const shortFor = () => (preset && preset.name === nameEl.value.trim() ? preset.short
    : (!isNew && a.name === nameEl.value.trim() ? a.short : initials(nameEl.value)));
  const refresh = () => {
    $('#a-preview').innerHTML = accBadge({ name: nameEl.value || '?', short: shortFor(), color });
    $$('.color-dot', form).forEach((d) => d.classList.toggle('on', d.dataset.c === color));
  };
  nameEl.addEventListener('input', refresh);
  $$('.color-dot', form).forEach((d) => d.addEventListener('click', () => { color = d.dataset.c; refresh(); }));
  $$('.preset', form).forEach((b) => b.addEventListener('click', () => {
    preset = ACCOUNT_PRESETS[Number(b.dataset.i)];
    $$('.preset', form).forEach((x) => x.classList.toggle('on', x === b));
    nameEl.value = preset.name;
    color = preset.color;
    refresh();
  }));
  $('#a-cancel').addEventListener('click', closeSheet);

  $('#a-del')?.addEventListener('click', async () => {
    if (!confirm(`Obrisati račun „${a.name}"? Troškovi i prihodi ostaju, samo bez oznake računa.`)) return;
    try {
      await db.removeAccount(a.id);
      if (isDefault) state.user.settings = await db.saveSettings({ defaultAccount: null });
      await loadAccounts();
      closeSheet();
      toast('Račun obrisan');
      render();
    } catch (e) { toast(errorText(e), true); }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = nameEl.value.trim();
    if (!name) { nameEl.focus(); return toast('Upiši naziv računa', true); }
    if (isNew && state.accounts.some((x) => x.name.toLowerCase() === name.toLowerCase())) return toast('Račun s tim nazivom već postoji', true);
    const data = { name, short: shortFor(), color };
    try {
      const id = isNew ? (await db.addAccount(data)).id : (await db.updateAccount(a.id, data), a.id);
      const wantDefault = $('#a-default').checked;
      if (wantDefault !== isDefault) state.user.settings = await db.saveSettings({ defaultAccount: wantDefault ? id : null });
      await loadAccounts();
      closeSheet();
      toast(isNew ? 'Račun dodan' : 'Promjene spremljene');
      render();
    } catch (e) { toast(errorText(e), true); }
  });
}

// ---------- Uređivanje zapisa ----------
function openEdit(kind, r) {
  const K = KINDS[kind];
  let picked = r.category;
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <div class="sheet-bar">
      <div class="grab"></div>
      <div class="bar-row">
        <button type="button" class="left" id="e-cancel">Odustani</button>
        <h2>${K.editTitle}</h2>
        <button type="submit" class="right" form="edit-form">Spremi</button>
      </div>
    </div>
    <form id="edit-form" novalidate>
      ${entryFields(kind, { amount: r.amount.toFixed(2).replace('.', ','), category: picked, note: r.note, date: r.date, account: r.account_id })}
      <div class="group">
        <button type="button" class="row center destructive" id="e-del">${K.deleteLabel}</button>
      </div>
    </form>`;
  openSheet();

  const form = $('#edit-form');
  wireFields(form);
  wireCats(form, (id) => { picked = id; });
  $('#e-cancel').addEventListener('click', closeSheet);

  $('#e-del').addEventListener('click', async () => {
    if (!confirm(`Obrisati ${K.sign}${money(r.amount)} · ${cat(kind, r.category).label}?`)) return;
    try {
      await db.remove(kind, r.id);
      closeSheet();
      toast('Obrisano');
      render();
    } catch (e) { toast(errorText(e), true); }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fields = readFields(form);
    if (!(fields.amount > 0)) return toast('Upiši ispravan iznos', true);
    try {
      await db.update(kind, r.id, { ...fields, category: picked });
      closeSheet();
      toast('Promjene spremljene');
      render();
    } catch (e) { toast(errorText(e), true); }
  });
}

// Donji prozor: klizi gore kod otvaranja i dolje kod zatvaranja
let sheetTimer;
function openSheet() {
  clearTimeout(sheetTimer);
  const sheet = $('#sheet');
  const backdrop = $('#sheet-backdrop');
  sheet.classList.remove('closing');
  backdrop.classList.remove('closing');
  backdrop.hidden = false;
  sheet.hidden = false;
  sheet.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

function closeSheet() {
  const sheet = $('#sheet');
  const backdrop = $('#sheet-backdrop');
  document.body.style.overflow = '';
  const finish = () => {
    sheet.hidden = true;
    backdrop.hidden = true;
    sheet.classList.remove('closing');
    backdrop.classList.remove('closing');
    sheet.innerHTML = '';
  };
  if (sheet.hidden || reduceMotion()) return finish();
  sheet.classList.add('closing');
  backdrop.classList.add('closing');
  clearTimeout(sheetTimer);
  sheetTimer = setTimeout(finish, 260);
}
