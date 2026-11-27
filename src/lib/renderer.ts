import { glyph } from './glyph';
import { ELEMENTS, ENEMY_COLORS, H, MODIFIERS, RESONANCE_DIST, W, computeStats } from './constants';
import type { GameEngine } from './engine';
import { pointInConduit } from './maps';
import type { Element, Enemy, Fx, LaneData, MapDef, PathId, Patch, Projectile, Tower } from './types';

export interface UiState {
  hover: { x: number; y: number } | null;
  placing: Element | null;
  selectedId: number | null;
  previewUpgrade: { id: number; path: PathId } | null;
}

type Pt = [number, number];
const INK = '#1A1918';
const PAPER = '#F4EFE6';
const CJK = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK JP","Noto Serif JP","MS Mincho",serif';
const BRUSH = '"Brush Script MT","Segoe Script","Snell Roundhand","Apple Chancery",cursive';

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poly(g: CanvasRenderingContext2D, pts: Pt[], fill: string | null, stroke: string | null = INK, lw = 1): void {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); }
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string | null, stroke: string | null = null, lw = 1): void {
  g.beginPath();
  g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

function hexPts(r: number, rot = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < 6; i++) out.push([Math.cos(rot + (i * Math.PI) / 3) * r, Math.sin(rot + (i * Math.PI) / 3) * r]);
  return out;
}

// ============================================================ static map cache
const caches = new Map<string, HTMLCanvasElement>();

export function getMapCache(map: MapDef, scale: number): HTMLCanvasElement {
  const key = `${map.id}@${scale}`;
  const hit = caches.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = Math.round(W * scale);
  c.height = Math.round(H * scale);
  const g = c.getContext('2d');
  if (g) {
    g.scale(scale, scale);
    paintMap(g, map);
  }
  caches.set(key, c);
  return c;
}

function scrollShape(g: CanvasRenderingContext2D, rnd: () => number): void {
  const m = 9;
  const pts: Pt[] = [];
  const j = () => (rnd() - 0.5) * 5;
  for (let x = m; x < W - m; x += 14) pts.push([x, m + j()]);
  for (let y = m; y < H - m; y += 14) pts.push([W - m + j(), y]);
  for (let x = W - m; x > m; x -= 14) pts.push([x, H - m + j()]);
  for (let y = H - m; y > m; y -= 14) pts.push([m + j(), y]);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) g.lineTo(p[0], p[1]);
  g.closePath();
}

function paintWashi(g: CanvasRenderingContext2D, seed: number): void {
  const rnd = mulberry(seed);
  g.fillStyle = '#B7A88B';
  g.fillRect(0, 0, W, H);
  g.save();
  g.shadowColor = 'rgba(40,25,10,0.5)';
  g.shadowBlur = 14;
  scrollShape(g, mulberry(seed + 1));
  g.fillStyle = PAPER;
  g.fill();
  g.restore();
  g.save();
  scrollShape(g, mulberry(seed + 1));
  g.clip();
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W, y = rnd() * H, r = 40 + rnd() * 110;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${200 + rnd() * 30},${178 + rnd() * 30},${140 + rnd() * 30},${0.05 + rnd() * 0.07})`);
    gr.addColorStop(1, 'rgba(220,200,160,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.lineCap = 'round';
  for (let i = 0; i < 3600; i++) {
    const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI * 2, l = 5 + rnd() * 20;
    g.strokeStyle = rnd() > 0.5 ? `rgba(150,120,80,${0.04 + rnd() * 0.09})` : `rgba(255,255,255,${0.15 + rnd() * 0.25})`;
    g.lineWidth = 0.4 + rnd() * 0.7;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rnd() * 3, y + Math.sin(a) * l * 0.5 + rnd() * 3, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(120,95,60,${0.05 + rnd() * 0.1})`;
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  v.addColorStop(0, 'rgba(120,90,50,0)');
  v.addColorStop(1, 'rgba(120,90,50,0.28)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  g.restore();
  scrollShape(g, mulberry(seed + 1));
  g.strokeStyle = 'rgba(120,90,50,0.55)';
  g.lineWidth = 2;
  g.stroke();
}

function laneNormal(l: LaneData, i: number): Pt {
  const a = l.angs[Math.min(l.angs.length - 1, i)];
  return [-Math.sin(a), Math.cos(a)];
}

function paintTrack(g: CanvasRenderingContext2D, map: MapDef, seed: number): void {
  const rnd = mulberry(seed + 99);
  const hw = map.trackHalfWidth;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const l of map.lanes) {
    for (const [w, a] of [[hw * 2 + 18, 0.07], [hw * 2 + 9, 0.14]] as const) {
      g.strokeStyle = `rgba(40,34,30,${a})`;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(l.xs[0], l.ys[0]);
      for (let i = 1; i < l.xs.length; i++) g.lineTo(l.xs[i], l.ys[i]);
      g.stroke();
    }
  }
  for (const l of map.lanes) {
    for (let i = 0; i < l.xs.length; i++) {
      const d = i * l.step;
      const s = Math.min(1, d / 150);
      const taper = 0.55 + 0.45 * (s * s * (3 - 2 * s));
      const r = hw * taper * (0.94 + Math.sin(i * 0.21 + seed) * 0.05 + Math.sin(i * 0.07) * 0.03);
      circle(g, l.xs[i], l.ys[i], r, INK);
    }
    for (let i = 2; i < l.xs.length; i += 3) {
      const [nx, ny] = laneNormal(l, i);
      const side = rnd() > 0.5 ? 1 : -1;
      circle(g, l.xs[i] + nx * side * hw * 0.95, l.ys[i] + ny * side * hw * 0.95, 1.5 + rnd() * 3, INK);
    }
    const n = Math.floor(l.length / 16);
    for (let k = 0; k < n; k++) {
      const i = Math.floor(rnd() * l.xs.length);
      const [nx, ny] = laneNormal(l, i);
      const side = rnd() > 0.5 ? 1 : -1;
      const off = hw + 4 + rnd() * 22;
      g.globalAlpha = 0.45 + rnd() * 0.4;
      circle(g, l.xs[i] + nx * side * off, l.ys[i] + ny * side * off, 0.7 + rnd() * rnd() * 3.2, INK);
    }
    g.globalAlpha = 1;
    const streaks = Math.floor(l.length / 22);
    for (let k = 0; k < streaks; k++) {
      const s = Math.floor(rnd() * l.xs.length);
      const len = 12 + Math.floor(rnd() * 30);
      const off = (rnd() - 0.5) * hw * 1.5;
      g.strokeStyle = `rgba(244,239,230,${0.06 + rnd() * 0.14})`;
      g.lineWidth = 0.6 + rnd() * 0.9;
      g.beginPath();
      for (let i = s; i < Math.min(l.xs.length, s + len); i++) {
        const [nx, ny] = laneNormal(l, i);
        if (i === s) g.moveTo(l.xs[i] + nx * off, l.ys[i] + ny * off);
        else g.lineTo(l.xs[i] + nx * off, l.ys[i] + ny * off);
      }
      g.stroke();
    }
  }
}

function drawHanko(g: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number, label: string): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = '#C1121F';
  g.beginPath();
  g.roundRect(-size / 2, -size / 2, size, size, size * 0.12);
  g.fill();
  g.strokeStyle = 'rgba(244,239,230,0.85)';
  g.lineWidth = Math.max(1.5, size * 0.05);
  g.strokeRect(-size * 0.4, -size * 0.4, size * 0.8, size * 0.8);
  g.fillStyle = 'rgba(244,239,230,0.95)';
  g.font = `bold ${Math.round(size * 0.52)}px ${CJK}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(glyph(label), 0, size * 0.03);
  const r = mulberry(Math.floor(x * 7 + y));
  for (let i = 0; i < 8; i++) circle(g, (r() - 0.5) * size, (r() - 0.5) * size, 0.5 + r() * 1.4, PAPER);
  g.restore();
}

function brushText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, rot = 0, color = INK, alpha = 0.9, align: CanvasTextAlign = 'left'): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.font = `italic 700 ${size}px ${BRUSH}`;
  g.textBaseline = 'middle';
  g.textAlign = align;
  g.fillText(text, 0, 0);
  g.restore();
}

function paintMap(g: CanvasRenderingContext2D, map: MapDef): void {
  const seed = map.id === 'river' ? 11 : map.id === 'bridge' ? 23 : 37;
  paintWashi(g, seed);
  const rnd = mulberry(seed + 5);
  const track = (x: number, y: number) => {
    let best = Infinity;
    for (const l of map.lanes) for (let i = 0; i < l.xs.length; i += 2) best = Math.min(best, Math.hypot(l.xs[i] - x, l.ys[i] - y));
    return best;
  };
  for (let i = 0; i < 70; i++) {
    const x = 34 + rnd() * 892, y = 34 + rnd() * 532;
    if (track(x, y) < 48) continue;
    g.fillStyle = `rgba(110,150,90,${0.12 + rnd() * 0.12})`;
    g.beginPath();
    g.ellipse(x, y, 9 + rnd() * 8, 3.5 + rnd() * 2.5, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(70,110,60,0.55)';
    g.lineWidth = 1;
    for (let b = -1; b <= 1; b++) {
      g.beginPath();
      g.moveTo(x + b * 3, y + 1);
      g.lineTo(x + b * 5 + (rnd() - 0.5) * 3, y - 5 - rnd() * 4);
      g.stroke();
    }
  }
  for (const c of map.conduits) {
    g.fillStyle = 'rgba(120,170,140,0.2)';
    circle(g, c.x, c.y, c.r, 'rgba(120,170,140,0.2)');
    g.setLineDash([5, 4]);
    circle(g, c.x, c.y, c.r, null, '#2A9D8F', 2);
    g.setLineDash([]);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.fillStyle = '#9A9A92';
      g.strokeStyle = INK;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r, 5, 3.5, a, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.fillStyle = 'rgba(42,157,143,0.7)';
    g.font = `bold 9px ${CJK}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('+15% RANGE', c.x, c.y);
  }
  paintTrack(g, map, seed);
  if (map.bridge) {
    const b = map.bridge;
    g.save();
    g.translate(b.x, b.y);
    g.rotate(b.angle);
    g.shadowColor = 'rgba(0,0,0,0.4)';
    g.shadowBlur = 8;
    g.fillStyle = '#A57544';
    g.fillRect(-b.len / 2, -b.wid / 2, b.len, b.wid);
    g.shadowBlur = 0;
    g.strokeStyle = '#6E4A28';
    g.lineWidth = 1.2;
    for (let x = -b.len / 2 + 10; x < b.len / 2; x += 10) {
      g.beginPath();
      g.moveTo(x, -b.wid / 2);
      g.lineTo(x, b.wid / 2);
      g.stroke();
    }
    g.fillStyle = '#5B3A1E';
    g.fillRect(-b.len / 2 - 4, -b.wid / 2 - 4, b.len + 8, 6);
    g.fillRect(-b.len / 2 - 4, b.wid / 2 - 2, b.len + 8, 6);
    for (let x = -b.len / 2; x <= b.len / 2; x += 30) {
      g.fillStyle = '#C1121F';
      g.fillRect(x - 2.5, -b.wid / 2 - 7, 5, 10);
      g.fillRect(x - 2.5, b.wid / 2 - 3, 5, 10);
    }
    g.restore();
  }
  // entrance arrows
  for (const l of map.lanes) {
    const i = Math.min(l.xs.length - 1, 22);
    g.save();
    g.translate(l.xs[i], l.ys[i]);
    g.rotate(l.angs[i]);
    poly(g, [[-16, -3], [4, -3], [4, -9], [18, 0], [4, 9], [4, 3], [-16, 3]], 'rgba(244,239,230,0.88)', null);
    g.restore();
  }
  // exit hanko stamps
  map.exits.forEach((ex, i) => {
    const spiral = map.id === 'spiral';
    const size = spiral ? 46 : 38;
    const sx = Math.min(ex.x, 922), sy = ex.y;
    drawHanko(g, sx, sy, size, -0.12 + i * 0.2, spiral ? '社' : '守');
    brushText(g, 'Sanctuary', spiral ? sx - 40 : 938, sy + (sy > 300 ? 36 : -34), 17, 0, INK, 0.9, spiral ? 'left' : 'right');
  });
  for (const l of map.labels) brushText(g, l.text, l.x, l.y, 19, l.rot);
  drawHanko(g, 44, 556, 20, 0.1, '墨');
  drawHanko(g, 920, 44, 18, -0.1, '折');
}

// ============================================================ towers
function mix(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function drawTalisman(g: CanvasRenderingContext2D, x: number, y: number, rot: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = '#F7F0DC';
  g.strokeStyle = '#B8860B';
  g.lineWidth = 0.8;
  g.fillRect(-2.5, -5.5, 5, 11);
  g.strokeRect(-2.5, -5.5, 5, 11);
  g.fillStyle = '#C1121F';
  g.fillRect(-0.7, -4, 1.4, 8);
  g.restore();
}

export function drawTower(g: CanvasRenderingContext2D, t: Tower, time: number, alpha = 1): void {
  const def = ELEMENTS[t.element];
  const tier = Math.max(t.a, t.b);
  const bob = tier >= 3 ? Math.sin(time * 2 + t.id) * 2 : 0;
  g.save();
  g.globalAlpha = alpha;
  g.translate(t.x, t.y);
  g.fillStyle = 'rgba(30,20,10,0.2)';
  g.beginPath();
  g.ellipse(0, 10, 17, 6, 0, 0, Math.PI * 2);
  g.fill();
  if (tier >= 3) {
    const gr = g.createRadialGradient(0, -6, 2, 0, -6, 34);
    gr.addColorStop(0, 'rgba(255,215,90,0.35)');
    gr.addColorStop(1, 'rgba(255,215,90,0)');
    g.fillStyle = gr;
    g.fillRect(-36, -42, 72, 72);
  }
  const flap = Math.sin(time * 4 + t.id) * 0.12 + 1;
  const wingCol = mix(def.light, 0.92);
  const wingStroke = tier >= 3 ? '#B8860B' : INK;
  if (tier >= 1) {
    const s = 20 + tier * 4;
    for (const sgn of [-1, 1]) {
      poly(g, [[sgn * 7, -2], [sgn * s, (-13 - tier * 2.5) * flap], [sgn * (s - 5), 5]], wingCol, wingStroke, 1);
      if (tier >= 2) poly(g, [[sgn * 7, 3], [sgn * (s - 2), 0], [sgn * (s - 8), 11]], mix(def.color, 0.8), wingStroke, 1);
    }
  }
  const h = 22 + tier * 1.5;
  const apex: Pt = [0, -h + bob];
  const L: Pt = [-15, 6], F: Pt = [0, 13], R: Pt = [15, 6];
  poly(g, [apex, L, F], def.color, tier >= 3 ? '#D4A017' : INK, tier >= 3 ? 1.5 : 1);
  poly(g, [apex, F, R], def.dark, tier >= 3 ? '#D4A017' : INK, tier >= 3 ? 1.5 : 1);
  poly(g, [apex, [-5.5, -h * 0.45 + bob], [5.5, -h * 0.45 + bob]], def.light, null);
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(apex[0], apex[1]);
  g.lineTo(F[0], F[1]);
  g.stroke();
  const sy = 2 + bob * 0.3;
  circle(g, 0, sy, 5.5, t.element === 'ink' ? '#3A3C5C' : def.dark, tier >= 3 ? '#FFD34E' : '#F4EFE6', 1.2);
  g.fillStyle = '#F4EFE6';
  g.font = `bold 7px ${CJK}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(glyph(def.glyph) || def.name[0], 0, sy + 0.5);
  if (tier >= 3) {
    drawTalisman(g, Math.cos(time * 1.6 + t.id) * 22, -24 + Math.sin(time * 1.6 + t.id) * 5, Math.cos(time) * 0.3);
    drawTalisman(g, Math.cos(time * 1.6 + t.id + Math.PI) * 22, -24 + Math.sin(time * 1.6 + t.id + Math.PI) * 5, -Math.cos(time) * 0.3);
  }
  if (tier >= 4) drawApex(g, t, time);
  g.restore();
  // tier pips
  g.save();
  g.globalAlpha = alpha;
  for (let i = 0; i < 4; i++) {
    if (i < t.a) circle(g, t.x - 20 + i * 4, t.y + 19, 1.6, '#C1121F');
    if (i < t.b) circle(g, t.x + 8 + i * 4, t.y + 19, 1.6, '#2A6FDB');
  }
  g.restore();
}

function drawApex(g: CanvasRenderingContext2D, t: Tower, time: number): void {
  const def = ELEMENTS[t.element];
  const p = time * 2;
  switch (t.element) {
    case 'air':
      for (const s of [-1, 1]) {
        poly(g, [[s * 4, -14], [s * 40, -34 + Math.sin(p) * 3], [s * 30, -10]], '#DDF3EE', '#1B6B61', 1.2);
        poly(g, [[s * 4, -10], [s * 34, -12 + Math.sin(p + 1) * 3], [s * 22, 4]], '#9ADBCF', '#1B6B61', 1.2);
      }
      poly(g, [[0, -34], [-4, -24], [0, -18], [4, -24]], '#F4FFFC', '#1B6B61', 1);
      for (let k = 0; k < 4; k++) drawTalisman(g, Math.cos(p * 0.6 + k * 1.57) * 30, -32 + Math.sin(p * 0.6 + k * 1.57) * 6, 0.2 * k);
      break;
    case 'fire':
      poly(g, [[-6, -24], [-12, -42], [-2, -30]], '#FF9B3D', '#7A1F1F', 1);
      poly(g, [[6, -24], [12, -42], [2, -30]], '#FF9B3D', '#7A1F1F', 1);
      for (let k = 0; k < 5; k++) {
        const a = -2.6 + k * 0.55 + Math.sin(p + k) * 0.08;
        poly(g, [[Math.cos(a) * 14, Math.sin(a) * 14 - 6], [Math.cos(a) * 28, Math.sin(a) * 28 - 8 - Math.sin(p * 2 + k) * 3], [Math.cos(a + 0.25) * 14, Math.sin(a + 0.25) * 14 - 6]], k % 2 ? '#FFB703' : '#E63946', '#7A1F1F', 0.8);
      }
      poly(g, [[0, -30], [-7, -20], [0, -12], [7, -20]], '#FFD166', '#7A1F1F', 1);
      break;
    case 'water':
      for (let k = 0; k < 2; k++) {
        const a = p * 0.8 + k * Math.PI;
        const x = Math.cos(a) * 26, y = -14 + Math.sin(a) * 8;
        g.save();
        g.translate(x, y);
        g.rotate(a + Math.PI / 2);
        g.fillStyle = k ? '#E63946' : '#F4EFE6';
        g.strokeStyle = INK;
        g.lineWidth = 0.8;
        g.beginPath();
        g.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        poly(g, [[-6, 0], [-11, -3], [-11, 3]], k ? '#E63946' : '#F4EFE6', INK, 0.8);
        g.restore();
      }
      g.strokeStyle = '#8DB9FF';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, -26, 12, Math.PI, Math.PI * 2);
      g.stroke();
      break;
    case 'earth':
      poly(g, [[-7, -12], [-7, -38], [0, -46], [7, -38], [7, -12]], '#C99B5E', '#6B4A24', 1.2);
      poly(g, [[0, -46], [7, -38], [7, -12], [0, -16]], '#8F6B3F', '#6B4A24', 1);
      for (let k = 0; k < 3; k++) {
        const a = p * 0.7 + (k * Math.PI * 2) / 3;
        g.save();
        g.translate(Math.cos(a) * 30, -22 + Math.sin(a) * 9);
        g.rotate(a);
        poly(g, hexPts(6), '#D9B98A', '#6B4A24', 1);
        g.restore();
      }
      break;
    case 'ink':
      g.save();
      g.translate(0, -30 + Math.sin(p) * 2);
      g.rotate(Math.PI / 4 + Math.sin(p * 0.5) * 0.1);
      g.fillStyle = '#0B0B12';
      g.strokeStyle = '#8E8EC0';
      g.lineWidth = 1.4;
      g.fillRect(-9, -9, 18, 18);
      g.strokeRect(-9, -9, 18, 18);
      g.restore();
      for (let k = 0; k < 3; k++) circle(g, -8 + k * 8, -14 + ((p * 6 + k * 5) % 14), 1.8, '#0B0B12');
      break;
  }
  g.strokeStyle = mix(def.light, 0.5);
}

function drawOrbiters(g: CanvasRenderingContext2D, t: Tower, tt: number): void {
  const st = computeStats(t);
  if (st.orbit <= 0) return;
  for (let k = 0; k < st.orbit; k++) {
    const a = t.orbit + (k * Math.PI * 2) / st.orbit;
    g.save();
    g.translate(t.x + Math.cos(a) * st.orbitR, t.y + Math.sin(a) * st.orbitR);
    g.rotate(a * 2 + tt);
    const sz = st.orbit === 6 ? 8 : 7;
    poly(g, [[sz, 0], [0, -sz * 0.45], [-sz * 0.8, 0], [0, sz * 0.45]], '#E6C99C', '#6B4A24', 1.1);
    g.restore();
  }
  g.strokeStyle = 'rgba(143,107,63,0.18)';
  g.setLineDash([2, 5]);
  circle(g, t.x, t.y, st.orbitR, null, 'rgba(143,107,63,0.22)', 1);
  g.setLineDash([]);
}

function drawBeamsFromTower(g: CanvasRenderingContext2D, t: Tower, tt: number): void {
  if (!t.firing) return;
  const st = computeStats(t);
  const reach = 125 * (t.inConduit ? 1.15 : 1);
  g.save();
  g.translate(t.x, t.y);
  g.rotate(t.aim);
  if (st.laser) {
    const flick = 0.85 + Math.sin(tt * 40) * 0.15;
    g.fillStyle = 'rgba(193,18,31,0.35)';
    g.fillRect(0, -9, 1400, 18);
    g.fillStyle = `rgba(255,190,60,${0.85 * flick})`;
    g.fillRect(0, -5, 1400, 10);
    g.fillStyle = '#FFF6D6';
    g.fillRect(0, -2, 1400, 4);
  } else if (st.cone) {
    const half = st.coneAng / 2;
    const gr = g.createRadialGradient(0, 0, 6, 0, 0, reach);
    gr.addColorStop(0, 'rgba(255,230,120,0.85)');
    gr.addColorStop(0.5, 'rgba(255,120,40,0.55)');
    gr.addColorStop(1, 'rgba(230,57,70,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, reach, -half, half);
    g.closePath();
    g.fill();
    for (let k = 0; k < 6; k++) {
      const a = Math.sin(tt * 18 + k * 2) * half * 0.8;
      const d = 30 + ((tt * 140 + k * 37) % (reach - 30));
      circle(g, Math.cos(a) * d, Math.sin(a) * d, 2.5, k % 2 ? '#FFB703' : '#E63946');
    }
  }
  g.restore();
}

// ============================================================ enemies
function drawEnemy(g: CanvasRenderingContext2D, e: Enemy, time: number): void {
  const col = ENEMY_COLORS[e.kind];
  const fl = Math.sin(e.age * 14) * 0.5 + 0.5;
  g.save();
  g.translate(e.x, e.y);
  if (e.camo) {
    g.globalAlpha = 0.5;
    g.setLineDash([3, 3]);
  }
  const ln = (c: string) => (e.camo ? 'rgba(26,25,24,0.8)' : c);
  const dark = e.kind === 'moth' ? '#BDB29C' : '#00000033';
  const flip = Math.cos(e.angle) < 0;
  g.save();
  g.rotate(e.angle);
  if (flip) g.scale(1, -1);
  switch (e.kind) {
    case 'moth':
      poly(g, [[0, 0], [-5, -12 * (0.5 + fl)], [-9, -2]], '#F9F4E8', ln(INK), 1);
      poly(g, [[0, 0], [-5, 12 * (0.5 + fl)], [-9, 2]], '#F9F4E8', ln(INK), 1);
      poly(g, [[9, 0], [-6, -4.5], [-6, 4.5]], col, ln(INK), 1);
      poly(g, [[9, 0], [-6, -4.5], [-1, 0]], dark, null);
      break;
    case 'crane':
      poly(g, [[0, 0], [-4, -15 * (0.4 + fl * 0.8)], [-9, -1]], '#F3B8D0', ln(INK), 1);
      poly(g, [[0, 0], [-4, 15 * (0.4 + fl * 0.8)], [-9, 1]], '#D98AB0', ln(INK), 1);
      poly(g, [[11, 0], [0, -4.5], [-10, 0], [0, 4.5]], col, ln(INK), 1);
      poly(g, [[11, 0], [17, -3], [12, 1]], '#C1121F', ln(INK), 0.8);
      poly(g, [[-10, 0], [-16, 2], [-11, 3]], '#B65D86', ln(INK), 0.8);
      break;
    case 'fox':
      poly(g, [[-9, 0], [-19, -5], [-15, 2], [-19, 6]], '#F8F1E4', ln(INK), 1);
      poly(g, [[5, -6], [-8, -6], [-11, 0], [-8, 6], [5, 6]], col, ln(INK), 1);
      poly(g, [[5, -6], [-8, -6], [-2, 0]], '#B85A22', null);
      poly(g, [[13, 0], [5, -7], [5, 7]], '#F09A55', ln(INK), 1);
      poly(g, [[7, -6], [9, -13], [2, -7]], '#E07B39', ln(INK), 1);
      poly(g, [[7, 6], [9, 13], [2, 7]], '#E07B39', ln(INK), 1);
      circle(g, 8, -2, 1, INK);
      circle(g, 8, 2, 1, INK);
      break;
    case 'serpent': {
      for (let k = 6; k >= 0; k--) {
        const x = -k * 5, y = Math.sin(e.age * 6 - k * 0.9) * 3.5;
        poly(g, [[x + 5, y], [x, y - 6 + k * 0.4], [x - 5, y], [x, y + 6 - k * 0.4]], k % 2 ? '#3F7FB0' : col, ln(INK), 1);
      }
      poly(g, [[16, 0], [7, -6], [3, 0], [7, 6]], '#7FC3EA', ln(INK), 1);
      poly(g, [[8, -5], [4, -11], [2, -4]], '#DDF1FF', ln(INK), 0.8);
      circle(g, 9, -1.5, 1, INK);
      break;
    }
    case 'tortoise':
      for (const [lx, ly] of [[8, -11], [8, 11], [-8, -11], [-8, 11]] as Pt[]) poly(g, [[lx, ly], [lx + 4, ly + (ly > 0 ? 4 : -4)], [lx - 4, ly + (ly > 0 ? 4 : -4)]], '#5E6E5E', ln(INK), 0.8);
      poly(g, [[19, 0], [11, -4], [11, 4]], '#8FA08F', ln(INK), 1);
      poly(g, hexPts(14), e.armored ? '#565C68' : '#8A9C8A', ln(INK), 1.2);
      poly(g, hexPts(8, Math.PI / 6), e.armored ? '#444A56' : '#6F826F', ln(INK), 1);
      g.strokeStyle = e.armored ? '#9AA2B2' : '#586858';
      g.lineWidth = 0.8;
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        g.beginPath();
        g.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
        g.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
        g.stroke();
        if (e.armored) circle(g, Math.cos(a + 0.5) * 11, Math.sin(a + 0.5) * 11, 1.2, '#C9CFDA');
      }
      break;
    case 'dragon':
      for (let k = 5; k >= 0; k--) {
        const x = -k * 17, y = Math.sin(e.age * 3 - k * 0.8) * 5, r = 18 - k * 1.8;
        poly(g, [[x + r, y], [x, y - r], [x - r, y], [x, y + r]], k % 2 ? '#E7DEF0' : col, ln(INK), 1.4);
        poly(g, [[x, y - r], [x + 3, y - r - 7], [x - 3, y - r]], '#C1121F', ln(INK), 1);
      }
      poly(g, [[34, 0], [14, -14], [8, 0], [14, 14]], '#FFFFFF', ln(INK), 1.5);
      poly(g, [[16, -10], [10, -24], [24, -12]], '#C1121F', ln(INK), 1.2);
      poly(g, [[16, 10], [10, 24], [24, 12]], '#C1121F', ln(INK), 1.2);
      circle(g, 22, -4, 2, '#C1121F');
      circle(g, 22, 4, 2, '#C1121F');
      break;
  }
  g.restore();
  g.setLineDash([]);
  g.globalAlpha = 1;
  if (e.armored && e.kind !== 'tortoise') poly(g, hexPts(e.radius + 3), null, '#565C68', 2);
  if (e.flash > 0) circle(g, 0, 0, e.radius + 1, `rgba(255,255,255,${e.flash * 0.7})`);
  if (e.soak > 0) { g.setLineDash([2, 3]); circle(g, 0, 0, e.radius + 4, null, '#3A86FF', 1.4); g.setLineDash([]); }
  if (e.wind > 0) { g.strokeStyle = '#2A9D8F'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, e.radius + 6, time * 5, time * 5 + 1.6); g.stroke(); }
  if (e.burn > 0) { circle(g, -3, -e.radius - 3 - fl * 2, 2.5, '#FF9B3D'); circle(g, 3, -e.radius - 2 - fl * 3, 2, '#E63946'); }
  if (e.stain > 0 || e.stainPerm) for (let k = 0; k < 4; k++) circle(g, Math.cos(k * 1.7 + e.age) * (e.radius * 0.7), Math.sin(k * 1.7 + e.age) * (e.radius * 0.7), 1.6, INK);
  if (e.fract > 0) { g.strokeStyle = '#8F6B3F'; g.lineWidth = 1; g.beginPath(); g.moveTo(-5, -4); g.lineTo(0, 0); g.lineTo(-2, 5); g.moveTo(0, 0); g.lineTo(6, 2); g.stroke(); }
  if (e.frozen > 0) {
    const c = e.frozenKind === 'cube' ? '#1D1E2C' : e.frozenKind === 'petrify' ? '#9A9488' : '#BFE8FF';
    g.globalAlpha = 0.72;
    poly(g, hexPts(e.radius + 5, Math.PI / 6), c, e.frozenKind === 'cube' ? '#8E8EC0' : '#FFFFFF', 1.5);
    g.globalAlpha = 1;
  }
  if (e.hp < e.maxHp) {
    const w = e.kind === 'dragon' ? 44 : 20;
    g.fillStyle = 'rgba(26,25,24,0.75)';
    g.fillRect(-w / 2, -e.radius - 9, w, 3.5);
    g.fillStyle = e.hp / e.maxHp > 0.4 ? '#4CAF50' : '#C1121F';
    g.fillRect(-w / 2 + 0.5, -e.radius - 8.5, (w - 1) * Math.max(0, e.hp / e.maxHp), 2.5);
  }
  g.restore();
}

// ============================================================ projectiles & patches
function drawProj(g: CanvasRenderingContext2D, p: Projectile, map: MapDef, time: number): void {
  g.save();
  switch (p.kind) {
    case 'shuriken':
    case 'swallow':
    case 'dart':
    case 'shard':
    case 'needle': {
      g.translate(p.x, p.y);
      if (p.kind === 'needle') { g.rotate(p.rot); g.strokeStyle = '#8F6B3F'; g.lineWidth = 2; g.beginPath(); g.moveTo(-5, 0); g.lineTo(5, 0); g.stroke(); break; }
      if (p.kind === 'shard') { g.rotate(p.rot); poly(g, [[8, 0], [-4, -4], [-2, 0], [-4, 4]], '#EBCBA3', '#6B4A24', 1); break; }
      if (p.kind === 'dart') { g.rotate(p.rot); poly(g, [[9, 0], [0, -4], [-7, 0], [0, 4]], '#E6C99C', '#6B4A24', 1); break; }
      g.rotate(time * 18 + p.rot);
      const s = p.kind === 'swallow' ? 5 : 9;
      poly(g, [[s, 0], [2, -2], [0, -s], [-2, -2], [-s, 0], [-2, 2], [0, s], [2, 2]], '#2A9D8F', INK, 1);
      circle(g, 0, 0, 1.5, '#F4EFE6');
      break;
    }
    case 'crane': {
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      const f = Math.sin(time * 20 + p.id) * 0.5 + 0.5;
      poly(g, [[0, 0], [-3, -11 * (0.4 + f)], [-9, -1]], '#BFEDE5', INK, 1);
      poly(g, [[0, 0], [-3, 11 * (0.4 + f)], [-9, 1]], '#7FD3C6', INK, 1);
      poly(g, [[11, 0], [0, -3.5], [-9, 0], [0, 3.5]], '#F4EFE6', INK, 1);
      poly(g, [[11, 0], [15, -2], [12, 1]], '#C1121F', INK, 0.8);
      break;
    }
    case 'fan': {
      g.translate(p.x, p.y);
      g.rotate(Math.atan2(p.vy, p.vx));
      g.strokeStyle = 'rgba(42,157,143,0.4)';
      g.lineWidth = 9;
      g.beginPath();
      g.arc(-6, 0, 22, -1.0, 1.0);
      g.stroke();
      g.strokeStyle = '#BFEDE5';
      g.lineWidth = 5;
      g.stroke();
      g.strokeStyle = INK;
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(-6, 0, 24.5, -1.0, 1.0);
      g.stroke();
      break;
    }
    case 'whirlwind': {
      g.translate(p.x, p.y);
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = `rgba(26,25,24,${0.55 - k * 0.1})`;
        g.lineWidth = 3.5 - k * 0.6;
        g.beginPath();
        g.arc(0, 0, 14 + k * 12, time * 9 + k * 1.3, time * 9 + k * 1.3 + 3.8);
        g.stroke();
      }
      g.fillStyle = 'rgba(42,157,143,0.15)';
      circle(g, 0, 0, 55, 'rgba(42,157,143,0.12)');
      break;
    }
    case 'lantern':
    case 'spark': {
      const f = Math.min(1, p.age / p.dur);
      const hgt = p.sky ? 0 : Math.sin(Math.PI * f) * p.height;
      g.translate(p.x, p.y - hgt);
      const gr = g.createRadialGradient(0, 0, 1, 0, 0, p.kind === 'spark' ? 10 : 18);
      gr.addColorStop(0, 'rgba(255,190,60,0.7)');
      gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr;
      g.fillRect(-18, -18, 36, 36);
      if (p.kind === 'spark') { poly(g, [[0, -4], [4, 0], [0, 4], [-4, 0]], '#FFB703', '#9E1F2A', 0.8); break; }
      g.rotate(Math.sin(time * 6 + p.id) * 0.15);
      g.fillStyle = '#B8860B';
      g.fillRect(-5, -9, 10, 2.5);
      g.fillRect(-5, 6.5, 10, 2.5);
      g.fillStyle = '#E63946';
      g.beginPath();
      g.roundRect(-6, -6.5, 12, 13, 3);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1;
      g.stroke();
      circle(g, 0, 0, 2.5, '#FFE08A');
      break;
    }
    case 'wave': {
      g.translate(p.x, p.y);
      g.rotate(Math.atan2(p.vy, p.vx));
      g.strokeStyle = '#3A86FF';
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(-4, 0, 11, -1.2, 1.2);
      g.stroke();
      g.strokeStyle = '#E8F2FF';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(-2, 0, 11, -1.0, 1.0);
      g.stroke();
      break;
    }
    case 'spike': {
      g.translate(p.x, p.y);
      g.rotate(Math.atan2(p.vy, p.vx));
      poly(g, [[13, 0], [0, -6], [-9, 0], [0, 6]], '#D4A373', '#6B4A24', 1.2);
      poly(g, [[13, 0], [0, -6], [-2, 0]], '#EBCBA3', null);
      break;
    }
    case 'boulder': {
      g.translate(p.x, p.y);
      g.rotate(p.travelled * 0.06);
      poly(g, hexPts(20), '#C99B5E', '#6B4A24', 2);
      poly(g, hexPts(12, 0.5), '#A67C45', '#6B4A24', 1.2);
      poly(g, [[0, 0], [20, 0], [10, -17]], 'rgba(255,255,255,0.25)', null);
      break;
    }
    case 'blot': {
      const f = Math.min(1, p.age / p.dur);
      g.translate(p.x, p.y - Math.sin(Math.PI * f) * p.height);
      circle(g, 0, 0, 6, INK);
      circle(g, 5, -3, 2.5, INK);
      circle(g, -5, 4, 2, INK);
      circle(g, 2, 7, 1.5, INK);
      break;
    }
    case 'blade': {
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = '#143A44';
      g.beginPath();
      g.moveTo(11, 0);
      g.quadraticCurveTo(0, -9, -9, -2);
      g.quadraticCurveTo(0, -3, 11, 0);
      g.fill();
      g.strokeStyle = 'rgba(42,157,143,0.6)';
      g.lineWidth = 1.5;
      g.stroke();
      break;
    }
    case 'koi': {
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      const s = 1 + Math.sin(Math.min(1, p.travelled / 40) * Math.PI) * 0.3;
      g.scale(s, s);
      const sw = Math.sin(time * 14 + p.id) * 2;
      poly(g, [[-9, 0], [-17, -5 + sw], [-17, 5 + sw]], '#F4EFE6', INK, 1);
      g.fillStyle = '#F4EFE6';
      g.strokeStyle = INK;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      circle(g, -2, -1, 3, '#E63946');
      circle(g, 4, 1.5, 2.2, '#E63946');
      circle(g, 8, -1, 1, INK);
      break;
    }
    case 'dragon': {
      const ln = map.lanes[p.lane];
      for (let k = 18; k >= 0; k--) {
        const d = Math.min(ln.length, p.dist + k * 9);
        const i = Math.min(ln.xs.length - 1, Math.floor(d / ln.step));
        const w = 3 + (18 - k) * 0.9;
        circle(g, ln.xs[i] + Math.sin(time * 8 - k) * 2, ln.ys[i] + Math.cos(time * 8 - k) * 2, w, k % 3 === 0 ? '#2B2B3B' : INK);
      }
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      poly(g, [[-14, 0], [-2, -12], [8, -8], [14, 0], [8, 8], [-2, 12]], INK, '#8E8EC0', 1.5);
      circle(g, -4, -4, 2, '#F4EFE6');
      circle(g, -4, 4, 2, '#F4EFE6');
      break;
    }
  }
  g.restore();
}

function drawPatch(g: CanvasRenderingContext2D, p: Patch, time: number): void {
  const fade = Math.min(1, p.t / 0.6);
  g.save();
  g.globalAlpha = fade;
  switch (p.kind) {
    case 'ash':
    case 'magma': {
      const mg = p.kind === 'magma';
      circle(g, p.x, p.y, p.r * (mg ? 0.9 : 0.8), mg ? 'rgba(232,120,42,0.55)' : 'rgba(70,55,48,0.42)', mg ? '#7A1F2A' : 'rgba(40,30,25,0.5)', 1.2);
      const n = 6 + p.stacks * 3;
      for (let k = 0; k < n; k++) {
        const a = p.seed + k * 2.1, d = ((k * 37) % 100) / 100 * p.r * 0.7;
        circle(g, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.8, k % 2 ? '#FF9B3D' : '#3a2f2a');
        if (k % 3 === 0) {
          const fy = Math.sin(time * 10 + k) * 2;
          poly(g, [[p.x + Math.cos(a) * d - 2, p.y + Math.sin(a) * d], [p.x + Math.cos(a) * d, p.y + Math.sin(a) * d - 7 + fy], [p.x + Math.cos(a) * d + 2, p.y + Math.sin(a) * d]], '#FF8A2B', null);
        }
      }
      break;
    }
    case 'puddle':
    case 'mini': {
      const gr = g.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r);
      gr.addColorStop(0, 'rgba(20,20,28,0.95)');
      gr.addColorStop(0.8, 'rgba(26,25,30,0.8)');
      gr.addColorStop(1, 'rgba(26,25,30,0.1)');
      g.fillStyle = gr;
      g.beginPath();
      for (let k = 0; k <= 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const r = p.r * (0.88 + Math.sin(a * 3 + p.seed) * 0.1);
        if (k === 0) g.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
        else g.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      }
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(p.x - p.r * 0.2, p.y - p.r * 0.2, p.r * 0.35, 3.6, 4.8);
      g.stroke();
      break;
    }
    case 'wake':
      circle(g, p.x, p.y, p.r, 'rgba(100,160,255,0.22)', 'rgba(58,134,255,0.45)', 1);
      break;
    case 'vortex': {
      circle(g, p.x, p.y, p.r, 'rgba(58,134,255,0.12)');
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = `rgba(30,70,160,${0.65 - k * 0.12})`;
        g.lineWidth = 2.5 - k * 0.4;
        g.beginPath();
        g.arc(p.x, p.y, p.r * (0.3 + k * 0.22), time * 7 + k * 1.6, time * 7 + k * 1.6 + 3.6);
        g.stroke();
      }
      break;
    }
  }
  g.restore();
}

// ============================================================ fx
function drawFx(g: CanvasRenderingContext2D, f: Fx): void {
  const u = f.t / f.life;
  g.save();
  switch (f.k) {
    case 'confetti':
      g.globalAlpha = 1 - u * u;
      g.translate(f.x, f.y);
      g.rotate(f.rot);
      poly(g, [[f.size, 0], [-f.size * 0.7, -f.size * 0.6], [-f.size * 0.7, f.size * 0.6]], f.color, 'rgba(26,25,24,0.5)', 0.6);
      break;
    case 'splat': {
      const a = Math.min(0.78, (1 - u) * 1.3);
      g.globalAlpha = a;
      const r = f.r * Math.min(1, 0.4 + u * 6);
      g.fillStyle = INK;
      g.beginPath();
      for (let k = 0; k <= 14; k++) {
        const ang = (k / 14) * Math.PI * 2;
        const rr = r * (0.75 + Math.abs(Math.sin(f.seed + k * 2.3)) * 0.55);
        if (k === 0) g.moveTo(f.x + Math.cos(ang) * rr, f.y + Math.sin(ang) * rr);
        else g.lineTo(f.x + Math.cos(ang) * rr, f.y + Math.sin(ang) * rr);
      }
      g.fill();
      for (let k = 0; k < 5; k++) {
        const ang = f.seed + k * 1.9, d = r * (1.2 + (k % 3) * 0.4);
        circle(g, f.x + Math.cos(ang) * d, f.y + Math.sin(ang) * d, 0.8 + (k % 3) * 0.7, INK);
      }
      break;
    }
    case 'ring': {
      const e = 1 - (1 - u) * (1 - u);
      g.globalAlpha = 1 - u;
      circle(g, f.x, f.y, f.r * e, null, f.color, 3 * (1 - u) + 0.5);
      break;
    }
    case 'text': {
      g.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      g.font = `italic 800 ${f.size}px ${BRUSH}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const y = f.y - u * 22;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(244,239,230,0.95)';
      g.lineJoin = 'round';
      g.strokeText(f.text, f.x, y);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, y);
      break;
    }
    case 'stamp': {
      const sc = u < 0.12 ? 1.8 - (u / 0.12) * 0.8 : 1;
      g.globalAlpha = u > 0.65 ? 1 - (u - 0.65) / 0.35 : 0.95;
      g.translate(f.x, f.y);
      g.scale(sc, sc);
      drawHanko(g, 0, 0, 30, -0.18, f.text);
      break;
    }
    case 'chain': {
      g.globalAlpha = 1 - u;
      g.lineJoin = 'round';
      for (const [w, c] of [[5, f.color], [1.6, '#FFFFFF']] as const) {
        g.strokeStyle = c;
        g.lineWidth = w;
        g.beginPath();
        f.pts.forEach((p, i) => {
          if (i === 0) g.moveTo(p.x, p.y);
          else {
            const q = f.pts[i - 1];
            const mx = (p.x + q.x) / 2 + Math.sin(f.t * 60 + i) * 6, my = (p.y + q.y) / 2 + Math.cos(f.t * 60 + i) * 6;
            g.lineTo(mx, my);
            g.lineTo(p.x, p.y);
          }
        });
        g.stroke();
      }
      break;
    }
    case 'beam':
      g.globalAlpha = 1 - u;
      g.strokeStyle = f.color;
      g.lineWidth = f.w;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(f.x1, f.y1);
      g.lineTo(f.x2, f.y2);
      g.stroke();
      g.strokeStyle = '#FFF6E0';
      g.lineWidth = f.w * 0.35;
      g.stroke();
      break;
    case 'wave': {
      const x = -140 + u * (W + 280);
      g.globalAlpha = 0.85 * (1 - Math.max(0, u - 0.8) * 5);
      const gr = g.createLinearGradient(x - 140, 0, x + 40, 0);
      gr.addColorStop(0, 'rgba(26,60,140,0)');
      gr.addColorStop(0.7, 'rgba(26,60,140,0.55)');
      gr.addColorStop(1, 'rgba(232,242,255,0.9)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x - 140, 0);
      for (let y = 0; y <= H; y += 12) g.lineTo(x + Math.sin(y * 0.05 + f.t * 8) * 16, y);
      g.lineTo(x - 140, H);
      g.fill();
      break;
    }
    case 'lotus': {
      g.globalAlpha = u < 0.6 ? 0.95 : 1 - (u - 0.6) / 0.4;
      g.translate(f.x, f.y);
      for (let k = 0; k < 8; k++) {
        g.save();
        g.rotate((k / 8) * Math.PI * 2);
        poly(g, [[4, 0], [18 * (0.6 + u * 0.5), -5], [26 * (0.6 + u * 0.5), 0], [18 * (0.6 + u * 0.5), 5]], k % 2 ? '#D5EFFF' : '#9AD3F5', '#4A8AB5', 1);
        g.restore();
      }
      break;
    }
  }
  g.restore();
}

// ============================================================ frame
function rangeRing(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, time: number, fill = true): void {
  if (fill) circle(g, x, y, r, mix(color, 0.07));
  g.save();
  g.setLineDash([7, 6]);
  g.lineDashOffset = -time * 10;
  circle(g, x, y, r, null, color, 1.8);
  g.restore();
}

function resonance(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, idx: number, time: number, strong: boolean): void {
  g.save();
  g.setLineDash([6, 5]);
  g.lineDashOffset = -time * 14;
  g.strokeStyle = idx % 2 ? '#C58B3C' : '#2A9D8F';
  g.globalAlpha = strong ? 0.95 : 0.55;
  g.lineWidth = strong ? 2.2 : 1.6;
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(bx, by);
  g.stroke();
  g.restore();
}

export function drawFrame(g: CanvasRenderingContext2D, eng: GameEngine, ui: UiState, cache: HTMLCanvasElement, time: number): void {
  g.drawImage(cache, 0, 0, W, H);
  for (const f of eng.fx) if (f.k === 'splat') drawFx(g, f);
  for (const p of eng.patches) drawPatch(g, p, time);
  // resonance lines between placed towers
  const ts = eng.towers;
  let idx = 0;
  for (let i = 0; i < ts.length; i++) {
    for (let j = i + 1; j < ts.length; j++) {
      if (ts[i].element === ts[j].element) continue;
      if (Math.hypot(ts[i].x - ts[j].x, ts[i].y - ts[j].y) <= RESONANCE_DIST) resonance(g, ts[i].x, ts[i].y, ts[j].x, ts[j].y, idx++, time, false);
    }
  }
  // selected tower range & upgrade preview
  const sel = ui.selectedId !== null ? eng.towerById(ui.selectedId) : undefined;
  if (sel) {
    const r = eng.towerRange(sel);
    rangeRing(g, sel.x, sel.y, r, INK, time);
    if (ui.previewUpgrade && ui.previewUpgrade.id === sel.id) {
      const next = { ...sel };
      if (ui.previewUpgrade.path === 'A') next.a = Math.min(4, next.a + 1);
      else next.b = Math.min(4, next.b + 1);
      next.lastPath = ui.previewUpgrade.path;
      const nr = eng.towerRange(next as Tower);
      if (nr > r + 0.5) rangeRing(g, sel.x, sel.y, nr, '#C58B3C', time, false);
    }
    circle(g, sel.x, sel.y, 20, null, '#C1121F', 1.8);
  }
  for (const t of ts) drawBeamsFromTower(g, t, time);
  const sorted = ts.slice().sort((a, b) => a.y - b.y);
  for (const t of sorted) drawTower(g, t, time);
  for (const t of ts) drawOrbiters(g, t, time);
  // tethers
  for (const th of eng.tethers) {
    const ms = th.members.map((id) => eng.enemies.find((e) => e.id === id)).filter((e): e is Enemy => !!e && !e.dead);
    for (let i = 1; i < ms.length; i++) {
      g.save();
      g.strokeStyle = 'rgba(30,20,60,0.85)';
      g.lineWidth = 2.5;
      g.setLineDash([4, 3]);
      g.beginPath();
      g.moveTo(ms[0].x, ms[0].y);
      g.quadraticCurveTo((ms[0].x + ms[i].x) / 2 + Math.sin(time * 6 + i) * 8, (ms[0].y + ms[i].y) / 2 + Math.cos(time * 6 + i) * 8, ms[i].x, ms[i].y);
      g.stroke();
      g.restore();
    }
  }
  const es = eng.enemies.slice().sort((a, b) => a.y - b.y);
  for (const e of es) drawEnemy(g, e, time);
  for (const p of eng.projs) drawProj(g, p, eng.map, time);
  for (const f of eng.fx) if (f.k !== 'splat' && f.k !== 'text' && f.k !== 'stamp') drawFx(g, f);
  for (const f of eng.fx) if (f.k === 'stamp') drawFx(g, f);
  for (const f of eng.fx) if (f.k === 'text') drawFx(g, f);
  // hover preview
  if (ui.hover) {
    const { x, y } = ui.hover;
    if (ui.placing) {
      const def = ELEMENTS[ui.placing];
      const chk = eng.canPlace(x, y);
      const ok = chk.ok && eng.ink >= def.cost;
      const conduit = pointInConduit(eng.map, x, y);
      const st = computeStats({ element: ui.placing, a: 0, b: 0, lastPath: 'A' });
      const r = st.range * (conduit ? 1.15 : 1);
      rangeRing(g, x, y, r, ok ? '#2A9D8F' : '#C1121F', time);
      let k = 0;
      for (const t of ts) {
        if (t.element !== ui.placing && Math.hypot(t.x - x, t.y - y) <= RESONANCE_DIST) resonance(g, x, y, t.x, t.y, k++, time, true);
      }
      const ghost: Tower = { id: 0, element: ui.placing, x, y, a: 0, b: 0, lastPath: 'A', invested: 0, mode: 'first', cooldown: 0, kills: 0, damage: 0, shots: 0, special: 0, special2: 0, orbit: 0, inConduit: conduit, aim: 0, firing: false, tickAcc: 0, flash: 0, age: 0 };
      drawTower(g, ghost, time, ok ? 0.75 : 0.4);
      if (!ok) {
        g.strokeStyle = '#C1121F';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x - 9, y - 9);
        g.lineTo(x + 9, y + 9);
        g.moveTo(x + 9, y - 9);
        g.lineTo(x - 9, y + 9);
        g.stroke();
      }
    } else {
      const over = ts.find((t) => Math.hypot(t.x - x, t.y - y) < 18);
      if (over && over.id !== ui.selectedId) rangeRing(g, over.x, over.y, eng.towerRange(over), 'rgba(26,25,24,1)', time);
    }
  }
  if (eng.modifier) {
    g.strokeStyle = mix(MODIFIERS[eng.modifier].color, 0.55);
    g.lineWidth = 6;
    g.strokeRect(3, 3, W - 6, H - 6);
  }
}
