/**
 * Runic Origami & Ink - strict type system for the headless engine,
 * maps, towers, projectiles, enemies and combo reactions.
 * Logical playfield: 960 x 600 px (rendered on a single canvas, DPR-scaled).
 */

// ---------------------------------------------------------------- primitives

export type Element = 'air' | 'fire' | 'water' | 'earth' | 'ink';
export type PathSide = 'A' | 'B';
export type TargetMode = 'first' | 'last' | 'strong' | 'close' | 'unprimed';
export type DifficultyId = 'apprentice' | 'master' | 'grandmaster';
export type EnemyKind = 'moth' | 'crane' | 'fox' | 'serpent' | 'tortoise' | 'dragon';

export interface Vec2 {
  x: number;
  y: number;
}

export const CANVAS_W = 960;
export const CANVAS_H = 600;

// ---------------------------------------------------------------- map

export interface LaneSample {
  x: number;
  y: number;
  angle: number;
}

/** One enemy lane: arc-length uniform samples of a parametric spline. */
export interface LaneDef {
  /** Uniform samples every `spacing` px along the lane. */
  samples: LaneSample[];
  spacing: number;
  length: number;
  entrance: Vec2;
  exit: Vec2;
}

export interface ConduitZone {
  x: number;
  y: number;
  r: number;
}

export interface MapDef {
  id: string;
  name: string;
  flavor: string;
  tier: string;
  lanes: LaneDef[];
  conduits: ConduitZone[];
  /** Spiral Shrine: enemies on the outer 40% of the spline move +15% faster. */
  spiral: boolean;
  /** Twin-Bridge: decorative overpass bridge center. */
  bridge: Vec2 | null;
}

export type PlacementFail = 'track' | 'tower' | 'bounds' | null;

export interface PlacementCheck {
  ok: boolean;
  reason: PlacementFail;
  inConduit: boolean;
}

// ---------------------------------------------------------------- towers

export type AttackKind =
  | 'shuriken'
  | 'crane'
  | 'fan'
  | 'lantern'
  | 'cone'
  | 'laser'
  | 'crest'
  | 'koi'
  | 'spike'
  | 'boulder'
  | 'orbital'
  | 'blot';

/** Fully resolved effective stats for a tower at its current A/B tiers. */
export interface TowerStats {
  kind: AttackKind;
  range: number;
  rate: number;
  damage: number;
  pierce: number;
  splash: number;
  coneAngle: number;
  projSpeed: number;
  homing: number;
  ricochets: number;
  fanWidth: number;
  fanBounces: number;
  knockback: number;
  stun: number;
  slowPct: number;
  statusDuration: number;
  burnDps: number;
  ashDuration: number;
  ashDps: number;
  ashStacks: number;
  clusterBombs: number;
  meltsArmor: boolean;
  stripsCloak: boolean;
  craneVolley: number;
  craneSplit: boolean;
  koiHits: number;
  koiWake: boolean;
  greatWave: boolean;
  vortexRadius: number;
  vortexVuln: boolean;
  freezeOnHits: number;
  shardCount: number;
  shardCrit: boolean;
  orbitalCount: number;
  orbitalRadius: number;
  orbitalDamage: number;
  orbDart: boolean;
  orbBeam: boolean;
  puddleRadius: number;
  puddleDps: number;
  inkDragon: boolean;
  tetherCount: number;
  tetherBind: boolean;
  voidCube: boolean;
  whirlwind: boolean;
  skyBarrage: boolean;
}

export interface UpgradeTier {
  name: string;
  desc: string;
  /** Apprentice-tier cost; scaled by difficulty and rounded to nearest 5. */
  cost: number;
  transforms: 'projectile' | 'apex' | null;
}

export interface UpgradePath {
  label: string;
  tiers: [UpgradeTier, UpgradeTier, UpgradeTier, UpgradeTier];
}

export interface TowerDef {
  element: Element;
  title: string;
  sealName: string;
  kanji: string;
  color: string;
  accent: string;
  cost: number;
  baseDesc: string;
  statusName: string;
  pathA: UpgradePath;
  pathB: UpgradePath;
}

export interface Tower {
  id: number;
  element: Element;
  x: number;
  y: number;
  tierA: number;
  tierB: number;
  targeting: TargetMode;
  cooldown: number;
  angle: number;
  kills: number;
  damageDealt: number;
  totalInvested: number;
  shotCount: number;
  /** Multi-purpose ability timer (pools, barrages, dragons, darts, beams...). */
  abilityTimer: number;
  abilityTimer2: number;
  coneAngle: number;
  laserAngle: number;
  tickAcc: number;
  orbitalAngle: number;
  conduitBoost: boolean;
  buildFlash: number;
  fireGlow: number;
  muzzleX: number;
  muzzleY: number;
}

// ---------------------------------------------------------------- enemies

export interface EnemyPeeled {
  kind: EnemyKind;
  count: number;
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  baseHp: number;
  baseSpeed: number;
  bounty: number;
  hitRadius: number;
  armored: boolean;
  phantom: boolean;
  boss: boolean;
  peelsInto: EnemyPeeled[];
  /** Folded Crane: ignores knockback below this many px. */
  immuneKnockbackBelow: number;
  /** Tidal Serpent: immune to the Soaked slow. */
  immuneSoakedSlow: boolean;
  desc: string;
}

export interface StatusInstance {
  time: number;
  slow: number;
  dps: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  def: EnemyDef;
  laneIndex: number;
  distance: number;
  hp: number;
  maxHp: number;
  bounty: number;
  hitRadius: number;
  /** difficulty x endless x modifier speed multiplier. */
  speedFactor: number;
  statuses: Partial<Record<Element, StatusInstance>>;
  reactionCooldown: number;
  rooted: number;
  frozen: number;
  frozenBy: 'lotus' | 'petrify' | 'cube' | null;
  lotusHits: number;
  hitProjectileIds: number[];
  cloaked: boolean;
  armorStripped: boolean;
  armorLevel: number;
  tetherIds: number[];
  tetherTime: number;
  /** Tethers created by an Ink B3+ tower: slowed and cannot cloak or split. */
  tetherBound: boolean;
  /** Per-tower orbital contact cooldown expiry times (game-time seconds). */
  orbCd: Record<number, number>;
  /** Damage-taken amplifiers refreshed each step from overlapping ground fx. */
  vulnAll: number;
  vulnCombo: number;
  /** Generic slow from combo reactions (e.g. Scalding Steam). */
  extraSlow: number;
  extraSlowT: number;
  wobble: number;
  flash: number;
}

// ---------------------------------------------------------------- projectiles / ground / vfx

export type ProjectileKind =
  | 'shuriken'
  | 'crane'
  | 'swallow'
  | 'fan'
  | 'whirlwind'
  | 'lantern'
  | 'skyLantern'
  | 'crest'
  | 'koi'
  | 'needle'
  | 'galeBlade'
  | 'spike'
  | 'shard'
  | 'boulder'
  | 'orbDart'
  | 'blot';

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  element: Element;
  towerId: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  pierce: number;
  hitIds: number[];
  targetId: number;
  speed: number;
  homing: number;
  ricochets: number;
  splash: number;
  splashSlow: number;
  statusDuration: number;
  burnDps: number;
  knockback: number;
  stun: number;
  spin: number;
  /** Lobbed lanterns: parabolic arc from -> to. */
  lobT: number;
  lobDur: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fanBounces: number;
  fanWidth: number;
  retargets: boolean;
  splits: boolean;
  clusterBombs: number;
  ashDuration: number;
  ashDps: number;
  meltsArmor: boolean;
  stripsCloak: boolean;
  dropsWake: boolean;
  dropsPuddle: boolean;
  /** Koi / boulder: travel along lane [koiFrom -> koiTo]. */
  koi: boolean;
  koiLane: number;
  koiFrom: number;
  koiTo: number;
  koiProgress: number;
  koiHits: number;
  crushLeft: number;
  trueDamage: boolean;
  freezeOnHits: number;
  vortexRadius: number;
}

export type GroundKind = 'ash' | 'magma' | 'puddle' | 'miniPuddle' | 'whirlpool' | 'wake';

export interface GroundFx {
  kind: GroundKind;
  x: number;
  y: number;
  r: number;
  t: number;
  dur: number;
  dps: number;
  slow: number;
  /** px/s dragged toward the vortex centre (whirlpool). */
  pull: number;
  dmgTakenBonus: number;
  comboOnlyBonus: boolean;
  stripsArmor: boolean;
  laneIndex: number;
  from: number;
  to: number;
}

export type VfxKind =
  | 'callout'
  | 'stamp'
  | 'ring'
  | 'confetti'
  | 'inkSplash'
  | 'laserBeam'
  | 'chainArc'
  | 'waveSweep'
  | 'dragonSweep'
  | 'beamFlash'
  | 'banner'
  | 'poof'
  | 'aura';

export interface Vfx {
  kind: VfxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  dur: number;
  text: string;
  color: string;
  r: number;
  r2: number;
  angle: number;
  points: Vec2[];
  scale: number;
  spin: number;
}

// ---------------------------------------------------------------- combos

export interface ComboDef {
  id: string;
  name: string;
  kanji: string;
  callout: string;
  elements: [Element, Element];
  effect: string;
}

// ---------------------------------------------------------------- waves

export interface SpawnGroup {
  kind: EnemyKind;
  count: number;
  gap: number;
  delay: number;
  lane?: number;
}

export interface WaveDef {
  name: string;
  groups: SpawnGroup[];
}

export interface SpawnOrder {
  time: number;
  kind: EnemyKind;
  laneIndex: number;
}

export interface EndlessModifier {
  id: 'swiftGale' | 'ironOrigami' | 'phantomMist';
  name: string;
  desc: string;
}

// ---------------------------------------------------------------- difficulty

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  sealKanji: string;
  desc: string;
  ink: number;
  lives: number;
  waves: number;
  hpMult: number;
  speedMult: number;
  costMult: number;
}

// ---------------------------------------------------------------- persistence

export interface LedgerEntry {
  bestWave: number;
  bestScore: number;
  victories: number;
}

export type Ledger = Record<string, Partial<Record<DifficultyId, LedgerEntry>>>;

// ---------------------------------------------------------------- engine state

export interface GameStats {
  kills: number;
  shotsFired: number;
  inkEarned: number;
  discovered: string[];
}

export interface EndState {
  kind: 'victory' | 'defeat';
  waveReached: number;
  kills: number;
  score: number;
  mvpName: string | null;
  mvpElement: Element | null;
  mvpKills: number;
  mvpDamage: number;
}

export interface GameState {
  map: MapDef;
  difficulty: DifficultyDef;
  waveIndex: number;
  wavesCleared: number;
  targetWave: number;
  endless: boolean;
  phase: 'prep' | 'wave' | 'cleared' | 'ended';
  waveName: string;
  spawnQueue: SpawnOrder[];
  spawnClock: number;
  ink: number;
  lives: number;
  maxLives: number;
  score: number;
  paused: boolean;
  modalPaused: boolean;
  speed: number;
  autoNext: boolean;
  autoNextTimer: number;
  overclocked: boolean;
  endlessMods: { speed: number; armor: number; mist: boolean };
  modifierBanner: { name: string; desc: string; t: number } | null;
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  ground: GroundFx[];
  vfx: Vfx[];
  time: number;
  shake: number;
  shopElement: Element | null;
  selectedTowerId: number;
  pointer: Vec2 | null;
  pointerValid: boolean;
  rangePreview: { towerId: number; range: number } | null;
  discoveredRun: string[];
  endState: EndState | null;
  stats: GameStats;
  banner: { text: string; sub: string; t: number } | null;
  fps: number;
}

// ---------------------------------------------------------------- UI snapshot

export interface UiTowerInfo {
  id: number;
  element: Element;
  title: string;
  tierA: number;
  tierB: number;
  targeting: TargetMode;
  kills: number;
  damageDealt: number;
  totalInvested: number;
  sellValue: number;
  range: number;
  rate: number;
  damage: number;
  kind: AttackKind;
  pathALabel: string;
  pathBLabel: string;
}

export interface UiSnapshot {
  version: number;
  phase: GameState['phase'];
  waveIndex: number;
  wavesCleared: number;
  targetWave: number;
  endless: boolean;
  waveName: string;
  ink: number;
  lives: number;
  maxLives: number;
  score: number;
  paused: boolean;
  speed: number;
  autoNext: boolean;
  muted: boolean;
  enemiesAlive: number;
  queuedSpawns: number;
  modifier: { name: string; desc: string } | null;
  shopElement: Element | null;
  selectedTower: UiTowerInfo | null;
  discovered: string[];
  discoveredRun: string[];
  endState: EndState | null;
  canStartWave: boolean;
  canOverclock: boolean;
  fps: number;
}

/** Debug handle exposed as window.__roi for the automated e2e suite. */
export interface RoiDebug {
  ink: () => number;
  towers: () => number;
  enemies: () => number;
  phase: () => GameState['phase'];
  waveIndex: () => number;
  kills: () => number;
  shots: () => number;
  speed: () => number;
  inkEarned: () => number;
  startWave: () => void;
}
