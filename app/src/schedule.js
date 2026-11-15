// Limpiezas programadas, guardadas en los temporizadores de Valetudo (/api/v2/timers).
// Valetudo los guarda en hora UTC. La app guarda la hora local en la etiqueta
// ("s5 10:00 135") y, cada vez que se abre, corrige los que se hayan movido
// con el cambio de hora de verano/invierno.

const DAYS = [
  // [día JS (0 = domingo), corto, largo]
  [1, 'L', 'lunes'], [2, 'M', 'martes'], [3, 'X', 'miércoles'], [4, 'J', 'jueves'],
  [5, 'V', 'viernes'], [6, 'S', 'sábado'], [0, 'D', 'domingo']
];

async function req(method, path, body) {
  const res = await fetch('/api/v2/timers' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('timers ' + res.status);
  const t = await res.text();
  try { return JSON.parse(t); } catch { return t; }
}

// Hora local -> hora UTC de Valetudo, moviendo los días si se cruza la medianoche
function toUtc(localDays, hh, mm) {
  const offset = -new Date().getTimezoneOffset(); // minutos que Madrid va por delante de UTC
  let mins = hh * 60 + mm - offset;
  let shift = 0;
  if (mins < 0) { mins += 1440; shift = -1; }
  if (mins >= 1440) { mins -= 1440; shift = 1; }
  return {
    dow: [...new Set(localDays.map((d) => (d + shift + 7) % 7))].sort(),
    hour: Math.floor(mins / 60),
    minute: mins % 60
  };
}

function encodeLabel(localDays, hh, mm) {
  return 's5 ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ' ' + [...localDays].sort().join('');
}

function decodeLabel(label) {
  const m = /^s5 (\d\d):(\d\d) ([0-6]+)$/.exec(label || '');
  if (!m) return null;
  return { hh: +m[1], mm: +m[2], days: [...m[3]].map(Number) };
}

// Para temporizadores creados fuera de la app (sin etiqueta nuestra): UTC -> local
function fromUtc(t) {
  const offset = -new Date().getTimezoneOffset();
  let mins = t.hour * 60 + t.minute + offset;
  let shift = 0;
  if (mins < 0) { mins += 1440; shift = -1; }
  if (mins >= 1440) { mins -= 1440; shift = 1; }
  return { hh: Math.floor(mins / 60), mm: mins % 60, days: t.dow.map((d) => (d + shift + 7) % 7) };
}

function describeDays(days) {
  const set = new Set(days);
  if (set.size === 7) return 'Todos los días';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'De lunes a viernes';
  if (set.size === 2 && set.has(6) && set.has(0)) return 'Sábados y domingos';
  // lunes…viernes no cambian en plural; sábado y domingo sí
  const names = DAYS.filter(([d]) => set.has(d)).map(([, , l]) => (l === 'sábado' || l === 'domingo' ? l + 's' : l));
  return 'Los ' + (names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' y ' + names.at(-1));
}

export function createSchedule({ el, getSegments, toast }) {
  const st = { timers: [], editing: null, error: false };

  async function refresh() {
    try {
      const obj = await req('GET', '');
      st.timers = Object.values(obj || {});
      st.error = false;
      await fixDst();
    } catch (e) {
      st.error = true;
    }
    render();
  }

  // Si cambió la hora (verano/invierno), recoloca los nuestros para que sigan a la misma hora local
  async function fixDst() {
    for (const t of st.timers) {
      const loc = decodeLabel(t.label);
      if (!loc) continue;
      const want = toUtc(loc.days, loc.hh, loc.mm);
      if (want.hour !== t.hour || want.minute !== t.minute || want.dow.join() !== [...t.dow].sort().join()) {
        try {
          await req('PUT', '/' + t.id, { ...t, ...want, enabled: t.enabled === true });
          Object.assign(t, want);
        } catch (e) { /* lo intentará la próxima vez */ }
      }
    }
  }

  function local(t) {
    return decodeLabel(t.label) || fromUtc(t);
  }

  function whatText(t) {
    if (t.action && t.action.type === 'segment_cleanup') {
      const segs = getSegments();
      const names = (t.action.params.segment_ids || []).map((id) => (segs.find((s) => String(s.id) === String(id)) || {}).name).filter(Boolean);
      return names.length ? names.join(', ') : 'Algunas habitaciones';
    }
    return 'Toda la casa';
  }

  function button(text, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function render() {
    el.innerHTML = '';
    const h = document.createElement('h2');
    h.textContent = 'Limpieza programada';
    el.appendChild(h);

    if (st.editing) { renderEditor(); return; }

    if (st.error) {
      const p = document.createElement('p');
      p.className = 'muted sched-empty';
      p.textContent = 'No puedo ver la programación ahora mismo.';
      el.appendChild(p);
      return;
    }

    const list = [...st.timers].sort((a, b) => { const x = local(a), y = local(b); return x.hh * 60 + x.mm - (y.hh * 60 + y.mm); });
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'muted sched-empty';
      p.textContent = 'Aún no hay ninguna. El robot puede limpiar solo los días y a la hora que elijas.';
      el.appendChild(p);
    }
    for (const t of list) {
      const loc = local(t);
      const row = document.createElement('div');
      row.className = 'sched-row' + (t.enabled ? '' : ' is-off');
      const txt = document.createElement('div');
      txt.className = 'sched-text';
      const a = document.createElement('span');
      a.className = 'sched-time';
      a.textContent = String(loc.hh).padStart(2, '0') + ':' + String(loc.mm).padStart(2, '0');
      const b = document.createElement('span');
      b.className = 'sched-sub';
      b.textContent = describeDays(loc.days) + ' · ' + whatText(t);
      txt.append(a, b);

      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'switch';
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-checked', t.enabled ? 'true' : 'false');
      sw.setAttribute('aria-label', t.enabled ? 'Activada' : 'Desactivada');
      sw.addEventListener('click', async () => {
        try {
          await req('PUT', '/' + t.id, { ...t, enabled: !t.enabled });
          toast(t.enabled ? 'Programación apagada' : 'Programación encendida');
        } catch (e) { toast('No he podido cambiarlo. Prueba otra vez.'); }
        refresh();
      });

      const edit = button('Cambiar', 'sched-edit', () => { st.editing = { id: t.id, enabled: t.enabled, ...loc, segIds: t.action.type === 'segment_cleanup' ? [...t.action.params.segment_ids] : [] }; render(); });
      row.append(txt, edit, sw);
      el.appendChild(row);
    }
    if (st.timers.length < 6) {
      el.appendChild(button('+ Programar una limpieza', 'btn sched-add', () => {
        st.editing = { id: null, enabled: true, hh: 10, mm: 0, days: [1, 3, 5], segIds: [] };
        render();
      }));
    }
  }

  function renderEditor() {
    const e = st.editing;

    const l1 = document.createElement('p');
    l1.className = 'sched-label';
    l1.textContent = '¿Qué días?';
    const days = document.createElement('div');
    days.className = 'sched-days';
    for (const [d, short, long] of DAYS) {
      const c = button(short, 'day', () => {
        e.days = e.days.includes(d) ? e.days.filter((x) => x !== d) : [...e.days, d];
        c.setAttribute('aria-pressed', e.days.includes(d) ? 'true' : 'false');
        save.disabled = !e.days.length;
      });
      c.setAttribute('aria-label', long);
      c.setAttribute('aria-pressed', e.days.includes(d) ? 'true' : 'false');
      days.appendChild(c);
    }

    const l2 = document.createElement('p');
    l2.className = 'sched-label';
    l2.textContent = '¿A qué hora?';
    const time = document.createElement('input');
    time.type = 'time';
    time.className = 'sched-input';
    time.value = String(e.hh).padStart(2, '0') + ':' + String(e.mm).padStart(2, '0');
    time.addEventListener('change', () => { const [h, m] = time.value.split(':').map(Number); if (!isNaN(h)) { e.hh = h; e.mm = m || 0; } });

    const l3 = document.createElement('p');
    l3.className = 'sched-label';
    l3.textContent = '¿Qué limpia?';
    const chips = document.createElement('div');
    chips.className = 'chips';
    const all = button('Toda la casa', 'chip', () => { e.segIds = []; paint(); });
    chips.appendChild(all);
    const segChips = [];
    for (const s of getSegments()) {
      const c = button(s.name, 'chip', () => {
        const id = String(s.id);
        e.segIds = e.segIds.includes(id) ? e.segIds.filter((x) => x !== id) : [...e.segIds, id];
        paint();
      });
      segChips.push([String(s.id), c]);
      chips.appendChild(c);
    }
    function paint() {
      all.setAttribute('aria-pressed', e.segIds.length ? 'false' : 'true');
      for (const [id, c] of segChips) c.setAttribute('aria-pressed', e.segIds.includes(id) ? 'true' : 'false');
    }
    paint();

    const row = document.createElement('div');
    row.className = 'sched-buttons';
    const cancel = button('Cancelar', 'btn ghost', () => { st.editing = null; render(); });
    const save = button('Guardar', 'btn primary', async () => {
      save.disabled = true;
      const utc = toUtc(e.days, e.hh, e.mm);
      const body = {
        enabled: e.enabled !== false,
        label: encodeLabel(e.days, e.hh, e.mm),
        ...utc,
        action: e.segIds.length
          ? { type: 'segment_cleanup', params: { segment_ids: e.segIds, iterations: 1, custom_order: false } }
          : { type: 'full_cleanup', params: {} }
      };
      try {
        if (e.id) await req('PUT', '/' + e.id, body);
        else await req('POST', '', body);
        toast('Hecho. Limpiaré ' + describeDays(e.days).toLowerCase() + ' a las ' + time.value);
        st.editing = null;
      } catch (err) {
        toast('No he podido guardarlo. Prueba otra vez.');
        save.disabled = false;
      }
      refresh();
    });
    save.disabled = !e.days.length;
    row.append(cancel, save);

    el.append(l1, days, l2, time, l3, chips, row);

    if (e.id) {
      el.appendChild(button('Borrar esta programación', 'link-btn sched-del', async () => {
        try { await req('DELETE', '/' + e.id); toast('Programación borrada'); } catch (err) { toast('No he podido borrarla.'); }
        st.editing = null;
        refresh();
      }));
    }
  }

  return { refresh, render };
}
