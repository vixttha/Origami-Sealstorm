import { PLAYFIELD_PADDING, TOWER_RADIUS } from './constants';
import {
  ConduitZone,
  MapId,
  Point2D,
  PrecomputedMapData,
  ScrollMapDefinition,
  SplineSample,
  TowerEntity,
} from './types';

export const SCROLL_MAPS: Record<MapId, ScrollMapDefinition> = {
  river: {
    id: 'river',
    name: 'Winding Calligraphy River',
    japaneseTitle: 'Sumi-e Kawa',
    difficultyLabel: 'Beginner',
    description:
      'A sweeping S-curve ink river with four gentle hairpin bends and two ancient Conduit Stone Circles.',
    specialRuleText: 'Conduit Stone Circles grant +15% Attack Range to towers placed within them.',
    trackHalfWidth: 22,
    controlPoints: [
      [
        { x: 45, y: 170 },
        { x: 165, y: 120 },
        { x: 310, y: 115 },
        { x: 415, y: 190 },
        { x: 390, y: 330 },
        { x: 335, y: 455 },
        { x: 470, y: 515 },
        { x: 645, y: 485 },
        { x: 710, y: 350 },
        { x: 640, y: 205 },
        { x: 740, y: 125 },
        { x: 875, y: 185 },
      ],
    ],
    conduits: [
      {
        x: 245,
        y: 265,
        radius: 44,
        rangeMultiplier: 1.15,
        label: 'West Wind Stone (+15% Range)',
      },
      {
        x: 535,
        y: 345,
        radius: 44,
        rangeMultiplier: 1.15,
        label: 'East Dragon Stone (+15% Range)',
      },
    ],
  },
  twin_bridge: {
    id: 'twin_bridge',
    name: 'Twin-Bridge Crossover',
    japaneseTitle: 'Futatsu-Bashi',
    difficultyLabel: 'Intermediate',
    description:
      'Dual ink streams enter from the north and south, converging over a central Wooden Origami Bridge before splitting toward twin Sanctuary Seals.',
    specialRuleText:
      'Enemies split across 2 lanes and cross at (480, 300) without switching tracks.',
    trackHalfWidth: 20,
    controlPoints: [
      [
        { x: 50, y: 115 },
        { x: 210, y: 115 },
        { x: 345, y: 195 },
        { x: 480, y: 300 },
        { x: 615, y: 405 },
        { x: 760, y: 475 },
        { x: 890, y: 465 },
      ],
      [
        { x: 50, y: 485 },
        { x: 210, y: 485 },
        { x: 345, y: 405 },
        { x: 480, y: 300 },
        { x: 615, y: 195 },
        { x: 760, y: 125 },
        { x: 890, y: 135 },
      ],
    ],
    conduits: [
      {
        x: 480,
        y: 155,
        radius: 40,
        rangeMultiplier: 1.15,
        label: 'North Lantern Shrine (+15% Range)',
      },
      {
        x: 480,
        y: 445,
        radius: 40,
        rangeMultiplier: 1.15,
        label: 'South Lantern Shrine (+15% Range)',
      },
    ],
    bridge: {
      x: 480,
      y: 300,
      width: 92,
      height: 54,
      angle: -0.64,
    },
  },
  spiral: {
    id: 'spiral',
    name: 'The Spiral Shrine',
    japaneseTitle: 'Uzumaki Jinja',
    difficultyLabel: 'Advanced',
    description:
      'An inward-coiling sacred whirlpool path winding around a central Crimson Hanko Sanctuary.',
    specialRuleText:
      'Beasts on the outer 40% of the spiral rush +15% faster; central towers strike multiple rings.',
    trackHalfWidth: 20,
    controlPoints: [
      [
        { x: 65, y: 95 },
        { x: 480, y: 68 },
        { x: 865, y: 115 },
        { x: 880, y: 320 },
        { x: 845, y: 515 },
        { x: 480, y: 535 },
        { x: 135, y: 495 },
        { x: 125, y: 300 },
        { x: 235, y: 175 },
        { x: 500, y: 165 },
        { x: 730, y: 215 },
        { x: 735, y: 375 },
        { x: 560, y: 425 },
        { x: 335, y: 390 },
        { x: 325, y: 280 },
        { x: 480, y: 300 },
      ],
    ],
    conduits: [
      {
        x: 615,
        y: 295,
        radius: 38,
        rangeMultiplier: 1.15,
        label: 'Inner Vortex Stone (+15% Range)',
      },
    ],
  },
};

export const MAP_LIST: ScrollMapDefinition[] = [
  SCROLL_MAPS.river,
  SCROLL_MAPS.twin_bridge,
  SCROLL_MAPS.spiral,
];

function catmullRomPoint(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: number): Point2D {
  const t2 = t * t;
  const t3 = t2 * t;
  const x =
    0.5 *
    (2 * p1.x +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  const y =
    0.5 *
    (2 * p1.y +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  return { x, y };
}

function buildUniformSpline(controlPts: Point2D[], stepPx = 2): SplineSample[] {
  if (controlPts.length < 2) return [];

  const dense: Point2D[] = [];
  const subSteps = 32;
  for (let i = 0; i < controlPts.length - 1; i++) {
    const p0 = controlPts[Math.max(0, i - 1)];
    const p1 = controlPts[i];
    const p2 = controlPts[i + 1];
    const p3 = controlPts[Math.min(controlPts.length - 1, i + 2)];
    for (let s = 0; s < subSteps; s++) {
      const t = s / subSteps;
      dense.push(catmullRomPoint(p0, p1, p2, p3, t));
    }
  }
  dense.push(controlPts[controlPts.length - 1]);

  const samples: SplineSample[] = [];
  let accumDist = 0;
  let nextSampleDist = 0;

  samples.push({
    x: dense[0].x,
    y: dense[0].y,
    angle: Math.atan2(dense[1].y - dense[0].y, dense[1].x - dense[0].x),
    distance: 0,
  });
  nextSampleDist += stepPx;

  for (let i = 1; i < dense.length; i++) {
    const prev = dense[i - 1];
    const curr = dense[i];
    const segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (segLen <= 1e-5) continue;

    while (accumDist + segLen >= nextSampleDist) {
      const ratio = (nextSampleDist - accumDist) / segLen;
      const sx = prev.x + (curr.x - prev.x) * ratio;
      const sy = prev.y + (curr.y - prev.y) * ratio;
      const angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      samples.push({
        x: sx,
        y: sy,
        angle,
        distance: nextSampleDist,
      });
      nextSampleDist += stepPx;
    }
    accumDist += segLen;
  }

  const lastPt = dense[dense.length - 1];
  const prevSample = samples[samples.length - 1];
  if (Math.hypot(lastPt.x - prevSample.x, lastPt.y - prevSample.y) > 0.5) {
    samples.push({
      x: lastPt.x,
      y: lastPt.y,
      angle: prevSample.angle,
      distance: accumDist,
    });
  }

  return samples;
}

const cachedMapData: Partial<Record<MapId, PrecomputedMapData>> = {};

export function getPrecomputedMap(mapId: MapId): PrecomputedMapData {
  const existing = cachedMapData[mapId];
  if (existing) return existing;

  const definition = SCROLL_MAPS[mapId];
  const lanes: SplineSample[][] = [];
  const laneLengths: number[] = [];
  const clearanceSamples: Point2D[] = [];

  for (const ctrl of definition.controlPoints) {
    const laneSamples = buildUniformSpline(ctrl, 2);
    lanes.push(laneSamples);
    const totalLen =
      laneSamples.length > 0 ? laneSamples[laneSamples.length - 1].distance : 0;
    laneLengths.push(totalLen);

    // Pre-sample every 4px (every 2nd sample of 2px table) for deterministic placement validation
    for (let i = 0; i < laneSamples.length; i += 2) {
      clearanceSamples.push({ x: laneSamples[i].x, y: laneSamples[i].y });
    }
  }

  const computed: PrecomputedMapData = {
    definition,
    lanes,
    laneLengths,
    clearanceSamples,
  };
  cachedMapData[mapId] = computed;
  return computed;
}

export function sampleLaneAtDistance(
  mapData: PrecomputedMapData,
  laneIndex: number,
  distance: number
): SplineSample {
  const lane = mapData.lanes[laneIndex] ?? mapData.lanes[0];
  if (lane.length === 0) {
    return { x: 0, y: 0, angle: 0, distance: 0 };
  }
  if (distance <= 0) {
    return lane[0];
  }
  const maxDist = lane[lane.length - 1].distance;
  if (distance >= maxDist) {
    return lane[lane.length - 1];
  }

  const approxIdx = Math.min(lane.length - 2, Math.max(0, Math.floor(distance / 2)));
  const s0 = lane[approxIdx];
  const s1 = lane[approxIdx + 1];
  const span = s1.distance - s0.distance;
  const t = span > 1e-4 ? Math.min(1, Math.max(0, (distance - s0.distance) / span)) : 0;

  return {
    x: s0.x + (s1.x - s0.x) * t,
    y: s0.y + (s1.y - s0.y) * t,
    angle: s0.angle,
    distance,
  };
}

export function findNearestTrackPoint(
  mapData: PrecomputedMapData,
  x: number,
  y: number
): { x: number; y: number; laneIndex: number; distance: number; distToTrack: number } {
  let bestDist = Infinity;
  let bestSample = mapData.lanes[0][0];
  let bestLane = 0;

  for (let l = 0; l < mapData.lanes.length; l++) {
    const lane = mapData.lanes[l];
    for (let i = 0; i < lane.length; i += 2) {
      const s = lane[i];
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestDist) {
        bestDist = d;
        bestSample = s;
        bestLane = l;
      }
    }
  }

  return {
    x: bestSample.x,
    y: bestSample.y,
    laneIndex: bestLane,
    distance: bestSample.distance,
    distToTrack: bestDist,
  };
}

export function isPointInConduit(
  mapData: PrecomputedMapData,
  x: number,
  y: number
): ConduitZone | null {
  for (const conduit of mapData.definition.conduits) {
    if (Math.hypot(conduit.x - x, conduit.y - y) <= conduit.radius) {
      return conduit;
    }
  }
  return null;
}

export function validateTowerPlacement(
  mapData: PrecomputedMapData,
  existingTowers: TowerEntity[],
  x: number,
  y: number
): { valid: boolean; reason?: string; inConduit: boolean } {
  if (
    x < PLAYFIELD_PADDING.minX ||
    x > PLAYFIELD_PADDING.maxX ||
    y < PLAYFIELD_PADDING.minY ||
    y > PLAYFIELD_PADDING.maxY
  ) {
    return { valid: false, reason: 'Outside scroll margin', inConduit: false };
  }

  const minTrackDist = mapData.definition.trackHalfWidth + TOWER_RADIUS + 6;
  for (const pt of mapData.clearanceSamples) {
    if (Math.hypot(pt.x - x, pt.y - y) < minTrackDist) {
      return { valid: false, reason: 'Too close to brushstroke path', inConduit: false };
    }
  }

  const minTowerDist = TOWER_RADIUS * 2 + 4;
  for (const t of existingTowers) {
    if (Math.hypot(t.x - x, t.y - y) < minTowerDist) {
      return { valid: false, reason: 'Overlaps another Elemental Seal', inConduit: false };
    }
  }

  const conduit = isPointInConduit(mapData, x, y);
  return { valid: true, inConduit: Boolean(conduit) };
}
