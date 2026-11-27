/**
 * Runic Origami & Ink - 100% procedural canvas renderer.
 * The washi paper, ink brushstroke track and map decor are pre-rendered onto
 * an offscreen cached canvas per map (deterministic, seeded), so runtime
 * rendering stays cheap. Every tower, enemy, projectile and effect is a
 * procedural vector/faceted-polygon drawing - zero image assets.
 */

import { RESONANCE_COLORS, RESONANCE_RANGE, TOWER_DEFS, computeTowerStats } from './constants';
import type {
  Element,
  Enemy,
  GameState,
  GroundFx,
  LaneDef,
  MapDef,
  Projectile,
  Tower,
  TowerStats,
  Vec2,
  Vfx,
} from './types';
import { CANVAS_H, CANVAS_W } from './types';
import { sampleLane } from './maps';

const BRUSH_FONT = 'Georgia, "Noto Serif SC", "Noto Sans SC", serif';
const BG_SCALE = 2;

// ------------------------------------------------------------------ color utils

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number): number =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ background cache

const bgCache = new Map<string, HTMLCanvasElement>();

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function drawWashi(ctx: CanvasRenderingContext2D, rand: () => number, w: number, h: number): void {
  ctx.fillStyle = '#F4EFE6';
  ctx.fillRect(0, 0, w, h);

  // Rice-paper fiber noise: short faint strokes + speckles.
  const fibers = Math.floor((w * h) / 900);
  for (let i = 0; i < fibers; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 6 + rand() * 26;
    const ang = rand() * Math.PI * 2;
    const tone = rand();
    ctx.strokeStyle =
      tone < 0.5
        ? `rgba(120, 100, 70, ${0.025 + rand() * 0.035})`
        : `rgba(214, 196, 161, ${0.05 + rand() * 0.05})`;
    ctx.lineWidth = 0.6 + rand() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  for (let i = 0; i < fibers / 3; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillStyle = `rgba(150, 128, 96, ${0.02 + rand() * 0.03})`;
    ctx.fillRect(x, y, 1 + rand() * 2, 1 + rand() * 2);
  }

  // Soft aged blotches.
  for (let i = 0; i < 10; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 40 + rand() * 130;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(190, 168, 122, 0.05)');
    grad.addColorStop(1, 'rgba(190, 168, 122, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDeckledBorder(ctx: CanvasRenderingContext2D, rand: () => number, w: number, h: number): void {
  const bw = 15;
  // Torn parchment frame.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  const jitter = (): number => (rand() - 0.5) * 7;
  const inner = (): void => {
    ctx.moveTo(bw + jitter(), bw + jitter());
    ctx.lineTo(w - bw + jitter(), bw + jitter());
    ctx.lineTo(w - bw + jitter(), h - bw + jitter());
    ctx.lineTo(bw + jitter(), h - bw + jitter());
    ctx.closePath();
  };
  ctx.closePath();
  inner();
  ctx.fillStyle = 'rgba(214, 196, 158, 0.55)';
  ctx.fill('evenodd');
  ctx.restore();

  ctx.strokeStyle = 'rgba(90, 74, 52, 0.5)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(bw + 2, bw + 2, w - bw * 2 - 4, h - bw * 2 - 4);
  ctx.strokeStyle = 'rgba(120, 96, 66, 0.28)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(bw + 6, bw + 6, w - bw * 2 - 12, h - bw * 2 - 12);
}

function strokeLane(ctx: CanvasRenderingContext2D, lane: LaneDef, rand: () => number): void {
  const pts: Vec2[] = lane.samples.map((s) => ({ x: s.x, y: s.y }));

  // Soft ink bleed under-stroke.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(26, 25, 24, 0.16)';
  const bleedPass = (width: number): void => {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 2) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  };
  bleedPass(40);
  bleedPass(34);

  // Main brushstroke: bold tapering from entrance (wide) to exit (narrower).
  const n = pts.length;
  for (let i = 1; i < n; i++) {
    const f = i / n;
    const width = 26 - 10 * f;
    ctx.strokeStyle = 'rgba(26, 25, 24, 0.95)';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  // Dry-brush center streak.
  ctx.strokeStyle = 'rgba(244, 239, 230, 0.14)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < n; i += 3) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  // Organic ink splatter along the edges.
  for (let i = 0; i < n; i += 2) {
    if (rand() < 0.16) {
      const s = lane.samples[i];
      const ang = s.angle + (rand() < 0.5 ? 1 : -1) * (Math.PI / 2);
      const dist = 16 + rand() * 18;
      const r = 0.7 + rand() * 2.4;
      ctx.fillStyle = `rgba(26, 25, 24, ${0.25 + rand() * 0.5})`;
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(ang) * dist, s.y + Math.sin(ang) * dist, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Faint direction chevrons.
  ctx.strokeStyle = 'rgba(244, 239, 230, 0.35)';
  ctx.lineWidth = 2;
  for (let d = 120; d < lane.length - 60; d += 150) {
    const s = sampleLane(lane, d);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(4, 0);
    ctx.lineTo(-4, 6);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawHanko(ctx: CanvasRenderingContext2D, x: number, y: number, kanji: string, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08);
  ctx.fillStyle = '#C1121F';
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.strokeStyle = 'rgba(244, 239, 230, 0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(-size / 2 + 2.5, -size / 2 + 2.5, size - 5, size - 5);
  ctx.fillStyle = '#F4EFE6';
  ctx.font = `700 ${Math.floor(size * 0.55)}px ${BRUSH_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(kanji, 0, 1);
  ctx.restore();
}

function buildMapBackground(map: MapDef): HTMLCanvasElement {
  const w = CANVAS_W * BG_SCALE;
  const h = CANVAS_H * BG_SCALE;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(BG_SCALE, BG_SCALE);

  const rand = mulberry32(map.id.split('').reduce((a, c) => a + c.charCodeAt(0) * 31, 7));
  drawWashi(ctx, rand, CANVAS_W, CANVAS_H);

  // Conduit stone circles (under the track? no - decor islands, draw before track for blending).
  for (const c of map.conduits) {
    ctx.save();
    ctx.strokeStyle = 'rgba(160, 130, 86, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160, 130, 86, 0.32)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r - 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      ctx.fillStyle = 'rgba(160, 130, 86, 0.4)';
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(a) * (c.r - 4), c.y + Math.sin(a) * (c.r - 4), 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (const lane of map.lanes) strokeLane(ctx, lane, rand);

  // Twin-Bridge: wooden overpass planks at the crossing.
  if (map.bridge) {
    const { x, y } = map.bridge;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(138, 107, 74, 0.85)';
    ctx.strokeStyle = 'rgba(84, 62, 40, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 58, 40, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 15, -34 + Math.abs(i) * 4);
      ctx.lineTo(i * 15 + 8, 34 - Math.abs(i) * 4);
      ctx.strokeStyle = 'rgba(84, 62, 40, 0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.fillStyle = '#F4EFE6';
    ctx.font = `600 10px ${BRUSH_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('OVERPASS', 0, -48);
    ctx.restore();
  }

  // Entrance calligraphy arrows + labels.
  for (const lane of map.lanes) {
    const s = sampleLane(lane, 46);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.strokeStyle = 'rgba(26, 25, 24, 0.75)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-16, -12);
    ctx.lineTo(2, 0);
    ctx.lineTo(-16, 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(-4, 0);
    ctx.stroke();
    ctx.restore();
    const s2 = sampleLane(lane, 30);
    ctx.save();
    ctx.fillStyle = 'rgba(43, 41, 39, 0.85)';
    ctx.font = `600 12px ${BRUSH_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('Entrance', Math.max(60, Math.min(CANVAS_W - 60, s2.x)), Math.max(44, s2.y - 20));
    ctx.restore();
  }

  // Crimson Hanko stamps at the sanctuary exit(s).
  for (const lane of map.lanes) {
    const exit = sampleLane(lane, Math.max(0, lane.length - 30));
    drawHanko(ctx, Math.min(CANVAS_W - 40, exit.x), exit.y, '守', 26);
    ctx.save();
    ctx.fillStyle = 'rgba(193, 18, 31, 0.9)';
    ctx.font = `700 12px ${BRUSH_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('SANCTUARY', Math.min(CANVAS_W - 46, exit.x + 2), exit.y - 20);
    ctx.restore();
  }

  // Spiral shrine halo at the center stamp.
  if (map.spiral) {
    ctx.save();
    ctx.strokeStyle = 'rgba(193, 18, 31, 0.16)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(480, 300, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawDeckledBorder(ctx, rand, CANVAS_W, CANVAS_H);
  return canvas;
}

export function getMapBackground(map: MapDef): HTMLCanvasElement {
  let bg = bgCache.get(map.id);
  if (!bg) {
    bg = buildMapBackground(map);
    bgCache.set(map.id, bg);
  }
  return bg;
}

/** Small preview of a map for the title screen. */
export function drawMapThumb(canvas: HTMLCanvasElement, map: MapDef): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const bg = getMapBackground(map);
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

// ------------------------------------------------------------------ origami helpers

function facetPoly(ctx: CanvasRenderingContext2D, pts: Vec2[], base: string, outline: string): void {
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    ctx.fillStyle = shade(base, i % 2 === 0 ? 0.14 : -0.16);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ towers

function drawTower(ctx: CanvasRenderingContext2D, tower: Tower, stats: TowerStats, time: number): void {
  const def = TOWER_DEFS[tower.element];
  const tier = Math.max(tower.tierA, tower.tierB);
  const bob = Math.sin(time * 2 + tower.id) * 1.4;
  const x = tower.x;
  const y = tower.y + bob * 0.3;

  // Ground shadow.
  ctx.save();
  ctx.fillStyle = 'rgba(26, 25, 24, 0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 15, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Apex silhouettes behind the pyramid.
  if (tier >= 4) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 1.2 + tower.id) * 0.03);
    if (tower.element === 'air') {
      // Crane Shogun: outstretched wings + talismans.
      facetPoly(ctx, [{ x: -46, y: -2 }, { x: -14, y: -14 }, { x: -12, y: 6 }], def.color, shade(def.color, -0.5));
      facetPoly(ctx, [{ x: 46, y: -2 }, { x: 14, y: -14 }, { x: 12, y: 6 }], def.color, shade(def.color, -0.5));
      facetPoly(ctx, [{ x: -30, y: -14 }, { x: -10, y: -26 }, { x: -6, y: -8 }], shade(def.color, 0.2), shade(def.color, -0.5));
      facetPoly(ctx, [{ x: 30, y: -14 }, { x: 10, y: -26 }, { x: 6, y: -8 }], shade(def.color, 0.2), shade(def.color, -0.5));
    } else if (tower.element === 'fire') {
      // Ignite Dragon head crest.
      facetPoly(ctx, [{ x: -34, y: -8 }, { x: 0, y: -40 }, { x: 34, y: -8 }, { x: 0, y: -14 }], def.color, '#8C1A13');
      facetPoly(ctx, [{ x: -12, y: -18 }, { x: -6, y: -30 }, { x: 0, y: -16 }], '#C9A227', '#8C6A1A');
      facetPoly(ctx, [{ x: 12, y: -18 }, { x: 6, y: -30 }, { x: 0, y: -16 }], '#C9A227', '#8C6A1A');
    } else if (tower.element === 'water') {
      // Tidal crest ring.
      ctx.strokeStyle = rgba(def.color, 0.7);
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, -6, 26 + i * 7, Math.PI * (1.06 + i * 0.05), Math.PI * (1.9 - i * 0.05));
        ctx.stroke();
      }
    } else if (tower.element === 'earth') {
      // Monolith sentinel: big standing stone.
      facetPoly(ctx, [{ x: -26, y: 12 }, { x: -16, y: -30 }, { x: 16, y: -30 }, { x: 26, y: 12 }], '#8D7748', '#4A3A22');
    } else {
      // Ink: fanned blades.
      for (let i = -2; i <= 2; i++) {
        facetPoly(
          ctx,
          [{ x: i * 12, y: -6 }, { x: i * 12 + 6, y: -34 }, { x: i * 12 + 12, y: -6 }],
          def.color,
          '#0C0D14',
        );
      }
    }
    ctx.restore();
  }

  // Floating calligraphy talismans (tier 3+).
  if (tier >= 3) {
    const tx = x + Math.sin(time * 1.6 + tower.id * 2) * 8;
    const ty = y - 34 + Math.cos(time * 2 + tower.id) * 3;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(Math.sin(time * 1.3 + tower.id) * 0.12);
    ctx.fillStyle = '#F4EFE6';
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.5;
    ctx.fillRect(-6, -9, 12, 18);
    ctx.strokeRect(-6, -9, 12, 18);
    ctx.fillStyle = def.color;
    ctx.font = `700 9px ${BRUSH_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.kanji, 0, 0);
    ctx.restore();
  }

  // Folded wings/fans (tier 1-2).
  if (tier >= 1) {
    ctx.save();
    ctx.translate(x, y);
    const wingSpan = tier >= 2 ? 26 : 20;
    const wingLift = tier >= 2 ? -20 : -13;
    facetPoly(ctx, [{ x: -8, y: 0 }, { x: -wingSpan, y: wingLift }, { x: -6, y: -6 }], def.color, shade(def.color, -0.5));
    facetPoly(ctx, [{ x: 8, y: 0 }, { x: wingSpan, y: wingLift }, { x: 6, y: -6 }], def.color, shade(def.color, -0.5));
    if (tier >= 2) {
      facetPoly(ctx, [{ x: -9, y: 3 }, { x: -wingSpan - 4, y: wingLift + 12 }, { x: -6, y: -3 }], shade(def.color, 0.16), shade(def.color, -0.5));
      facetPoly(ctx, [{ x: 9, y: 3 }, { x: wingSpan + 4, y: wingLift + 12 }, { x: 6, y: -3 }], shade(def.color, 0.16), shade(def.color, -0.5));
    }
    ctx.restore();
  }

  // Folded paper pyramid core.
  ctx.save();
  ctx.translate(x, y);
  const apex = tier >= 3 ? -22 : -16;
  const half = 10;
  const base: Vec2[] = [
    { x: -half, y: 8 },
    { x: -half * 0.55, y: 11 },
    { x: half * 0.55, y: 11 },
    { x: half, y: 8 },
  ];
  for (let i = 0; i < base.length; i++) {
    const a = base[i];
    const b = base[(i + 1) % base.length];
    ctx.fillStyle = i % 2 === 0 ? shade(def.color, 0.18) : shade(def.color, -0.2);
    ctx.beginPath();
    ctx.moveTo(0, apex);
    ctx.lineTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = tier >= 3 ? '#C9A227' : shade(def.color, -0.45);
    ctx.lineWidth = tier >= 3 ? 1.6 : 0.9;
    ctx.stroke();
  }

  // Wax seal emblem at the core.
  ctx.beginPath();
  ctx.arc(0, 2, 6, 0, Math.PI * 2);
  ctx.fillStyle = def.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 239, 230, 0.75)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = 'rgba(244, 239, 230, 0.9)';
  ctx.font = `700 7px ${BRUSH_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.kanji, 0, 2.5);
  ctx.restore();

  // Orbiting polyhedrons (Earth Kinetic Sentinel / Celestial Orrery).
  if (stats.kind === 'orbital' && stats.orbitalCount > 0) {
    for (let i = 0; i < stats.orbitalCount; i++) {
      const a = tower.orbitalAngle + (i / stats.orbitalCount) * Math.PI * 2;
      const ox = x + Math.cos(a) * stats.orbitalRadius;
      const oy = y + Math.sin(a) * stats.orbitalRadius;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(a * 2);
      const hex: Vec2[] = [];
      for (let k = 0; k < 6; k++) {
        const hk = (k / 6) * Math.PI * 2;
        hex.push({ x: Math.cos(hk) * 7, y: Math.sin(hk) * 7 });
      }
      facetPoly(ctx, hex, tower.element === 'earth' ? '#D4A373' : '#1D1E2C', '#4A3A22');
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(212, 163, 115, 0.25)';
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.arc(x, y, stats.orbitalRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Muzzle flash + build flash.
  if (tower.fireGlow > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, tower.fireGlow * 3);
    ctx.fillStyle = rgba(def.color, 0.5);
    ctx.beginPath();
    ctx.arc(tower.muzzleX, tower.muzzleY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (tower.buildFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, tower.buildFlash * 2);
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 20 + (1 - tower.buildFlash) * 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (tower.conduitBoost) {
    ctx.fillStyle = '#C9A227';
    ctx.beginPath();
    ctx.arc(x + 13, y - 13, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ enemies

function drawStatusPips(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number): void {
  let i = 0;
  for (const key of Object.keys(enemy.statuses) as Element[]) {
    const st = enemy.statuses[key];
    if (!st || st.time <= 0) continue;
    ctx.fillStyle = RESONANCE_COLORS[key];
    ctx.beginPath();
    ctx.arc(x - 8 + i * 8, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    i++;
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, pos: Vec2, angle: number, time: number, lane: LaneDef): void {
  const { x, y } = pos;
  const paper = '#EDE4CE';
  const fold = '#B9AB8C';
  const wobble = Math.sin(time * 6 + enemy.wobble);

  ctx.save();
  if (enemy.cloaked) {
    ctx.globalAlpha = 0.24;
  }
  ctx.fillStyle = 'rgba(26,25,24,0.15)';
  ctx.beginPath();
  ctx.ellipse(x, y + enemy.hitRadius * 0.7, enemy.hitRadius * 0.9, enemy.hitRadius * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const tri = (pts: Vec2[], base: string): void => facetPoly(ctx, pts, base, fold);

  if (enemy.kind === 'moth') {
    tri([{ x: -7, y: 0 }, { x: 4, y: -5 }, { x: 4, y: 5 }], paper);
    const flap = wobble * 0.5;
    tri([{ x: 0, y: -3 }, { x: -6 + flap * 3, y: -14 - flap * 4 }, { x: 5, y: -4 }], shade(paper, 0.1));
    tri([{ x: 0, y: 3 }, { x: -6 - flap * 3, y: 14 + flap * 4 }, { x: 5, y: 4 }], shade(paper, -0.08));
  } else if (enemy.kind === 'crane') {
    tri([{ x: -11, y: 0 }, { x: 6, y: -6 }, { x: 6, y: 6 }], paper);
    tri([{ x: -2, y: 0 }, { x: -14 + wobble * 2, y: -12 }, { x: 4, y: -4 }], shade(paper, 0.08));
    tri([{ x: -2, y: 0 }, { x: -14 - wobble * 2, y: 12 }, { x: 4, y: 4 }], shade(paper, -0.08));
    tri([{ x: 6, y: 0 }, { x: 15, y: -3 }, { x: 13, y: 3 }], '#C1121F');
  } else if (enemy.kind === 'fox') {
    tri([{ x: -10, y: -7 }, { x: 12, y: -4 }, { x: 12, y: 4 }, { x: -10, y: 7 }], paper);
    tri([{ x: 12, y: -4 }, { x: 17, y: -10 }, { x: 15, y: 0 }], paper);
    tri([{ x: 12, y: 4 }, { x: 17, y: 10 }, { x: 15, y: 0 }], paper);
    tri([{ x: -10, y: 0 }, { x: -20 - wobble, y: -6 }, { x: -20 - wobble, y: 6 }], shade(paper, -0.05));
    ctx.fillStyle = '#C1121F';
    ctx.beginPath();
    ctx.arc(9, -2, 1.4, 0, Math.PI * 2);
    ctx.arc(9, 2, 1.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'serpent') {
    for (let s = 3; s >= 0; s--) {
      const segPos = sampleLane(lane, enemy.distance - s * 16);
      const sp = s === 0 ? { x: 0, y: 0 } : { x: segPos.x - x, y: segPos.y - y };
      const r = 9 - s * 1.4;
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(s === 0 ? 0 : Math.atan2(-Math.sin(angle), -Math.cos(angle)));
      tri([{ x: -r, y: 0 }, { x: 0, y: -r * 0.75 }, { x: r, y: 0 }, { x: 0, y: r * 0.75 }], s === 0 ? '#9CC5E8' : shade(paper, -0.02 * s));
      ctx.restore();
    }
    ctx.fillStyle = '#C1121F';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(17, -2);
    ctx.lineTo(17, 2);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === 'tortoise') {
    const hex: Vec2[] = [];
    for (let k = 0; k < 6; k++) {
      const hk = (k / 6) * Math.PI * 2 + 0.5;
      hex.push({ x: Math.cos(hk) * 14, y: Math.sin(hk) * 12 });
    }
    facetPoly(ctx, hex, enemy.armorStripped ? '#C9BB9C' : '#6E7280', '#3C3E4A');
    if (!enemy.armorStripped) {
      // Iron-fold plating.
      ctx.strokeStyle = '#2E3038';
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 6; k++) {
        const hk = (k / 6) * Math.PI * 2 + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(hk) * 14, Math.sin(hk) * 12);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(193, 18, 31, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.lineTo(2, 2);
      ctx.lineTo(-3, 8);
      ctx.stroke();
    }
    tri([{ x: 12, y: -5 }, { x: 20, y: 0 }, { x: 12, y: 5 }], paper);
  } else {
    // Paper Dragon boss: head + trailing segments.
    for (let s = 4; s >= 1; s--) {
      const segPos = sampleLane(lane, enemy.distance - s * 22);
      const r = 17 - s * 2.2;
      ctx.save();
      ctx.translate(segPos.x - x, segPos.y - y);
      const hexSeg: Vec2[] = [];
      for (let k = 0; k < 6; k++) {
        const hk = (k / 6) * Math.PI * 2;
        hexSeg.push({ x: Math.cos(hk) * r, y: Math.sin(hk) * r * 0.8 });
      }
      facetPoly(ctx, hexSeg, s % 2 === 0 ? '#B33A2E' : '#8C2A20', '#3A100C');
      ctx.restore();
    }
    tri([{ x: -16, y: -10 }, { x: 16, y: -7 }, { x: 16, y: 7 }, { x: -16, y: 10 }], '#C1121F');
    tri([{ x: -4, y: -9 }, { x: -10, y: -24 }, { x: 2, y: -12 }], '#E8B04B');
    tri([{ x: 6, y: -9 }, { x: 12, y: -22 }, { x: -2, y: -12 }], '#E8B04B');
    tri([{ x: 16, y: -6 }, { x: 30, y: -9 }, { x: 26, y: 0 }], shade('#C1121F', -0.1));
    tri([{ x: 16, y: 6 }, { x: 30, y: 9 }, { x: 26, y: 0 }], shade('#C1121F', -0.1));
    ctx.fillStyle = '#F4EFE6';
    ctx.beginPath();
    ctx.arc(6, -4, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Frozen crystal prism.
  if (enemy.frozen > 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = Math.min(0.8, enemy.frozen * 1.5);
    facetPoly(
      ctx,
      [
        { x: -enemy.hitRadius, y: 0 },
        { x: -enemy.hitRadius * 0.4, y: -enemy.hitRadius * 1.3 },
        { x: enemy.hitRadius * 0.5, y: -enemy.hitRadius },
        { x: enemy.hitRadius, y: 0 },
        { x: enemy.hitRadius * 0.4, y: enemy.hitRadius * 1.3 },
        { x: -enemy.hitRadius * 0.5, y: enemy.hitRadius },
      ],
      '#9FD8F2',
      '#4C93C4',
    );
    ctx.restore();
  }

  // Rooted stone base.
  if (enemy.rooted > 0) {
    ctx.strokeStyle = 'rgba(120, 96, 60, 0.85)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
      ctx.lineTo(x + Math.cos(a) * (enemy.hitRadius + 6), y + Math.sin(a) * (enemy.hitRadius + 6));
      ctx.stroke();
    }
  }

  // Burning flame.
  const burn = enemy.statuses.fire;
  if (burn && burn.time > 0) {
    const h = 6 + Math.sin(time * 18 + enemy.id) * 2.5;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#E8632C';
    ctx.beginPath();
    ctx.moveTo(x - 4, y - enemy.hitRadius);
    ctx.quadraticCurveTo(x, y - enemy.hitRadius - h * 2, x + 4, y - enemy.hitRadius);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#F4B942';
    ctx.beginPath();
    ctx.arc(x, y - enemy.hitRadius - h * 0.4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Cloaked tracing outline.
  if (enemy.cloaked) {
    ctx.strokeStyle = 'rgba(43, 41, 39, 0.55)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, enemy.hitRadius + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // HP bar.
  if (enemy.hp < enemy.maxHp) {
    const w = Math.max(16, enemy.hitRadius * 2);
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = 'rgba(26, 25, 24, 0.65)';
    ctx.fillRect(x - w / 2, y - enemy.hitRadius - 9, w, 3.5);
    ctx.fillStyle = ratio > 0.5 ? '#5C8A4A' : ratio > 0.25 ? '#C98A2D' : '#C1121F';
    ctx.fillRect(x - w / 2, y - enemy.hitRadius - 9, w * ratio, 3.5);
  }

  drawStatusPips(ctx, enemy, x, y + enemy.hitRadius + 7);

  // Hit flash.
  if (enemy.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.7, enemy.flash * 4);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, enemy.hitRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ projectiles

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, time: number): void {
  const angle = Math.atan2(p.vy, p.vx);
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.kind === 'shuriken') {
    ctx.rotate(p.spin);
    ctx.fillStyle = '#2A9D8F';
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(7, -2.5);
      ctx.lineTo(9, 0);
      ctx.lineTo(7, 2.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#F4EFE6';
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'crane') {
    ctx.rotate(angle);
    facetPoly(ctx, [{ x: -7, y: 0 }, { x: 3, y: -5 }, { x: 8, y: 0 }, { x: 3, y: 5 }], '#F7F2E4', '#9C8F73');
    facetPoly(ctx, [{ x: -2, y: 0 }, { x: -10, y: -8 }, { x: 2, y: -3 }], '#DDEDE6', '#9C8F73');
    facetPoly(ctx, [{ x: -2, y: 0 }, { x: -10, y: 8 }, { x: 2, y: 3 }], '#C8DCD4', '#9C8F73');
    ctx.fillStyle = '#2A9D8F';
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'swallow') {
    ctx.rotate(angle);
    facetPoly(ctx, [{ x: -5, y: 0 }, { x: 5, y: -3 }, { x: 5, y: 3 }], '#EAF4F0', '#9C8F73');
  } else if (p.kind === 'fan') {
    ctx.rotate(angle);
    ctx.strokeStyle = '#2A9D8F';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-8, 0, 14, -1.1, 1.1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(244,239,230,0.6)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-8, 0, 14, -0.9, 0.9);
    ctx.stroke();
  } else if (p.kind === 'whirlwind') {
    ctx.strokeStyle = 'rgba(29, 30, 44, 0.8)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const off = time * 5 + i * 2;
      ctx.arc(0, 0, 12 + i * 8, off, off + 2.4);
      ctx.stroke();
    }
  } else if (p.kind === 'lantern' || p.kind === 'skyLantern') {
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
    glow.addColorStop(0, 'rgba(244, 162, 97, 0.95)');
    glow.addColorStop(1, 'rgba(244, 162, 97, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E63946';
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(4, -6);
    ctx.lineTo(5, 2);
    ctx.lineTo(-5, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#F4B942';
    ctx.fillRect(-3, -4, 6, 5);
  } else if (p.kind === 'crest') {
    ctx.rotate(angle);
    ctx.strokeStyle = '#3A86FF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-4, 0, 7, -1.25, 1.25);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(144, 224, 239, 0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-4, 0, 7, -1, 1);
    ctx.stroke();
  } else if (p.kind === 'koi') {
    ctx.rotate(angle);
    facetPoly(ctx, [{ x: -9, y: 0 }, { x: 2, y: -5 }, { x: 7, y: 0 }, { x: 2, y: 5 }], '#E8DFC8', '#B33A2E');
    ctx.fillStyle = '#C1121F';
    ctx.beginPath();
    ctx.ellipse(-1, 0, 5, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    facetPoly(ctx, [{ x: -8, y: 0 }, { x: -14, y: -5 }, { x: -14, y: 5 }], '#C1121F', '#7C1017');
  } else if (p.kind === 'needle') {
    ctx.rotate(angle);
    ctx.fillStyle = '#C2A76C';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -2.4);
    ctx.lineTo(-4, 2.4);
    ctx.closePath();
    ctx.fill();
  } else if (p.kind === 'galeBlade') {
    ctx.rotate(angle);
    ctx.strokeStyle = '#1D1E2C';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-4, 0, 8, -1.2, 1.2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(42, 157, 143, 0.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-6, 0, 10, -1, 1);
    ctx.stroke();
  } else if (p.kind === 'spike') {
    ctx.rotate(angle);
    facetPoly(ctx, [{ x: -12, y: -4 }, { x: 10, y: 0 }, { x: -12, y: 4 }], '#D4A373', '#6B532F');
  } else if (p.kind === 'shard') {
    ctx.rotate(angle);
    facetPoly(ctx, [{ x: -5, y: -3 }, { x: 7, y: 0 }, { x: -5, y: 3 }], '#E9F2F7', '#7FA8C4');
  } else if (p.kind === 'boulder') {
    ctx.rotate(p.spin);
    const hex: Vec2[] = [];
    for (let k = 0; k < 7; k++) {
      const hk = (k / 7) * Math.PI * 2;
      hex.push({ x: Math.cos(hk) * 15, y: Math.sin(hk) * 13 });
    }
    facetPoly(ctx, hex, '#8D7748', '#3F3120');
  } else if (p.kind === 'orbDart') {
    ctx.rotate(p.spin);
    const hex: Vec2[] = [];
    for (let k = 0; k < 6; k++) {
      const hk = (k / 6) * Math.PI * 2;
      hex.push({ x: Math.cos(hk) * 6, y: Math.sin(hk) * 6 });
    }
    facetPoly(ctx, hex, '#D4A373', '#6B532F');
  } else {
    // blot
    ctx.fillStyle = '#1D1E2C';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(29, 30, 44, 0.5)';
    ctx.beginPath();
    ctx.arc(5, 3, 2, 0, Math.PI * 2);
    ctx.arc(-4, 4, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ ground fx

function drawGround(ctx: CanvasRenderingContext2D, g: GroundFx, time: number): void {
  const fade = Math.min(1, g.t / 0.35) * Math.min(1, (g.dur - g.t) / 0.35);
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  if (g.kind === 'ash') {
    ctx.fillStyle = 'rgba(90, 84, 76, 0.55)';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(g.x + Math.cos(a) * g.r * 0.4, g.y + Math.sin(a) * g.r * 0.4, g.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(244, 130, 60, ${0.35 + Math.sin(time * 9 + g.x) * 0.2})`;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (g.kind === 'magma') {
    const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
    grad.addColorStop(0, 'rgba(230, 70, 30, 0.85)');
    grad.addColorStop(0.6, 'rgba(160, 40, 16, 0.6)');
    grad.addColorStop(1, 'rgba(90, 24, 10, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
  } else if (g.kind === 'puddle' || g.kind === 'miniPuddle') {
    ctx.fillStyle = 'rgba(29, 30, 44, 0.62)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, g.r, g.r * 0.72, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120, 130, 170, 0.25)';
    ctx.beginPath();
    ctx.ellipse(g.x - g.r * 0.2, g.y - g.r * 0.2, g.r * 0.4, g.r * 0.2, 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (g.kind === 'whirlpool') {
    ctx.strokeStyle = 'rgba(58, 134, 255, 0.75)';
    ctx.lineWidth = 2.6;
    for (let i = 0; i < 3; i++) {
      const off = time * 7 + i * 2.1;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r * (0.35 + i * 0.22), off, off + 2.6);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(144, 224, 239, 0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (g.kind === 'wake') {
    // Handled by caller with lane context.
  }
  ctx.restore();
}

function drawWake(ctx: CanvasRenderingContext2D, g: GroundFx, lane: LaneDef): void {
  const fade = Math.min(1, g.t / 0.3) * Math.min(1, (g.dur - g.t) / 0.3);
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.strokeStyle = 'rgba(58, 134, 255, 0.5)';
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const from = Math.max(0, g.from);
  const to = Math.min(lane.length, g.to);
  const s0 = sampleLane(lane, from);
  ctx.moveTo(s0.x, s0.y);
  for (let d = from; d <= to; d += 12) {
    const s = sampleLane(lane, d);
    ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(144, 224, 239, 0.35)';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ vfx

function drawVfx(ctx: CanvasRenderingContext2D, v: Vfx, time: number): void {
  const f = v.t / v.dur;
  ctx.save();
  switch (v.kind) {
    case 'callout': {
      ctx.globalAlpha = Math.max(0, 1 - f * f);
      ctx.translate(v.x, v.y - f * 34);
      ctx.rotate(Math.sin(v.spin) * 0.05);
      ctx.font = `900 15px ${BRUSH_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(244, 239, 230, 0.9)';
      ctx.strokeText(v.text, 0, 0);
      ctx.fillStyle = v.color;
      ctx.fillText(v.text, 0, 0);
      break;
    }
    case 'stamp': {
      const pop = f < 0.4 ? 0.6 + (f / 0.4) * 0.5 : 1.1 - (f - 0.4) * 0.18;
      ctx.globalAlpha = f < 0.75 ? 1 : Math.max(0, 1 - (f - 0.75) / 0.25);
      ctx.translate(v.x, v.y);
      ctx.rotate(-0.12);
      ctx.scale(pop, pop);
      const s = v.r;
      ctx.fillStyle = '#C1121F';
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = 'rgba(244,239,230,0.9)';
      ctx.lineWidth = 2.4;
      ctx.strokeRect(-s / 2 + 3, -s / 2 + 3, s - 6, s - 6);
      ctx.fillStyle = '#F4EFE6';
      ctx.font = `700 ${Math.floor(s * 0.5)}px ${BRUSH_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(v.text, 0, 1);
      break;
    }
    case 'ring': {
      ctx.globalAlpha = Math.max(0, 1 - f);
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 3 * (1 - f) + 0.5;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.r + f * v.r2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'confetti': {
      ctx.globalAlpha = Math.max(0, 1 - f);
      for (const p of v.points) {
        const t = v.t;
        ctx.save();
        ctx.translate(v.x + p.x * t * 2.4, v.y + p.y * t * 2.4 + t * t * 60);
        ctx.rotate(p.x + time * 6);
        ctx.fillStyle = v.color;
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(3, 2);
        ctx.lineTo(-3, 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'inkSplash': {
      ctx.globalAlpha = Math.max(0, 0.8 * (1 - f));
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.r * (0.5 + f * 0.6), 0, Math.PI * 2);
      ctx.fill();
      for (const p of v.points) {
        ctx.beginPath();
        ctx.arc(v.x + p.x * (1 + f), v.y + p.y * (1 + f), 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'laserBeam': {
      ctx.globalAlpha = Math.max(0, 1 - f * 1.6);
      const grad = ctx.createLinearGradient(v.points[0].x, v.points[0].y, v.points[1].x, v.points[1].y);
      grad.addColorStop(0, '#E63946');
      grad.addColorStop(0.5, '#F4B942');
      grad.addColorStop(1, '#E63946');
      ctx.strokeStyle = grad;
      ctx.lineWidth = v.r * (1 - f * 0.6);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(v.points[0].x, v.points[0].y);
      ctx.lineTo(v.points[1].x, v.points[1].y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(244, 239, 230, 0.75)';
      ctx.lineWidth = Math.max(1, v.r * 0.22);
      ctx.stroke();
      break;
    }
    case 'beamFlash': {
      ctx.globalAlpha = Math.max(0, 1 - f * 1.8);
      ctx.strokeStyle = '#D4A373';
      ctx.lineWidth = 5 * (1 - f) + 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(v.points[0].x, v.points[0].y);
      ctx.lineTo(v.points[1].x, v.points[1].y);
      ctx.stroke();
      break;
    }
    case 'chainArc': {
      ctx.globalAlpha = Math.max(0, 1 - f * 1.5);
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      const a = v.points[0];
      const b = v.points[1];
      ctx.moveTo(a.x, a.y);
      const steps = 4;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const mx = a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 16;
        const my = a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 16;
        ctx.lineTo(mx, my);
      }
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      break;
    }
    case 'waveSweep': {
      const x = -120 + f * (CANVAS_W + 240);
      ctx.globalAlpha = 0.55;
      const grad = ctx.createLinearGradient(x - 160, 0, x + 40, 0);
      grad.addColorStop(0, 'rgba(58, 134, 255, 0)');
      grad.addColorStop(0.7, 'rgba(58, 134, 255, 0.5)');
      grad.addColorStop(1, 'rgba(144, 224, 239, 0.7)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - 160, 0, 200, CANVAS_H);
      ctx.strokeStyle = 'rgba(26, 25, 24, 0.7)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let yy = 0; yy <= CANVAS_H; yy += 24) {
        ctx.moveTo(x - 60, yy);
        ctx.quadraticCurveTo(x, yy + 10, x + 46, yy);
      }
      ctx.stroke();
      break;
    }
    case 'dragonSweep': {
      const count = v.points.length;
      const head = Math.min(count - 1, Math.floor(f * count));
      ctx.globalAlpha = 0.92;
      ctx.strokeStyle = '#1D1E2C';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const start = Math.max(0, head - 30);
      ctx.moveTo(v.points[start].x, v.points[start].y);
      for (let i = start + 1; i <= head; i++) ctx.lineTo(v.points[i].x, v.points[i].y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(193, 18, 31, 0.6)';
      ctx.lineWidth = 3;
      ctx.stroke();
      const hp = v.points[head];
      facetPoly(ctx, [{ x: hp.x - 14, y: hp.y - 9 }, { x: hp.x + 14, y: hp.y - 6 }, { x: hp.x + 14, y: hp.y + 6 }, { x: hp.x - 14, y: hp.y + 9 }], '#1D1E2C', '#000000');
      break;
    }
    case 'poof': {
      ctx.globalAlpha = Math.max(0, 0.7 * (1 - f));
      ctx.fillStyle = 'rgba(180, 166, 138, 0.8)';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + v.spin;
        const d = 8 + f * 22;
        ctx.beginPath();
        ctx.arc(v.x + Math.cos(a) * d, v.y + Math.sin(a) * d, 5 * (1 - f) + 1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'aura': {
      ctx.globalAlpha = Math.max(0, 1 - f);
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 4 * (1 - f);
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.r * f, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'banner':
    default:
      break;
  }
  ctx.restore();
}

// ------------------------------------------------------------------ overlays

function drawRangeRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = rgba(color, 0.05);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawResonance(ctx: CanvasRenderingContext2D, from: Vec2, to: Vec2, color: string, time: number): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([5, 7]);
  ctx.lineDashOffset = -time * 30;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ frame

export function drawFrame(canvas: HTMLCanvasElement, state: GameState): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const time = state.time;
  const sx = canvas.width / CANVAS_W;
  const sy = canvas.height / CANVAS_H;
  const shakeX = state.shake > 0 ? (Math.random() - 0.5) * 2 * state.shake : 0;
  const shakeY = state.shake > 0 ? (Math.random() - 0.5) * 2 * state.shake : 0;
  ctx.setTransform(sx, 0, 0, sy, shakeX * sx, shakeY * sy);
  ctx.clearRect(-20, -20, CANVAS_W + 40, CANVAS_H + 40);

  const bg = getMapBackground(state.map);
  ctx.drawImage(bg, 0, 0, CANVAS_W, CANVAS_H);

  const lanes = state.map.lanes;

  // Ground effects (under everything).
  for (const g of state.ground) {
    if (g.kind === 'wake') {
      const lane = lanes[g.laneIndex];
      if (lane) drawWake(ctx, g, lane);
    } else {
      drawGround(ctx, g, time);
    }
  }

  // Range previews + resonance lines.
  if (state.pointer && state.shopElement) {
    const color = TOWER_DEFS[state.shopElement].color;
    const previewRange = computeTowerStats(state.shopElement, 0, 0).range;
    ctx.save();
    ctx.globalAlpha = 0.85;
    drawRangeRing(ctx, state.pointer.x, state.pointer.y, previewRange, state.pointerValid ? color : '#C1121F');
    const ghost: Tower = {
      id: -1,
      element: state.shopElement,
      x: state.pointer.x,
      y: state.pointer.y,
      tierA: 0,
      tierB: 0,
      targeting: 'first',
      cooldown: 0,
      angle: 0,
      kills: 0,
      damageDealt: 0,
      totalInvested: 0,
      shotCount: 0,
      abilityTimer: 0,
      abilityTimer2: 0,
      coneAngle: 0,
      laserAngle: 0,
      tickAcc: 0,
      orbitalAngle: 0,
      conduitBoost: false,
      buildFlash: 0,
      fireGlow: 0,
      muzzleX: 0,
      muzzleY: 0,
    };
    ctx.globalAlpha = 0.5;
    drawTower(ctx, ghost, computeTowerStats(state.shopElement, 0, 0), time);
    ctx.restore();
    for (const t of state.towers) {
      if (t.element === state.shopElement) continue;
      if (Math.hypot(t.x - state.pointer.x, t.y - state.pointer.y) <= RESONANCE_RANGE) {
        drawResonance(ctx, state.pointer, t, RESONANCE_COLORS[state.shopElement], time);
      }
    }
  }

  const selected = state.towers.find((t) => t.id === state.selectedTowerId);
  if (selected) {
    const stats = computeTowerStats(selected.element, selected.tierA, selected.tierB);
    const range = stats.range * (selected.conduitBoost ? 1.15 : 1);
    drawRangeRing(ctx, selected.x, selected.y, range, TOWER_DEFS[selected.element].color);
    for (const t of state.towers) {
      if (t.id === selected.id || t.element === selected.element) continue;
      if (Math.hypot(t.x - selected.x, t.y - selected.y) <= RESONANCE_RANGE) {
        drawResonance(ctx, selected, t, RESONANCE_COLORS[selected.element], time);
      }
    }
  }

  const rangePreview = state.rangePreview;
  if (rangePreview) {
    const t = state.towers.find((tw) => tw.id === rangePreview.towerId);
    if (t) {
      drawRangeRing(ctx, t.x, t.y, rangePreview.range, '#C9A227');
    }
  }

  // Towers.
  for (const tower of state.towers) {
    drawTower(ctx, tower, computeTowerStats(tower.element, tower.tierA, tower.tierB), time);
  }

  // Enemies (boss segments drawn per-enemy via lane context).
  for (const e of state.enemies) {
    const lane = lanes[e.laneIndex];
    if (!lane) continue;
    const pos = sampleLane(lane, e.distance);
    drawEnemy(ctx, e, pos, pos.angle, time, lane);
  }

  // Projectiles.
  for (const p of state.projectiles) {
    drawProjectile(ctx, p, time);
  }

  // VFX on top.
  for (const v of state.vfx) {
    drawVfx(ctx, v, time);
  }

  // Boss HP bar.
  const boss = state.enemies.find((e) => e.def.boss);
  if (boss) {
    const lane = lanes[boss.laneIndex];
    const pos = lane ? sampleLane(lane, boss.distance) : { x: 480, y: 40 };
    ctx.save();
    ctx.fillStyle = 'rgba(26, 25, 24, 0.82)';
    ctx.fillRect(290, 30, 380, 26);
    ctx.strokeStyle = '#C1121F';
    ctx.lineWidth = 2;
    ctx.strokeRect(290, 30, 380, 26);
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    ctx.fillStyle = '#C1121F';
    ctx.fillRect(293, 33, 374 * ratio, 20);
    ctx.fillStyle = '#F4EFE6';
    ctx.font = `700 13px ${BRUSH_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`龍 Paper Dragon - The Folded Shogun`, 480, 43);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.font = `700 10px ${BRUSH_FONT}`;
    ctx.fillStyle = 'rgba(43,41,39,0.8)';
    ctx.textAlign = 'left';
    ctx.fillText('BOSS', pos.x - 34, pos.y - boss.hitRadius - 12);
    ctx.restore();
  }

  // Wave banner.
  if (state.banner && state.banner.t > 0) {
    const bf = 1 - state.banner.t / 2.2;
    ctx.save();
    ctx.globalAlpha = state.banner.t > 1.9 ? (2.2 - state.banner.t) / 0.3 : Math.min(1, state.banner.t / 0.5);
    ctx.translate(480, 64 - Math.max(0, bf) * 6);
    ctx.fillStyle = 'rgba(26, 25, 24, 0.88)';
    ctx.beginPath();
    ctx.moveTo(-190, -16);
    ctx.lineTo(190, -16);
    ctx.lineTo(178, 16);
    ctx.lineTo(-178, 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#C1121F';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#F4EFE6';
    ctx.font = `700 14px ${BRUSH_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.banner.text, 0, -4);
    ctx.font = `600 10px ${BRUSH_FONT}`;
    ctx.fillStyle = 'rgba(244, 239, 230, 0.75)';
    ctx.fillText(state.banner.sub, 0, 9);
    ctx.restore();
  }

  // Corrupted ink modifier banner.
  if (state.modifierBanner && state.modifierBanner.t > 0) {
    const a = Math.min(1, state.modifierBanner.t / 0.4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(29, 30, 44, 0.92)';
    ctx.fillRect(140, 96, 680, 34);
    ctx.strokeStyle = '#C1121F';
    ctx.lineWidth = 2;
    ctx.strokeRect(140, 96, 680, 34);
    ctx.fillStyle = '#C1121F';
    ctx.font = `900 15px ${BRUSH_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`CORRUPTED INK - ${state.modifierBanner.name}: ${state.modifierBanner.desc}`, 480, 113);
    ctx.restore();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
