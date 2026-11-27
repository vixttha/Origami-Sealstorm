/**
 * Runic Origami & Ink - exact base stats, upgrade definitions, combo table,
 * enemy stats, difficulty seals, scaling math and localStorage persistence.
 * All numbers below are transcribed from the master build specification.
 */

import type {
  ComboDef,
  DifficultyDef,
  DifficultyId,
  Element,
  EnemyDef,
  EnemyKind,
  Ledger,
  LedgerEntry,
  TargetMode,
  TowerDef,
  TowerStats,
} from './types';

// ------------------------------------------------------------------ geometry

export const CANVAS_W = 960;
export const CANVAS_H = 600;

/** Spline is pre-sampled every 4 px for placement validation. */
export const LANE_SAMPLE_SPACING = 4;

export const TRACK_HALF_WIDTH = 22;
export const TOWER_RADIUS = 17;
export const TOWER_GAP = TOWER_RADIUS * 2 + 4; // 38
export const TRACK_CLEARANCE = TRACK_HALF_WIDTH + TOWER_RADIUS + 6; // 45
export const FIELD_PAD = { minX: 28, maxX: 932, minY: 28, maxY: 572 };

/** Different-element towers within this distance show Resonance Lines. */
export const RESONANCE_RANGE = 170;
export const CONDUIT_RANGE_BONUS = 1.15;
export const CONDUIT_RADIUS = 46;

export const RESONANCE_COLORS: Record<Element, string> = {
  air: '#2A9D8F',
  fire: '#E63946',
  water: '#3A86FF',
  earth: '#D4A373',
  ink: '#1D1E2C',
};

// ------------------------------------------------------------------ elements

export const ELEMENTS: Element[] = ['air', 'fire', 'water', 'earth', 'ink'];

export const ELEMENT_META: Record<
  Element,
  { label: string; kanji: string; color: string; statusName: string; statusDesc: string }
> = {
  air: {
    label: 'Air (Kaze)',
    kanji: '風',
    color: '#2A9D8F',
    statusName: 'Wind-Touched',
    statusDesc: 'Marks the target for 3.0s - primed for Storm combos.',
  },
  fire: {
    label: 'Fire (Kagura)',
    kanji: '火',
    color: '#E63946',
    statusName: 'Burning',
    statusDesc: 'Burns for DPS over 3.0s - primed for Flame combos.',
  },
  water: {
    label: 'Water (Mizu)',
    kanji: '水',
    color: '#3A86FF',
    statusName: 'Soaked',
    statusDesc: 'Slows by 25% for 3.5s - primed for Tide combos.',
  },
  earth: {
    label: 'Earth (Tsuchi)',
    kanji: '土',
    color: '#D4A373',
    statusName: 'Fractured',
    statusDesc: 'Takes +15% damage for 3.0s - primed for Stone combos.',
  },
  ink: {
    label: 'Ink (Sumi)',
    kanji: '墨',
    color: '#1D1E2C',
    statusName: 'Stained',
    statusDesc: 'Slows by 45% for 4.0s and strips Phantom/Camo shrouds.',
  },
};

// ------------------------------------------------------------------ towers

export const TOWER_DEFS: Record<Element, TowerDef> = {
  air: {
    element: 'air',
    title: 'Kaze - Air',
    sealName: 'Air',
    kanji: '風',
    color: '#2A9D8F',
    accent: '#7FD1C5',
    cost: 100,
    baseDesc: 'Homing paper shuriken, 2 pierce. Applies Wind-Touched (3s).',
    statusName: 'Wind-Touched',
    pathA: {
      label: 'Flock of Cranes',
      tiers: [
        { name: 'Rising Winds', desc: 'Projectile speed +30%, homing turn rate doubled.', cost: 85, transforms: null },
        {
          name: 'Folded Crane',
          desc: 'Projectiles fold into paper cranes: persist 3.5s, auto-retarget after each hit, +1 pierce.',
          cost: 165,
          transforms: 'projectile',
        },
        { name: 'Swallow Split', desc: 'Cranes split into 2 mini-swallows (8 dmg, 2 pierce) on their final hit.', cost: 320, transforms: null },
        {
          name: 'Thousand-Fold Storm',
          desc: '3 cranes per volley (18 dmg, 4 pierce each) and double fire rate.',
          cost: 650,
          transforms: 'apex',
        },
      ],
    },
    pathB: {
      label: 'Tessen War Fan',
      tiers: [
        { name: 'Wide Fan', desc: 'Range 185px, pierce 4.', cost: 85, transforms: null },
        {
          name: 'Folding War Fan',
          desc: 'Wide 44px crescent fans knock enemies back 28px and bounce off canvas borders 2 times.',
          cost: 165,
          transforms: 'projectile',
        },
        { name: 'Gale Reveal', desc: 'Knockback 42px and permanently strips Phantom/Camo shrouds.', cost: 320, transforms: null },
        {
          name: 'Typhoon Gale',
          desc: 'Every 4th shot unleashes a 110px ink whirlwind: 55 dmg, 75px knockback, 15 pierce.',
          cost: 650,
          transforms: 'apex',
        },
      ],
    },
  },
  fire: {
    element: 'fire',
    title: 'Kagura - Fire',
    sealName: 'Fire',
    kanji: '火',
    color: '#E63946',
    accent: '#F4A261',
    cost: 135,
    baseDesc: 'Lobbed ember lantern, 48px splash, 2.5s Ash Patch (6 DPS). Applies Burning (3s).',
    statusName: 'Burning',
    pathA: {
      label: 'Paper Dragon',
      tiers: [
        { name: 'Ember Feast', desc: 'Burn DPS increases from 6 to 14.', cost: 115, transforms: null },
        {
          name: "Dragon's Breath",
          desc: 'Continuous 125px sweeping ember cone: 12 ticks/s, 6 dmg per tick, permanently melts armor.',
          cost: 220,
          transforms: 'projectile',
        },
        { name: 'Widened Breath', desc: 'Cone widens to 65 degrees, burn DPS 28.', cost: 430, transforms: null },
        {
          name: 'Sun-Seal Lance',
          desc: 'Map-spanning crimson-gold laser ribbon: 14px wide, 18 dmg/tick at 15 ticks/s, tracks the strongest enemy.',
          cost: 875,
          transforms: 'apex',
        },
      ],
    },
    pathB: {
      label: 'Lotus Fireworks',
      tiers: [
        { name: 'Bright Burst', desc: 'Splash radius 68px, direct damage 26.', cost: 115, transforms: null },
        {
          name: 'Cluster Lotus',
          desc: 'Lanterns burst into 4 spark-bombs (14 dmg, 36px splash) in a 55px ring.',
          cost: 220,
          transforms: 'projectile',
        },
        { name: 'Enduring Ash', desc: 'Ash patches last 5.0s at 22 DPS and stack up to 3 times.', cost: 430, transforms: null },
        {
          name: 'Sky-Lantern Barrage',
          desc: 'Every 2.2s drops 8 exploding lanterns (65 dmg, 64px splash) onto the densest clusters.',
          cost: 875,
          transforms: 'apex',
        },
      ],
    },
  },
  water: {
    element: 'water',
    title: 'Mizu - Water',
    sealName: 'Water',
    kanji: '水',
    color: '#3A86FF',
    accent: '#90E0EF',
    cost: 115,
    baseDesc: 'Fluid wave crest ricocheting between enemies (90px). Applies Soaked (25% slow, 3.5s).',
    statusName: 'Soaked',
    pathA: {
      label: 'Origami Koi & Tsunami',
      tiers: [
        { name: 'Extra Bounces', desc: '+2 ricochets (4 total), projectile speed +25%.', cost: 100, transforms: null },
        {
          name: 'Leaping Koi',
          desc: 'Swimming paper koi travel 220px backward down the track, striking up to 8 enemies (16 dmg).',
          cost: 190,
          transforms: 'projectile',
        },
        { name: 'Wet Wake', desc: 'Koi leave a 3.0s wet wake: 35% slow, +20% combo damage taken.', cost: 370, transforms: null },
        {
          name: 'Great Wave',
          desc: 'Every 6.0s summons a full-screen brushstroke wave: 95 dmg, 65px pushback, global Soaked.',
          cost: 745,
          transforms: 'apex',
        },
      ],
    },
    pathB: {
      label: 'Whirlpool & Glacial Lotus',
      tiers: [
        { name: 'Deep Chill', desc: 'Soaked slow 38%, duration 5.0s.', cost: 100, transforms: null },
        {
          name: 'Paper Whirlpool',
          desc: 'Impacts spawn a 58px spinning vortex (2.0s) dragging enemies 45px/s, 10 DPS.',
          cost: 190,
          transforms: 'projectile',
        },
        { name: 'Vortex Grasp', desc: 'Vortex radius 76px; dragged enemies take +25% damage from all sources.', cost: 370, transforms: null },
        {
          name: 'Glacial Lotus',
          desc: 'Soaked enemies struck 3 times freeze in crystal prisms (1.8s); the next hit shatters for 110 bonus AoE.',
          cost: 745,
          transforms: 'apex',
        },
      ],
    },
  },
  earth: {
    element: 'earth',
    title: 'Tsuchi - Earth',
    sealName: 'Earth',
    kanji: '土',
    color: '#D4A373',
    accent: '#F2CC8F',
    cost: 150,
    baseDesc: 'Heavy folded monolith spike, 0.35s stun, +100% damage vs Armor. Applies Fractured (3s).',
    statusName: 'Fractured',
    pathA: {
      label: 'Shatter Prism',
      tiers: [
        { name: 'Heavy Shard', desc: 'Base damage 55, stun 0.5s.', cost: 125, transforms: null },
        {
          name: 'Crystal Prism',
          desc: 'Impacts shatter into 5 high-velocity paper shards (18 dmg) in a 70 degree cone behind the target.',
          cost: 245,
          transforms: 'projectile',
        },
        { name: 'Prismatic Crit', desc: 'Shards deal 2.0x damage (36) to Soaked, Stained or Fractured targets.', cost: 480, transforms: null },
        {
          name: 'Tectonic Monolith',
          desc: 'Rolling origami boulders: 140 dmg, crush 12 enemies down the track, detonate for 180 AoE.',
          cost: 975,
          transforms: 'apex',
        },
      ],
    },
    pathB: {
      label: 'Kinetic Sentinel',
      tiers: [
        { name: 'Long Reach', desc: 'Range 155px, fire rate 0.85/s.', cost: 125, transforms: null },
        {
          name: 'Orbiting Polyhedrons',
          desc: '3 spinning origami spikes orbit at 68px: 24 dmg on contact, 0.4s per-enemy cooldown.',
          cost: 245,
          transforms: 'projectile',
        },
        { name: 'Homing Copies', desc: 'Every 3.0s launches all 3 polyhedrons as homing darts (45 dmg).', cost: 480, transforms: null },
        {
          name: 'Celestial Orrery',
          desc: '6 orbiting blades (90px, 42 dmg) firing instant piercing stone beams (65 dmg) every 1.2s.',
          cost: 975,
          transforms: 'apex',
        },
      ],
    },
  },
  ink: {
    element: 'ink',
    title: 'Sumi - Ink',
    sealName: 'Ink',
    kanji: '墨',
    color: '#1D1E2C',
    accent: '#5C5F73',
    cost: 110,
    baseDesc: 'Calligraphy blot, 42px splash. Applies Stained (45% slow, 4s) and strips Phantom/Camo.',
    statusName: 'Stained',
    pathA: {
      label: 'Brushstroke River',
      tiers: [
        { name: 'Wide Wash', desc: 'Splash radius 62px, slow 52%.', cost: 95, transforms: null },
        {
          name: 'Calligraphy Pool',
          desc: 'Paints 64px ink puddles on the nearest track point every 1.1s: 5.5s, 60% slow.',
          cost: 180,
          transforms: 'projectile',
        },
        { name: 'Corrosive Pools', desc: 'Puddles strip armor layers and deal 18 corrosive DPS.', cost: 350, transforms: null },
        {
          name: 'Living Dragon Scroll',
          desc: 'Every 7.0s an ink dragon swims backward from exit to entrance: 120 dmg, permanent Stained + 65% slow (6s).',
          cost: 715,
          transforms: 'apex',
        },
      ],
    },
    pathB: {
      label: 'Soul Tether & Void',
      tiers: [
        { name: 'Quick Strokes', desc: 'Fire rate 1.30/s, range 165px.', cost: 95, transforms: null },
        {
          name: 'Ink Tendrils',
          desc: 'Tethers the target to up to 3 enemies within 95px for 3.5s; 40% of damage is shared across the tether.',
          cost: 180,
          transforms: 'projectile',
        },
        { name: 'Binding Tethers', desc: 'Tethered enemies move 30% slower and cannot cloak or split on pop.', cost: 350, transforms: null },
        {
          name: 'Void Origami Cube',
          desc: 'Every 5th shot traps the target in an obsidian cube (2.5s), then detonates for 160 AoE (90px).',
          cost: 715,
          transforms: 'apex',
        },
      ],
    },
  },
};

// ------------------------------------------------------------------ targeting

export const TARGET_MODES: { id: TargetMode; label: string; hint: string }[] = [
  { id: 'first', label: 'First', hint: 'Furthest along the track' },
  { id: 'last', label: 'Last', hint: 'Closest to the entrance' },
  { id: 'strong', label: 'Strong', hint: 'Highest current HP' },
  { id: 'close', label: 'Close', hint: 'Nearest to the tower' },
  { id: 'unprimed', label: 'Unprimed', hint: 'Enemies in range lacking this element status' },
];

// ------------------------------------------------------------------ combos

export const COMBOS: ComboDef[] = [
  {
    id: 'water_fire',
    name: 'Scalding Steam',
    kanji: '湯',
    callout: 'SCALD!',
    elements: ['water', 'fire'],
    effect: '45 + 6w AoE damage (85px radius) and 40% slow for 2.5s.',
  },
  {
    id: 'water_air',
    name: 'Monsoon Squall',
    kanji: '嵐',
    callout: 'MONSOON!',
    elements: ['water', 'air'],
    effect: 'Chains 35 + 4w arcs to up to 5 enemies within 110px.',
  },
  {
    id: 'water_earth',
    name: 'Mudslide',
    kanji: '泥',
    callout: 'MUDSLIDE!',
    elements: ['water', 'earth'],
    effect: 'Roots the target 1.3s, strips Armor, deals 40 + 5w damage.',
  },
  {
    id: 'water_ink',
    name: 'Spreading Wash',
    kanji: '洗',
    callout: 'WASH!',
    elements: ['water', 'ink'],
    effect: 'Spreads Soaked + Stained to all enemies within 115px, plus 25 burst damage.',
  },
  {
    id: 'fire_air',
    name: 'Firestorm',
    kanji: '焔',
    callout: 'IGNITE!',
    elements: ['fire', 'air'],
    effect: '50 + 6w AoE damage (80px), 35px knockback, refreshes Burning.',
  },
  {
    id: 'fire_earth',
    name: 'Molten Slag',
    kanji: '溶',
    callout: 'SLAG!',
    elements: ['fire', 'earth'],
    effect: 'Spawns a 65px magma patch (4.0s) dealing 28 + 3w DPS.',
  },
  {
    id: 'fire_ink',
    name: 'Scorched Lacquer',
    kanji: '焦',
    callout: 'LACQUER!',
    elements: ['fire', 'ink'],
    effect: '75 + 9w True Burst Damage - bypasses all Armor and resistances.',
  },
  {
    id: 'air_earth',
    name: 'Sandstorm Shrapnel',
    kanji: '砂',
    callout: 'SHRAPNEL!',
    elements: ['air', 'earth'],
    effect: 'Fires 6 grit needles (16 + 2w damage) in a 90 degree cone; strips Armor.',
  },
  {
    id: 'air_ink',
    name: 'Calligraphy Gale',
    kanji: '筆',
    callout: 'GALE!',
    elements: ['air', 'ink'],
    effect: 'Launches 3 seeking ink-wind blades (24 + 3w damage) dropping mini puddles.',
  },
  {
    id: 'earth_ink',
    name: 'Petrified Seal',
    kanji: '封',
    callout: 'PETRIFY!',
    elements: ['earth', 'ink'],
    effect: 'Freezes the target 1.6s; it takes +50% damage from all sources while frozen.',
  },
];

const COMBO_LOOKUP = new Map<string, ComboDef>();
for (const combo of COMBOS) {
  COMBO_LOOKUP.set(combo.elements[0] + '|' + combo.elements[1], combo);
  COMBO_LOOKUP.set(combo.elements[1] + '|' + combo.elements[0], combo);
}

export function comboFor(a: Element, b: Element): ComboDef | null {
  return COMBO_LOOKUP.get(a + '|' + b) ?? null;
}

export const COMBO_DISCOVERY_BONUS = 25;
export const COMBO_REACTION_COOLDOWN = 1.2;
export const COMBO_RECURSION_DEPTH = 1;

// ------------------------------------------------------------------ enemies

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  moth: {
    kind: 'moth',
    name: 'Paper Moth',
    baseHp: 24,
    baseSpeed: 78,
    bounty: 4,
    hitRadius: 10,
    armored: false,
    phantom: false,
    boss: false,
    peelsInto: [],
    immuneKnockbackBelow: 0,
    immuneSoakedSlow: false,
    desc: 'Fast, fragile swarm triangle. Bursts into confetti.',
  },
  crane: {
    kind: 'crane',
    name: 'Folded Crane',
    baseHp: 55,
    baseSpeed: 96,
    bounty: 7,
    hitRadius: 12,
    armored: false,
    phantom: false,
    boss: false,
    peelsInto: [{ kind: 'moth', count: 2 }],
    immuneKnockbackBelow: 20,
    immuneSoakedSlow: false,
    desc: 'Swift. Immune to knockback below 20px. Peels into 2 Paper Moths.',
  },
  fox: {
    kind: 'fox',
    name: 'Origami Fox',
    baseHp: 65,
    baseSpeed: 84,
    bounty: 9,
    hitRadius: 12,
    armored: false,
    phantom: true,
    boss: false,
    peelsInto: [{ kind: 'crane', count: 1 }],
    immuneKnockbackBelow: 0,
    immuneSoakedSlow: false,
    desc: 'Phantom (Camo): untargetable until revealed by Ink/Water strikes or gale reveals.',
  },
  serpent: {
    kind: 'serpent',
    name: 'Tidal Serpent',
    baseHp: 110,
    baseSpeed: 72,
    bounty: 12,
    hitRadius: 14,
    armored: false,
    phantom: false,
    boss: false,
    peelsInto: [{ kind: 'moth', count: 3 }],
    immuneKnockbackBelow: 0,
    immuneSoakedSlow: true,
    desc: 'Immune to the Soaked slow. Splits into 3 Paper Moths unless tethered.',
  },
  tortoise: {
    kind: 'tortoise',
    name: 'Iron-Fold Tortoise',
    baseHp: 160,
    baseSpeed: 46,
    bounty: 16,
    hitRadius: 15,
    armored: true,
    phantom: false,
    boss: false,
    peelsInto: [{ kind: 'fox', count: 2 }],
    immuneKnockbackBelow: 0,
    immuneSoakedSlow: false,
    desc: 'Armored: 50% damage reduction vs Air & Water until stripped by Earth, Fire or combos. Peels into 2 Origami Foxes.',
  },
  dragon: {
    kind: 'dragon',
    name: 'Paper Dragon',
    baseHp: 1400,
    baseSpeed: 36,
    bounty: 120,
    hitRadius: 20,
    armored: false,
    phantom: false,
    boss: true,
    peelsInto: [{ kind: 'tortoise', count: 3 }],
    immuneKnockbackBelow: 9999,
    immuneSoakedSlow: false,
    desc: 'Multi-segment boss. Immune to knockback and roots; slows capped at 25%. Peels into 3 Iron-Fold Tortoises.',
  },
};

export const BOSS_SLOW_CAP = 0.25;

// ------------------------------------------------------------------ difficulties

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  apprentice: {
    id: 'apprentice',
    name: 'Apprentice Scroll',
    sealKanji: '初',
    desc: 'Normal - 450 Ink | 100 Lives | 25 Waves | 1.00x HP | 1.00x Speed | 1.00x Upgrade Cost',
    ink: 450,
    lives: 100,
    waves: 25,
    hpMult: 1.0,
    speedMult: 1.0,
    costMult: 1.0,
  },
  master: {
    id: 'master',
    name: 'Master Calligrapher',
    sealKanji: '達',
    desc: 'Hard - 375 Ink | 50 Lives | 35 Waves | 1.25x HP | 1.08x Speed | 1.10x Upgrade Cost',
    ink: 375,
    lives: 50,
    waves: 35,
    hpMult: 1.25,
    speedMult: 1.08,
    costMult: 1.1,
  },
  grandmaster: {
    id: 'grandmaster',
    name: 'Grandmaster Seal',
    sealKanji: '極',
    desc: 'Nightmare - 325 Ink | 1 Life (Sudden Death) | 40 Waves | 1.45x HP | 1.15x Speed | 1.20x Upgrade Cost',
    ink: 325,
    lives: 1,
    waves: 40,
    hpMult: 1.45,
    speedMult: 1.15,
    costMult: 1.2,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ['apprentice', 'master', 'grandmaster'];

// ------------------------------------------------------------------ scaling math

export function round5(value: number): number {
  return Math.round(value / 5) * 5;
}

export function upgradeCost(baseCost: number, costMult: number): number {
  return round5(baseCost * costMult);
}

export function towerCost(element: Element, costMult: number): number {
  return upgradeCost(TOWER_DEFS[element].cost, costMult);
}

export function hpForWave(baseHp: number, wave: number, difficulty: DifficultyDef): number {
  if (wave <= difficulty.waves) {
    const w = wave - 1;
    return Math.round(baseHp * (1 + 0.11 * w + 0.008 * w * w) * difficulty.hpMult);
  }
  const atTarget = baseHp * (1 + 0.11 * (difficulty.waves - 1) + 0.008 * (difficulty.waves - 1) ** 2) * difficulty.hpMult;
  return Math.round(atTarget * Math.pow(1.14, wave - difficulty.waves));
}

export function endlessSpeedMult(wave: number, difficulty: DifficultyDef): number {
  if (wave <= difficulty.waves) return 1;
  return Math.min(2.2, 1 + 0.025 * (wave - difficulty.waves));
}

export function waveClearBonus(wave: number): number {
  return 45 + 8 * wave;
}

export function overclockBonus(wave: number): number {
  return 20 + Math.floor(0.15 * waveClearBonus(wave));
}

export function salvageValue(totalInvested: number): number {
  return Math.floor(totalInvested * 0.75);
}

// ------------------------------------------------------------------ computed tower stats

const BASE_STATS: TowerStats = {
  kind: 'shuriken',
  range: 155,
  rate: 1.35,
  damage: 12,
  pierce: 2,
  splash: 0,
  coneAngle: 0,
  projSpeed: 340,
  homing: 4.8,
  ricochets: 0,
  fanWidth: 0,
  fanBounces: 0,
  knockback: 0,
  stun: 0,
  slowPct: 0,
  statusDuration: 3,
  burnDps: 0,
  ashDuration: 0,
  ashDps: 0,
  ashStacks: 0,
  clusterBombs: 0,
  meltsArmor: false,
  stripsCloak: false,
  craneVolley: 1,
  craneSplit: false,
  koiHits: 0,
  koiWake: false,
  greatWave: false,
  vortexRadius: 0,
  vortexVuln: false,
  freezeOnHits: 0,
  shardCount: 0,
  shardCrit: false,
  orbitalCount: 0,
  orbitalRadius: 0,
  orbitalDamage: 0,
  orbDart: false,
  orbBeam: false,
  puddleRadius: 0,
  puddleDps: 0,
  inkDragon: false,
  tetherCount: 0,
  tetherBind: false,
  voidCube: false,
  whirlwind: false,
  skyBarrage: false,
};

/**
 * Resolve fully-crossed effective stats for a tower at its current tiers.
 * Transformed projectile attacks (crane/fan, cone/laser, koi, boulder/orbital)
 * come from the dominant path (higher tier; ties favor Path A). Passive and
 * ability upgrades from the opposite path always stack, per classic 4-2 rules.
 */
export function computeTowerStats(element: Element, tierA: number, tierB: number): TowerStats {
  const s: TowerStats = { ...BASE_STATS };
  if (element === 'air') {
    s.range = 155;
    s.rate = 1.35;
    s.damage = 12;
    s.pierce = 2;
    s.projSpeed = 340;
    s.homing = 4.8;
    s.statusDuration = 3;
    if (tierA >= 1) {
      s.projSpeed = 442;
      s.homing = 9.6;
    }
    if (tierB >= 1) {
      s.range = 185;
      s.pierce = 4;
    }
    if (tierA >= 2) {
      s.pierce = Math.max(s.pierce, 3);
    }
    const crane = tierA >= 2 && tierA >= tierB;
    const fan = tierB >= 2 && tierB > tierA;
    if (crane) {
      s.kind = 'crane';
    } else if (fan) {
      s.kind = 'fan';
      s.fanWidth = 44;
      s.knockback = tierB >= 3 ? 42 : 28;
      s.fanBounces = 2;
    }
    if (tierA >= 3) s.craneSplit = true;
    if (tierA >= 4) {
      s.kind = 'crane';
      s.craneVolley = 3;
      s.damage = 18;
      s.pierce = Math.max(s.pierce, 4);
      s.rate = 2.7;
    }
    if (tierB >= 3) s.stripsCloak = true;
    if (tierB >= 4) s.whirlwind = true;
  } else if (element === 'fire') {
    s.kind = 'lantern';
    s.range = 130;
    s.rate = 0.8;
    s.damage = 18;
    s.splash = 48;
    s.projSpeed = 260;
    s.statusDuration = 3;
    s.burnDps = 6;
    s.ashDuration = 2.5;
    s.ashDps = 6;
    s.ashStacks = 1;
    if (tierA >= 1) s.burnDps = 14;
    if (tierB >= 1) {
      s.splash = 68;
      s.damage = 26;
    }
    if (tierB >= 2) s.clusterBombs = 4;
    if (tierB >= 3) {
      s.ashDuration = 5.0;
      s.ashDps = 22;
      s.ashStacks = 3;
    }
    if (tierB >= 4) s.skyBarrage = true;
    const breath = tierA >= 2 && tierA >= tierB;
    if (breath) {
      if (tierA >= 4) {
        s.kind = 'laser';
        s.range = 2000;
        s.rate = 15;
        s.damage = 18;
        s.meltsArmor = true;
      } else {
        s.kind = 'cone';
        s.range = 125;
        s.rate = 12;
        s.damage = 6;
        s.coneAngle = tierA >= 3 ? 65 : 40;
        s.meltsArmor = true;
        if (tierA >= 3) s.burnDps = 28;
      }
    }
  } else if (element === 'water') {
    s.kind = 'crest';
    s.range = 145;
    s.rate = 1.15;
    s.damage = 11;
    s.pierce = 1;
    s.projSpeed = 300;
    s.ricochets = 2;
    s.slowPct = 0.25;
    s.statusDuration = 3.5;
    if (tierA >= 1) {
      s.ricochets = 4;
      s.projSpeed = 375;
    }
    if (tierB >= 1) {
      s.slowPct = 0.38;
      s.statusDuration = 5.0;
    }
    if (tierB >= 2) s.vortexRadius = 58;
    if (tierB >= 3) {
      s.vortexRadius = 76;
      s.vortexVuln = true;
    }
    if (tierB >= 4) s.freezeOnHits = 3;
    if (tierA >= 2 && tierA >= tierB) {
      s.kind = 'koi';
      s.damage = 16;
      s.koiHits = 8;
    }
    if (tierA >= 3) s.koiWake = true;
    if (tierA >= 4) s.greatWave = true;
  } else if (element === 'earth') {
    s.kind = 'spike';
    s.range = 125;
    s.rate = 0.65;
    s.damage = 34;
    s.pierce = 1;
    s.projSpeed = 380;
    s.stun = 0.35;
    s.statusDuration = 3;
    if (tierA >= 1) {
      s.damage = 55;
      s.stun = 0.5;
    }
    if (tierB >= 1) {
      s.range = 155;
      s.rate = 0.85;
    }
    if (tierA >= 2) s.shardCount = 5;
    if (tierA >= 3) s.shardCrit = true;
    if (tierA >= 4 && !(tierB >= 2 && tierB > tierA)) {
      s.kind = 'boulder';
      s.damage = 140;
      s.pierce = 12;
    }
    if (tierB >= 2 && tierB >= tierA) {
      s.kind = 'orbital';
      s.orbitalCount = tierB >= 4 ? 6 : 3;
      s.orbitalRadius = tierB >= 4 ? 90 : 68;
      s.orbitalDamage = tierB >= 4 ? 42 : 24;
      s.range = Math.max(s.range, s.orbitalRadius + 60);
    }
    if (tierB >= 3) s.orbDart = true;
    if (tierB >= 4) s.orbBeam = true;
  } else {
    s.kind = 'blot';
    s.range = 140;
    s.rate = 0.95;
    s.damage = 8;
    s.splash = 42;
    s.projSpeed = 240;
    s.slowPct = 0.45;
    s.statusDuration = 4;
    if (tierA >= 1) {
      s.splash = 62;
      s.slowPct = 0.52;
    }
    if (tierB >= 1) {
      s.rate = 1.3;
      s.range = 165;
    }
    if (tierA >= 2) s.puddleRadius = 64;
    if (tierA >= 3) s.puddleDps = 18;
    if (tierA >= 4) s.inkDragon = true;
    if (tierB >= 2) s.tetherCount = 3;
    if (tierB >= 3) s.tetherBind = true;
    if (tierB >= 4) s.voidCube = true;
  }
  return s;
}

// ------------------------------------------------------------------ persistence

const LEDGER_KEY = 'roi.ledger.v1';
const CODEX_KEY = 'roi.codex.v1';

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function loadLedger(): Ledger {
  const data = readJson(LEDGER_KEY);
  if (data === null || typeof data !== 'object') return {};
  const ledger: Ledger = {};
  for (const [mapId, byDiff] of Object.entries(data as Record<string, unknown>)) {
    if (byDiff === null || typeof byDiff !== 'object') continue;
    const entry: Partial<Record<DifficultyId, LedgerEntry>> = {};
    for (const diff of DIFFICULTY_ORDER) {
      const raw = (byDiff as Record<string, unknown>)[diff];
      if (raw === null || typeof raw !== 'object') continue;
      const rec = raw as Record<string, unknown>;
      if (typeof rec.bestWave === 'number' && typeof rec.bestScore === 'number' && typeof rec.victories === 'number') {
        entry[diff] = { bestWave: rec.bestWave, bestScore: rec.bestScore, victories: rec.victories };
      }
    }
    ledger[mapId] = entry;
  }
  return ledger;
}

export function saveLedger(ledger: Ledger): void {
  try {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // localStorage unavailable (private mode) - persistence is best-effort.
  }
}

export function recordLedgerRun(
  ledger: Ledger,
  mapId: string,
  difficulty: DifficultyId,
  wave: number,
  score: number,
  victory: boolean,
): Ledger {
  const next: Ledger = { ...ledger };
  const perMap: Partial<Record<DifficultyId, LedgerEntry>> = { ...(next[mapId] ?? {}) };
  const prev = perMap[difficulty] ?? { bestWave: 0, bestScore: 0, victories: 0 };
  perMap[difficulty] = {
    bestWave: Math.max(prev.bestWave, wave),
    bestScore: Math.max(prev.bestScore, score),
    victories: prev.victories + (victory ? 1 : 0),
  };
  next[mapId] = perMap;
  saveLedger(next);
  return next;
}

export function loadCodex(): string[] {
  const data = readJson(CODEX_KEY);
  if (data === null || !Array.isArray(data)) return [];
  return data.filter((id): id is string => typeof id === 'string');
}

export function saveCodex(ids: string[]): void {
  try {
    window.localStorage.setItem(CODEX_KEY, JSON.stringify(ids));
  } catch {
    // best-effort
  }
}
