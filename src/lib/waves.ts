/**
 * Runic Origami & Ink - handcrafted waves 1-40, the Endless procedural
 * director and the Corrupted Ink modifiers for the Infinite Scroll.
 */

import type { EndlessModifier, EnemyKind, SpawnGroup, WaveDef } from './types';

function g(kind: EnemyKind, count: number, gap: number, delay: number, lane?: number): SpawnGroup {
  return { kind, count, gap, delay, lane };
}

/** Handcrafted wave table, 1-40 (used by Apprentice/Master/Grandmaster finals). */
export const WAVES: WaveDef[] = [
  { name: 'First Flutter', groups: [g('moth', 8, 0.9, 0)] },
  { name: 'Paper Drift', groups: [g('moth', 12, 0.65, 0)] },
  { name: 'Folded Wings', groups: [g('moth', 10, 0.8, 0), g('crane', 4, 1.6, 3)] },
  { name: 'Moth Squall', groups: [g('moth', 16, 0.45, 0), g('crane', 4, 1.5, 4)] },
  { name: 'Crane Court', groups: [g('crane', 8, 0.9, 0), g('moth', 8, 0.5, 2)] },
  { name: 'Phantom Whispers', groups: [g('fox', 4, 1.7, 0), g('moth', 10, 0.6, 1)] },
  { name: 'Fox Trickery', groups: [g('fox', 6, 1.4, 0), g('crane', 6, 0.9, 2)] },
  { name: 'River Serpent', groups: [g('serpent', 2, 3.0, 0), g('moth', 12, 0.55, 1), g('crane', 4, 1.4, 3)] },
  { name: 'Twin Coils', groups: [g('serpent', 4, 2.4, 0), g('fox', 6, 1.3, 1)] },
  { name: 'Moth Blizzard', groups: [g('moth', 24, 0.3, 0), g('crane', 6, 1.0, 2), g('serpent', 2, 4.0, 5)] },
  { name: 'Iron Shells', groups: [g('tortoise', 3, 2.4, 0), g('moth', 8, 0.6, 1)] },
  { name: 'Turtle Wall', groups: [g('tortoise', 5, 2.0, 0), g('crane', 8, 0.9, 2)] },
  { name: 'Cloak & Iron', groups: [g('fox', 6, 1.3, 0), g('tortoise', 4, 2.2, 2)] },
  { name: 'Serpent Coil', groups: [g('serpent', 6, 1.8, 0), g('crane', 8, 0.8, 1), g('fox', 6, 1.2, 4)] },
  { name: 'Iron Parade', groups: [g('tortoise', 8, 1.4, 0)] },
  { name: 'Great Migration', groups: [g('moth', 30, 0.22, 0), g('crane', 10, 0.7, 1), g('fox', 4, 2.0, 3)] },
  { name: "Shogun's Guard", groups: [g('tortoise', 8, 1.3, 0), g('fox', 8, 1.1, 1)] },
  { name: 'Paper Typhoon', groups: [g('crane', 12, 0.55, 0), g('fox', 10, 0.9, 1)] },
  { name: 'Iron River', groups: [g('tortoise', 10, 1.0, 0), g('serpent', 6, 1.6, 2)] },
  { name: 'The Paper Dragon', groups: [g('dragon', 1, 6.0, 0), g('crane', 8, 1.0, 2), g('moth', 10, 0.4, 1)] },
  { name: 'Ashen Trail', groups: [g('fox', 12, 0.9, 0), g('crane', 10, 0.7, 1), g('tortoise', 4, 2.0, 5)] },
  { name: 'Serpent Festival', groups: [g('serpent', 10, 1.1, 0), g('moth', 16, 0.35, 2)] },
  { name: 'Iron Vanguard', groups: [g('tortoise', 12, 1.0, 0), g('crane', 8, 0.8, 3)] },
  { name: 'Phantom Legion', groups: [g('fox', 12, 0.8, 0), g('serpent', 8, 1.3, 1), g('tortoise', 6, 1.5, 4)] },
  { name: 'Dragon Shogun', groups: [g('dragon', 2, 6.0, 0), g('fox', 8, 1.2, 1)] },
  { name: 'Waning Paper', groups: [g('moth', 36, 0.18, 0), g('crane', 12, 0.55, 1), g('fox', 6, 1.2, 3)] },
  { name: 'Shell Storm', groups: [g('tortoise', 14, 0.9, 0)] },
  { name: 'Coil & Shell', groups: [g('serpent', 10, 1.1, 0), g('tortoise', 10, 0.9, 1)] },
  { name: 'Cloak Storm', groups: [g('fox', 16, 0.55, 0), g('crane', 10, 0.7, 2)] },
  { name: 'Twin Dragons', groups: [g('dragon', 2, 6.0, 0), g('serpent', 10, 1.0, 1)] },
  { name: 'Folded Flood', groups: [g('crane', 20, 0.4, 0), g('fox', 12, 0.7, 1)] },
  { name: 'Iron Tide', groups: [g('tortoise', 18, 0.65, 0)] },
  { name: 'Serpent River', groups: [g('serpent', 16, 0.55, 0), g('moth', 20, 0.3, 2)] },
  { name: 'Mist of Cloaks', groups: [g('fox', 20, 0.45, 0), g('tortoise', 12, 0.8, 3)] },
  { name: 'Dragon Council', groups: [g('dragon', 3, 6.0, 0), g('tortoise', 8, 1.2, 1)] },
  { name: 'Endless Fold', groups: [g('moth', 40, 0.16, 0), g('crane', 16, 0.45, 1), g('fox', 8, 0.9, 2)] },
  { name: 'Shell Fortress', groups: [g('tortoise', 20, 0.55, 0), g('serpent', 10, 0.9, 1)] },
  { name: 'Night of Cloaks', groups: [g('fox', 24, 0.35, 0), g('serpent', 16, 0.6, 1)] },
  { name: 'Iron Dynasty', groups: [g('tortoise', 24, 0.45, 0), g('fox', 12, 0.7, 2)] },
  { name: 'Dragon Apocalypse', groups: [g('dragon', 3, 7.0, 0), g('tortoise', 12, 1.0, 2), g('serpent', 12, 0.9, 4)] },
];

// ---------------------------------------------------------------- endless

export const CORRUPTED_MODIFIERS: EndlessModifier[] = [
  { id: 'swiftGale', name: 'Swift Gale', desc: 'All enemy speed +25%' },
  { id: 'ironOrigami', name: 'Iron Origami', desc: 'All enemies gain +1 Armor layer' },
  { id: 'phantomMist', name: 'Phantom Mist', desc: '30% of enemies spawn Cloaked' },
];

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

/**
 * Procedural Endless director: deterministic per wave index.
 * Composition grows with wave number; bosses return every 6 waves.
 */
export function endlessWave(wave: number): WaveDef {
  const rng = mulberry32(wave * 2654435761 + 12345);
  const depth = wave - 40;
  const groups: SpawnGroup[] = [];
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];

  groups.push(g('moth', 18 + Math.min(30, depth * 2), Math.max(0.12, 0.3 - depth * 0.005), 0));
  const heavies: EnemyKind[] = ['crane', 'fox', 'serpent', 'tortoise'];
  const heavyCount = 2 + Math.min(3, Math.floor(depth / 8));
  for (let i = 0; i < heavyCount; i++) {
    const kind = pick(heavies);
    const count = 6 + Math.min(18, Math.floor(depth / 2));
    groups.push(g(kind, count, Math.max(0.3, 0.9 - depth * 0.01), 1 + i * 2));
  }
  if (depth % 6 === 0 || wave % 13 === 0) {
    const bosses = 2 + Math.floor(depth / 12);
    groups.push(g('dragon', bosses, 7.0, 2));
  }
  if (depth % 4 === 0) {
    groups.push(g('tortoise', 8 + Math.min(12, depth), 0.7, 6));
  }
  return { name: `Corrupted Wave ${wave}`, groups };
}

/** Wave definition for a given wave index (handcrafted <= 40, director beyond). */
export function waveDef(wave: number): WaveDef {
  if (wave <= WAVES.length) {
    const def = WAVES[wave - 1];
    if (def) return def;
  }
  return endlessWave(wave);
}
