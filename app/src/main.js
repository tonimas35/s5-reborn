// App para mamá: interfaz sencilla sobre Valetudo.
import { valetudoApi, readAttributes, readStats } from './api.js';
import { createDemoApi } from './demo.js';
import { HouseMap } from './map3d.js';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const api = DEMO ? createDemoApi({ error: params.get('demo') === 'error' }) : valetudoApi;

const $ = (id) => document.getElementById(id);
const ICONS = {
  dock: '<svg viewBox="0 0 24 24"><path d="M7 3v5"/><path d="M17 3v5"/><path d="M5 8h14v3a7 7 0 0 1-14 0z"/><path d="M12 18v3"/></svg>',
  clean: '<svg viewBox="0 0 24 24"><path d="M12 12c0-3 2-5 5-5-1 3-2 4-5 5z"/><path d="M12 12c3 0 5 2 5 5-3-1-4-2-5-5z"/><path d="M12 12c0 3-2 5-5 5 1-3 2-4 5-5z"/><path d="M12 12c-3 0-5-2-5-5 3 1 4 2 5 5z"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M9 5v14"/><path d="M15 5v14"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M12 3 2.5 19.5h19z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg>',
  idle: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/></svg>',
  rooms: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>'
};
const FAN_LABELS = { low: 'Suave', medium: 'Normal', high: 'Fuerte', max: 'Máxima' };

// Traducción de los errores más comunes del S5 a frases normales
const ERRORS = [
  [/wheel|suspend|lifted/i, 'Una de mis ruedas no toca el suelo. Seguramente me he subido a algo.'],
  [/stuck|trapped|entrapped/i, 'Me he quedado atascado y no sé salir.'],
  [/main brush|roller/i, 'El cepillo grande se ha enredado. Mira si tiene pelos o algún cordón.'],
  [/side brush/i, 'El cepillo pequeño de la esquina se ha enredado.'],
  [/cliff|fall/i, 'Mis sensores de abajo creen que hay un escalón. Puede que estén sucios.'],
  [/bumper/i, 'Mi parachoques delantero se ha quedado apretado.'],
  [/dust ?bin|bin/i, 'Falta el depósito de polvo o no está bien puesto.'],
  [/filter/i, 'El filtro está atascado o mojado.'],
  [/laser|lidar|lds/i, 'La torreta de arriba no gira bien o está tapada.'],
  [/battery|charg/i, 'Tengo un problema con la batería o con la carga.'],
  [/magnetic|virtual/i, 'He encontrado una zona prohibida y no sé por dónde seguir.']
];

const state = {
  attrs: readAttributes([]),
  segments: [],
  stats: { seconds: 0, m2: 0 },
  selecting: false,
  selected: new Set(),
  cleaning: null, // ids que pedimos limpiar desde la app
  fanPresets: [],
  failures: 0,
  busy: false
};

const map = new HouseMap($('map'), {
  onRoomTap: (id) => {
    const s = state.attrs.status;
    if (!['docked', 'idle'].includes(s)) return;
    if (!state.selecting) { state.selecting = true; state.selected.clear(); }
    state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
    render();
  }
});

// ---------- Utilidades ----------

function greeting() {
  const h = new Date().getHours();
  return h < 7 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
}
function fmtMinutes(sec) {
  const m = Math.round(sec / 60);
  return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
}
function fmtM2(m2) { return (m2 < 10 ? m2.toFixed(1) : Math.round(m2)).toString().replace('.', ',') + ' m²'; }
function joinNames(names) {
  const low = names.map((n) => n.toLowerCase());
  if (low.length <= 1) return low[0] || '';
  return low.slice(0, -1).join(', ') + ' y ' + low[low.length - 1];
}
function article(name) {
  const n = name.toLowerCase();
  const fem = /(a|ción|sión)$/.test(n) && !/(baño|pasillo|salón|estudio|dormitorio)$/.test(n);
  return (fem ? 'la ' : 'el ') + n;
}
function segName(id) { const s = state.segments.find((x) => String(x.id) === String(id)); return s ? s.name : 'habitación'; }
function errorText(err) {
  const raw = err ? (typeof err === 'string' ? err : err.message || err.description || '') : '';
  for (const [re, txt] of ERRORS) if (re.test(raw)) return txt;
  return 'Algo me impide seguir limpiando.';
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

async function run(fn, okMsg) {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    await fn();
    if (okMsg) toast(okMsg);
    setTimeout(refreshAttributes, 600);
  } catch (e) {
    toast('No he podido hacerlo. Vuelve a intentarlo en un momento.');
  } finally {
    state.busy = false;
    render();
  }
}

// ---------- Acciones ----------

const actions = {
  cleanAll: () => run(async () => { state.cleaning = null; await api.start(); }, 'Empiezo a limpiar toda la casa'),
  cleanSelected: () => {
    const ids = [...state.selected];
    run(async () => {
      state.cleaning = ids;
      state.selecting = false;
      state.selected.clear();
      await api.cleanSegments(ids);
    }, 'Voy a limpiar ' + joinNames(ids.map(segName)));
  },
  pickRooms: () => { state.selecting = true; state.selected.clear(); render(); },
  cancelPick: () => { state.selecting = false; state.selected.clear(); render(); },
  pause: () => run(() => api.pause(), 'En pausa'),
  resume: () => run(() => api.start(), 'Sigo limpiando'),
  home: () => run(() => api.home(), 'Vuelvo a la base'),
  locate: () => run(() => api.locate(), 'Escucha: el robot te está diciendo dónde está'),
  fan: (name) => run(() => api.setFan(name), 'Potencia: ' + (FAN_LABELS[name] || name).toLowerCase())
};

function button(label, icon, onClick, kind = '', disabled = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn ' + kind;
  b.innerHTML = (icon ? ICONS[icon] : '') + '<span></span>';
  b.querySelector('span').textContent = label;
  b.disabled = disabled || state.busy;
  b.addEventListener('click', onClick);
  return b;
}

// ---------- Pintar la interfaz ----------

function render() {
  const a = state.attrs;
  const s = a.status;
  const cleaningNames = state.cleaning ? state.cleaning.map(segName) : null;

  $('greeting').textContent = greeting();

  // Batería
  const bat = $('battery');
  bat.style.setProperty('--pct', a.battery ?? 0);
  bat.classList.toggle('low', (a.battery ?? 100) < 20);
  $('batteryPct').textContent = a.battery == null ? '–' : a.battery + '%';
  bat.setAttribute('aria-label', 'Batería ' + (a.battery ?? 'desconocida') + '%');

  // Título y estado
  let title = 'La casa está tranquila';
  let main = 'Esperando';
  let sub = '';
  let icon = 'idle';
  const done = state.stats.seconds > 0 ? 'Última limpieza: ' + fmtMinutes(state.stats.seconds) + ' · ' + fmtM2(state.stats.m2) : 'Listo para limpiar';
  switch (s) {
    case 'docked':
      icon = 'dock';
      main = a.batteryFlag === 'charging' ? 'Cargando en su base' : 'En su base, cargado';
      sub = done;
      break;
    case 'idle':
      main = 'Esperando órdenes';
      sub = 'Está fuera de la base';
      break;
    case 'cleaning':
      title = 'Limpiando la casa';
      if (cleaningNames && cleaningNames.length === 1) title = 'Limpiando ' + article(cleaningNames[0]);
      else if (cleaningNames && cleaningNames.length > 1) title = 'Limpiando ' + joinNames(cleaningNames);
      main = 'Limpiando';
      sub = 'Llevo ' + fmtMinutes(state.stats.seconds) + ' · ' + fmtM2(state.stats.m2);
      icon = 'clean';
      break;
    case 'paused':
      title = 'En pausa';
      main = 'En pausa';
      sub = 'Llevo ' + fmtMinutes(state.stats.seconds) + ' · ' + fmtM2(state.stats.m2);
      icon = 'pause';
      break;
    case 'returning':
      title = 'Volviendo a casa';
      main = 'Volviendo a la base';
      sub = 'Batería ' + (a.battery ?? '–') + '%';
      icon = 'home';
      break;
    case 'error':
      title = /stuck|trapped|wheel|suspend/i.test(String(a.error && (a.error.message || a.error))) ? 'Me he quedado atascado' : 'Necesito tu ayuda';
      main = 'Necesita ayuda';
      sub = 'Mira el aviso de abajo';
      icon = 'alert';
      break;
    case 'manual_control':
    case 'moving':
      title = 'Moviéndose';
      main = 'Moviéndose';
      icon = 'clean';
      break;
    case 'unknown':
      title = 'Conectando con el robot…';
      main = 'Conectando…';
      break;
  }
  if (state.selecting) title = '¿Qué limpio?';
  $('title').textContent = title;
  $('statusMain').textContent = main;
  $('statusSub').textContent = sub;
  const si = $('statusIcon');
  si.innerHTML = ICONS[icon];
  si.className = 'status-icon' + (s === 'error' ? ' is-alert' : '') + (s === 'cleaning' ? ' is-busy' : '');

  // Aviso de error
  $('alertCard').hidden = s !== 'error';
  if (s === 'error') $('alertMsg').textContent = errorText(a.error);

  // Mapa
  const segIds = state.segments.map((x) => String(x.id));
  const active = s === 'cleaning' || s === 'paused' ? (state.cleaning || []) : [];
  map.setHighlight({ active, selected: state.selecting ? [...state.selected] : [] });
  map.setTone(s === 'error' ? 'alert' : 'normal');
  $('map').classList.toggle('is-alert', s === 'error');
  $('mapEmpty').hidden = map.hasMap;
  $('mapTools').hidden = !map.hasMap;
  $('mapHint').hidden = !map.hasMap;
  $('mapHint').textContent = state.selecting ? 'Toca las habitaciones en el mapa o en la lista' : 'Arrastra, pellizca o toca una habitación';
  const totalArea = state.segments.reduce((t, x) => t + (x.area || 0), 0);
  $('mapMeta').textContent = segIds.length ? segIds.length + ' habitaciones' + (totalArea ? ' · ' + Math.round(totalArea) + ' m²' : '') : '';

  // Selector de habitaciones
  const picker = $('roomPicker');
  picker.hidden = !state.selecting;
  if (state.selecting) {
    const chips = $('chips');
    chips.innerHTML = '';
    for (const seg of state.segments) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'chip';
      const on = state.selected.has(String(seg.id));
      c.setAttribute('aria-pressed', String(on));
      c.textContent = seg.name;
      c.addEventListener('click', () => {
        const id = String(seg.id);
        state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
        render();
      });
      chips.appendChild(c);
    }
  }

  // Botones según el estado
  const box = $('actions');
  box.innerHTML = '';
  box.className = 'actions';
  if (s === 'docked' || s === 'idle' || s === 'unknown') {
    if (state.selecting) {
      const n = state.selected.size;
      box.append(
        button(n ? 'Limpiar ' + (n === 1 ? article(segName([...state.selected][0])) : n + ' habitaciones') : 'Elige al menos una', 'play', actions.cleanSelected, 'primary', n === 0),
        button('Cancelar', '', actions.cancelPick, 'ghost')
      );
    } else {
      box.append(button('Limpiar toda la casa', 'play', actions.cleanAll, 'primary', s === 'unknown'));
      if (state.segments.length) box.append(button('Elegir habitaciones', 'rooms', actions.pickRooms));
      if (s === 'idle') box.append(button('Volver a la base', 'home', actions.home, 'ghost'));
    }
  } else if (s === 'cleaning') {
    box.classList.add('two');
    box.append(button('Pausar', 'pause', actions.pause), button('Volver a casa', 'home', actions.home, 'primary'));
  } else if (s === 'paused') {
    box.classList.add('two');
    box.append(button('Seguir', 'play', actions.resume, 'primary'), button('Volver a casa', 'home', actions.home));
  } else if (s === 'returning' || s === 'moving' || s === 'manual_control') {
    box.append(button('Pausar', 'pause', actions.pause));
  } else if (s === 'error') {
    box.append(button('Seguir limpiando', 'play', actions.resume, 'primary'), button('Dejarlo por hoy y volver a la base', 'home', actions.home, 'ghost'));
  }

  // Potencia
  const fan = $('fan');
  const presets = state.fanPresets.filter((p) => FAN_LABELS[p]);
  if (fan.childElementCount !== presets.length) {
    fan.innerHTML = '';
    for (const p of presets) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg';
      b.setAttribute('role', 'radio');
      b.dataset.preset = p;
      b.textContent = FAN_LABELS[p];
      b.addEventListener('click', () => actions.fan(p));
      fan.appendChild(b);
    }
  }
  for (const b of fan.children) b.setAttribute('aria-checked', String(b.dataset.preset === a.fan));

  $('offline').hidden = state.failures < 2;
  $('foot').textContent = DEMO ? 'Modo demostración · casa de ejemplo' : 's5-reborn';
}

// ---------- Datos ----------

async function refreshAttributes() {
  try {
    state.attrs = readAttributes(await api.attributes());
    state.failures = 0;
    if (!['cleaning', 'paused', 'returning', 'error'].includes(state.attrs.status) && state.attrs.status !== 'unknown') {
      if (state.attrs.status === 'docked') state.cleaning = null;
    }
  } catch (e) {
    state.failures++;
  }
  render();
}

async function refreshMap() {
  try {
    const m = await api.map();
    const had = map.hasMap;
    map.update(m);
    const segs = ((m && m.layers) || []).filter((l) => l.type === 'segment').map((l) => ({
      id: String(l.metaData.segmentId),
      name: l.metaData.name || 'Habitación',
      area: (l.metaData.area || 0) / 10000
    }));
    if (segs.length) {
      const names = await api.segments().catch(() => []);
      for (const s of segs) {
        const named = (names || []).find((n) => String(n.id) === s.id);
        if (named && named.name) s.name = named.name;
      }
    }
    state.segments = segs;
    if (had !== map.hasMap) render();
  } catch (e) { /* lo reintentamos en la siguiente vuelta */ }
  render();
}

async function refreshStats() {
  try { state.stats = readStats(await api.currentStats()); } catch (e) { /* nada */ }
}

async function refreshCare() {
  try {
    const items = await api.consumables();
    const names = { 'brush:main': 'Cepillo grande', 'brush:side_right': 'Cepillo de la esquina', 'filter:main': 'Filtro', 'cleaning:sensor': 'Limpiar los sensores' };
    const due = (items || []).filter((c) => c.remaining && c.remaining.unit === 'minutes' && c.remaining.value < 10 * 60);
    const list = $('careList');
    list.innerHTML = '';
    for (const c of due) {
      const li = document.createElement('li');
      const a = document.createElement('span');
      const b = document.createElement('span');
      a.textContent = names[c.type + ':' + c.subType] || c.type;
      b.textContent = c.remaining.value <= 0 ? 'ya toca' : 'en ' + Math.max(1, Math.round(c.remaining.value / 60)) + ' h de uso';
      li.append(a, b);
      list.appendChild(li);
    }
    $('care').hidden = due.length === 0;
  } catch (e) { /* nada */ }
}

$('zoomIn').addEventListener('click', () => map.zoomBy(1.4));
$('zoomOut').addEventListener('click', () => map.zoomBy(1 / 1.4));
$('recenter').addEventListener('click', () => map.recenter());
$('locate').addEventListener('click', actions.locate);

async function boot() {
  render();
  state.fanPresets = await api.fanPresets().catch(() => []);
  await Promise.all([refreshAttributes(), refreshMap(), refreshStats(), refreshCare()]);

  const busy = () => ['cleaning', 'returning', 'moving', 'manual_control'].includes(state.attrs.status);
  setInterval(refreshAttributes, 2000);
  let tick = 0;
  setInterval(() => {
    tick++;
    if (busy() || tick % 5 === 0) refreshMap();
    if (busy() || tick % 10 === 0) refreshStats();
    if (tick % 100 === 0) refreshCare();
  }, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshAttributes(); refreshMap(); } });
}
boot();
