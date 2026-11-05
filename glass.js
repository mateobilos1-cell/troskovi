// Tekuće staklo (Liquid Glass): svijetli rub stakla i leća na traci s karticama.
// Prilagođeno iz biblioteke Glisse (MIT, vidi vendor/glisse-LICENSE.txt), koja je pisana za React.
// Lom pozadine nije preuzet: Safari ne primjenjuje SVG filtere na ono što je iza elementa,
// pa i Glisse na iPhoneu koristi mutno staklo i svijetli rub.

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ---------- Opruga: pokret bez unaprijed zadanog trajanja, kao na iOS-u ----------
const moving = new Set();
let frame = 0;
let last = 0;

function advance(s, dt) {
  const x = s.value - s.target;
  const v = s.velocity;
  const half = s.damping / 2;
  const disc = half * half - s.stiffness;
  if (Math.abs(disc) < 1e-4) {
    const decay = Math.exp(-half * dt);
    const b = v + half * x;
    s.value = s.target + decay * (x + b * dt);
    s.velocity = decay * (v - half * b * dt);
  } else if (disc > 0) {
    const root = Math.sqrt(disc);
    const r1 = -half + root;
    const r2 = -half - root;
    const a = (v - r2 * x) / (r1 - r2);
    const b = x - a;
    s.value = s.target + a * Math.exp(r1 * dt) + b * Math.exp(r2 * dt);
    s.velocity = a * r1 * Math.exp(r1 * dt) + b * r2 * Math.exp(r2 * dt);
  } else {
    const omega = Math.sqrt(-disc);
    const decay = Math.exp(-half * dt);
    const cos = Math.cos(omega * dt);
    const sin = Math.sin(omega * dt);
    s.value = s.target + decay * (x * cos + ((v + half * x) / omega) * sin);
    s.velocity = decay * (v * cos - ((half * v + s.stiffness * x) / omega) * sin);
  }
}

function tick(time) {
  frame = 0;
  const dt = Math.min(0.1, Math.max(0, (time - last) / 1000));
  last = time;
  for (const s of moving) {
    advance(s, dt);
    if (Math.abs(s.value - s.target) < 1e-4 && Math.abs(s.velocity) < 0.001) {
      s.value = s.target;
      s.velocity = 0;
      moving.delete(s);
    }
    s.paint(s.value);
  }
  if (moving.size) frame = requestAnimationFrame(tick);
}

function spring(value, paint) {
  const s = { value, target: value, velocity: 0, stiffness: 1, damping: 1, paint };
  return {
    set(target, instant = false) {
      s.target = target;
      if (instant || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        s.value = target;
        s.velocity = 0;
        moving.delete(s);
        return paint(target);
      }
      moving.add(s);
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    },
    tune(stiffness, damping) {
      s.stiffness = stiffness;
      s.damping = damping;
    },
  };
}

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
  return `url("${canvas.toDataURL()}")`;
}

function paintRim(el) {
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  if (!width || !height) return;
  const style = getComputedStyle(el);
  const corner = style.borderTopLeftRadius;
  const radius = Math.min(width / 2, height / 2, corner.endsWith('%') ? (Math.min(width, height) * parseFloat(corner)) / 100 : parseFloat(corner) || 0);
  const shine = clamp(parseFloat(style.getPropertyValue('--lg-rim-shine')) || 0.13, 0, 1);
  const edge = parseColour(style.getPropertyValue('--lg-edge').trim() || 'transparent');
  const density = Math.min(devicePixelRatio || 1, 3);
  const key = [width, height, radius, shine, edge, density].join('|');
  if (!rims.has(key)) rims.set(key, rimImage(width, height, radius, shine, edge, density));
  el.style.setProperty('--lg-rim', rims.get(key));
  el.setAttribute('data-rim', '');
}

// Prati sve staklene elemente, i one koje aplikacija doda kasnije (npr. gumbe u donjem prozoru)
const GLASS = '.lg-glass, .sheet-bar button, .tab-lens';

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
const REST = [1024, 58.9, 676, 47.8]; // klizanje, prigušenje, podizanje, prigušenje
const DRAG = [2500, 94, 576, 44.2];
const GROW_X = 24;
const GROW_Y = 16;

export function liquidTabBar(bar) {
  const tabs = [...bar.querySelectorAll('button')];
  const lens = document.createElement('div');
  lens.className = 'tab-lens';
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
  let width = 0;
  let height = 0;
  let padding = 0;
  let active = -1;
  let shown = false;
  let gesture = null;
  let suppressClick = false;
  const now = { x: 0, lift: 0 };

  const measure = () => {
    padding = parseFloat(getComputedStyle(bar).paddingLeft) || 0;
    slot = (bar.clientWidth - 2 * padding) / tabs.length;
    width = slot;
    height = lens.offsetHeight;
    lens.style.width = tint.style.width = `${slot}px`;
    row.style.width = `${slot * tabs.length}px`;
  };
  const mark = () => bar.toggleAttribute('data-away', active < 0 || Math.abs(now.x - active * slot) > 0.5);
  const paint = () => {
    const { x, lift } = now;
    if (!width || !height) return;
    const sx = 1 + (GROW_X / width) * lift;
    const sy = 1 + (GROW_Y / height) * lift;
    lens.style.transform = tint.style.transform = `translateX(${x}px) scale(${sx}, ${sy})`;
    lens.style.setProperty('--lg-lift', String(clamp(lift, 0, 1)));
    row.style.transform = `scale(${1 / sx}, ${1 / sy}) translate(${-x + (sx - 1) * (width / 2)}px, ${(sy - 1) * (height / 2)}px)`;
    mark();
  };
  const x = spring(0, (v) => { now.x = v; paint(); });
  const lift = spring(0, (v) => { now.lift = v; paint(); });
  const move = (target, lifted, instant = false) => {
    const [slide, slideDamp, up, upDamp] = gesture ? DRAG : REST;
    x.tune(slide, slideDamp);
    lift.tune(up, upDamp);
    x.set(target, instant);
    lift.set(lifted ? 1 : 0, instant);
  };
  const settle = (instant = false) => {
    if (gesture || active < 0) return;
    move(active * slot, false, instant || !shown);
    shown = true;
  };
  const position = (e) => clamp(gesture.anchor + e.clientX - gesture.x, 0, slot * (tabs.length - 1));
  const release = () => {
    const old = gesture;
    gesture = null;
    delete bar.dataset.lifted;
    return old;
  };

  bar.addEventListener('pointerdown', (e) => {
    const tab = e.target.closest('button');
    if (!e.isPrimary || e.button !== 0 || gesture || !tab) return;
    measure();
    gesture = { id: e.pointerId, x: e.clientX, anchor: tabs.indexOf(tab) * slot, moved: false, box: bar.getBoundingClientRect() };
    suppressClick = false;
    bar.dataset.lifted = '';
    move(gesture.anchor, true, !shown);
    shown = true;
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerId !== gesture?.id) return;
    if (!gesture.moved && Math.abs(e.clientX - gesture.x) > 6) {
      gesture.moved = true;
      bar.setPointerCapture(e.pointerId);
    }
    if (gesture.moved) move(position(e), true);
  });
  const end = (e) => {
    if (e.pointerId !== gesture?.id) return;
    const index = Math.round(position(e) / slot);
    const { moved, box } = release();
    const near = e.clientY >= box.top - 24 && e.clientY <= box.bottom + 24;
    if (e.type === 'pointerup' && (moved || near)) {
      suppressClick = true; // preglednikov klik nakon ovoga bi otvorio karticu ispod prsta
      tabs[index]?.click();
      settle();
    } else settle();
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
    paint();
  }).observe(bar);
  measure();

  return {
    setActive(index) {
      active = index;
      settle();
      mark();
    },
  };
}
