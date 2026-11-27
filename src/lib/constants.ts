import type {
  ComboDef,
  DifficultyDef,
  DifficultyId,
  Element,
  ElementDef,
  EnemyDef,
  EnemyKind,
  PathId,
  Stats,
  Tower,
} from './types';

export const W = 960;
export const H = 600;
export const FIXED_DT = 1 / 60;
export const TOWER_R = 14;
export const PAD_X0 = 28;
export const PAD_X1 = 932;
export const PAD_Y0 = 28;
export const PAD_Y1 = 572;
export const TRACK_HALF = 17;
export const RESONANCE_DIST = 150;
export const CONDUIT_BONUS = 1.15;

export const ELEMENT_ORDER: Element[] = ['air', 'fire', 'water', 'earth', 'ink'];

const tier = (name: string, text: string, transforms = false, apex = false) => ({ name, text, transforms, apex });

export const ELEMENTS: Record<Element, ElementDef> = {
  air: {
    id: 'air', name: 'Kaze', jp: '風', glyph: '風', color: '#2A9D8F', dark: '#1B6B61', light: '#7FD3C6',
    cost: 100, range: 155, rate: 1.35, dmg: 12, pierce: '2 pierce',
    desc: 'Homing paper shuriken. Applies Wind-Touched (3.0s).', status: 'Wind-Touched',
    upCosts: [85, 165, 320, 650],
    A: {
      name: 'Flock of Cranes',
      tiers: [
        tier('Swift Wings', 'Projectile speed +30%, homing turn rate 2x.'),
        tier('Folded Crane', 'Shuriken fold into Paper Cranes lasting 3.5s that retarget after each hit. +1 pierce.', true),
        tier('Mini-Swallows', 'Cranes split into 2 mini-swallows (8 dmg, 2 pierce) on their final hit.'),
        tier('Thousand-Fold Storm', '3 cranes per volley (18 dmg, 4 pierce each) and 2x fire rate.', false, true),
      ],
    },
    B: {
      name: 'Tessen War Fan',
      tiers: [
        tier('Long Fan', 'Range 185px, pierce 4.'),
        tier('Folding War Fan', 'Wide 44px crescent fans push non-boss enemies back 28px and bounce off canvas borders twice.', true),
        tier('Gale Force', 'Knockback 42px. Permanently strips Phantom/Camo shrouds.'),
        tier('Typhoon Gale', 'Every 4th shot unleashes a 110px ink whirlwind (55 dmg, 75px knockback, 15 pierce).', false, true),
      ],
    },
  },
  fire: {
    id: 'fire', name: 'Kagura', jp: '火', glyph: '火', color: '#E63946', dark: '#9E1F2A', light: '#FF8A92',
    cost: 135, range: 130, rate: 0.8, dmg: 18, pierce: '48px splash',
    desc: 'Lobbed ember lantern. Leaves a 2.5s Ash Patch (6 DPS). Applies Burning (3.0s).', status: 'Burning',
    upCosts: [115, 220, 430, 875],
    A: {
      name: 'Paper Dragon',
      tiers: [
        tier('Hot Embers', 'Burn DPS increases from 6 to 14.'),
        tier("Dragon's Breath", 'Replaces the lantern with a continuous 125px ember cone (12 ticks/s, 6 dmg). Melts armor permanently.', true),
        tier('Wide Flame', 'Cone widens to 65 degrees. Burn DPS 28.'),
        tier('Sun-Seal Lance', 'Map-spanning piercing laser ribbon (14px wide, 18 dmg x 15 ticks/s) tracking the strongest target.', false, true),
      ],
    },
    B: {
      name: 'Lotus Fireworks',
      tiers: [
        tier('Big Bloom', 'Splash radius 68px, direct damage 26.'),
        tier('Cluster Lotus', 'Lanterns burst into 4 spark-bombs (14 dmg, 36px splash) in a 55px ring.', true),
        tier('Deep Ash', 'Ash patches last 5.0s (22 DPS) and stack up to 3 times.'),
        tier('Sky-Lantern Barrage', 'Every 2.2s drops 8 exploding lanterns (65 dmg, 64px splash) on the densest clusters.', false, true),
      ],
    },
  },
  water: {
    id: 'water', name: 'Mizu', jp: '水', glyph: '水', color: '#3A86FF', dark: '#1F55B8', light: '#8DB9FF',
    cost: 115, range: 145, rate: 1.15, dmg: 11, pierce: '2 ricochets (90px)',
    desc: 'Fluid wave crest bouncing between enemies. Applies Soaked (25% slow, 3.5s).', status: 'Soaked',
    upCosts: [100, 190, 370, 745],
    A: {
      name: 'Koi & Tsunami',
      tiers: [
        tier('Quick Current', '+2 ricochet bounces (4 total), projectile speed +25%.'),
        tier('Leaping Koi', 'Swimming Paper Koi travel backward along the track for 220px, hitting up to 8 enemies (16 dmg).', true),
        tier('Wet Wake', 'Koi leave a 3.0s wake (35% slow, +20% combo damage taken).'),
        tier('Great Wave', 'Every 6.0s a full-screen brushstroke wave (95 dmg, 65px pushback) soaks everyone.', false, true),
      ],
    },
    B: {
      name: 'Whirlpool & Lotus',
      tiers: [
        tier('Deep Soak', 'Soaked slow 38%, duration 5.0s.'),
        tier('Paper Whirlpool', 'Impacts spawn a 58px vortex (2.0s) pulling enemies in (45 px/s, 10 DPS).', true),
        tier('Maelstrom', 'Vortex radius 76px; pulled enemies take +25% damage from all sources.'),
        tier('Glacial Lotus', 'Soaked enemies struck 3 times freeze 1.8s in a crystal prism; the next hit shatters for 110 AoE.', false, true),
      ],
    },
  },
  earth: {
    id: 'earth', name: 'Tsuchi', jp: '土', glyph: '土', color: '#D4A373', dark: '#8F6B3F', light: '#EBCBA3',
    cost: 150, range: 125, rate: 0.65, dmg: 34, pierce: '1 (+100% vs Armor)',
    desc: 'Heavy monolith spike. 0.35s stun. Applies Fractured (+15% damage taken, 3.0s).', status: 'Fractured',
    upCosts: [125, 245, 480, 975],
    A: {
      name: 'Shatter Prism',
      tiers: [
        tier('Heavy Fold', 'Base damage 55, stun 0.5s.'),
        tier('Crystal Prism', 'Impact shatters into 5 paper shards (18 dmg) in a 70 degree cone behind the target.', true),
        tier('Critical Facets', 'Shards deal 2x (36 dmg) to Soaked, Stained or Fractured targets.'),
        tier('Tectonic Monolith', 'Rolling origami boulders (140 dmg, crush 12 enemies) detonate for 180 AoE.', false, true),
      ],
    },
    B: {
      name: 'Kinetic Sentinel',
      tiers: [
        tier('Watchful Stone', 'Range 155px, fire rate 0.85/s.'),
        tier('Orbiting Polyhedrons', '3 spinning spikes orbit at 68px (24 dmg on contact, 0.4s hit cooldown).', true),
        tier('Homing Darts', 'Every 3.0s launches copies of all 3 polyhedrons as homing darts (45 dmg).'),
        tier('Celestial Orrery', '6 orbiting blades (90px, 42 dmg) plus a piercing stone beam (65 dmg) every 1.2s.', false, true),
      ],
    },
  },
  ink: {
    id: 'ink', name: 'Sumi', jp: '墨', glyph: '墨', color: '#1D1E2C', dark: '#0B0B12', light: '#5A5C78',
    cost: 110, range: 140, rate: 0.95, dmg: 8, pierce: '42px splash',
    desc: 'Calligraphy blot. Applies Stained (45% slow, 4.0s) and strips Phantom shrouds.', status: 'Stained',
    upCosts: [95, 180, 350, 715],
    A: {
      name: 'Brushstroke River',
      tiers: [
        tier('Wide Brush', 'Splash radius 62px, slow 52%.'),
        tier('Calligraphy Pool', 'Paints 64px ink puddles on the nearest track point every 1.1s (5.5s, 60% slow).', true),
        tier('Corrosive Ink', 'Puddles strip armor layers and deal 18 corrosive DPS.'),
        tier('Living Dragon Scroll', 'Every 7.0s an ink dragon swims exit to entrance (120 dmg, permanent Stained, 65% slow 6s).', false, true),
      ],
    },
    B: {
      name: 'Soul Tether & Void',
      tiers: [
        tier('Quick Quill', 'Fire rate 1.30/s, range 165px.'),
        tier('Ink Tendrils', 'Tethers target to up to 3 enemies within 95px for 3.5s; 40% of damage is shared.', true),
        tier('Binding Ink', 'Tethered enemies move 30% slower and cannot cloak or split on pop.'),
        tier('Void Origami Cube', 'Every 5th shot traps the target in an obsidian cube (2.5s), then detonates for 160 AoE (90px).', false, true),
      ],
    },
  },
};

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  apprentice: { id: 'apprentice', name: 'Apprentice Scroll', jp: '見習', tag: 'Normal', ink: 450, lives: 100, waves: 25, hp: 1.0, speed: 1.0, cost: 1.0 },
  master: { id: 'master', name: 'Master Calligrapher', jp: '師範', tag: 'Hard', ink: 375, lives: 50, waves: 35, hp: 1.25, speed: 1.08, cost: 1.1 },
  grandmaster: { id: 'grandmaster', name: 'Grandmaster Seal', jp: '名人', tag: 'Nightmare', ink: 325, lives: 1, waves: 40, hp: 1.45, speed: 1.15, cost: 1.2 },
};
export const DIFFICULTY_ORDER: DifficultyId[] = ['apprentice', 'master', 'grandmaster'];

export const COMBOS: ComboDef[] = [
  { id: 'steam', a: 'water', b: 'fire', name: 'Scalding Steam', kanji: '蒸', callout: 'SCALD!', color: '#9CC9E8', desc: '45 + 6w AoE damage (85px) and a 40% slow for 2.5s.' },
  { id: 'monsoon', a: 'water', b: 'air', name: 'Monsoon Squall', kanji: '嵐', callout: 'MONSOON!', color: '#2A9D8F', desc: 'Chains 35 + 4w damage arcs to up to 5 enemies within 110px.' },
  { id: 'mudslide', a: 'water', b: 'earth', name: 'Mudslide', kanji: '泥', callout: 'MIRE!', color: '#8F6B3F', desc: 'Roots the target 1.3s, strips Armor, deals 40 + 5w damage.' },
  { id: 'wash', a: 'water', b: 'ink', name: 'Spreading Wash', kanji: '滲', callout: 'SPREAD!', color: '#3A4A7A', desc: 'Spreads Soaked + Stained to all enemies within 115px, plus 25 burst damage.' },
  { id: 'firestorm', a: 'fire', b: 'air', name: 'Firestorm', kanji: '炎', callout: 'IGNITE!', color: '#E63946', desc: '50 + 6w AoE (80px), 35px knockback, refreshes Burning.' },
  { id: 'slag', a: 'fire', b: 'earth', name: 'Molten Slag', kanji: '溶', callout: 'MOLTEN!', color: '#E8782A', desc: 'Spawns a 65px magma patch (4.0s) dealing 28 + 3w DPS.' },
  { id: 'lacquer', a: 'fire', b: 'ink', name: 'Scorched Lacquer', kanji: '漆', callout: 'SCORCH!', color: '#7A1F2A', desc: '75 + 9w True Burst Damage that bypasses all Armor and resistances.' },
  { id: 'sandstorm', a: 'air', b: 'earth', name: 'Sandstorm Shrapnel', kanji: '砂', callout: 'SHATTER!', color: '#C9A064', desc: 'Fires 6 grit needles (16 + 2w each) in a 90 degree cone; strips Armor.' },
  { id: 'gale', a: 'air', b: 'ink', name: 'Calligraphy Gale', kanji: '颪', callout: 'GALE!', color: '#2B6E7A', desc: 'Launches 3 seeking ink-wind blades (24 + 3w) that drop mini puddles.' },
  { id: 'petrify', a: 'earth', b: 'ink', name: 'Petrified Seal', kanji: '石', callout: 'PETRIFY!', color: '#6B6258', desc: 'Freezes the target 1.6s; it takes +50% damage from all sources meanwhile.' },
];

export function comboFor(x: Element, y: Element): ComboDef | undefined {
  return COMBOS.find((c) => (c.a === x && c.b === y) || (c.a === y && c.b === x));
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  moth: { kind: 'moth', name: 'Paper Moth', hp: 24, speed: 78, bounty: 4, radius: 9, leak: 1, peels: [], note: 'Fast fragile swarm.' },
  crane: { kind: 'crane', name: 'Folded Crane', hp: 55, speed: 96, bounty: 7, radius: 11, leak: 2, peels: ['moth', 'moth'], note: 'Swift. Immune to knockback under 20px.' },
  fox: { kind: 'fox', name: 'Origami Fox', hp: 65, speed: 84, bounty: 9, radius: 12, leak: 3, peels: ['crane'], note: 'Phantom: untargetable until revealed.' },
  serpent: { kind: 'serpent', name: 'Tidal Serpent', hp: 110, speed: 72, bounty: 12, radius: 12, leak: 3, peels: ['moth', 'moth'], note: 'Immune to Soaked slow. Splits on pop.' },
  tortoise: { kind: 'tortoise', name: 'Iron-Fold Tortoise', hp: 160, speed: 46, bounty: 16, radius: 15, leak: 4, peels: ['fox'], note: 'Armored: 50% less damage from Air and Water.' },
  dragon: { kind: 'dragon', name: 'Paper Dragon', hp: 1400, speed: 36, bounty: 120, radius: 22, leak: 25, peels: ['tortoise', 'tortoise', 'tortoise'], note: 'Boss. Immune to knockback and roots; slows capped at 25%.' },
};

export const ENEMY_COLORS: Record<EnemyKind, string> = {
  moth: '#EDE6D6', crane: '#E8A0BF', fox: '#E07B39', serpent: '#4A90C2', tortoise: '#7A8B7A', dragon: '#F0EAF5',
};

export function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function upgradeCost(el: Element, tierIndex: number, diffCost: number): number {
  return round5(ELEMENTS[el].upCosts[tierIndex] * diffCost);
}

export function hpScale(w: number, target: number): number {
  const std = (x: number) => 1 + 0.11 * (x - 1) + 0.008 * (x - 1) * (x - 1);
  if (w <= target) return std(w);
  return std(target) * Math.pow(1.14, w - target);
}

export function endlessSpeed(w: number, target: number): number {
  return w <= target ? 1 : Math.min(2.2, 1 + 0.025 * (w - target));
}

export function waveClearBonus(w: number): number {
  return 45 + 8 * w;
}

export function overclockBonus(w: number): number {
  return 20 + Math.floor(0.15 * waveClearBonus(w));
}

export function salvage(t: { invested: number }): number {
  return Math.floor(t.invested * 0.75);
}

export const MODIFIERS = {
  swift: { name: 'Swift Gale', text: 'Enemies move +25% faster', color: '#2A9D8F' },
  iron: { name: 'Iron Origami', text: 'Every enemy gains +1 Armor', color: '#555B66' },
  mist: { name: 'Phantom Mist', text: '30% of enemies are Camo', color: '#8E7CC3' },
} as const;

export function baseStats(): Stats {
  return {
    range: 0, rate: 1, dmg: 1, pierce: 1, splash: 0, speed: 300, turn: 5,
    burnT: 3, burnDps: 6, soakSlow: 0.25, soakT: 3.5, stainSlow: 0.45, stainT: 4,
    stun: 0, knock: 0, stripCamo: false, bounces: 2, hop: 90, volley: 1,
    crane: false, swallows: false, fan: false, whirl: false, cone: false, coneAng: 0.785,
    laser: false, cluster: false, ashT: 2.5, ashDps: 6, ashStack: 1, barrage: false,
    koi: false, wake: false, tsunami: false, vortex: false, vortexR: 58, pullDmg: false, lotus: false,
    shards: false, crit: false, boulder: false, orbit: 0, orbitR: 68, orbitDmg: 24, darts: false, beam: false,
    pool: false, corrode: false, dragon: false, tether: false, tetherSlow: false, cube: false,
  };
}

type TierState = Pick<Tower, 'element' | 'a' | 'b' | 'lastPath'>;

/** Derive every effective number for a tower from its element + (A, B) tiers. */
export function computeStats(t: TierState): Stats {
  const e = ELEMENTS[t.element];
  const s = baseStats();
  s.range = e.range;
  s.rate = e.rate;
  s.dmg = e.dmg;
  const { a, b } = t;
  const pA = a >= 2 && (b < 2 || a > b || (a === b && t.lastPath === 'A'));
  const pB = b >= 2 && (a < 2 || b > a || (a === b && t.lastPath === 'B'));
  switch (t.element) {
    case 'air':
      s.pierce = 2; s.speed = 340; s.turn = 4.8;
      if (a >= 1) { s.speed *= 1.3; s.turn *= 2; }
      if (b >= 1) { s.range = 185; s.pierce = 4; }
      if (pA) { s.crane = true; s.pierce += 1; }
      if (a >= 3 && pA) s.swallows = true;
      if (a >= 4) { s.dmg = 18; s.pierce = 4; s.volley = 3; s.rate *= 2; }
      if (pB) { s.fan = true; s.knock = 28; }
      if (b >= 3) { s.knock = 42; s.stripCamo = true; }
      if (b >= 4) s.whirl = true;
      break;
    case 'fire':
      s.splash = 48;
      if (a >= 1) s.burnDps = 14;
      if (b >= 1) { s.splash = 68; s.dmg = 26; }
      if (pA) { s.cone = true; s.rate = 12; s.dmg = 6; s.coneAng = 0.785; }
      if (a >= 3) { s.coneAng = 1.134; s.burnDps = 28; }
      if (a >= 4) { s.laser = true; s.cone = false; s.rate = 15; s.dmg = 18; s.range = 240; }
      if (pB && !s.cone && !s.laser) s.cluster = true;
      if (b >= 3) { s.ashT = 5; s.ashDps = 22; s.ashStack = 3; }
      if (b >= 4) s.barrage = true;
      break;
    case 'water':
      s.speed = 300; s.bounces = 2;
      if (a >= 1) { s.bounces = 4; s.speed *= 1.25; }
      if (a >= 2) { s.koi = true; s.dmg = 16; s.pierce = 8; }
      if (a >= 3) s.wake = true;
      if (a >= 4) s.tsunami = true;
      if (b >= 1) { s.soakSlow = 0.38; s.soakT = 5; }
      if (b >= 2) s.vortex = true;
      if (b >= 3) { s.vortexR = 76; s.pullDmg = true; }
      if (b >= 4) s.lotus = true;
      break;
    case 'earth':
      s.speed = 280; s.stun = 0.35; s.pierce = 1;
      if (a >= 1) { s.dmg = 55; s.stun = 0.5; }
      if (a >= 2) s.shards = true;
      if (a >= 3) s.crit = true;
      if (a >= 4) { s.boulder = true; s.dmg = 140; s.pierce = 12; }
      if (b >= 1) { s.range = 155; s.rate = 0.85; }
      if (b >= 2) { s.orbit = 3; s.orbitR = 68; s.orbitDmg = 24; }
      if (b >= 3) s.darts = true;
      if (b >= 4) { s.orbit = 6; s.orbitR = 90; s.orbitDmg = 42; s.beam = true; }
      break;
    case 'ink':
      s.speed = 320; s.splash = 42;
      if (a >= 1) { s.splash = 62; s.stainSlow = 0.52; }
      if (a >= 2) s.pool = true;
      if (a >= 3) s.corrode = true;
      if (a >= 4) s.dragon = true;
      if (b >= 1) { s.rate = 1.3; s.range = 165; }
      if (b >= 2) s.tether = true;
      if (b >= 3) s.tetherSlow = true;
      if (b >= 4) s.cube = true;
      break;
  }
  return s;
}

export function towerName(t: TierState): string {
  const e = ELEMENTS[t.element];
  const hi = Math.max(t.a, t.b);
  if (hi === 0) return `${e.name} Seal`;
  const path: PathId = t.a > t.b ? 'A' : t.b > t.a ? 'B' : t.lastPath;
  const tiers = path === 'A' ? e.A.tiers : e.B.tiers;
  return tiers[hi - 1].name;
}

export function nextTierAllowed(t: TierState, path: PathId): { ok: boolean; reason: string } {
  const cur = path === 'A' ? t.a : t.b;
  const other = path === 'A' ? t.b : t.a;
  if (cur >= 4) return { ok: false, reason: 'Max tier' };
  if (cur + 1 >= 3 && other >= 3) return { ok: false, reason: 'SEALED' };
  return { ok: true, reason: '' };
}
