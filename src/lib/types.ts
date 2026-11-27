export type ElementType = 'air' | 'fire' | 'water' | 'earth' | 'ink';

export type TargetingMode = 'first' | 'last' | 'strong' | 'close' | 'unprimed';

export type StatusEffectType = 'wind' | 'burn' | 'soaked' | 'fractured' | 'stained';

export type ComboId =
  | 'water_fire'
  | 'water_air'
  | 'water_earth'
  | 'water_ink'
  | 'fire_air'
  | 'fire_earth'
  | 'fire_ink'
  | 'air_earth'
  | 'air_ink'
  | 'earth_ink';

export type EnemyType = 'moth' | 'crane' | 'fox' | 'serpent' | 'tortoise' | 'dragon';

export type MapId = 'river' | 'twin_bridge' | 'spiral';

export type DifficultyId = 'apprentice' | 'master' | 'grandmaster';

export type CorruptedModifierId = 'swift_gale' | 'iron_origami' | 'phantom_mist';

export interface UpgradeTierSpec {
  tier: 1 | 2 | 3 | 4;
  name: string;
  baseCost: number;
  tag?: 'TRANSFORMS' | 'APEX';
  description: string;
  rangeBonus?: number;
}

export interface TowerBaseSpec {
  element: ElementType;
  name: string;
  japaneseName: string;
  kanji: string;
  title: string;
  waxColor: string;
  secondaryColor: string;
  cost: number;
  range: number;
  fireRate: number;
  damage: number;
  pierce: number;
  splashRadius: number;
  ricochets: number;
  statusApplied: StatusEffectType;
  statusDuration: number;
  description: string;
  pathAName: string;
  pathBName: string;
  pathA: [UpgradeTierSpec, UpgradeTierSpec, UpgradeTierSpec, UpgradeTierSpec];
  pathB: [UpgradeTierSpec, UpgradeTierSpec, UpgradeTierSpec, UpgradeTierSpec];
}

export interface ComboDefinition {
  id: ComboId;
  elements: [ElementType, ElementType];
  name: string;
  kanji: string;
  callout: string;
  color: string;
  description: string;
  formulaText: string;
}

export interface EnemySpec {
  type: EnemyType;
  name: string;
  japaneseSubtitle: string;
  baseHp: number;
  speed: number;
  bounty: number;
  radius: number;
  lifeDamage: number;
  isCamo: boolean;
  isArmored: boolean;
  isBoss: boolean;
  knockbackMinThreshold: number;
  soakedImmune: boolean;
  peelsInto: { type: EnemyType; count: number } | null;
  primaryColor: string;
  secondaryColor: string;
  description: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface SplineSample {
  x: number;
  y: number;
  angle: number;
  distance: number;
}

export interface ConduitZone {
  x: number;
  y: number;
  radius: number;
  rangeMultiplier: number;
  label: string;
}

export interface BridgeOverlay {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
}

export interface ScrollMapDefinition {
  id: MapId;
  name: string;
  japaneseTitle: string;
  difficultyLabel: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  specialRuleText: string;
  trackHalfWidth: number;
  controlPoints: Point2D[][];
  conduits: ConduitZone[];
  bridge?: BridgeOverlay;
}

export interface PrecomputedMapData {
  definition: ScrollMapDefinition;
  lanes: SplineSample[][];
  laneLengths: number[];
  clearanceSamples: Point2D[];
}

export interface DifficultySpec {
  id: DifficultyId;
  name: string;
  subtitle: string;
  kanji: string;
  startingInk: number;
  startingLives: number;
  targetWaves: number;
  hpMultiplier: number;
  speedMultiplier: number;
  upgradeCostMultiplier: number;
  description: string;
}

export interface OrbitingBlade {
  angle: number;
  hitCooldowns: Record<string, number>;
}

export interface TowerEntity {
  id: string;
  element: ElementType;
  x: number;
  y: number;
  tierA: 0 | 1 | 2 | 3 | 4;
  tierB: 0 | 1 | 2 | 3 | 4;
  targeting: TargetingMode;
  totalInvested: number;
  kills: number;
  damageDealt: number;
  cooldown: number;
  specialTimer: number;
  shotCounter: number;
  angle: number;
  inConduit: boolean;
  orbiters: OrbitingBlade[];
  laserTargetId: string | null;
  coneActiveTimer: number;
  pulseAnim: number;
}

export interface ActiveStatus {
  type: StatusEffectType;
  element: ElementType;
  duration: number;
  maxDuration: number;
  dps: number;
  slowPct: number;
  sourceTowerId: string;
}

export interface EnemyEntity {
  id: string;
  type: EnemyType;
  laneIndex: number;
  distanceTraveled: number;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  baseSpeed: number;
  radius: number;
  bounty: number;
  lifeDamage: number;
  isCamo: boolean;
  camoStripped: boolean;
  isArmored: boolean;
  armorStripped: boolean;
  isBoss: boolean;
  statuses: Partial<Record<ElementType, ActiveStatus>>;
  reactionCooldown: number;
  stunTimer: number;
  rootTimer: number;
  freezeTimer: number;
  voidCubeTimer: number;
  voidCubeSourceId: string | null;
  glacialHitCount: number;
  glacialShatterPrimed: boolean;
  tetheredToIds: string[];
  tetherTimer: number;
  tetherNoSplit: boolean;
  vulnerabilityBonus: number;
  hitProjectileIds: Set<string>;
  foldPhase: number;
  hitFlash: number;
}

export type ProjectileVisualKind =
  | 'shuriken'
  | 'crane'
  | 'swallow'
  | 'war_fan'
  | 'typhoon'
  | 'lantern'
  | 'spark_bomb'
  | 'water_wave'
  | 'koi'
  | 'earth_spike'
  | 'crystal_shard'
  | 'boulder'
  | 'homing_poly'
  | 'ink_blot'
  | 'grit_needle'
  | 'ink_wind_blade';

export interface ProjectileEntity {
  id: string;
  towerId: string;
  element: ElementType;
  kind: ProjectileVisualKind;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  speed: number;
  angle: number;
  damage: number;
  pierce: number;
  maxPierce: number;
  splashRadius: number;
  ricochetsLeft: number;
  ricochetRange: number;
  homingTurnRate: number;
  targetId: string | null;
  life: number;
  maxLife: number;
  radius: number;
  knockbackPx: number;
  bouncesLeft: number;
  stripsCamo: boolean;
  stripsArmor: boolean;
  stunDuration: number;
  isKoiSpline: boolean;
  koiLaneIndex: number;
  koiDistanceLeft: number;
  koiCurrentSplineDist: number;
  leavesWetWake: boolean;
  spawnsClusterLotus: boolean;
  ashDuration: number;
  ashDps: number;
  spawnsWhirlpool: boolean;
  whirlpoolRadius: number;
  whirlpoolVuln: boolean;
  shattersIntoPrisms: boolean;
  prismCrit: boolean;
  isBoulder: boolean;
  tethersTargets: boolean;
  tetherSlowAndNoSplit: boolean;
  trapsInVoidCube: boolean;
  spawnsMiniPuddle: boolean;
  hitEnemyIds: Set<string>;
}

export type GroundZoneKind =
  | 'ash_patch'
  | 'whirlpool'
  | 'wet_wake'
  | 'ink_puddle'
  | 'magma_patch'
  | 'dragon_scroll';

export interface GroundZoneEntity {
  id: string;
  towerId: string;
  element: ElementType;
  kind: GroundZoneKind;
  x: number;
  y: number;
  radius: number;
  duration: number;
  maxDuration: number;
  dps: number;
  slowPct: number;
  pullSpeed: number;
  vulnBonus: number;
  stripsArmor: boolean;
  tickTimer: number;
  laneIndex?: number;
  splineDist?: number;
}

export interface VisualEffect {
  id: string;
  kind:
    | 'ring'
    | 'hanko_stamp'
    | 'lightning_arc'
    | 'laser_beam'
    | 'stone_beam'
    | 'great_wave'
    | 'flame_cone'
    | 'ink_splash';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius: number;
  maxRadius: number;
  color: string;
  kanji?: string;
  angle?: number;
  spreadAngle?: number;
  life: number;
  maxLife: number;
}

export interface FloatingCallout {
  id: string;
  x: number;
  y: number;
  vy: number;
  text: string;
  subtext?: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface PaperConfetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  vAngle: number;
  color: string;
  life: number;
  maxLife: number;
  isInkDrop: boolean;
}

export interface WaveSpawnGroup {
  enemyType: EnemyType;
  count: number;
  interval: number;
  delayBefore: number;
  laneMode: 'alternate' | 'lane0' | 'lane1';
}

export interface QueuedSpawn {
  enemyType: EnemyType;
  spawnTime: number;
  laneIndex: number;
}

export interface HighScoreRecord {
  mapId: MapId;
  difficultyId: DifficultyId;
  highestWave: number;
  victoryAchieved: boolean;
  totalKills: number;
  combosTriggered: number;
  timestamp: number;
}

export interface ResonanceLink {
  fromTowerId: string;
  toTowerId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  comboId: ComboId;
  color: string;
}

export interface EngineSnapshot {
  mapId: MapId;
  difficultyId: DifficultyId;
  wave: number;
  targetWaves: number;
  lives: number;
  maxLives: number;
  ink: number;
  waveActive: boolean;
  speedMultiplier: 1 | 2 | 3;
  isPaused: boolean;
  autoNextWave: boolean;
  isMuted: boolean;
  gameState: 'playing' | 'victory_prompt' | 'endless' | 'defeat';
  activeModifier: CorruptedModifierId | null;
  selectedTowerId: string | null;
  placingElement: ElementType | null;
  towers: TowerEntity[];
  enemiesCount: number;
  discoveredCombos: ComboId[];
  runCombosTriggered: number;
  totalKills: number;
  totalDamageDealt: number;
  resonanceLinks: ResonanceLink[];
  recentComboBanner: {
    name: string;
    kanji: string;
    color: string;
    isNewDiscovery: boolean;
  } | null;
}
