export type Element = 'air' | 'fire' | 'water' | 'earth' | 'ink';
export type DifficultyId = 'apprentice' | 'master' | 'grandmaster';
export type MapId = 'river' | 'bridge' | 'spiral';
export type EnemyKind = 'moth' | 'crane' | 'fox' | 'serpent' | 'tortoise' | 'dragon';
export type TargetMode = 'first' | 'last' | 'strong' | 'close' | 'unprimed';
export type PathId = 'A' | 'B';
export type ModifierId = 'swift' | 'iron' | 'mist';
export type GameStatus = 'playing' | 'victory' | 'won' | 'defeat';

export interface Vec {
  x: number;
  y: number;
}

/** Arc-length lookup table: sample i sits exactly at distance i * step. */
export interface LaneData {
  id: number;
  step: number;
  length: number;
  xs: number[];
  ys: number[];
  angs: number[];
}

export interface Conduit {
  x: number;
  y: number;
  r: number;
}

export interface BridgeDef {
  x: number;
  y: number;
  angle: number;
  len: number;
  wid: number;
}

export interface MapDef {
  id: MapId;
  name: string;
  jp: string;
  level: string;
  blurb: string;
  lanes: LaneData[];
  entrances: Vec[];
  exits: Vec[];
  conduits: Conduit[];
  bridge: BridgeDef | null;
  trackHalfWidth: number;
  spiralBoost: boolean;
  labels: { text: string; x: number; y: number; rot: number }[];
}

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  jp: string;
  tag: string;
  ink: number;
  lives: number;
  waves: number;
  hp: number;
  speed: number;
  cost: number;
}

export interface UpgradeDef {
  name: string;
  text: string;
  transforms?: boolean;
  apex?: boolean;
}

export interface PathDef {
  name: string;
  tiers: UpgradeDef[];
}

export interface ElementDef {
  id: Element;
  name: string;
  jp: string;
  glyph: string;
  color: string;
  dark: string;
  light: string;
  cost: number;
  range: number;
  rate: number;
  dmg: number;
  pierce: string;
  desc: string;
  status: string;
  upCosts: number[];
  A: PathDef;
  B: PathDef;
}

export interface ComboDef {
  id: string;
  a: Element;
  b: Element;
  name: string;
  kanji: string;
  callout: string;
  color: string;
  desc: string;
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  bounty: number;
  radius: number;
  leak: number;
  peels: EnemyKind[];
  note: string;
}

export interface Stats {
  range: number;
  rate: number;
  dmg: number;
  pierce: number;
  splash: number;
  speed: number;
  turn: number;
  burnT: number;
  burnDps: number;
  soakSlow: number;
  soakT: number;
  stainSlow: number;
  stainT: number;
  stun: number;
  knock: number;
  stripCamo: boolean;
  bounces: number;
  hop: number;
  volley: number;
  crane: boolean;
  swallows: boolean;
  fan: boolean;
  whirl: boolean;
  cone: boolean;
  coneAng: number;
  laser: boolean;
  cluster: boolean;
  ashT: number;
  ashDps: number;
  ashStack: number;
  barrage: boolean;
  koi: boolean;
  wake: boolean;
  tsunami: boolean;
  vortex: boolean;
  vortexR: number;
  pullDmg: boolean;
  lotus: boolean;
  shards: boolean;
  crit: boolean;
  boulder: boolean;
  orbit: number;
  orbitR: number;
  orbitDmg: number;
  darts: boolean;
  beam: boolean;
  pool: boolean;
  corrode: boolean;
  dragon: boolean;
  tether: boolean;
  tetherSlow: boolean;
  cube: boolean;
}

export interface Tower {
  id: number;
  element: Element;
  x: number;
  y: number;
  a: number;
  b: number;
  lastPath: PathId;
  invested: number;
  mode: TargetMode;
  cooldown: number;
  kills: number;
  damage: number;
  shots: number;
  special: number;
  special2: number;
  orbit: number;
  inConduit: boolean;
  aim: number;
  firing: boolean;
  tickAcc: number;
  flash: number;
  age: number;
}

export type FrozenKind = 'none' | 'lotus' | 'petrify' | 'cube';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  lane: number;
  dist: number;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  wave: number;
  radius: number;
  camo: boolean;
  armored: boolean;
  dead: boolean;
  hitIds: Set<number>;
  reactionCd: number;
  wind: number;
  burn: number;
  burnDps: number;
  soak: number;
  soakSlow: number;
  fract: number;
  stain: number;
  stainSlow: number;
  stainPerm: boolean;
  stun: number;
  root: number;
  frozen: number;
  frozenKind: FrozenKind;
  slowT: number;
  slowPct: number;
  patchSlow: number;
  pulledT: number;
  wakeT: number;
  soakHits: number;
  tetherId: number;
  orbitCd: Map<number, number>;
  flash: number;
  age: number;
  lastHitBy: number;
}

export type ProjKind =
  | 'shuriken'
  | 'crane'
  | 'swallow'
  | 'fan'
  | 'whirlwind'
  | 'lantern'
  | 'spark'
  | 'wave'
  | 'spike'
  | 'shard'
  | 'boulder'
  | 'blot'
  | 'dart'
  | 'needle'
  | 'blade'
  | 'koi'
  | 'dragon';

export interface Projectile {
  id: number;
  kind: ProjKind;
  element: Element;
  towerId: number;
  st: Stats;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  speed: number;
  turn: number;
  dmg: number;
  pierce: number;
  splash: number;
  radius: number;
  life: number;
  age: number;
  targetId: number;
  hitIds: Set<number>;
  bounces: number;
  knock: number;
  // lob
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  dur: number;
  height: number;
  // lane
  lane: number;
  dist: number;
  dir: number;
  travelled: number;
  maxTravel: number;
  // flags
  noReact: boolean;
  sky: boolean;
  dead: boolean;
  wakeAcc: number;
  rot: number;
}

export type PatchKind = 'ash' | 'magma' | 'puddle' | 'wake' | 'vortex' | 'mini';

export interface Patch {
  id: number;
  kind: PatchKind;
  x: number;
  y: number;
  r: number;
  t: number;
  max: number;
  dps: number;
  stacks: number;
  slow: number;
  corrode: boolean;
  pull: number;
  pullBonus: boolean;
  seed: number;
}

export interface Bomb {
  t: number;
  enemyId: number;
  x: number;
  y: number;
  r: number;
  dmg: number;
  towerId: number;
}

export interface Tether {
  id: number;
  members: number[];
  t: number;
  slow: boolean;
}

interface FxBase {
  t: number;
  life: number;
}

export type Fx =
  | (FxBase & { k: 'confetti'; x: number; y: number; vx: number; vy: number; rot: number; vr: number; color: string; size: number })
  | (FxBase & { k: 'splat'; x: number; y: number; r: number; seed: number })
  | (FxBase & { k: 'ring'; x: number; y: number; r: number; color: string })
  | (FxBase & { k: 'text'; x: number; y: number; text: string; color: string; size: number })
  | (FxBase & { k: 'stamp'; x: number; y: number; text: string })
  | (FxBase & { k: 'chain'; pts: Vec[]; color: string })
  | (FxBase & { k: 'beam'; x1: number; y1: number; x2: number; y2: number; w: number; color: string })
  | (FxBase & { k: 'wave' })
  | (FxBase & { k: 'lotus'; x: number; y: number });

export interface SpawnEntry {
  t: number;
  kind: EnemyKind;
  lane: number;
  wave: number;
}

export interface WaveGroup {
  kind: EnemyKind;
  count: number;
  interval: number;
  delay: number;
}

export interface RunStats {
  kills: number;
  leaks: number;
  inkEarned: number;
  combos: number;
}

export interface ScoreEntry {
  bestWave: number;
  won: boolean;
  kills: number;
  runs: number;
}

export type ScoreLedger = Record<string, ScoreEntry>;
