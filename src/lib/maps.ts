import { PAD_X0, PAD_X1, PAD_Y0, PAD_Y1, TOWER_R, TRACK_HALF } from './constants';
import type { LaneData, MapDef, MapId, Vec } from './types';

export const LANE_STEP = 4;

/** Open Catmull-Rom spline through control points, returned as a dense polyline. */
function catmull(pts: Vec[], sub = 18): Vec[] {
  const out: Vec[] = [];
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    for (let s = 0; s < sub; s++) {
      const t = s / sub;
      const t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Resample a polyline into an arc-length lookup table (one sample every LANE_STEP px). */
function buildLane(id: number, ctrl: Vec[], sub = 18): LaneData {
  const dense = catmull(ctrl, sub);
  const cum: number[] = [0];
  for (let i = 1; i < dense.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
  }
  const total = cum[cum.length - 1];
  const n = Math.floor(total / LANE_STEP);
  const xs: number[] = [];
  const ys: number[] = [];
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const d = i * LANE_STEP;
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const f = Math.min(1, Math.max(0, (d - cum[j]) / seg));
    xs.push(dense[j].x + (dense[j + 1].x - dense[j].x) * f);
    ys.push(dense[j].y + (dense[j + 1].y - dense[j].y) * f);
  }
  const angs: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const a = Math.max(0, i - 1), b = Math.min(xs.length - 1, i + 1);
    angs.push(Math.atan2(ys[b] - ys[a], xs[b] - xs[a]));
  }
  return { id, step: LANE_STEP, length: n * LANE_STEP, xs, ys, angs };
}

export interface LanePos {
  x: number;
  y: number;
  angle: number;
}

export function sampleInto(lane: LaneData, d: number, out: LanePos): LanePos {
  const dd = Math.min(lane.length, Math.max(0, d));
  const f = dd / lane.step;
  const i = Math.min(lane.xs.length - 2, Math.floor(f));
  const r = f - i;
  out.x = lane.xs[i] + (lane.xs[i + 1] - lane.xs[i]) * r;
  out.y = lane.ys[i] + (lane.ys[i + 1] - lane.ys[i]) * r;
  out.angle = lane.angs[i];
  return out;
}

export function sampleLane(lane: LaneData, d: number): LanePos {
  return sampleInto(lane, d, { x: 0, y: 0, angle: 0 });
}

/** Closest track sample (over every lane) to a point. */
export function nearestTrack(map: MapDef, x: number, y: number): { d: number; x: number; y: number; lane: number; dist: number } {
  let best = Infinity;
  let bx = 0, by = 0, bl = 0, bd = 0;
  for (const lane of map.lanes) {
    for (let i = 0; i < lane.xs.length; i++) {
      const dx = lane.xs[i] - x, dy = lane.ys[i] - y;
      const q = dx * dx + dy * dy;
      if (q < best) { best = q; bx = lane.xs[i]; by = lane.ys[i]; bl = lane.id; bd = i * lane.step; }
    }
  }
  return { d: Math.sqrt(best), x: bx, y: by, lane: bl, dist: bd };
}

export function pointInConduit(map: MapDef, x: number, y: number): boolean {
  return map.conduits.some((c) => Math.hypot(c.x - x, c.y - y) <= c.r);
}

export interface PlaceCheck {
  ok: boolean;
  reason: string;
}

/** Deterministic placement rule shared by hover preview and the engine. */
export function validatePlacement(map: MapDef, towers: { x: number; y: number }[], x: number, y: number): PlaceCheck {
  if (x < PAD_X0 || x > PAD_X1 || y < PAD_Y0 || y > PAD_Y1) return { ok: false, reason: 'Outside the scroll' };
  if (nearestTrack(map, x, y).d < TRACK_HALF + TOWER_R + 6) return { ok: false, reason: 'Too close to the ink road' };
  for (const t of towers) {
    if (Math.hypot(t.x - x, t.y - y) < TOWER_R * 2 + 4) return { ok: false, reason: 'Overlaps another seal' };
  }
  return { ok: true, reason: '' };
}

// ---------- Map 1: Winding Calligraphy River ----------
function riverCtrl(): Vec[] {
  const rows = [70, 190, 310, 430, 540];
  const pts: Vec[] = [];
  const X0 = 140, X1 = 820;
  const wob = (x: number, row: number, a: number) => {
    const edge = Math.min(1, Math.min(x - X0, X1 - x) / 90);
    return Math.sin(x / 85 + row * 1.7) * a * Math.max(0, edge);
  };
  for (let r = 0; r < rows.length; r++) {
    const right = r % 2 === 0;
    const y = rows[r];
    const xs: number[] = [];
    if (right) {
      const start = r === 0 ? -30 : X0;
      const end = r === rows.length - 1 ? 940 : X1;
      for (let x = start; x <= end; x += 90) xs.push(x);
      if (xs[xs.length - 1] !== end) xs.push(end);
    } else {
      for (let x = X1; x >= X0; x -= 90) xs.push(x);
      if (xs[xs.length - 1] !== X0) xs.push(X0);
    }
    for (const x of xs) pts.push({ x, y: y + wob(x, r, 8) });
    if (r < rows.length - 1) {
      const y2 = rows[r + 1];
      const cy = (y + y2) / 2, rad = (y2 - y) / 2;
      const cx = right ? X1 : X0;
      for (let k = 1; k <= 3; k++) {
        const th = (-90 + k * 45) * (Math.PI / 180);
        const dx = rad * Math.cos(th) * (right ? 1 : -1);
        pts.push({ x: cx + dx, y: cy + rad * Math.sin(th) });
      }
    }
  }
  return pts;
}

// ---------- Map 3: Spiral Shrine ----------
function spiralCtrl(): Vec[] {
  const pts: Vec[] = [{ x: -30, y: 300 }, { x: 20, y: 300 }];
  const cx = 480, cy = 300, rx = 420, ry = 255;
  const N = 150;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const k = 1 - 0.88 * t;
    const th = Math.PI + Math.PI * 4 * t;
    pts.push({ x: cx + rx * k * Math.cos(th), y: cy + ry * k * Math.sin(th) });
  }
  pts.push({ x: 480, y: 300 });
  return pts;
}

let cache: Partial<Record<MapId, MapDef>> = {};

function buildMap(id: MapId): MapDef {
  if (id === 'river') {
    const lane = buildLane(0, riverCtrl(), 14);
    return {
      id, name: 'Winding Calligraphy River', jp: '蛇行の墨河', level: 'Beginner',
      blurb: 'A sweeping S-curve with four hairpin bends and two Conduit Stone Circles (+15% range).',
      lanes: [lane], entrances: [{ x: 0, y: 70 }], exits: [{ x: lane.xs[lane.xs.length - 1], y: lane.ys[lane.ys.length - 1] }],
      conduits: [{ x: 360, y: 250, r: 40 }, { x: 600, y: 370, r: 40 }],
      bridge: null, trackHalfWidth: TRACK_HALF, spiralBoost: false,
      labels: [{ text: 'Sumi-e River', x: 120, y: 34, rot: -0.04 }, { text: 'Entrance', x: 62, y: 106, rot: 0 }],
    };
  }
  if (id === 'bridge') {
    const A: Vec[] = [{ x: -30, y: 90 }, { x: 120, y: 90 }, { x: 240, y: 130 }, { x: 320, y: 220 }, { x: 400, y: 280 }, { x: 480, y: 300 }, { x: 560, y: 320 }, { x: 640, y: 390 }, { x: 740, y: 470 }, { x: 850, y: 470 }, { x: 930, y: 470 }];
    const B: Vec[] = A.map((p) => ({ x: p.x, y: 600 - p.y }));
    const la = buildLane(0, A, 18), lb = buildLane(1, B, 18);
    return {
      id, name: 'Twin-Bridge Crossover', jp: '双橋', level: 'Intermediate',
      blurb: 'Two lanes cross an origami overpass at the centre. Waves split across both; fire into either lane.',
      lanes: [la, lb], entrances: [{ x: 0, y: 90 }, { x: 0, y: 510 }],
      exits: [{ x: 930, y: 470 }, { x: 930, y: 130 }], conduits: [],
      bridge: { x: 480, y: 300, angle: 0, len: 150, wid: 78 }, trackHalfWidth: TRACK_HALF, spiralBoost: false,
      labels: [{ text: 'Overpass', x: 480, y: 372, rot: 0 }, { text: 'Entrance', x: 70, y: 56, rot: 0 }],
    };
  }
  const lane = buildLane(0, spiralCtrl(), 6);
  return {
    id: 'spiral', name: 'The Spiral Shrine', jp: '螺旋の社', level: 'Advanced',
    blurb: 'An inward coil to the central Hanko Stamp. The outer 40% of the road is 15% faster.',
    lanes: [lane], entrances: [{ x: 0, y: 300 }], exits: [{ x: 480, y: 300 }], conduits: [],
    bridge: null, trackHalfWidth: TRACK_HALF, spiralBoost: true,
    labels: [{ text: 'Entrance', x: 44, y: 334, rot: 0 }, { text: 'Spiral Shrine', x: 120, y: 34, rot: -0.03 }],
  };
}

export function getMap(id: MapId): MapDef {
  const hit = cache[id];
  if (hit) return hit;
  const m = buildMap(id);
  cache = { ...cache, [id]: m };
  return m;
}

export const MAP_ORDER: MapId[] = ['river', 'bridge', 'spiral'];
