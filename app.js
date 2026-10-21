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

const CAT_INDEX =Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, Object.fromEntries(v.cats.map((c) => [c.id, c]))]));
const cat = (kind, id) => CAT_INDEX[kind][id] || CAT_INDEX[kind].ostalo;

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
  if (/failed to fetch|network/i.test(msg)) return 'Nema veze s internetom.';
  if (isMissingTable(e) && /accounts|account_id/.test(msg)) return 'Tablica za račune još ne postoji — pokreni supabase/accounts.sql u Supabaseu.';
  if (isMissingTable(e)) return 'Tablica za prihode još ne postoji — pokreni supabase/incomes.sql u Supabaseu.';
  return msg || 'Nešto je pošlo po zlu.';
}

// Polje za iznos raste sa sadržajem pa je iznos uvijek centriran uz "€"
function wireAmount(input) {
  const fit = () => { input.style.width = `${Math.max((input.value || input.placeholder).length, 1) + 0.2}ch`; };
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
  pick: { expense: null, income: null },
  accounts: [],
};

const tracking = () => !!state.user?.settings?.trackAccounts;
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

  db.onAuthChange((event, user) => {
    if (event === 'PASSWORD_RECOVERY') return showRecovery();
    setUser(user);
  });
  setUser(await db.getUser());
}

function setUser(user) {
  if (state.recovering) return;
  const same = (state.user?.id ?? null) === (user?.id ?? null);
  state.user = user;
  if (same && state.started) return;
  state.started = true;
  if (user) { $('#auth').hidden = true; $('#app').hidden = false; loadAccounts().then(() => go('trosak')); }
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
  render();
}

async function render() {
  const view = state.view;
  try {
    if (view === 'trosak') await renderEntry('expense');
    else if (view === 'prihod') await renderEntry('income');
    else if (view === 'pregled') await renderPregled();
    else renderPostavke();
  } catch (e) {
    toast(errorText(e), true);
  }
}

// ---------- Zajednički dijelovi ----------
function catButtons(kind, selected) {
  return KINDS[kind].cats.map((c) => `
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
function entryFields(kind, { amount = '', category = null, note = '', date = today(), account = null } = {}) {
  let accountRow = '';
  if (tracking()) {
    accountRow = state.accounts.length
      ? `<label class="row"><span class="label">Račun</span>
          <select class="pill-select account" aria-label="Račun">
            <option value="">Bez računa</option>
            ${state.accounts.map((a) => `<option value="${a.id}" ${a.id === account ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
          </select></label>`
      : `<button type="button" class="row go-accounts"><span class="label">Račun</span><span class="value tinted">Dodaj u postavkama</span><span class="chev"></span></button>`;
  }
  return `
    <div class="group amount-group">
      <label class="amount-line">
        ${kind === 'income' ? '<span class="cur sign">+</span>' : ''}
        <input class="amount" inputmode="decimal" placeholder="0,00" value="${esc(amount)}" autocomplete="off" enterkeyhint="done" aria-label="Iznos">
        <span class="cur">€</span>
      </label>
    </div>
    <div class="group"><div class="cats">${catButtons(kind, category)}</div></div>
    <div class="group">
      <label class="row"><input class="row-input note" placeholder="Bilješka (neobavezno)" maxlength="100" value="${esc(note)}" autocomplete="off"></label>
      <label class="row"><span class="label">Datum</span><input class="pill-date date" type="date" value="${date}" max="${today()}" aria-label="Datum"></label>
      ${accountRow}
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
    <button class="row item" data-id="${r.id}" style="--c:${c.color}">
      <span class="ico-sq">${c.icon}</span>
      <span class="main"><span class="t">${esc(c.label)}</span>${sub ? `<span class="s">${sub}</span>` : ''}</span>
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
      ${entryFields(kind, { category: state.pick[kind], account: accById(state.user.settings.defaultAccount)?.id })}
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
      await db.add(kind, { ...fields, category });
      toast(`${cat(kind, category).icon}  ${KINDS[kind].sign}${money(amount)} spremljeno`);
      state.pick[kind] = null;
      window.scrollTo(0, 0);
      await renderEntry(kind);
    } catch (e) {
      toast(errorText(e), true);
      btn.disabled = false;
    }
  });

  const m = monthStart(new Date());
  const from = isoDate(m);
  const to = isoDate(addMonths(m, 1));
  const [monthRows, recent, other] = await Promise.all([
    db.list(kind, from, to),
    db.listRecent(kind, 8),
    kind === 'income' ? db.list('expense', from, to) : null,
  ]);
  if (state.view !== view) return;

  let stats;
  if (kind === 'expense') {
    stats = `
      <div class="stat"><div class="k">Danas</div><div class="v">${money(sum(monthRows.filter((r) => r.date === today())))}</div></div>
      <div class="stat"><div class="k">${monthName(m)}</div><div class="v">${money(sum(monthRows))}</div></div>`;
  } else {
    const balance = sum(monthRows) - sum(other);
    stats = `
      <div class="stat"><div class="k">Prihodi · ${MONTHS[m.getMonth()]}</div><div class="v pos">${money(sum(monthRows))}</div></div>
      <div class="stat"><div class="k">Bilanca</div><div class="v ${balance < 0 ? 'neg' : ''}">${signed(balance)}</div></div>`;
  }

  $('#entry-extra').innerHTML = `
    <div class="stats">${stats}</div>
    <div class="section-title"><span>Zadnji unosi</span></div>
    ${recent.length
      ? `<div class="group">${recent.map((r) => itemRow(kind, r, true)).join('')}</div>`
      : `<div class="group empty">${kind === 'income' ? 'Još nema prihoda. Upiši plaću ili drugi prihod gore.' : 'Još nema unosa. Upiši prvi trošak gore.'}</div>`}`;
  wireItems(kind, $('#entry-extra'), recent);
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

  const v = $('#view');
  v.innerHTML = `
    <div class="month-nav">
      <button type="button" id="prev-m" aria-label="Prethodni mjesec">${CHEVRON_L}</button>
      <span class="m">${monthName(m)} ${m.getFullYear()}.</span>
      <button type="button" id="next-m" aria-label="Sljedeći mjesec" ${isCurrent ? 'disabled' : ''}>${CHEVRON_R}</button>
    </div>

    <div class="group total balance">
      <div class="k">Bilanca</div>
      <div class="big ${balance < 0 ? 'neg' : income > 0 ? 'pos' : ''}">${signed(balance)}</div>
      <div class="split">
        <div><span class="dot" style="background:var(--green)"></span>Prihodi<b class="pos">${money(income)}</b></div>
        <div><span class="dot" style="background:var(--tint)"></span>Troškovi<b>${money(spent)}</b></div>
      </div>
      ${balanceBody}
    </div>

    <div class="segmented" id="kind-switch">
      <button type="button" data-kind="expense" class="${kind === 'expense' ? 'on' : ''}">Troškovi</button>
      <button type="button" data-kind="income" class="${kind === 'income' ? 'on' : ''}">Prihodi</button>
    </div>

    <div class="group total">
      <div class="k">${K.totalLabel}</div>
      <div class="big ${kind === 'income' && total > 0 ? 'pos' : ''}">${money(total)}</div>
      <div class="sub">${cur.length} ${cur.length === 1 ? 'unos' : 'unosa'} · prosjek ${money(total / daysElapsed)} dnevno</div>
      ${delta}
      <div class="chart">
        <svg viewBox="0 0 ${days * 10} 96" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>
        <div class="axis"><span>1.</span><span>${Math.ceil(days / 2)}.</span><span>${days}.</span></div>
      </div>
    </div>

    ${catList.length ? `
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
    </div>` : ''}

    ${accList.length ? `
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
    </div>` : ''}

    <div class="section-title">
      <span>${K.listTitle}</span>
      <span class="chips">
        ${state.filterCat ? `<button type="button" class="filter-chip" id="clear-cat">${cat(kind, state.filterCat).icon} ${esc(cat(kind, state.filterCat).label)} <span class="x">✕</span></button>` : ''}
        ${state.filterAcc ? `<button type="button" class="filter-chip" id="clear-acc">${esc(accLabel(state.filterAcc)?.name)} <span class="x">✕</span></button>` : ''}
      </span>
    </div>
    ${groups.length ? groups.map((g) => `
      <div class="group-header"><span>${dayLabel(g.date)}</span><span>${K.sign}${money(sum(g.rows))}</span></div>
      <div class="group">${g.rows.map((r) => itemRow(kind, r)).join('')}</div>`).join('')
      : `<div class="group empty">${K.empty}</div>`}
  `;

  const resetFilters = () => { state.filterCat = null; state.filterAcc = null; };
  $('#prev-m').addEventListener('click', () => { state.month = addMonths(state.month, -1); resetFilters(); render(); });
  $('#next-m').addEventListener('click', () => { state.month = addMonths(state.month, 1); resetFilters(); render(); });
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
  $$('.acc-row', v).forEach((b) => b.addEventListener('click', () => {
    state.filterAcc = state.filterAcc === b.dataset.acc ? null : b.dataset.acc;
    render();
  }));
  wireItems(kind, v, cur);
}

// ---------- Postavke ----------
function renderPostavke() {
  const v = $('#view');
  const def = state.user.settings.defaultAccount;
  v.innerHTML = `
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
  $('#sheet-backdrop').hidden = false;
  sheet.hidden = false;
  sheet.scrollTop = 0;
  document.body.style.overflow = 'hidden';

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
  $('#sheet-backdrop').hidden = false;
  sheet.hidden = false;
  sheet.scrollTop = 0;
  document.body.style.overflow = 'hidden';

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

function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheet-backdrop').hidden = true;
  $('#sheet').innerHTML = '';
  document.body.style.overflow = '';
}
