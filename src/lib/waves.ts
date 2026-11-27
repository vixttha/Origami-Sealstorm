import { CorruptedModifierId, QueuedSpawn, WaveSpawnGroup } from './types';

const HANDCRAFTED_WAVES: WaveSpawnGroup[][] = [
  // Wave 1: Paper Moth introduction
  [{ enemyType: 'moth', count: 8, interval: 1.05, delayBefore: 0.2, laneMode: 'alternate' }],
  // Wave 2: Denser Moths
  [{ enemyType: 'moth', count: 13, interval: 0.85, delayBefore: 0.2, laneMode: 'alternate' }],
  // Wave 3: Folded Crane debut
  [
    { enemyType: 'moth', count: 8, interval: 0.8, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'crane', count: 3, interval: 1.4, delayBefore: 1.2, laneMode: 'alternate' },
  ],
  // Wave 4
  [
    { enemyType: 'crane', count: 5, interval: 1.2, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'moth', count: 10, interval: 0.65, delayBefore: 1.0, laneMode: 'alternate' },
  ],
  // Wave 5
  [
    { enemyType: 'moth', count: 12, interval: 0.55, delayBefore: 0.2, laneMode: 'lane0' },
    { enemyType: 'crane', count: 6, interval: 1.0, delayBefore: 0.8, laneMode: 'lane1' },
  ],
  // Wave 6: Origami Fox (Phantom/Camo) debut
  [
    { enemyType: 'crane', count: 5, interval: 1.0, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'fox', count: 4, interval: 1.4, delayBefore: 1.2, laneMode: 'alternate' },
  ],
  // Wave 7
  [
    { enemyType: 'moth', count: 16, interval: 0.48, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'fox', count: 5, interval: 1.2, delayBefore: 1.0, laneMode: 'alternate' },
  ],
  // Wave 8: Tidal Serpent debut
  [
    { enemyType: 'crane', count: 6, interval: 0.9, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'serpent', count: 4, interval: 1.5, delayBefore: 1.0, laneMode: 'alternate' },
  ],
  // Wave 9
  [
    { enemyType: 'serpent', count: 6, interval: 1.25, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'fox', count: 6, interval: 1.1, delayBefore: 0.8, laneMode: 'alternate' },
  ],
  // Wave 10: Iron-Fold Tortoise (Armored) debut
  [
    { enemyType: 'moth', count: 14, interval: 0.45, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'tortoise', count: 3, interval: 2.2, delayBefore: 1.0, laneMode: 'alternate' },
    { enemyType: 'crane', count: 6, interval: 0.85, delayBefore: 0.8, laneMode: 'alternate' },
  ],
  // Wave 11
  [
    { enemyType: 'fox', count: 8, interval: 0.95, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'serpent', count: 6, interval: 1.15, delayBefore: 0.8, laneMode: 'alternate' },
  ],
  // Wave 12
  [
    { enemyType: 'tortoise', count: 4, interval: 1.9, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'crane', count: 10, interval: 0.7, delayBefore: 0.8, laneMode: 'alternate' },
  ],
  // Wave 13
  [
    { enemyType: 'serpent', count: 8, interval: 1.0, delayBefore: 0.2, laneMode: 'lane0' },
    { enemyType: 'fox', count: 8, interval: 0.9, delayBefore: 0.6, laneMode: 'lane1' },
  ],
  // Wave 14
  [
    { enemyType: 'tortoise', count: 5, interval: 1.7, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'serpent', count: 7, interval: 1.0, delayBefore: 0.8, laneMode: 'alternate' },
    { enemyType: 'moth', count: 20, interval: 0.35, delayBefore: 0.6, laneMode: 'alternate' },
  ],
  // Wave 15: Mid-boss vanguard
  [
    { enemyType: 'tortoise', count: 6, interval: 1.5, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'fox', count: 10, interval: 0.8, delayBefore: 0.8, laneMode: 'alternate' },
    { enemyType: 'crane', count: 12, interval: 0.65, delayBefore: 0.8, laneMode: 'alternate' },
  ],
  // Wave 16
  [
    { enemyType: 'serpent', count: 12, interval: 0.85, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'tortoise', count: 5, interval: 1.5, delayBefore: 1.0, laneMode: 'alternate' },
  ],
  // Wave 17
  [
    { enemyType: 'fox', count: 14, interval: 0.7, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'crane', count: 14, interval: 0.55, delayBefore: 0.6, laneMode: 'alternate' },
  ],
  // Wave 18
  [
    { enemyType: 'tortoise', count: 8, interval: 1.4, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'serpent', count: 10, interval: 0.8, delayBefore: 0.8, laneMode: 'alternate' },
  ],
  // Wave 19
  [
    { enemyType: 'moth', count: 30, interval: 0.28, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'fox', count: 12, interval: 0.65, delayBefore: 0.6, laneMode: 'alternate' },
    { enemyType: 'tortoise', count: 6, interval: 1.3, delayBefore: 0.6, laneMode: 'alternate' },
  ],
  // Wave 20: First Paper Dragon Boss
  [
    { enemyType: 'crane', count: 10, interval: 0.6, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'dragon', count: 1, interval: 3.0, delayBefore: 1.5, laneMode: 'lane0' },
    { enemyType: 'fox', count: 8, interval: 0.85, delayBefore: 1.5, laneMode: 'alternate' },
  ],
  // Wave 21
  [
    { enemyType: 'serpent', count: 14, interval: 0.75, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'tortoise', count: 8, interval: 1.25, delayBefore: 0.8, laneMode: 'alternate' },
  ],
  // Wave 22
  [
    { enemyType: 'fox', count: 16, interval: 0.6, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'serpent', count: 12, interval: 0.75, delayBefore: 0.7, laneMode: 'alternate' },
  ],
  // Wave 23
  [
    { enemyType: 'tortoise', count: 10, interval: 1.15, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'crane', count: 18, interval: 0.45, delayBefore: 0.6, laneMode: 'alternate' },
  ],
  // Wave 24
  [
    { enemyType: 'serpent', count: 16, interval: 0.65, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'fox', count: 14, interval: 0.6, delayBefore: 0.6, laneMode: 'alternate' },
    { enemyType: 'tortoise', count: 8, interval: 1.1, delayBefore: 0.6, laneMode: 'alternate' },
  ],
  // Wave 25: Apprentice Finale — Twin Dragon Procession
  [
    { enemyType: 'tortoise', count: 6, interval: 1.1, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'dragon', count: 1, interval: 3.0, delayBefore: 1.2, laneMode: 'lane0' },
    { enemyType: 'fox', count: 12, interval: 0.65, delayBefore: 1.0, laneMode: 'alternate' },
    { enemyType: 'dragon', count: 1, interval: 3.0, delayBefore: 2.0, laneMode: 'lane1' },
  ],
  // Wave 26
  [
    { enemyType: 'crane', count: 24, interval: 0.38, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'serpent', count: 16, interval: 0.6, delayBefore: 0.6, laneMode: 'alternate' },
  ],
  // Wave 27
  [
    { enemyType: 'tortoise', count: 12, interval: 1.0, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'fox', count: 18, interval: 0.52, delayBefore: 0.6, laneMode: 'alternate' },
  ],
  // Wave 28
  [
    { enemyType: 'serpent', count: 20, interval: 0.55, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'tortoise', count: 10, interval: 0.95, delayBefore: 0.6, laneMode: 'alternate' },
  ],
  // Wave 29
  [
    { enemyType: 'fox', count: 22, interval: 0.45, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'crane', count: 24, interval: 0.35, delayBefore: 0.5, laneMode: 'alternate' },
  ],
  // Wave 30: Dragon Trio
  [
    { enemyType: 'tortoise', count: 10, interval: 0.9, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'dragon', count: 2, interval: 3.5, delayBefore: 1.0, laneMode: 'alternate' },
    { enemyType: 'serpent', count: 16, interval: 0.55, delayBefore: 0.8, laneMode: 'alternate' },
  ],
  // Wave 31
  [
    { enemyType: 'tortoise', count: 14, interval: 0.85, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'fox', count: 20, interval: 0.45, delayBefore: 0.5, laneMode: 'alternate' },
  ],
  // Wave 32
  [
    { enemyType: 'serpent', count: 24, interval: 0.48, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'crane', count: 26, interval: 0.32, delayBefore: 0.5, laneMode: 'alternate' },
  ],
  // Wave 33
  [
    { enemyType: 'tortoise', count: 16, interval: 0.8, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'serpent', count: 18, interval: 0.5, delayBefore: 0.5, laneMode: 'alternate' },
  ],
  // Wave 34
  [
    { enemyType: 'fox', count: 26, interval: 0.4, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'tortoise', count: 14, interval: 0.78, delayBefore: 0.5, laneMode: 'alternate' },
  ],
  // Wave 35: Master Calligrapher Finale
  [
    { enemyType: 'tortoise', count: 12, interval: 0.75, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'dragon', count: 2, interval: 3.0, delayBefore: 1.0, laneMode: 'alternate' },
    { enemyType: 'fox', count: 20, interval: 0.42, delayBefore: 0.8, laneMode: 'alternate' },
    { enemyType: 'dragon', count: 1, interval: 2.5, delayBefore: 1.5, laneMode: 'lane0' },
  ],
  // Wave 36
  [
    { enemyType: 'serpent', count: 28, interval: 0.42, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'tortoise', count: 16, interval: 0.72, delayBefore: 0.5, laneMode: 'alternate' },
  ],
  // Wave 37
  [
    { enemyType: 'fox', count: 30, interval: 0.36, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'serpent', count: 22, interval: 0.45, delayBefore: 0.5, laneMode: 'alternate' },
  ],
  // Wave 38
  [
    { enemyType: 'tortoise', count: 20, interval: 0.65, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'dragon', count: 1, interval: 2.5, delayBefore: 0.8, laneMode: 'alternate' },
  ],
  // Wave 39
  [
    { enemyType: 'crane', count: 36, interval: 0.25, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'fox', count: 26, interval: 0.35, delayBefore: 0.4, laneMode: 'alternate' },
    { enemyType: 'tortoise', count: 16, interval: 0.65, delayBefore: 0.5, laneMode: 'alternate' },
  ],
  // Wave 40: Grandmaster Seal Finale — Imperial Dragon Armada
  [
    { enemyType: 'tortoise', count: 14, interval: 0.65, delayBefore: 0.2, laneMode: 'alternate' },
    { enemyType: 'dragon', count: 2, interval: 2.8, delayBefore: 1.0, laneMode: 'alternate' },
    { enemyType: 'fox', count: 24, interval: 0.35, delayBefore: 0.6, laneMode: 'alternate' },
    { enemyType: 'serpent', count: 24, interval: 0.4, delayBefore: 0.6, laneMode: 'alternate' },
    { enemyType: 'dragon', count: 2, interval: 2.6, delayBefore: 1.2, laneMode: 'alternate' },
  ],
];

function buildProceduralWave(wave: number): WaveSpawnGroup[] {
  const endlessDepth = Math.max(1, wave - 40);
  const groups: WaveSpawnGroup[] = [
    {
      enemyType: 'crane',
      count: 20 + endlessDepth * 2,
      interval: Math.max(0.2, 0.38 - endlessDepth * 0.008),
      delayBefore: 0.2,
      laneMode: 'alternate',
    },
    {
      enemyType: 'fox',
      count: 16 + endlessDepth * 2,
      interval: Math.max(0.24, 0.45 - endlessDepth * 0.008),
      delayBefore: 0.5,
      laneMode: 'alternate',
    },
    {
      enemyType: 'serpent',
      count: 16 + endlessDepth * 2,
      interval: Math.max(0.28, 0.5 - endlessDepth * 0.008),
      delayBefore: 0.5,
      laneMode: 'alternate',
    },
    {
      enemyType: 'tortoise',
      count: 12 + Math.floor(endlessDepth * 1.5),
      interval: Math.max(0.4, 0.7 - endlessDepth * 0.01),
      delayBefore: 0.6,
      laneMode: 'alternate',
    },
  ];

  const dragonCount = wave % 5 === 0 ? 2 + Math.floor(endlessDepth / 4) : 1 + Math.floor(endlessDepth / 7);
  groups.push({
    enemyType: 'dragon',
    count: dragonCount,
    interval: 2.4,
    delayBefore: 1.0,
    laneMode: 'alternate',
  });

  return groups;
}

export function getWaveSpawnQueue(wave: number, laneCount: number): QueuedSpawn[] {
  const groups =
    wave <= HANDCRAFTED_WAVES.length
      ? HANDCRAFTED_WAVES[wave - 1]
      : buildProceduralWave(wave);

  const queue: QueuedSpawn[] = [];
  let cursorTime = 0;
  let globalCounter = 0;

  for (const group of groups) {
    cursorTime += group.delayBefore;
    for (let i = 0; i < group.count; i++) {
      let laneIndex = 0;
      if (laneCount > 1) {
        if (group.laneMode === 'lane0') laneIndex = 0;
        else if (group.laneMode === 'lane1') laneIndex = 1 % laneCount;
        else laneIndex = globalCounter % laneCount;
      }
      queue.push({
        enemyType: group.enemyType,
        spawnTime: cursorTime,
        laneIndex,
      });
      cursorTime += group.interval;
      globalCounter++;
    }
  }

  return queue;
}

const MODIFIER_ROTATION: CorruptedModifierId[] = [
  'swift_gale',
  'iron_origami',
  'phantom_mist',
];

export function getEndlessModifierForWave(
  wave: number,
  targetWaves: number
): CorruptedModifierId | null {
  if (wave <= targetWaves) return null;
  const endlessWaveIndex = wave - targetWaves;
  // Every 5 Endless waves activates or rotates a visible Corrupted Ink Modifier banner
  const cycleIndex = Math.floor((endlessWaveIndex - 1) / 5) % MODIFIER_ROTATION.length;
  return MODIFIER_ROTATION[cycleIndex];
}
