// Cliente mínimo de la API REST de Valetudo (v2).
// Todas las rutas son relativas: el servidor de la app hace de proxy de /api.

const BASE = '/api/v2';

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(method + ' ' + path + ' -> ' + res.status);
  const text = await res.text();
  if (!text) return null;
  // Las órdenes (PUT) de Valetudo responden con el texto "OK", no con JSON
  try { return JSON.parse(text); } catch { return text; }
}

const cap = (name) => '/robot/capabilities/' + name;

export const valetudoApi = {
  attributes: () => request('GET', '/robot/state/attributes'),
  map: () => request('GET', '/robot/state/map'),
  segments: () => request('GET', cap('MapSegmentationCapability')).catch(() => []),
  currentStats: () => request('GET', cap('CurrentStatisticsCapability')).catch(() => []),
  consumables: () => request('GET', cap('ConsumableMonitoringCapability')).catch(() => []),
  fanPresets: () => request('GET', cap('FanSpeedControlCapability') + '/presets').catch(() => []),

  start: () => request('PUT', cap('BasicControlCapability'), { action: 'start' }),
  pause: () => request('PUT', cap('BasicControlCapability'), { action: 'pause' }),
  stop: () => request('PUT', cap('BasicControlCapability'), { action: 'stop' }),
  home: () => request('PUT', cap('BasicControlCapability'), { action: 'home' }),
  locate: () => request('PUT', cap('LocateCapability'), { action: 'locate' }),
  setFan: (name) => request('PUT', cap('FanSpeedControlCapability') + '/preset', { name }),
  cleanSegments: (ids) => request('PUT', cap('MapSegmentationCapability'), {
    action: 'start_segment_action',
    segment_ids: ids.map(String),
    iterations: 1,
    customOrder: false
  })
};

// ---- Helpers para leer las respuestas ----

export function readAttributes(attrs) {
  const out = { status: 'unknown', statusFlag: 'none', battery: null, batteryFlag: 'none', fan: null, error: null };
  for (const a of attrs || []) {
    if (a.__class === 'StatusStateAttribute') {
      out.status = a.value;
      out.statusFlag = a.flag;
      out.error = a.error || (a.metaData && (a.metaData.error || a.metaData.error_description)) || null;
    } else if (a.__class === 'BatteryStateAttribute') {
      out.battery = a.level;
      out.batteryFlag = a.flag;
    } else if (a.__class === 'PresetSelectionStateAttribute' && a.type === 'fan_speed') {
      out.fan = a.value;
    }
  }
  return out;
}

export function readStats(points) {
  const out = { seconds: 0, m2: 0 };
  for (const p of points || []) {
    if (p.type === 'time') out.seconds = p.value;
    if (p.type === 'area') out.m2 = p.value / 10000; // cm² -> m²
  }
  return out;
}
