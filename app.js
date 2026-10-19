import * as db from './db.js';

// ---------- Kategorije ----------
// id se sprema u bazu — ne mijenjaj postojeće id-jeve, slobodno mijenjaj nazive, ikone i boje.
const CATEGORIES = [
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
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
const cat = (id) => CAT[id] || CAT.ostalo;

const MONTHS = ['siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj',
  'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'];
const WEEKDAYS = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];

// ---------- Pomoćne funkcije ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmt = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' });
const money = (n) => fmt.format(n);
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

function errorText(e) {
  const code = e?.code || '';
  const msg = String(e?.message || e || '');
  if (code === 'invalid_credentials' || /invalid login/i.test(msg)) return 'Pogrešan e-mail ili lozinka.';
  if (code === 'email_not_confirmed' || /not confirmed/i.test(msg)) return 'E-mail još nije potvrđen — otvori poveznicu koju smo ti poslali.';
  if (code === 'user_already_exists' || /already registered/i.test(msg)) return 'Račun s tim e-mailom već postoji. Prijavi se.';
  if (code === 'weak_password' || /password should be/i.test(msg)) return 'Lozinka mora imati barem 6 znakova.';
  if (/rate limit|too many/i.test(msg)) return 'Previše pokušaja. Pričekaj malo pa pokušaj ponovno.';
  if (/failed to fetch|network/i.test(msg)) return 'Nema veze s internetom.';
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
  view: 'unos',
  month: monthStart(new Date()),
  filterCat: null,
  addCat: null,
};

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
  if (user) { $('#auth').hidden = true; $('#app').hidden = false; go('unos'); }
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
      <h1>${isReset ? 'Nova lozinka' : 'Troškovi'}</h1>
      <p>${isReset ? 'Poslat ćemo ti poveznicu za novu lozinku.' : 'Zapiši svaku potrošnju u par sekundi.'}</p>
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
const TITLES = { unos: 'Novi trošak', pregled: 'Pregled', postavke: 'Račun' };

function go(view) {
  state.view = view;
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
    if (view === 'unos') await renderUnos();
    else if (view === 'pregled') await renderPregled();
    else renderRacun();
  } catch (e) {
    toast(errorText(e), true);
  }
}

// ---------- Zajednički dijelovi ----------
function catButtons(selected) {
  return CATEGORIES.map((c) => `
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
function expenseFields({ amount = '', category = null, note = '', date = today() } = {}) {
  return `
    <div class="group amount-group">
      <label class="amount-line">
        <input class="amount" inputmode="decimal" placeholder="0,00" value="${esc(amount)}" autocomplete="off" enterkeyhint="done" aria-label="Iznos">
        <span class="cur">€</span>
      </label>
    </div>
    <div class="group"><div class="cats">${catButtons(category)}</div></div>
    <div class="group">
      <label class="row"><input class="row-input note" placeholder="Bilješka (neobavezno)" maxlength="100" value="${esc(note)}" autocomplete="off"></label>
      <label class="row"><span class="label">Datum</span><input class="pill-date date" type="date" value="${date}" max="${today()}" aria-label="Datum"></label>
    </div>`;
}

function itemRow(r, showDate = false) {
  const c = cat(r.category);
  const sub = [showDate ? dayLabel(r.spent_at) : null, r.note ? esc(r.note) : null].filter(Boolean).join(' · ');
  return `
    <button class="row item" data-id="${r.id}" style="--c:${c.color}">
      <span class="ico-sq">${c.icon}</span>
      <span class="main"><span class="t">${esc(c.label)}</span>${sub ? `<span class="s">${sub}</span>` : ''}</span>
      <span class="amt">${money(r.amount)}</span>
      <span class="chev"></span>
    </button>`;
}

function wireItems(root, rows) {
  $$('.item', root).forEach((b) => b.addEventListener('click', () => {
    const r = rows.find((x) => x.id === b.dataset.id);
    if (r) openEdit(r);
  }));
}

// ---------- Unos ----------
async function renderUnos() {
  const v = $('#view');
  // Forma se prikaže odmah; brojke i zadnji unosi stignu kad se učitaju.
  v.innerHTML = `
    <form id="add-form" novalidate>
      ${expenseFields({ category: state.addCat })}
      <button class="btn-filled" type="submit">Spremi</button>
    </form>
    <div id="unos-extra"></div>`;

  const form = $('#add-form');
  const amountEl = $('.amount', form);
  wireAmount(amountEl);
  wireCats(form, (id) => { state.addCat = id; });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const amount = parseAmount(amountEl.value);
    if (!(amount > 0)) { amountEl.focus(); return toast('Upiši iznos', true); }
    if (!state.addCat) return toast('Odaberi kategoriju', true);
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      await db.addExpense({
        amount,
        category: state.addCat,
        note: $('.note', form).value.trim() || null,
        spent_at: $('.date', form).value || today(),
      });
      toast(`${cat(state.addCat).icon}  ${money(amount)} spremljeno`);
      state.addCat = null;
      window.scrollTo(0, 0);
      await renderUnos();
    } catch (e) {
      toast(errorText(e), true);
      btn.disabled = false;
    }
  });

  const m = monthStart(new Date());
  const [monthRows, recent] = await Promise.all([
    db.listExpenses(isoDate(m), isoDate(addMonths(m, 1))),
    db.listRecent(8),
  ]);
  if (state.view !== 'unos') return;
  const t = today();
  $('#unos-extra').innerHTML = `
    <div class="stats">
      <div class="stat"><div class="k">Danas</div><div class="v">${money(sum(monthRows.filter((r) => r.spent_at === t)))}</div></div>
      <div class="stat"><div class="k">${monthName(m)}</div><div class="v">${money(sum(monthRows))}</div></div>
    </div>
    <div class="section-title"><span>Zadnji unosi</span></div>
    ${recent.length
      ? `<div class="group">${recent.map((r) => itemRow(r, true)).join('')}</div>`
      : '<div class="group empty">Još nema unosa. Upiši prvi trošak gore.</div>'}`;
  wireItems($('#unos-extra'), recent);
}

// ---------- Pregled ----------
async function renderPregled() {
  const m = state.month;
  const prev = addMonths(m, -1);
  const rows = await db.listExpenses(isoDate(prev), isoDate(addMonths(m, 1)));
  if (state.view !== 'pregled') return;

  const mFrom = isoDate(m);
  const cur = rows.filter((r) => r.spent_at >= mFrom);
  const prevRows = rows.filter((r) => r.spent_at < mFrom);
  const now = new Date();
  const isCurrent = m.getTime() === monthStart(now).getTime();
  const total = sum(cur);

  // Usporedba: za tekući mjesec gleda isto razdoblje prošlog mjeseca (1. – današnji dan)
  const cutoff = isCurrent ? `${isoDate(prev).slice(0, 8)}${pad(now.getDate())}` : null;
  const prevTotal = sum(cutoff ? prevRows.filter((r) => r.spent_at <= cutoff) : prevRows);
  const daysElapsed = isCurrent ? now.getDate() : daysIn(m);
  let delta = '';
  if (prevTotal > 0 && total > 0) {
    const pct = Math.round(((total - prevTotal) / prevTotal) * 100);
    const span = isCurrent ? 'isto razdoblje prošlog mjeseca' : MONTHS[prev.getMonth()];
    delta = pct === 0
      ? `<div class="delta">Jednako kao ${span}</div>`
      : `<div class="delta ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% ${pct > 0 ? 'više' : 'manje'} nego ${span} (${money(prevTotal)})</div>`;
  }

  // Po kategorijama
  const byCat = {};
  cur.forEach((r) => { byCat[r.category] = (byCat[r.category] || 0) + r.amount; });
  const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const maxCat = catList[0]?.[1] || 1;

  // Po danima
  const days = daysIn(m);
  const perDay = Array(days).fill(0);
  cur.forEach((r) => { perDay[Number(r.spent_at.slice(8, 10)) - 1] += r.amount; });
  const maxDay = Math.max(...perDay, 1);
  const bars = perDay.map((val, i) => {
    const h = val > 0 ? Math.max(3, (val / maxDay) * 90) : 0;
    const isToday = isCurrent && i === now.getDate() - 1;
    return `<rect x="${i * 10 + 1.5}" y="${96 - h}" width="7" height="${h}" rx="2.5"
      fill="${isToday ? 'var(--tint)' : 'color-mix(in srgb, var(--tint) 45%, var(--card))'}"><title>${i + 1}. — ${money(val)}</title></rect>`;
  }).join('');

  const shown = state.filterCat ? cur.filter((r) => r.category === state.filterCat) : cur;
  const groups = [];
  shown.forEach((r) => {
    const g = groups[groups.length - 1];
    if (g && g.date === r.spent_at) g.rows.push(r);
    else groups.push({ date: r.spent_at, rows: [r] });
  });

  const v = $('#view');
  v.innerHTML = `
    <div class="month-nav">
      <button type="button" id="prev-m" aria-label="Prethodni mjesec">${CHEVRON_L}</button>
      <span class="m">${monthName(m)} ${m.getFullYear()}.</span>
      <button type="button" id="next-m" aria-label="Sljedeći mjesec" ${isCurrent ? 'disabled' : ''}>${CHEVRON_R}</button>
    </div>

    <div class="group total">
      <div class="k">Ukupno potrošeno</div>
      <div class="big">${money(total)}</div>
      <div class="sub">${cur.length} ${cur.length === 1 ? 'trošak' : 'troškova'} · prosjek ${money(total / daysElapsed)} dnevno</div>
      ${delta}
      <div class="chart">
        <svg viewBox="0 0 ${days * 10} 96" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>
        <div class="axis"><span>1.</span><span>${Math.ceil(days / 2)}.</span><span>${days}.</span></div>
      </div>
    </div>

    ${catList.length ? `
    <div class="section-title"><span>Na što trošiš</span></div>
    <div class="group">
      ${catList.map(([id, val]) => {
        const c = cat(id);
        return `
        <button type="button" class="row cat-row ${state.filterCat === id ? 'on' : ''}" data-cat="${id}" style="--c:${c.color}">
          <span class="ico-sq">${c.icon}</span>
          <span class="main">
            <span class="top"><span>${esc(c.label)}<span class="p">${Math.round((val / total) * 100)}%</span></span><span>${money(val)}</span></span>
            <span class="bar"><i style="width:${(val / maxCat) * 100}%"></i></span>
          </span>
        </button>`;
      }).join('')}
    </div>` : ''}

    <div class="section-title">
      <span>Troškovi</span>
      ${state.filterCat ? `<button type="button" class="filter-chip" id="clear-filter">${cat(state.filterCat).icon} ${esc(cat(state.filterCat).label)} <span class="x">✕</span></button>` : ''}
    </div>
    ${groups.length ? groups.map((g) => `
      <div class="group-header"><span>${dayLabel(g.date)}</span><span>${money(sum(g.rows))}</span></div>
      <div class="group">${g.rows.map((r) => itemRow(r)).join('')}</div>`).join('')
      : '<div class="group empty">Nema troškova u ovom mjesecu.</div>'}
  `;

  $('#prev-m').addEventListener('click', () => { state.month = addMonths(state.month, -1); state.filterCat = null; render(); });
  $('#next-m').addEventListener('click', () => { state.month = addMonths(state.month, 1); state.filterCat = null; render(); });
  $('#clear-filter')?.addEventListener('click', () => { state.filterCat = null; render(); });
  $$('.cat-row', v).forEach((b) => b.addEventListener('click', () => {
    state.filterCat = state.filterCat === b.dataset.cat ? null : b.dataset.cat;
    render();
  }));
  wireItems(v, cur);
}

// ---------- Račun ----------
function renderRacun() {
  const v = $('#view');
  v.innerHTML = `
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
}

// ---------- Uređivanje troška ----------
function openEdit(r) {
  let picked = r.category;
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <div class="sheet-bar">
      <div class="grab"></div>
      <div class="bar-row">
        <button type="button" class="left" id="e-cancel">Odustani</button>
        <h2>Uredi trošak</h2>
        <button type="submit" class="right" form="edit-form">Spremi</button>
      </div>
    </div>
    <form id="edit-form" novalidate>
      ${expenseFields({ amount: r.amount.toFixed(2).replace('.', ','), category: picked, note: r.note, date: r.spent_at })}
      <div class="group">
        <button type="button" class="row center destructive" id="e-del">Obriši trošak</button>
      </div>
    </form>`;
  $('#sheet-backdrop').hidden = false;
  sheet.hidden = false;
  sheet.scrollTop = 0;
  document.body.style.overflow = 'hidden';

  const form = $('#edit-form');
  wireAmount($('.amount', form));
  wireCats(form, (id) => { picked = id; });
  $('#e-cancel').addEventListener('click', closeSheet);

  $('#e-del').addEventListener('click', async () => {
    if (!confirm(`Obrisati ${money(r.amount)} · ${cat(r.category).label}?`)) return;
    try {
      await db.deleteExpense(r.id);
      closeSheet();
      toast('Obrisano');
      render();
    } catch (e) { toast(errorText(e), true); }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const amount = parseAmount($('.amount', form).value);
    if (!(amount > 0)) return toast('Upiši ispravan iznos', true);
    try {
      await db.updateExpense(r.id, {
        amount,
        category: picked,
        note: $('.note', form).value.trim() || null,
        spent_at: $('.date', form).value || r.spent_at,
      });
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
