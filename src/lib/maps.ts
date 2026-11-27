/**
 * Runic Origami & Ink - three rice-paper scroll maps.
 * Lanes are uniform Catmull-Rom splines, pre-sampled every 4 px into
 * arc-length lookup tables. Enemies address the track strictly by
 * { laneIndex, distanceTraveled } so they can never jump lanes or drift.
 */

import { FIELD_PAD, LANE_SAMPLE_SPACING, TOWER_GAP, TRACK_CLEARANCE } from './constants';
import type { ConduitZone, LaneDef, LaneSample, MapDef, PlacementCheck, Tower, Vec2 } from './types';

// ------------------------------------------------------------------ spline math

function catmull(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number): number =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}

const SEG_STEPS = 22;

/**
 * Build an arc-length uniform lane from Catmull-Rom control points.
 * Dense polyline -> cumulative length -> resampled every LANE_SAMPLE_SPACING px.
 */
export function buildLane(points: Vec2[]): LaneDef {
  const dense: Vec2[] = [];
  const last = points.length - 1;
  for (let i = 0; i < last; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(last, i + 2)];
    const end = i === last - 1 ? SEG_STEPS : SEG_STEPS - 1;
    for (let s = 0; s <= end; s++) {
      dense.push(catmull(p0, p1, p2, p3, s / SEG_STEPS));
    }
  }

  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i];
    total += Math.hypot(b.x - a.x, b.y - a.y);
    cum.push(total);
  }

  const spacing = LANE_SAMPLE_SPACING;
  const count = Math.max(1, Math.floor(total / spacing));
  const samples: LaneSample[] = [];
  let cursor = 0;
  for (let k = 0; k <= count; k++) {
    const target = Math.min(k * spacing, total);
    while (cursor < cum.length - 2 && cum[cursor + 1] < target) cursor++;
    const d0 = cum[cursor];
    const d1 = cum[cursor + 1];
    const span = Math.max(1e-6, d1 - d0);
    const f = Math.min(1, Math.max(0, (target - d0) / span));
    const a = dense[cursor];
    const b = dense[cursor + 1];
    samples.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: 0 });
  }

  for (let i = 0; i < samples.length; i++) {
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    samples[i].angle = Math.atan2(next.y - prev.y, next.x - prev.x);
  }

  return {
    samples,
    spacing,
    length: count * spacing,
    entrance: { x: samples[0].x, y: samples[0].y },
    exit: { x: samples[samples.length - 1].x, y: samples[samples.length - 1].y },
  };
}

/** Exact position/angle at arc-length d along a lane. */
export function sampleLane(lane: LaneDef, d: number): LaneSample {
  const clamped = Math.max(0, Math.min(lane.length, d));
  const idx = clamped / lane.spacing;
  const i0 = Math.max(0, Math.min(lane.samples.length - 1, Math.floor(idx)));
  const i1 = Math.min(lane.samples.length - 1, i0 + 1);
  const f = idx - i0;
  const a = lane.samples[i0];
  const b = lane.samples[i1];
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    angle: f < 0.5 ? a.angle : b.angle,
  };
}

export interface LaneHit {
  laneIndex: number;
  along: number;
  dist: number;
}

/** Nearest point of any lane to (x, y), scanning the 4 px samples. */
export function nearestLanePoint(lanes: LaneDef[], x: number, y: number): LaneHit {
  let best: LaneHit = { laneIndex: 0, along: 0, dist: Infinity };
  for (let li = 0; li < lanes.length; li++) {
    const lane = lanes[li];
    for (let i = 0; i < lane.samples.length; i++) {
      const s = lane.samples[i];
      const dx = s.x - x;
      const dy = s.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < best.dist) {
        best = { laneIndex: li, along: i * lane.spacing, dist };
      }
    }
  }
  return best;
}

/**
 * Deterministic placement validation:
 *  - distance to nearest 4 px track sample >= TRACK_CLEARANCE (45 px)
 *  - distance to every existing tower >= TOWER_GAP (38 px)
 *  - inside the scroll playfield [28, 932] x [28, 572]
 */
export function isValidPlacement(
  lanes: LaneDef[],
  towers: Tower[],
  conduits: ConduitZone[],
  x: number,
  y: number,
): PlacementCheck {
  if (x < FIELD_PAD.minX || x > FIELD_PAD.maxX || y < FIELD_PAD.minY || y > FIELD_PAD.maxY) {
    return { ok: false, reason: 'bounds', inConduit: false };
  }
  const inConduit = conduits.some((c) => Math.hypot(c.x - x, c.y - y) <= c.r);
  if (nearestLanePoint(lanes, x, y).dist < TRACK_CLEARANCE) {
    return { ok: false, reason: 'track', inConduit };
  }
  for (const tower of towers) {
    if (Math.hypot(tower.x - x, tower.y - y) < TOWER_GAP) {
      return { ok: false, reason: 'tower', inConduit };
    }
  }
  return { ok: true, reason: null, inConduit };
}

// ------------------------------------------------------------------ maps

function noConduits(): ConduitZone[] {
  return [];
}

const RIVER_CONDUITS: ConduitZone[] = [
  { x: 430, y: 300, r: 46 },
  { x: 700, y: 255, r: 46 },
];

export const MAPS: MapDef[] = [
  {
    id: 'river',
    name: 'Winding Calligraphy River',
    tier: 'Beginner',
    flavor:
      'A sweeping S-curve with four hairpin bends. Two Conduit Stone Circles on the central islands grant +15% range to towers placed inside.',
    lanes: [
      buildLane([
        { x: -40, y: 150 },
        { x: 110, y: 150 },
        { x: 230, y: 190 },
        { x: 310, y: 290 },
        { x: 240, y: 400 },
        { x: 330, y: 505 },
        { x: 480, y: 525 },
        { x: 610, y: 465 },
        { x: 635, y: 345 },
        { x: 565, y: 245 },
        { x: 655, y: 155 },
        { x: 810, y: 165 },
        { x: 900, y: 255 },
        { x: 885, y: 415 },
        { x: 790, y: 480 },
        { x: 1010, y: 500 },
      ]),
    ],
    conduits: RIVER_CONDUITS,
    spiral: false,
    bridge: null,
  },
  {
    id: 'bridges',
    name: 'Twin-Bridge Crossover',
    tier: 'Intermediate',
    flavor:
      'Two independent splines enter from the top-left and bottom-left, crossing at the wooden overpass bridge (480, 300) and exiting at two crimson hanko seals. Waves split traffic across both lanes.',
    lanes: [
      buildLane([
        { x: -40, y: 110 },
        { x: 140, y: 118 },
        { x: 260, y: 190 },
        { x: 370, y: 240 },
        { x: 480, y: 300 },
        { x: 610, y: 255 },
        { x: 740, y: 205 },
        { x: 880, y: 195 },
        { x: 1010, y: 190 },
      ]),
      buildLane([
        { x: -40, y: 490 },
        { x: 140, y: 482 },
        { x: 260, y: 412 },
        { x: 370, y: 362 },
        { x: 480, y: 300 },
        { x: 610, y: 350 },
        { x: 740, y: 400 },
        { x: 880, y: 410 },
        { x: 1010, y: 415 },
      ]),
    ],
    conduits: noConduits(),
    spiral: false,
    bridge: { x: 480, y: 300 },
  },
  {
    id: 'spiral',
    name: 'The Spiral Shrine',
    tier: 'Advanced',
    flavor:
      'An inward-coiling spiral from the outer border to a single crimson hanko stamp at the shrine center (480, 300). Enemies on the outer 40% of the spline move +15% faster.',
    lanes: [
      buildLane([
        { x: -40, y: 70 },
        { x: 880, y: 70 },
        { x: 880, y: 530 },
        { x: 80, y: 530 },
        { x: 80, y: 170 },
        { x: 790, y: 170 },
        { x: 790, y: 430 },
        { x: 170, y: 430 },
        { x: 170, y: 270 },
        { x: 700, y: 270 },
        { x: 700, y: 370 },
        { x: 480, y: 300 },
      ]),
    ],
    conduits: noConduits(),
    spiral: true,
    bridge: null,
  },
];

export function getMapById(id: string): MapDef | null {
  return MAPS.find((m) => m.id === id) ?? null;
}
