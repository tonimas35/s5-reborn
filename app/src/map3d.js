// Mapa 3D de la casa con three.js a partir del mapa de Valetudo.
// Unidades de la escena: centímetros. X = x del mapa, Z = y del mapa, Y = altura.

import {
  WebGLRenderer, Scene, OrthographicCamera, HemisphereLight, DirectionalLight,
  InstancedMesh, BoxGeometry, CylinderGeometry, RingGeometry, PlaneGeometry, MeshLambertMaterial, MeshBasicMaterial,
  Mesh, Group, Color, Matrix4, Vector3, Raycaster, Vector2, PCFShadowMap, DoubleSide,
  CanvasTexture, SRGBColorSpace, LinearFilter
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { TOUCH } from 'three';

const FLOOR_H = 3;
const WALL_H = 46;
const ROOM_COLORS = ['#DCE4D8', '#EFE4D2', '#D9E2EA', '#E5DFEA', '#F1DDD0', '#ECE7CF', '#EEDADD', '#D6E7E0', '#E3E8D3', '#E9E0D6'];
const NEUTRAL = new Color('#ECEAE5');
const DIMMED = new Color('#EEECE8');
const ALERT = '#8A4B2E';

// Agrupa las tiras horizontales de Valetudo [x, y, n] en rectángulos para usar menos geometría
function rectsFromRuns(compressed) {
  const byKey = new Map();
  for (let i = 0; i < compressed.length; i += 3) {
    const x = compressed[i];
    const y = compressed[i + 1];
    const n = compressed[i + 2];
    const key = x + ',' + n;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(y);
  }
  const rects = [];
  for (const [key, ys] of byKey) {
    const [x, n] = key.split(',').map(Number);
    ys.sort((a, b) => a - b);
    let start = ys[0];
    let prev = ys[0];
    for (let i = 1; i <= ys.length; i++) {
      const y = ys[i];
      if (y === prev + 1) { prev = y; continue; }
      rects.push({ x, y: start, w: n, h: prev - start + 1 });
      start = y;
      prev = y;
    }
  }
  return rects;
}

function layerFingerprint(layer) {
  const c = layer.compressedPixels || [];
  let sum = 0;
  for (let i = 0; i < c.length; i += 7) sum = (sum + c[i] * (i + 1)) % 1000000007;
  return layer.type + ':' + (layer.metaData && layer.metaData.segmentId) + ':' + c.length + ':' + sum;
}

export class HouseMap {
  constructor(container, { accent = '#3F5747', onRoomTap = () => {} } = {}) {
    this.container = container;
    this.accent = accent;
    this.onRoomTap = onRoomTap;
    this.tone = 'normal';
    this.highlight = { active: [], selected: [] };
    this.segments = new Map(); // id -> { name, color, centroid, label }
    this.instances = []; // por instancia de suelo: { seg, matrix }
    this.fingerprint = '';
    this.needsRender = true;
    this.hasMap = false;

    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.domElement.className = 'map3d-canvas';
    container.appendChild(this.renderer.domElement);

    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'map3d-labels';
    container.appendChild(this.labelLayer);

    this.scene = new Scene();
    this.world = new Group();
    this.scene.add(this.world);

    this.camera = new OrthographicCamera(-1, 1, 1, -1, -20000, 20000);
    this.scene.add(new HemisphereLight(0xffffff, 0xe2ddd3, 2.25));
    this.sun = new DirectionalLight(0xffffff, 0.95);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.radius = 4;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = true;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = 1.22;
    this.controls.minZoom = 0.6;
    this.controls.maxZoom = 7;
    this.controls.touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE };
    this.controls.addEventListener('change', () => { this.needsRender = true; });
    this.controls.addEventListener('start', () => { this.userMoved = true; }); // la persona ha movido el mapa

    this.buildRobot();
    this.buildDock();
    this.buildPath();
    this.bindTaps();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const moved = this.controls.update();
      const animating = this.animateRobot();
      if (moved || animating || this.needsRender) {
        this.renderer.render(this.scene, this.camera);
        this.placeLabels();
        this.needsRender = false;
      }
    };
    loop();
  }

  // ---------- Construcción ----------

  buildRobot() {
    const g = new Group();
    const dark = new MeshLambertMaterial({ color: '#34332F' });
    const body = new Mesh(new CylinderGeometry(17.5, 17.5, 9, 48), dark);
    body.position.y = FLOOR_H + 4.5;
    body.castShadow = true;
    const top = new Mesh(new CylinderGeometry(16.6, 16.6, 1.2, 48), new MeshLambertMaterial({ color: '#FBFAF8' }));
    top.position.y = FLOOR_H + 9.6;
    this.lidarMat = new MeshLambertMaterial({ color: this.accent });
    const lidar = new Mesh(new CylinderGeometry(4.8, 4.8, 3.4, 32), this.lidarMat);
    lidar.position.set(4, FLOOR_H + 11.6, 0);
    lidar.castShadow = true;
    this.haloMat = new MeshBasicMaterial({ color: this.accent, transparent: true, opacity: 0.16, side: DoubleSide, depthWrite: false });
    const halo = new Mesh(new RingGeometry(19, 30, 48), this.haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = FLOOR_H + 0.4;
    g.add(halo, body, top, lidar);
    g.scale.setScalar(1.8);
    g.visible = false;
    this.robot = g;
    this.robotTarget = null;
    this.world.add(g);
  }

  buildDock() {
    const dock = new Mesh(new BoxGeometry(9, 12, 17), new MeshLambertMaterial({ color: '#2D2C29' }));
    dock.castShadow = true;
    dock.scale.setScalar(1.6);
    dock.visible = false;
    this.dock = dock;
    this.world.add(dock);
  }

  buildPath() {
    this.pathMat = new LineMaterial({ color: this.accent, linewidth: 4, transparent: true, opacity: 0.5, worldUnits: false });
    this.pathGeom = new LineGeometry();
    this.path = new Line2(this.pathGeom, this.pathMat);
    this.path.visible = false;
    this.world.add(this.path);
  }

  bindTaps() {
    const el = this.renderer.domElement;
    let down = null;
    let lastTap = 0;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 350;
      down = null;
      if (moved > 8 || !quick) return;
      const id = this.pick(e.clientX, e.clientY);
      const now = performance.now();
      if (id && now - lastTap < 320) { this.focusRoom(id); lastTap = 0; return; }
      lastTap = now;
      if (id) this.onRoomTap(id);
    });
  }

  pick(cx, cy) {
    if (!this.floorMesh || !this.grid) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    const ray = new Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObject(this.floorMesh, false)[0];
    if (!hit || !hit.uv) return null;
    const g = this.grid;
    const px = Math.min(g.w - 1, Math.floor(hit.uv.x * g.w));
    const py = Math.min(g.h - 1, Math.floor((1 - hit.uv.y) * g.h));
    const idx = g.cells[py * g.w + px];
    return idx > 0 ? g.ids[idx - 1] : null;
  }

  // ---------- Datos ----------

  update(map) {
    const layers = (map && map.layers) || [];
    const isDefault = map && map.metaData && map.metaData.defaultMap;
    const useful = layers.filter((l) => l.type === 'segment' || l.type === 'floor' || l.type === 'wall');
    this.hasMap = !isDefault && useful.some((l) => (l.compressedPixels || []).length > 0);
    if (!this.hasMap) return false;

    this.ps = map.pixelSize || 5;
    const fp = useful.map(layerFingerprint).join('|');
    if (fp !== this.fingerprint) {
      this.fingerprint = fp;
      this.buildLayers(useful);
    }
    this.updateEntities(map.entities || []);
    this.needsRender = true;
    return true;
  }

  buildLayers(layers) {
    const ps = this.ps;
    for (const m of [this.floorMesh, this.wallMesh, this.baseMesh]) {
      if (m) {
        this.world.remove(m);
        m.geometry.dispose();
        if (m.material.map) m.material.map.dispose();
        m.material.dispose();
      }
    }
    for (const s of this.segments.values()) s.label.remove();
    this.segments.clear();

    // Límites del mapa en píxeles
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const l of layers) {
      const c = l.compressedPixels || [];
      for (let i = 0; i < c.length; i += 3) {
        if (c[i] < minX) minX = c[i];
        if (c[i] + c[i + 2] - 1 > maxX) maxX = c[i] + c[i + 2] - 1;
        if (c[i + 1] < minY) minY = c[i + 1];
        if (c[i + 1] > maxY) maxY = c[i + 1];
      }
    }
    const gw = maxX - minX + 1;
    const gh = maxY - minY + 1;

    // Rejilla: 0 = nada, 1..n = habitación (o suelo sin habitación)
    const cells = new Uint16Array(gw * gh);
    const ids = [];
    const colors = [];
    let colorIndex = 0;
    for (const layer of layers) {
      if (layer.type === 'wall') continue;
      const id = layer.type === 'segment' ? String(layer.metaData.segmentId) : null;
      const color = id ? new Color(ROOM_COLORS[colorIndex++ % ROOM_COLORS.length]) : NEUTRAL.clone();
      ids.push(id);
      colors.push(color);
      const idx = ids.length;
      let sx = 0, sz = 0, n = 0;
      const c = layer.compressedPixels || [];
      for (let i = 0; i < c.length; i += 3) {
        const y = c[i + 1] - minY;
        for (let k = 0; k < c[i + 2]; k++) cells[y * gw + (c[i] - minX + k)] = idx;
        sx += (c[i] + c[i + 2] / 2) * ps * c[i + 2];
        sz += (c[i + 1] + 0.5) * ps * c[i + 2];
        n += c[i + 2];
      }
      if (id) {
        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'map3d-label';
        label.textContent = (layer.metaData && layer.metaData.name) || 'Habitación ' + colorIndex;
        label.addEventListener('click', () => this.onRoomTap(id));
        this.labelLayer.appendChild(label);
        this.segments.set(id, { name: label.textContent, label, centroid: new Vector3(sx / n, FLOOR_H + WALL_H + 14, sz / n) });
      }
    }
    // Las paredes también cuentan como "suelo" bajo ellas para que no queden huecos
    const canvas = document.createElement('canvas');
    canvas.width = gw;
    canvas.height = gh;
    this.grid = { w: gw, h: gh, cells, ids, colors, canvas, ctx: canvas.getContext('2d') };

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    this.floorTex = tex;

    const W = gw * ps;
    const D = gh * ps;
    const cx = (minX + gw / 2) * ps;
    const cz = (minY + gh / 2) * ps;
    const plane = new PlaneGeometry(W, D);
    plane.rotateX(-Math.PI / 2);
    this.floorMesh = new Mesh(plane, new MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
    this.floorMesh.position.set(cx, FLOOR_H, cz);
    this.floorMesh.receiveShadow = true;
    this.world.add(this.floorMesh);

    // Paredes en bloques
    const box = new BoxGeometry(1, 1, 1);
    const m = new Matrix4();
    const wallRects = layers.filter((l) => l.type === 'wall').flatMap((l) => rectsFromRuns(l.compressedPixels || []));
    this.wallMesh = new InstancedMesh(box, new MeshLambertMaterial({ color: '#FBFAF8' }), Math.max(1, wallRects.length));
    this.wallMesh.castShadow = true;
    this.wallMesh.receiveShadow = true;
    wallRects.forEach((r, i) => {
      const w = r.w * ps;
      const d = r.h * ps;
      m.makeScale(w, WALL_H, d).setPosition(r.x * ps + w / 2, FLOOR_H + WALL_H / 2, r.y * ps + d / 2);
      this.wallMesh.setMatrixAt(i, m);
    });
    this.world.add(this.wallMesh);

    // Centrar la casa en el origen
    this.world.position.set(-cx, 0, -cz);
    const grew = !this.extent || W > this.extent.x || D > this.extent.z;
    this.extent = { x: W, z: D };
    // Puntos ocupados (relativos al centro), para encuadrar la casa y no la caja que la envuelve
    const pts = [];
    const step = Math.max(1, Math.round(Math.sqrt((gw * gh) / 40000))); // como mucho ~40k muestras
    for (let y = 0; y < gh; y += step) for (let x = 0; x < gw; x += step) {
      if (cells[y * gw + x]) pts.push((x + 0.5 - gw / 2) * ps, FLOOR_H, (y + 0.5 - gh / 2) * ps);
    }
    for (const r of wallRects) pts.push((r.x - minX + r.w / 2 - gw / 2) * ps, FLOOR_H + WALL_H, (r.y - minY + r.h / 2 - gh / 2) * ps);
    this.contentPts = pts;
    // El encuadre depende del tamaño de la casa, que crece mientras el robot descubre el mapa
    if (this.aspect && (grew || !this.framed)) {
      this.fitFrustum();
      // Mientras descubre la casa, si nadie ha tocado el mapa, lo mantenemos centrado
      if (grew && this.framed && !this.userMoved) this.recenter(false);
    }
    this.applyHighlight();

    // Sombra ajustada al tamaño de la casa
    const r = Math.max(this.extent.x, this.extent.z) * 0.75;
    Object.assign(this.sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 8000 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.position.set(-r * 0.6, r * 2.2, -r * 0.9);

    if (!this.framed) { this.recenter(false); this.framed = true; }
  }

  updateEntities(entities) {
    const robot = entities.find((e) => e.type === 'robot_position');
    const dock = entities.find((e) => e.type === 'charger_location');
    const path = entities.find((e) => e.type === 'path');

    if (robot && robot.points && robot.points.length >= 2) {
      const target = new Vector3(robot.points[0], 0, robot.points[1]);
      const angle = -(((robot.metaData && robot.metaData.angle) || 0) * Math.PI) / 180;
      if (!this.robot.visible || this.robot.position.distanceTo(target) > 250) {
        this.robot.position.copy(target);
        this.robot.rotation.y = angle;
      }
      this.robotTarget = { pos: target, angle };
      this.robot.visible = true;
    } else {
      this.robot.visible = false;
    }

    if (dock && dock.points && dock.points.length >= 2) {
      this.dock.position.set(dock.points[0], FLOOR_H + 9.6, dock.points[1]);
      this.dock.rotation.y = -(((dock.metaData && dock.metaData.angle) || 0) * Math.PI) / 180;
      this.dock.visible = true;
    }

    const pts = (path && path.points) || [];
    if (pts.length >= 4) {
      const step = Math.max(1, Math.floor(pts.length / 2 / 3000)); // como mucho ~3000 puntos
      const pos = [];
      for (let i = 0; i + 1 < pts.length; i += 2 * step) pos.push(pts[i], FLOOR_H + 0.8, pts[i + 1]);
      if (pos.length >= 6) {
        this.pathGeom.dispose();
        this.pathGeom = new LineGeometry();
        this.pathGeom.setPositions(pos);
        this.path.geometry = this.pathGeom;
        this.path.computeLineDistances();
        this.path.visible = true;
      }
    } else {
      this.path.visible = false;
    }
  }

  animateRobot() {
    if (!this.robotTarget || !this.robot.visible) return false;
    const p = this.robot.position;
    const t = this.robotTarget;
    const d = p.distanceTo(t.pos);
    let da = t.angle - this.robot.rotation.y;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (d < 0.5 && Math.abs(da) < 0.01) return false;
    p.lerp(t.pos, 0.12);
    this.robot.rotation.y += da * 0.15;
    return true;
  }

  // ---------- Apariencia ----------

  setHighlight({ active = [], selected = [] } = {}) {
    this.highlight = { active: active.map(String), selected: selected.map(String) };
    this.applyHighlight();
  }

  applyHighlight() {
    if (!this.floorMesh || !this.grid) return;
    const { active, selected } = this.highlight;
    const focus = selected.length ? selected : active;
    const g = this.grid;
    const accent = new Color(this.accent);
    // Color final (sRGB, 0-255) de cada entrada de la rejilla
    const rgb = g.colors.map((base, i) => {
      const id = g.ids[i];
      const on = id && focus.includes(id);
      const c = base.clone();
      if (focus.length > 0 && !on) c.lerp(DIMMED, 0.65);
      if (on && selected.length) c.lerp(accent, 0.22);
      return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
    });
    const img = g.ctx.createImageData(g.w, g.h);
    const d = img.data;
    for (let i = 0; i < g.cells.length; i++) {
      const v = g.cells[i];
      if (!v) continue;
      const [r, gg, b] = rgb[v - 1];
      d[i * 4] = r;
      d[i * 4 + 1] = gg;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = 255;
    }
    g.ctx.putImageData(img, 0, 0);
    this.floorTex.needsUpdate = true;
    for (const [id, s] of this.segments) {
      s.label.classList.toggle('is-on', focus.includes(id));
      s.label.classList.toggle('is-dim', focus.length > 0 && !focus.includes(id));
    }
    this.needsRender = true;
  }

  setTone(tone) {
    this.tone = tone;
    const c = tone === 'alert' ? ALERT : this.accent;
    this.lidarMat.color.set(c);
    this.haloMat.color.set(c);
    this.haloMat.opacity = tone === 'alert' ? 0.24 : 0.16;
    this.needsRender = true;
  }

  // ---------- Cámara ----------

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.pathMat.resolution.set(w, h);
    this.aspect = w / h;
    this.fitFrustum();
    this.needsRender = true;
  }

  // Dirección de la cámara en la vista por defecto (la de "Centrar el mapa")
  defaultView() {
    const dist = 4000;
    const polar = 0.86; // ~49° desde la vertical
    const azimuth = Math.PI / 4.5;
    return new Vector3(
      dist * Math.sin(polar) * Math.sin(azimuth),
      dist * Math.cos(polar),
      dist * Math.sin(polar) * Math.cos(azimuth)
    );
  }

  // Ajusta el encuadre a lo que ocupa la casa vista desde la cámara por defecto.
  // Usa las celdas reales de suelo y paredes y descarta el 1 % más alejado: el láser
  // ve rayos sueltos por puertas y ventanas que agrandan mucho la caja del mapa.
  fitFrustum() {
    const eye = this.defaultView();
    const view = new Matrix4().lookAt(eye, new Vector3(0, 0, 0), new Vector3(0, 1, 0));
    const inv = view.clone().invert();
    const pts = this.contentPts || [];
    let x0, x1, y0, y1;
    if (pts.length >= 30) {
      const xs = [], ys = [];
      const v = new Vector3();
      for (let i = 0; i < pts.length; i += 3) {
        v.set(pts[i], pts[i + 1], pts[i + 2]).applyMatrix4(inv);
        xs.push(v.x);
        ys.push(v.y);
      }
      const q = (a, f) => a[Math.min(a.length - 1, Math.max(0, Math.round(f * (a.length - 1))))];
      xs.sort((a, b) => a - b);
      ys.sort((a, b) => a - b);
      [x0, x1, y0, y1] = [q(xs, 0.01), q(xs, 0.99), q(ys, 0.01), q(ys, 0.99)];
    } else {
      const h = ((this.extent && Math.max(this.extent.x, this.extent.z)) || 800) / 2;
      [x0, x1, y0, y1] = [-h, h, -h * 0.7, h * 0.7];
    }
    // Centro de la casa en pantalla, pasado a coordenadas del mundo
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const right = new Vector3().setFromMatrixColumn(view, 0);
    const up = new Vector3().setFromMatrixColumn(view, 1);
    this.viewCenter = right.multiplyScalar(cx).add(up.multiplyScalar(cy));
    let hw = Math.max(60, (x1 - x0) / 2) * 1.1; // un poco de aire alrededor
    let hh = Math.max(60, (y1 - y0) / 2) * 1.15;
    if (hw / hh > this.aspect) hh = hw / this.aspect; else hw = hh * this.aspect;
    Object.assign(this.camera, { left: -hw, right: hw, top: hh, bottom: -hh });
    this.camera.updateProjectionMatrix();
  }

  recenter(animate = true) {
    this.userMoved = false;
    if (this.aspect) this.fitFrustum();
    const center = this.viewCenter ? this.viewCenter.clone() : new Vector3(0, 0, 0);
    const pos = this.defaultView().add(center);
    const apply = () => {
      this.controls.target.copy(center);
      this.camera.position.copy(pos);
      this.camera.zoom = 1;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this.needsRender = true;
    };
    if (!animate) return apply();
    this.tween({ target: center, position: pos, zoom: 1 });
  }

  zoomBy(f) {
    this.userMoved = true;
    this.tween({ zoom: Math.min(this.controls.maxZoom, Math.max(this.controls.minZoom, this.camera.zoom * f)) });
  }

  focusRoom(id) {
    const s = this.segments.get(id);
    if (!s) return;
    this.userMoved = true;
    const t = s.centroid.clone().add(this.world.position);
    t.y = 0;
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.tween({ target: t, position: t.clone().add(offset), zoom: Math.max(2.2, this.camera.zoom) });
  }

  tween({ target, position, zoom }) {
    const from = { t: this.controls.target.clone(), p: this.camera.position.clone(), z: this.camera.zoom };
    const start = performance.now();
    const dur = 450;
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      if (target) this.controls.target.lerpVectors(from.t, target, e);
      if (position) this.camera.position.lerpVectors(from.p, position, e);
      if (zoom) { this.camera.zoom = from.z + (zoom - from.z) * e; this.camera.updateProjectionMatrix(); }
      this.needsRender = true;
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }

  placeLabels() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const v = new Vector3();
    for (const s of this.segments.values()) {
      v.copy(s.centroid).add(this.world.position).project(this.camera);
      const x = ((v.x + 1) / 2) * w;
      const y = ((1 - v.y) / 2) * h;
      s.label.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%)';
      s.label.style.visibility = x < -40 || x > w + 40 || y < -20 || y > h + 20 ? 'hidden' : 'visible';
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
