// Modo demo: una casa de ejemplo y un robot simulado con la misma interfaz que valetudoApi.
// Se activa abriendo la app con ?demo (o ?demo=error para ver el aviso de atasco).

const PX = 5; // cm por píxel, igual que Valetudo
const OX = 400; // desplazamiento del mapa en píxeles
const OY = 400;

const ROOMS = [
  { id: '16', name: 'Salón', r: [0, 0, 112, 82] },
  { id: '17', name: 'Cocina', r: [112, 0, 200, 52] },
  { id: '18', name: 'Pasillo', r: [112, 52, 200, 82] },
  { id: '19', name: 'Dormitorio', r: [0, 82, 76, 160] },
  { id: '20', name: 'Baño', r: [76, 82, 122, 160] },
  { id: '21', name: 'Estudio', r: [122, 82, 200, 160] }
];
// Huecos de puerta [x0, y0, x1, y1] (en píxeles del plano)
const DOORS = [
  [111, 20, 113, 38], // salón-cocina
  [111, 60, 113, 76], // salón-pasillo
  [140, 51, 158, 53], // cocina-pasillo
  [30, 81, 48, 83], // salón-dormitorio
  [90, 81, 106, 83], // pasillo-baño (por el salón)
  [150, 81, 168, 83] // pasillo-estudio
];
const W = 200;
const H = 160;
const DOCK = { x: 6, y: 40 };

function buildGrid() {
  const grid = new Array(W * H).fill(null); // null | 'wall' | roomId
  for (const room of ROOMS) {
    const [x0, y0, x1, y1] = room.r;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const border = x === x0 || y === y0 || x === x1 - 1 || y === y1 - 1;
        grid[y * W + x] = border ? 'wall' : room.id;
      }
    }
  }
  for (const [x0, y0, x1, y1] of DOORS) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const room = ROOMS.find((r) => x > r.r[0] && x < r.r[2] - 1 && y > r.r[1] && y < r.r[3] - 1) ||
          ROOMS.find((r) => x >= r.r[0] && x < r.r[2] && y >= r.r[1] && y < r.r[3]);
        if (room) grid[y * W + x] = room.id;
      }
    }
  }
  return grid;
}

function compress(grid, match) {
  const out = [];
  let count = 0;
  for (let y = 0; y < H; y++) {
    let start = -1;
    for (let x = 0; x <= W; x++) {
      const on = x < W && match(grid[y * W + x]);
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        out.push(OX + start, OY + y, x - start);
        count += x - start;
        start = -1;
      }
    }
  }
  return { compressedPixels: out, count };
}

const GRID = buildGrid();
const WALLS = compress(GRID, (v) => v === 'wall');
const SEGMENTS = ROOMS.map((room) => ({ room, ...compress(GRID, (v) => v === room.id) }));

// Recorrido en zigzag dentro de una habitación (en cm)
function zigzag(room) {
  const [x0, y0, x1, y1] = room.r;
  const pts = [];
  const step = 7; // ~35 cm entre pasadas
  let dir = 1;
  for (let y = y0 + 4; y < y1 - 4; y += step) {
    const a = dir > 0 ? x0 + 4 : x1 - 5;
    const b = dir > 0 ? x1 - 5 : x0 + 4;
    pts.push([(OX + a) * PX, (OY + y) * PX], [(OX + b) * PX, (OY + y) * PX]);
    dir = -dir;
  }
  return pts;
}

function densify(points, spacing) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(d / spacing));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  if (points.length) out.push(points[points.length - 1]);
  return out;
}

const dockCm = [(OX + DOCK.x) * PX, (OY + DOCK.y) * PX];

export function createDemoApi(options = {}) {
  const s = {
    status: options.error ? 'error' : 'docked',
    battery: options.error ? 63 : 100,
    fan: 'medium',
    pos: options.error ? [(OX + 70) * PX, (OY + 22) * PX] : [dockCm[0] + 60, dockCm[1]],
    angle: 0,
    path: [],
    plan: [],
    seconds: options.error ? 940 : 0,
    m2: options.error ? 21 : 0,
    timer: null
  };

  function planFor(ids) {
    const rooms = ROOMS.filter((r) => !ids || ids.includes(r.id));
    let pts = [s.pos];
    for (const room of rooms) pts = pts.concat(zigzag(room));
    return densify(pts, 12);
  }

  function tick() {
    if (s.status === 'cleaning' || s.status === 'returning') {
      for (let i = 0; i < 4 && s.plan.length; i++) {
        const next = s.plan.shift();
        s.angle = (Math.atan2(next[1] - s.pos[1], next[0] - s.pos[0]) * 180) / Math.PI;
        s.pos = next;
        s.path.push(next[0], next[1]);
      }
      s.seconds += 6;
      if (s.status === 'cleaning') s.m2 += 0.25;
      s.battery = Math.max(15, s.battery - 0.15);
      if (!s.plan.length) {
        if (s.status === 'cleaning') {
          s.status = 'returning';
          s.plan = densify([s.pos, [dockCm[0] + 60, dockCm[1]], [dockCm[0] + 25, dockCm[1]]], 12);
        } else {
          s.status = 'docked';
          s.angle = 180;
        }
      }
    } else if (s.status === 'docked' && s.battery < 100) {
      s.battery = Math.min(100, s.battery + 0.5);
    }
  }
  s.timer = setInterval(tick, 400);

  const wait = () => new Promise((r) => setTimeout(r, 250));

  return {
    demo: true,
    async attributes() {
      return [
        { __class: 'StatusStateAttribute', value: s.status, flag: 'none', error: s.status === 'error' ? { message: 'Wheel suspended' } : undefined },
        { __class: 'BatteryStateAttribute', level: Math.round(s.battery), flag: s.status === 'docked' ? (s.battery >= 100 ? 'charged' : 'charging') : 'discharging' },
        { __class: 'PresetSelectionStateAttribute', type: 'fan_speed', value: s.fan }
      ];
    },
    async map() {
      return {
        __class: 'ValetudoMap',
        metaData: { version: 2, nonce: 'demo' },
        size: { x: 5120, y: 5120 },
        pixelSize: PX,
        layers: [
          { __class: 'MapLayer', type: 'wall', metaData: {}, compressedPixels: WALLS.compressedPixels },
          ...SEGMENTS.map((seg) => ({
            __class: 'MapLayer',
            type: 'segment',
            metaData: { segmentId: seg.room.id, name: seg.room.name, active: false, area: seg.count * PX * PX },
            compressedPixels: seg.compressedPixels
          }))
        ],
        entities: [
          { __class: 'PointMapEntity', type: 'charger_location', points: dockCm, metaData: { angle: 0 } },
          { __class: 'PointMapEntity', type: 'robot_position', points: s.pos, metaData: { angle: s.angle } },
          { __class: 'PathMapEntity', type: 'path', points: s.path.slice(), metaData: {} }
        ]
      };
    },
    async segments() {
      return ROOMS.map((r) => ({ __class: 'ValetudoMapSegment', id: r.id, name: r.name }));
    },
    async currentStats() {
      return [{ type: 'time', value: s.seconds }, { type: 'area', value: s.m2 * 10000 }];
    },
    async consumables() {
      return [
        { type: 'brush', subType: 'main', remaining: { value: 9356, unit: 'minutes' } },
        { type: 'filter', subType: 'main', remaining: { value: 5666, unit: 'minutes' } },
        { type: 'cleaning', subType: 'sensor', remaining: { value: 214, unit: 'minutes' } }
      ];
    },
    async fanPresets() {
      return ['low', 'medium', 'high', 'max'];
    },
    async start() {
      await wait();
      if (s.status === 'paused' && s.plan.length) { s.status = 'cleaning'; return; }
      s.path = [];
      s.seconds = 0;
      s.m2 = 0;
      s.plan = planFor(null);
      s.status = 'cleaning';
    },
    async cleanSegments(ids) {
      await wait();
      s.path = [];
      s.seconds = 0;
      s.m2 = 0;
      s.plan = planFor(ids.map(String));
      s.status = 'cleaning';
    },
    async pause() { await wait(); s.status = 'paused'; },
    async stop() { await wait(); s.status = 'idle'; s.plan = []; },
    async home() {
      await wait();
      s.status = 'returning';
      s.plan = densify([s.pos, [dockCm[0] + 60, dockCm[1]], [dockCm[0] + 25, dockCm[1]]], 12);
    },
    async locate() { await wait(); },
    async setFan(name) { await wait(); s.fan = name; }
  };
}
