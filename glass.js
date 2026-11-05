// Tekuće staklo (Liquid Glass): svijetli rub stakla i leća na traci s karticama.
// Prilagođeno iz biblioteke Glisse (MIT, vidi vendor/glisse-LICENSE.txt), koja je pisana za React.
// Lom pozadine nije preuzet: Safari ne primjenjuje SVG filtere na ono što je iza elementa,
// pa i Glisse na iPhoneu koristi mutno staklo i svijetli rub.

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ---------- Svijetli rub ----------
// Svjetlo pada na gornji lijevi i donji desni rub, pa se rub crta u sliku prema obliku elementa.
const RIM_WIDTH = 1.22;
const EDGE_WIDTH = 0.5;
const rims = new Map();
const palette = document.createElement('canvas').getContext('2d');

function parseColour(colour) {
  palette.fillStyle = '#0000';
  palette.fillStyle = colour;
  const value = String(palette.fillStyle);
  if (value.startsWith('#')) return [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16)).concat(1);
  const [r = 0, g = 0, b = 0, a = 1] = (value.match(/[\d.]+/g) ?? []).map(Number);
  return [r, g, b, a];
}

// Slika se sažima u pozadini (toBlob), da crtanje ruba ne zaustavi animaciju koja je u tijeku
function rimImage(width, height, radius, shine, edge, density) {
  const columns = Math.max(1, Math.round(width * density));
  const rows = Math.max(1, Math.round(height * density));
  const canvas = document.createElement('canvas');
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext('2d');
  const image = context.createImageData(columns, rows);
  const halfW = width / 2;
  const halfH = height / 2;
  const half = 0.5 / density;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = ((column + 0.5) / columns) * width - halfW;
      const y = ((row + 0.5) / rows) * height - halfH;
      const qx = Math.abs(x) - halfW + radius;
      const qy = Math.abs(y) - halfH + radius;
      const depth = radius - Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - Math.min(Math.max(qx, qy), 0);
      if (depth < -half || depth > 2 * RIM_WIDTH) continue;
      let nx = 0;
      let ny = 0;
      if (qx > 0 && qy > 0) {
        const length = Math.hypot(qx, qy);
        nx = (Math.sign(x) * qx) / length;
        ny = (Math.sign(y) * qy) / length;
      } else if (qx > qy) nx = Math.sign(x);
      else ny = Math.sign(y);
      const facing = Math.abs(nx + ny);
      const along = Math.max(0, depth) / (RIM_WIDTH * Math.sqrt(Math.max(1, facing)));
      const cover = clamp((depth + half) * density, 0, 1);
      const lined = clamp((Math.min(EDGE_WIDTH, depth + half) - Math.max(0, depth - half)) * density, 0, 1);
      const light = along < 1 ? shine * Math.min(1, facing) ** 1.5 * (1 - along ** 1.5) * cover : 0;
      const line = edge[3] * lined * (1 - light);
      const alpha = light + line;
      if (alpha <= 0) continue;
      const i = (row * columns + column) * 4;
      for (let channel = 0; channel < 3; channel++) image.data[i + channel] = Math.round((255 * light + edge[channel] * line) / alpha);
      image.data[i + 3] = Math.round(255 * alpha);
    }
  }
  context.putImageData(image, 0, 0);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(`url("${URL.createObjectURL(blob)}")`)));
}

async function paintRim(el) {
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  if (!width || !height) return;
  const style = getComputedStyle(el);
  const corner = style.borderTopLeftRadius;
  const radius = Math.min(width / 2, height / 2, corner.endsWith('%') ? (Math.min(width, height) * parseFloat(corner)) / 100 : parseFloat(corner) || 0);
  const shine = clamp(parseFloat(style.getPropertyValue('--lg-rim-shine')) || 0.13, 0, 1);
  const edge = parseColour(style.getPropertyValue('--lg-edge').trim() || 'transparent');
  const density = Math.min(devicePixelRatio || 1, 2);
  const key = [width, height, radius, shine, edge, density].join('|');
  if (!rims.has(key)) rims.set(key, rimImage(width, height, radius, shine, edge, density));
  el.style.setProperty('--lg-rim', await rims.get(key));
  el.setAttribute('data-rim', '');
}

// Prati sve staklene elemente, i one koje aplikacija doda kasnije (npr. gumbe u donjem prozoru)
const GLASS = '.lg-glass, .sheet-bar button, .tab-face';

export function startGlass() {
  document.addEventListener('touchstart', () => {}, { passive: true }); // bez ovoga iOS ne prikazuje :active
  const seen = new WeakSet();
  const sizes = new ResizeObserver((entries) => entries.forEach((e) => paintRim(e.target)));
  const find = () => document.querySelectorAll(GLASS).forEach((el) => {
    if (seen.has(el)) return;
    seen.add(el);
    sizes.observe(el);
  });
  new MutationObserver(find).observe(document.body, { childList: true, subtree: true });
  find();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => document.querySelectorAll(GLASS).forEach(paintRim));
}

// ---------- Traka s karticama ----------
// Istaknuti dio je leća: pritiskom se podigne, može se povući preko kartica, a pušten sjedne na karticu.
// Pokret radi preglednik (CSS prijelazi nad transform i opacity), pa ide glatko i dok se
// nova kartica iscrtava; zato ovdje nema animacije po sličicama.
export function liquidTabBar(bar) {
  const tabs = [...bar.querySelectorAll('button')];
  const lens = document.createElement('div');
  lens.className = 'tab-lens';
  const face = document.createElement('div');
  face.className = 'tab-face';
  lens.append(face);
  const tint = document.createElement('div');
  tint.className = 'tab-tint';
  tint.setAttribute('aria-hidden', 'true');
  const row = document.createElement('div');
  row.className = 'tab-row';
  // ista kartica u boji, vidljiva samo kroz leću
  tabs.forEach((tab) => {
    const copy = document.createElement('div');
    copy.className = 'tab-copy';
    copy.innerHTML = tab.innerHTML;
    row.append(copy);
  });
  tint.append(row);
  bar.append(lens, tint);

  let slot = 0;
  let padding = 0;
  let active = -1;
  let shown = false;
  let at = 0;
  let gesture = null;
  let suppressClick = false;

  const measure = () => {
    padding = parseFloat(getComputedStyle(bar).paddingLeft) || 0;
    slot = (bar.clientWidth - 2 * padding) / tabs.length;
    lens.style.width = tint.style.width = `${slot}px`;
    row.style.width = `${slot * tabs.length}px`;
  };
  const place = (x, instant) => {
    const moved = Math.abs(x - at) > 0.5;
    bar.toggleAttribute('data-instant', instant);
    at = x;
    lens.style.transform = tint.style.transform = `translateX(${x}px)`;
    row.style.transform = `translateX(${-x}px)`;
    // dok leća putuje, odabrana kartica se vidi i izvan nje
    if (moved && !instant) bar.setAttribute('data-away', '');
    else if (instant || !lens.getAnimations().length) bar.removeAttribute('data-away');
  };
  const settle = (instant = false) => {
    if (gesture || active < 0 || !slot) return;
    place(active * slot, instant || !shown);
    shown = true;
  };
  const position = (e) => clamp(gesture.anchor + e.clientX - gesture.x, 0, slot * (tabs.length - 1));
  const release = () => {
    const old = gesture;
    gesture = null;
    delete bar.dataset.lifted;
    return old;
  };

  lens.addEventListener('transitionend', (e) => {
    if (e.target === lens) bar.removeAttribute('data-away');
  });
  bar.addEventListener('pointerdown', (e) => {
    const tab = e.target.closest('button');
    if (!e.isPrimary || e.button !== 0 || gesture || !tab) return;
    measure();
    gesture = { id: e.pointerId, x: e.clientX, anchor: tabs.indexOf(tab) * slot, moved: false, box: bar.getBoundingClientRect() };
    suppressClick = false;
    bar.dataset.lifted = '';
    place(gesture.anchor, false);
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerId !== gesture?.id) return;
    if (!gesture.moved && Math.abs(e.clientX - gesture.x) > 6) {
      gesture.moved = true;
      bar.setPointerCapture(e.pointerId);
    }
    if (!gesture.moved) return;
    place(position(e), true); // leća prati prst bez kašnjenja
    bar.setAttribute('data-away', '');
  });
  const end = (e) => {
    if (e.pointerId !== gesture?.id) return;
    const index = Math.round(position(e) / slot);
    const { moved, box } = release();
    const near = e.clientY >= box.top - 24 && e.clientY <= box.bottom + 24;
    if (e.type === 'pointerup' && (moved || near)) {
      suppressClick = true; // preglednikov klik nakon ovoga bi otvorio karticu ispod prsta
      tabs[index]?.click();
    }
    settle();
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  bar.addEventListener('click', (e) => {
    if (!e.isTrusted || !suppressClick || e.detail === 0) return;
    suppressClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
  const reset = () => { release(); settle(true); };
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  new ResizeObserver(() => {
    measure();
    settle(true);
  }).observe(bar);
  measure();

  return {
    setActive(index) {
      active = index;
      settle();
    },
  };
}
