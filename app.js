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
  toastTimer = setTimeout(() => el.classList.remove('show'), isError ? 4000 : 2200);
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
      <h1>Troškovi</h1>
      <p>Zapiši svaku potrošnju u par sekundi.</p>
    </div>
    ${isReset ? '' : `
    <div class="segmented">
      <button type="button" data-mode="login" class="${isLogin ? 'on' : ''}">Prijava</button>
      <button type="button" data-mode="signup" class="${!isLogin ? 'on' : ''}">Novi račun</button>
    </div>`}
    <form id="auth-form" novalidate>
      ${isReset ? '<p class="muted">Upiši svoj e-mail i poslat ćemo ti poveznicu za novu lozinku.</p>' : ''}
      <input class="field" name="email" type="email" autocomplete="email" placeholder="E-mail" required>
      ${isReset ? '' : `<input class="field" name="password" type="password"
        autocomplete="${isLogin ? 'current-password' : 'new-password'}"
        placeholder="${isLogin ? 'Lozinka' : 'Lozinka (barem 6 znakova)'}" required minlength="6">`}
      <div class="msg"></div>
      <button class="primary" type="submit">${isReset ? 'Pošalji poveznicu' : isLogin ? 'Prijavi se' : 'Napravi račun'}</button>
    </form>
    ${isLogin ? '<button type="button" class="link" data-mode="reset">Zaboravljena lozinka?</button>' : ''}
    ${isReset ? '<button type="button" class="link" data-mode="login">Natrag na prijavu</button>' : ''}
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
    <div class="brand"><img src="icons/icon-192.png" alt=""><h1>Nova lozinka</h1></div>
    <form id="pw-form" novalidate>
      <input class="field" name="password" type="password" autocomplete="new-password" placeholder="Nova lozinka (barem 6 znakova)">
      <div class="msg"></div>
      <button class="primary" type="submit">Spremi lozinku</button>
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
  $$('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  window.scrollTo(0, 0);
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

// ---------- Kategorije (gumbi) ----------
function catButtons(selected) {
  return CATEGORIES.map((c) => `
    <button type="button" class="cat ${c.id === selected ? 'on' : ''}" data-cat="${c.id}" style="--c:${c.color}">
      <span class="ico">${c.icon}</span><span class="lbl">${esc(c.label)}</span>
    </button>`).join('');
}

function wireCats(root, onPick) {
  $$('.cat', root).forEach((b) => b.addEventListener('click', () => {
    $$('.cat', root).forEach((x) => x.classList.toggle('on', x === b));
    onPick(b.dataset.cat);
  }));
}

function itemRow(r, showDate = false) {
  const c = cat(r.category);
  const sub = [showDate ? dayLabel(r.spent_at) : null, r.note ? esc(r.note) : null].filter(Boolean).join(' · ');
  return `
    <button class="item" data-id="${r.id}" style="--c:${c.color}">
      <span class="badge">${c.icon}</span>
      <span class="mid"><div class="t">${esc(c.label)}</div>${sub ? `<div class="s">${sub}</div>` : ''}</span>
      <span class="amt">${money(r.amount)}</span>
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
    <form id="add-form" class="card" novalidate>
      <label class="amount-wrap">
        <input id="amount" inputmode="decimal" placeholder="0,00" autocomplete="off" enterkeyhint="done" aria-label="Iznos">
        <span>€</span>
      </label>
      <div class="cats">${catButtons(state.addCat)}</div>
      <div class="row2">
        <input class="field" id="note" placeholder="Bilješka (neobavezno)" maxlength="100" autocomplete="off">
        <input class="field" id="date" type="date" value="${today()}" max="${today()}" aria-label="Datum">
      </div>
      <button class="primary" type="submit">Spremi</button>
    </form>
    <div id="unos-extra"></div>`;

  const form = $('#add-form');
  const amountEl = $('#amount');
  amountEl.addEventListener('input', () => {
    // dopušta samo brojeve i jedan decimalni zarez
    let s = amountEl.value.replace('.', ',').replace(/[^\d,]/g, '');
    const i = s.indexOf(',');
    if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, '').slice(0, 2);
    amountEl.value = s;
  });
  wireCats(form, (id) => { state.addCat = id; });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const amount = parseAmount(amountEl.value);
    if (!(amount > 0)) { amountEl.focus(); return toast('Upiši iznos', true); }
    if (!state.addCat) return toast('Odaberi na što si potrošio', true);
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      await db.addExpense({
        amount,
        category: state.addCat,
        note: $('#note').value.trim() || null,
        spent_at: $('#date').value || today(),
      });
      toast(`Spremljeno ✓  ${money(amount)} · ${cat(state.addCat).label}`);
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
      ? `<div class="list">${recent.map((r) => itemRow(r, true)).join('')}</div>`
      : '<div class="empty">Još nema unosa. Upiši prvi trošak gore. 👆</div>'}`;
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
    const h = val > 0 ? Math.max(2, (val / maxDay) * 84) : 0;
    const isToday = isCurrent && i === now.getDate() - 1;
    return `<rect x="${i * 10 + 1.5}" y="${90 - h}" width="7" height="${h}" rx="2"
      fill="${isToday ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 45%, var(--chip))'}"><title>${i + 1}. — ${money(val)}</title></rect>`;
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
      <button type="button" id="prev-m" aria-label="Prethodni mjesec">‹</button>
      <span class="m">${monthName(m)} ${m.getFullYear()}</span>
      <button type="button" id="next-m" aria-label="Sljedeći mjesec" ${isCurrent ? 'disabled' : ''}>›</button>
    </div>

    <div class="card total">
      <div class="big">${money(total)}</div>
      <div class="sub">${cur.length} ${cur.length === 1 ? 'trošak' : 'troškova'} · prosjek ${money(total / daysElapsed)} po danu</div>
      ${delta}
      <div class="chart">
        <svg viewBox="0 0 ${days * 10} 90" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>
        <div class="axis"><span>1.</span><span>${Math.ceil(days / 2)}.</span><span>${days}.</span></div>
      </div>
    </div>

    ${catList.length ? `
    <div class="section-title"><span>Na što trošiš</span></div>
    <div class="list">
      ${catList.map(([id, val]) => {
        const c = cat(id);
        return `
        <button type="button" class="cat-row ${state.filterCat === id ? 'on' : ''}" data-cat="${id}" style="--c:${c.color}">
          <div class="top"><span>${c.icon} ${esc(c.label)}<span class="p">${Math.round((val / total) * 100)}%</span></span><span>${money(val)}</span></div>
          <div class="bar"><i style="width:${(val / maxCat) * 100}%"></i></div>
        </button>`;
      }).join('')}
    </div>` : ''}

    <div class="section-title">
      <span>Svi troškovi</span>
      ${state.filterCat ? `<button type="button" class="filter-chip" id="clear-filter">${cat(state.filterCat).icon} ${esc(cat(state.filterCat).label)} ✕</button>` : ''}
    </div>
    ${groups.length ? groups.map((g) => `
      <div class="section-title" style="margin-top:12px"><span>${dayLabel(g.date)}</span><span>${money(sum(g.rows))}</span></div>
      <div class="list">${g.rows.map((r) => itemRow(r)).join('')}</div>`).join('')
      : '<div class="empty">Nema troškova u ovom mjesecu.</div>'}
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
    <div class="card">
      <div class="kv"><span>Prijavljen kao</span><span>${esc(state.user?.email)}</span></div>
    </div>
    <button type="button" class="secondary danger-btn" id="logout">Odjava</button>

    <div class="section-title"><span>Dodaj na početni zaslon</span></div>
    <div class="card">
      <ol class="steps">
        <li>Otvori ovu stranicu u <b>Safariju</b></li>
        <li>Dodirni <b>Dijeli</b> (kvadrat sa strelicom)</li>
        <li>Odaberi <b>Dodaj na početni zaslon</b></li>
      </ol>
    </div>
    ${db.isDemo ? '<p class="muted" style="padding:0 4px">Demo način: podaci su samo u ovom pregledniku. Upiši Supabase podatke u <code>config.js</code> za spremanje u oblak.</p>' : ''}
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
    <div class="grab"></div>
    <h2>Uredi trošak</h2>
    <form id="edit-form" novalidate>
      <label class="amount-wrap">
        <input id="e-amount" inputmode="decimal" value="${String(r.amount.toFixed(2)).replace('.', ',')}" autocomplete="off" aria-label="Iznos">
        <span>€</span>
      </label>
      <div class="cats">${catButtons(picked)}</div>
      <div class="row2">
        <input class="field" id="e-note" placeholder="Bilješka" maxlength="100" value="${esc(r.note)}" autocomplete="off">
        <input class="field" id="e-date" type="date" value="${r.spent_at}" aria-label="Datum">
      </div>
      <div class="sheet-actions">
        <button class="primary" type="submit">Spremi promjene</button>
        <button class="secondary danger-btn" type="button" id="e-del">Obriši</button>
        <button class="secondary" type="button" id="e-cancel">Odustani</button>
      </div>
    </form>`;
  $('#sheet-backdrop').hidden = false;
  sheet.hidden = false;

  const form = $('#edit-form');
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
    const amount = parseAmount($('#e-amount').value);
    if (!(amount > 0)) return toast('Upiši ispravan iznos', true);
    try {
      await db.updateExpense(r.id, {
        amount,
        category: picked,
        note: $('#e-note').value.trim() || null,
        spent_at: $('#e-date').value || r.spent_at,
      });
      closeSheet();
      toast('Spremljeno ✓');
      render();
    } catch (e) { toast(errorText(e), true); }
  });
}

function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheet-backdrop').hidden = true;
  $('#sheet').innerHTML = '';
}
