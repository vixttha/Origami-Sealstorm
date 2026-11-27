import {
  ComboDefinition,
  ComboId,
  CorruptedModifierId,
  DifficultyId,
  DifficultySpec,
  ElementType,
  EnemySpec,
  EnemyType,
  TowerBaseSpec,
} from './types';

export const LOGICAL_WIDTH = 960;
export const LOGICAL_HEIGHT = 600;
export const PLAYFIELD_PADDING = {
  minX: 28,
  maxX: 932,
  minY: 28,
  maxY: 572,
};

export const TOWER_RADIUS = 18;
export const RESONANCE_MAX_DIST = 165;

export function round5(val: number): number {
  return Math.round(val / 5) * 5;
}

export function getScaledUpgradeCost(baseCost: number, difficultyMult: number): number {
  return round5(baseCost * difficultyMult);
}

export function getWaveHpMultiplier(
  wave: number,
  targetWaves: number,
  difficultyHpMult: number
): number {
  const cappedW = Math.min(wave, targetWaves);
  const standardMult =
    (1 + 0.11 * (cappedW - 1) + 0.008 * Math.pow(cappedW - 1, 2)) * difficultyHpMult;
  if (wave <= targetWaves) {
    return standardMult;
  }
  return standardMult * Math.pow(1.14, wave - targetWaves);
}

export function getWaveSpeedMultiplier(
  wave: number,
  targetWaves: number,
  difficultySpeedMult: number
): number {
  if (wave <= targetWaves) {
    return difficultySpeedMult;
  }
  const endlessMult = Math.min(2.2, 1 + 0.025 * (wave - targetWaves));
  return difficultySpeedMult * endlessMult;
}

export function getWaveClearBonus(wave: number): number {
  return 45 + 8 * wave;
}

export function getOverclockBonus(wave: number): number {
  return 20 + Math.floor(0.15 * getWaveClearBonus(wave));
}

export function getSalvageValue(totalInvested: number): number {
  return Math.floor(totalInvested * 0.75);
}

export const ELEMENT_ORDER: ElementType[] = ['air', 'fire', 'water', 'earth', 'ink'];

export const TOWER_SPECS: Record<ElementType, TowerBaseSpec> = {
  air: {
    element: 'air',
    name: 'Air Seal',
    japaneseName: 'Kaze',
    kanji: '風',
    title: 'Wind Shuriken Shrine',
    waxColor: '#2A9D8F',
    secondaryColor: '#76C893',
    cost: 100,
    range: 155,
    fireRate: 1.35,
    damage: 12,
    pierce: 2,
    splashRadius: 0,
    ricochets: 0,
    statusApplied: 'wind',
    statusDuration: 3.0,
    description:
      'Homing paper shuriken (0.08 rad/frame turn); pierces 2 foes and applies Wind-Touched (3.0s).',
    pathAName: 'Flock of Cranes',
    pathBName: 'Tessen War Fan',
    pathA: [
      {
        tier: 1,
        name: 'Swift Fold',
        baseCost: 85,
        description: 'Projectile speed +30%, homing turn rate 2×.',
      },
      {
        tier: 2,
        name: 'Folded Crane',
        baseCost: 165,
        tag: 'TRANSFORMS',
        description:
          'Projectiles fold into Paper Cranes that persist for 3.5s, auto-retarget new enemies after hitting, and gain +1 pierce.',
      },
      {
        tier: 3,
        name: 'Twin Swallows',
        baseCost: 320,
        description: 'Cranes split into 2 mini-swallows (8 dmg, 2 pierce) on their final hit.',
      },
      {
        tier: 4,
        name: 'Thousand-Fold Storm',
        baseCost: 650,
        tag: 'APEX',
        description: 'Launches 3 cranes per volley (18 dmg each, 4 pierce) + 2× fire rate.',
      },
    ],
    pathB: [
      {
        tier: 1,
        name: 'Gale Reach',
        baseCost: 85,
        rangeBonus: 30,
        description: 'Range increases to 185px, pierce increases to 4.',
      },
      {
        tier: 2,
        name: 'Folding War Fan',
        baseCost: 165,
        tag: 'TRANSFORMS',
        description:
          'Fires wide 44px crescent fans pushing non-boss enemies back 28px along the spline and bouncing off borders 2 times.',
      },
      {
        tier: 3,
        name: 'Shroud Ripper',
        baseCost: 320,
        description: 'Knockback 42px; permanently strips Phantom/Camo shrouds.',
      },
      {
        tier: 4,
        name: 'Typhoon Gale',
        baseCost: 650,
        tag: 'APEX',
        description:
          'Every 4th shot unleashes a 110px ink whirlwind (55 dmg, 75px knockback, 15 pierce).',
      },
    ],
  },
  fire: {
    element: 'fire',
    name: 'Fire Seal',
    japaneseName: 'Kagura',
    kanji: '火',
    title: 'Ember Lantern Shrine',
    waxColor: '#E63946',
    secondaryColor: '#F4A261',
    cost: 135,
    range: 130,
    fireRate: 0.8,
    damage: 18,
    pierce: 1,
    splashRadius: 48,
    ricochets: 0,
    statusApplied: 'burn',
    statusDuration: 3.0,
    description:
      'Lobbed ember lantern (48px splash); drops a 2.5s Ash Patch (6 DPS) and applies Burning (3.0s).',
    pathAName: 'Paper Dragon',
    pathBName: 'Lotus Fireworks',
    pathA: [
      {
        tier: 1,
        name: 'White-Hot Char',
        baseCost: 115,
        description: 'Burn DPS increases from 6 to 14.',
      },
      {
        tier: 2,
        name: "Dragon's Breath",
        baseCost: 220,
        tag: 'TRANSFORMS',
        description:
          'Replaces lobbed projectile with a continuous 125px sweeping ember cone (12 ticks/sec, 6 dmg/tick, melts armor permanently).',
      },
      {
        tier: 3,
        name: 'Searing Maw',
        baseCost: 430,
        description: 'Ember cone widens to 65° and Burn DPS increases to 28.',
      },
      {
        tier: 4,
        name: 'Sun-Seal Lance',
        baseCost: 875,
        tag: 'APEX',
        rangeBonus: 400,
        description:
          'Map-spanning piercing crimson-gold laser ribbon (14px wide, 18 dmg/tick at 15 ticks/sec) tracking the strongest target.',
      },
    ],
    pathB: [
      {
        tier: 1,
        name: 'Powder Pack',
        baseCost: 115,
        description: 'Splash radius increases to 68px, direct damage increases to 26.',
      },
      {
        tier: 2,
        name: 'Cluster Lotus',
        baseCost: 220,
        tag: 'TRANSFORMS',
        description:
          'Lanterns burst into 4 secondary spark-bombs (14 dmg, 36px splash) in a 55px ring.',
      },
      {
        tier: 3,
        name: 'Smoldering Hearth',
        baseCost: 430,
        description: 'Ash patches last 5.0s (22 DPS) and stack up to 3 times.',
      },
      {
        tier: 4,
        name: 'Sky-Lantern Barrage',
        baseCost: 875,
        tag: 'APEX',
        description:
          'Every 2.2s drops 8 exploding lanterns (65 dmg, 64px splash) onto the densest enemy clusters.',
      },
    ],
  },
  water: {
    element: 'water',
    name: 'Water Seal',
    japaneseName: 'Mizu',
    kanji: '水',
    title: 'Tidal Crest Shrine',
    waxColor: '#3A86FF',
    secondaryColor: '#4CC9F0',
    cost: 115,
    range: 145,
    fireRate: 1.15,
    damage: 11,
    pierce: 1,
    splashRadius: 0,
    ricochets: 2,
    statusApplied: 'soaked',
    statusDuration: 3.5,
    description:
      'Fluid wave crest bouncing up to 2 times (90px); applies Soaked (25% slow, 3.5s).',
    pathAName: 'Origami Koi & Tsunami',
    pathBName: 'Whirlpool & Glacial Lotus',
    pathA: [
      {
        tier: 1,
        name: 'Rippling Surge',
        baseCost: 100,
        description: '+2 ricochet bounces (4 total), projectile speed +25%.',
      },
      {
        tier: 2,
        name: 'Leaping Koi',
        baseCost: 190,
        tag: 'TRANSFORMS',
        description:
          'Fires swimming Paper Koi that travel backward along the track spline for 220px, hitting up to 8 enemies (16 dmg).',
      },
      {
        tier: 3,
        name: 'Sacred Wake',
        baseCost: 370,
        description:
          'Koi leave a 3.0s Wet Wake (35% slow, +20% combo damage taken).',
      },
      {
        tier: 4,
        name: 'Great Wave',
        baseCost: 745,
        tag: 'APEX',
        description:
          'Every 6.0s summons a full-screen brushstroke wave (95 dmg, 65px pushback, applies Soaked globally).',
      },
    ],
    pathB: [
      {
        tier: 1,
        name: 'Chilling Undertow',
        baseCost: 100,
        description: 'Soaked slow increases to 38%, duration increases to 5.0s.',
      },
      {
        tier: 2,
        name: 'Paper Whirlpool',
        baseCost: 190,
        tag: 'TRANSFORMS',
        description:
          'Impacts spawn a 58px spinning vortex (2.0s) pulling nearby enemies toward its center (45 px/s, 10 DPS).',
      },
      {
        tier: 3,
        name: 'Abyssal Funnel',
        baseCost: 370,
        description:
          'Vortex radius 76px; pulled enemies take +25% damage from all sources.',
      },
      {
        tier: 4,
        name: 'Glacial Lotus',
        baseCost: 745,
        tag: 'APEX',
        description:
          'Soaked enemies struck 3 times freeze solid in crystal origami prisms (1.8s); next hit shatters for 110 bonus AoE damage.',
      },
    ],
  },
  earth: {
    element: 'earth',
    name: 'Earth Seal',
    japaneseName: 'Tsuchi',
    kanji: '土',
    title: 'Monolith Spire Shrine',
    waxColor: '#D4A373',
    secondaryColor: '#E9C46A',
    cost: 150,
    range: 125,
    fireRate: 0.65,
    damage: 34,
    pierce: 1,
    splashRadius: 0,
    ricochets: 0,
    statusApplied: 'fractured',
    statusDuration: 3.0,
    description:
      'Heavy folded monolith spike (+100% vs Armor); 0.35s stun; applies Fractured (+15% dmg taken, 3.0s).',
    pathAName: 'Shatter Prism',
    pathBName: 'Kinetic Sentinel',
    pathA: [
      {
        tier: 1,
        name: 'Granite Crease',
        baseCost: 125,
        description: 'Base damage increases to 55, stun increases to 0.5s.',
      },
      {
        tier: 2,
        name: 'Crystal Prism',
        baseCost: 245,
        tag: 'TRANSFORMS',
        description:
          'Impact shatters into 5 high-velocity paper shards (18 dmg each) in a 70° cone behind the target.',
      },
      {
        tier: 3,
        name: 'Faultline Resonance',
        baseCost: 480,
        description:
          'Shards deal 2.0× critical damage (36 dmg) to Soaked, Stained, or Fractured targets.',
      },
      {
        tier: 4,
        name: 'Tectonic Monolith',
        baseCost: 975,
        tag: 'APEX',
        description:
          'Fires massive rolling origami boulders (140 dmg, crushes 12 enemies down the track, detonates for 180 AoE dmg).',
      },
    ],
    pathB: [
      {
        tier: 1,
        name: 'Seismic Tremor',
        baseCost: 125,
        rangeBonus: 30,
        description: 'Range increases to 155px, fire rate increases to 0.85/s.',
      },
      {
        tier: 2,
        name: 'Orbiting Polyhedrons',
        baseCost: 245,
        tag: 'TRANSFORMS',
        description:
          'Summons 3 spinning origami spikes orbiting at 68px radius (24 dmg on contact, 0.4s hit cooldown per enemy).',
      },
      {
        tier: 3,
        name: 'Shard Volley',
        baseCost: 480,
        description:
          'Every 3.0s launches copies of all 3 polyhedrons as homing darts (45 dmg).',
      },
      {
        tier: 4,
        name: 'Celestial Orrery',
        baseCost: 975,
        tag: 'APEX',
        description:
          '6 orbiting blades (90px radius, 42 dmg) firing instant piercing stone beams (65 dmg) every 1.2s.',
      },
    ],
  },
  ink: {
    element: 'ink',
    name: 'Ink Seal',
    japaneseName: 'Sumi',
    kanji: '墨',
    title: 'Calligraphy Well Shrine',
    waxColor: '#1D1E2C',
    secondaryColor: '#5C5470',
    cost: 110,
    range: 140,
    fireRate: 0.95,
    damage: 8,
    pierce: 1,
    splashRadius: 42,
    ricochets: 0,
    statusApplied: 'stained',
    statusDuration: 4.0,
    description:
      'Calligraphy blot (42px splash); applies Stained (45% slow, 4.0s) and permanently strips Phantom/Camo.',
    pathAName: 'Brushstroke River',
    pathBName: 'Soul Tether & Void',
    pathA: [
      {
        tier: 1,
        name: 'Dense Sumi',
        baseCost: 95,
        description: 'Splash radius increases to 62px, Stained slow increases to 52%.',
      },
      {
        tier: 2,
        name: 'Calligraphy Pool',
        baseCost: 180,
        tag: 'TRANSFORMS',
        description:
          'Paints persistent 64px ink puddles directly onto the nearest track spline point every 1.1s (5.5s duration, 60% slow).',
      },
      {
        tier: 3,
        name: 'Corrosive Wash',
        baseCost: 350,
        description: 'Ink puddles strip armor layers and deal 18 corrosive DPS.',
      },
      {
        tier: 4,
        name: 'Living Dragon Scroll',
        baseCost: 715,
        tag: 'APEX',
        description:
          'Every 7.0s summons an ink dragon swimming backward from exit to entrance (120 dmg, permanent Stained + 65% slow for 6s).',
      },
    ],
    pathB: [
      {
        tier: 1,
        name: 'Flickering Brush',
        baseCost: 95,
        rangeBonus: 25,
        description: 'Fire rate increases to 1.30/s, range increases to 165px.',
      },
      {
        tier: 2,
        name: 'Ink Tendrils',
        baseCost: 180,
        tag: 'TRANSFORMS',
        description:
          'Tethers target to up to 3 enemies within 95px for 3.5s; 40% of all damage dealt to any linked enemy is shared across the tether.',
      },
      {
        tier: 3,
        name: 'Binding Script',
        baseCost: 350,
        description:
          'Tethered enemies move 30% slower and cannot cloak or split on pop.',
      },
      {
        tier: 4,
        name: 'Void Origami Cube',
        baseCost: 715,
        tag: 'APEX',
        description:
          'Every 5th shot traps the target in a suspended obsidian cube (2.5s), then detonates for 160 AoE damage (90px radius).',
      },
    ],
  },
};

export const COMBO_DEFINITIONS: Record<ComboId, ComboDefinition> = {
  water_fire: {
    id: 'water_fire',
    elements: ['water', 'fire'],
    name: 'Scalding Steam',
    kanji: '蒸',
    callout: 'STEAM!',
    color: '#E76F51',
    description: 'Vaporizes water and ember into a scalding pressure cloud that slows and burns nearby origami.',
    formulaText: '45 + 6w AoE dmg (85px radius) + 40% slow (2.5s)',
  },
  water_air: {
    id: 'water_air',
    elements: ['water', 'air'],
    name: 'Monsoon Squall',
    kanji: '嵐',
    callout: 'MONSOON!',
    color: '#0096C7',
    description: 'Whips soaked folds into electrified storm arcs jumping across up to 5 enemies.',
    formulaText: 'Chains 35 + 4w lightning arcs to up to 5 enemies within 110px',
  },
  water_earth: {
    id: 'water_earth',
    elements: ['water', 'earth'],
    name: 'Mudslide',
    kanji: '泥',
    callout: 'MUDSLIDE!',
    color: '#9C6644',
    description: 'Turns stone and water into heavy mire that roots the target and tears off Iron-Fold armor.',
    formulaText: 'Roots target 1.3s, strips Armor, deals 40 + 5w dmg',
  },
  water_ink: {
    id: 'water_ink',
    elements: ['water', 'ink'],
    name: 'Spreading Wash',
    kanji: '染',
    callout: 'WASH!',
    color: '#3F37C9',
    description: 'Dilutes sumi ink into a wide capillary wash that propagates both statuses across the pack.',
    formulaText: 'Spreads Soaked + Stained to all enemies within 115px + 25 burst dmg',
  },
  fire_air: {
    id: 'fire_air',
    elements: ['fire', 'air'],
    name: 'Firestorm',
    kanji: '炎',
    callout: 'FIRESTORM!',
    color: '#F77F00',
    description: 'Drafts oxygen into burning paper, triggering a violent blast wave that hurls enemies backward.',
    formulaText: '50 + 6w AoE dmg (80px) + 35px knockback + refreshes Burning',
  },
  fire_earth: {
    id: 'fire_earth',
    elements: ['fire', 'earth'],
    name: 'Molten Slag',
    kanji: '熔',
    callout: 'MOLTEN!',
    color: '#D62828',
    description: 'Fuses fractured monolith shards into a bubbling pool of liquid magma.',
    formulaText: 'Spawns 65px magma patch (4.0s) dealing 28 + 3w DPS',
  },
  fire_ink: {
    id: 'fire_ink',
    elements: ['fire', 'ink'],
    name: 'Scorched Lacquer',
    kanji: '灼',
    callout: 'IGNITE!',
    color: '#9B2226',
    description: 'Ignites volatile calligraphy oils inside the paper folds for massive armor-piercing true damage.',
    formulaText: '75 + 9w True Burst Damage (bypasses all Armor/Resistances)',
  },
  air_earth: {
    id: 'air_earth',
    elements: ['air', 'earth'],
    name: 'Sandstorm Shrapnel',
    kanji: '砂',
    callout: 'SHATTER!',
    color: '#B5838D',
    description: 'Blasts fractured stone into 6 razor-sharp grit needles that shred armor in a forward cone.',
    formulaText: 'Fires 6 grit needles (16 + 2w dmg each) in a 90° cone; strips Armor',
  },
  air_ink: {
    id: 'air_ink',
    elements: ['air', 'ink'],
    name: 'Calligraphy Gale',
    kanji: '颯',
    callout: 'SLASH!',
    color: '#4895EF',
    description: 'Slices stained air into 3 seeking wind-ink crescents that paint slowing puddles on impact.',
    formulaText: 'Launches 3 seeking ink-wind blades (24 + 3w dmg) dropping mini puddles',
  },
  earth_ink: {
    id: 'earth_ink',
    elements: ['earth', 'ink'],
    name: 'Petrified Seal',
    kanji: '封',
    callout: 'PETRIFY!',
    color: '#6D597A',
    description: 'Hardens sumi ink into solid obsidian stone, immobilizing the beast and amplifying all damage.',
    formulaText: 'Freezes target 1.6s; target takes +50% damage from all sources while frozen',
  },
};

export const COMBO_LIST: ComboDefinition[] = Object.values(COMBO_DEFINITIONS);

export function resolveComboId(elA: ElementType, elB: ElementType): ComboId | null {
  if (elA === elB) return null;
  const pair = new Set([elA, elB]);
  for (const def of COMBO_LIST) {
    if (pair.has(def.elements[0]) && pair.has(def.elements[1])) {
      return def.id;
    }
  }
  return null;
}

export const ENEMY_SPECS: Record<EnemyType, EnemySpec> = {
  moth: {
    type: 'moth',
    name: 'Paper Moth',
    japaneseSubtitle: 'Kami-Ga',
    baseHp: 24,
    speed: 78,
    bounty: 4,
    radius: 11,
    lifeDamage: 1,
    isCamo: false,
    isArmored: false,
    isBoss: false,
    knockbackMinThreshold: 0,
    soakedImmune: false,
    peelsInto: null,
    primaryColor: '#F3E9D2',
    secondaryColor: '#D4A373',
    description: 'Fast fragile swarm triangle. Unfolds directly into paper confetti.',
  },
  crane: {
    type: 'crane',
    name: 'Folded Crane',
    japaneseSubtitle: 'Orizuru',
    baseHp: 55,
    speed: 96,
    bounty: 7,
    radius: 14,
    lifeDamage: 2,
    isCamo: false,
    isArmored: false,
    isBoss: false,
    knockbackMinThreshold: 20,
    soakedImmune: false,
    peelsInto: { type: 'moth', count: 2 },
    primaryColor: '#E5989B',
    secondaryColor: '#FFB4A2',
    description: 'Swift aerial fold; immune to weak knockback (<20px). Peels into 2 Paper Moths.',
  },
  fox: {
    type: 'fox',
    name: 'Origami Fox',
    japaneseSubtitle: 'Kitsune-Gami',
    baseHp: 65,
    speed: 84,
    bounty: 9,
    radius: 15,
    lifeDamage: 3,
    isCamo: true,
    isArmored: false,
    isBoss: false,
    knockbackMinThreshold: 0,
    soakedImmune: false,
    peelsInto: { type: 'crane', count: 1 },
    primaryColor: '#F4A261',
    secondaryColor: '#E76F51',
    description:
      'Phantom (Camo): Untargetable until revealed by Ink, Water wash, or Air T3. Peels into 1 Folded Crane.',
  },
  serpent: {
    type: 'serpent',
    name: 'Tidal Serpent',
    japaneseSubtitle: 'Mizuchi',
    baseHp: 110,
    speed: 72,
    bounty: 12,
    radius: 16,
    lifeDamage: 4,
    isCamo: false,
    isArmored: false,
    isBoss: false,
    knockbackMinThreshold: 0,
    soakedImmune: true,
    peelsInto: { type: 'moth', count: 3 },
    primaryColor: '#48CAE4',
    secondaryColor: '#0077B6',
    description:
      'Immune to Soaked slow; splits into 3 Paper Moths unless bound by Ink T3 Soul Tether.',
  },
  tortoise: {
    type: 'tortoise',
    name: 'Iron-Fold Tortoise',
    japaneseSubtitle: 'Kikko-Tekko',
    baseHp: 160,
    speed: 46,
    bounty: 16,
    radius: 18,
    lifeDamage: 6,
    isCamo: false,
    isArmored: true,
    isBoss: false,
    knockbackMinThreshold: 0,
    soakedImmune: false,
    peelsInto: { type: 'fox', count: 2 },
    primaryColor: '#4A4E69',
    secondaryColor: '#9A8C98',
    description:
      'Armored: 50% damage reduction vs Air & Water until stripped by Earth/Fire/combos. Peels into 2 Origami Foxes.',
  },
  dragon: {
    type: 'dragon',
    name: 'Paper Dragon',
    japaneseSubtitle: 'Ryu-Shogun (Boss)',
    baseHp: 1400,
    speed: 36,
    bounty: 120,
    radius: 26,
    lifeDamage: 25,
    isCamo: false,
    isArmored: true,
    isBoss: true,
    knockbackMinThreshold: 9999,
    soakedImmune: false,
    peelsInto: { type: 'tortoise', count: 3 },
    primaryColor: '#C1121F',
    secondaryColor: '#F4A261',
    description:
      'Multi-segment origami boss; immune to knockback/roots (slows capped at 25%). Peels into 3 Iron-Fold Tortoises.',
  },
};

export const DIFFICULTY_SPECS: Record<DifficultyId, DifficultySpec> = {
  apprentice: {
    id: 'apprentice',
    name: 'Apprentice Scroll',
    subtitle: 'Standard Calligraphy',
    kanji: '習',
    startingInk: 450,
    startingLives: 100,
    targetWaves: 25,
    hpMultiplier: 1.0,
    speedMultiplier: 1.0,
    upgradeCostMultiplier: 1.0,
    description: '450 Ink • 100 Lives • 25 Waves • 1.00× Enemy HP & Upgrade Cost.',
  },
  master: {
    id: 'master',
    name: 'Master Calligrapher',
    subtitle: 'Tempered Brush',
    kanji: '師',
    startingInk: 375,
    startingLives: 50,
    targetWaves: 35,
    hpMultiplier: 1.25,
    speedMultiplier: 1.08,
    upgradeCostMultiplier: 1.1,
    description: '375 Ink • 50 Lives • 35 Waves • 1.25× HP • 1.08× Speed • 1.10× Cost.',
  },
  grandmaster: {
    id: 'grandmaster',
    name: 'Grandmaster Seal',
    subtitle: 'One-Stroke Sudden Death',
    kanji: '極',
    startingInk: 325,
    startingLives: 1,
    targetWaves: 40,
    hpMultiplier: 1.45,
    speedMultiplier: 1.15,
    upgradeCostMultiplier: 1.2,
    description: '325 Ink • 1 Life (Sudden Death) • 40 Waves • 1.45× HP • 1.15× Speed • 1.20× Cost.',
  },
};

export const CORRUPTED_MODIFIERS: Record<
  CorruptedModifierId,
  { id: CorruptedModifierId; name: string; kanji: string; description: string; color: string }
> = {
  swift_gale: {
    id: 'swift_gale',
    name: 'Corrupted Ink: Swift Gale',
    kanji: '疾',
    description: 'All origami beasts move +25% faster during this Endless cycle.',
    color: '#2A9D8F',
  },
  iron_origami: {
    id: 'iron_origami',
    name: 'Corrupted Ink: Iron Origami',
    kanji: '鉄',
    description: 'All newly spawned beasts gain reinforced Iron-Fold Armor plating.',
    color: '#D4A373',
  },
  phantom_mist: {
    id: 'phantom_mist',
    name: 'Corrupted Ink: Phantom Mist',
    kanji: '霧',
    description: '35% of non-boss beasts emerge cloaked in Phantom Camo.',
    color: '#3A86FF',
  },
};
