/**
 * Runic Origami & Ink - pure headless game engine.
 * Fixed 1/60s timestep with clamped deltas and swept segment-to-circle
 * collisions (nothing tunnels at 3x speed). Owns the requestAnimationFrame
 * loop and calls an injected render callback; keeps zero DOM knowledge of
 * its own except through that callback. All mutating commands are driven by
 * the React UI layer via useSyncExternalStore snapshots.
 */

import {
  BOSS_SLOW_CAP,
  COMBO_DISCOVERY_BONUS,
  COMBO_REACTION_COOLDOWN,
  COMBO_RECURSION_DEPTH,
  COMBOS,
  CONDUIT_RANGE_BONUS,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  ELEMENT_META,
  ENEMY_DEFS,
  TOWER_DEFS,
  comboFor,
  computeTowerStats,
  endlessSpeedMult,
  hpForWave,
  loadCodex,
  loadLedger,
  overclockBonus,
  recordLedgerRun,
  salvageValue,
  saveCodex,
  towerCost,
  upgradeCost,
  waveClearBonus,
} from './constants';
import { isValidPlacement, nearestLanePoint, sampleLane } from './maps';
import { sound } from './sound';
import type {
  ComboDef,
  DifficultyDef,
  DifficultyId,
  Element,
  Enemy,
  EnemyKind,
  EndState,
  GameState,
  GroundFx,
  Ledger,
  MapDef,
  PathSide,
  Projectile,
  ProjectileKind,
  SpawnOrder,
  TargetMode,
  Tower,
  TowerStats,
  UiSnapshot,
  UiTowerInfo,
  Vec2,
  Vfx,
} from './types';
import { CORRUPTED_MODIFIERS, waveDef } from './waves';

const STEP = 1 / 60;
const STEP_CAP = 0.05;
const MAX_STEPS_PER_FRAME = 4;
const PROJECTILE_HIT_PAD = 4;
const SPARK_RING = 55;
const SHARD_RANGE_LIFE = 0.5;

interface DamageOpts {
  element?: Element | null;
  towerId?: number;
  projId?: number;
  trueDamage?: boolean;
  isCombo?: boolean;
  depth: number;
  noShare?: boolean;
}

interface ProjectileSeed {
  kind: ProjectileKind;
  element: Element;
  towerId: number;
  x: number;
  y: number;
  damage: number;
  speed: number;
  vx?: number;
  vy?: number;
  targetId?: number;
  pierce?: number;
  splash?: number;
  splashSlow?: number;
  statusDuration?: number;
  burnDps?: number;
  homing?: number;
  life?: number;
  knockback?: number;
  stun?: number;
  ricochets?: number;
  fanBounces?: number;
  retargets?: boolean;
  splits?: boolean;
  clusterBombs?: number;
  ashDuration?: number;
  ashDps?: number;
  meltsArmor?: boolean;
  stripsCloak?: boolean;
  dropsPuddle?: boolean;
  dropsWake?: boolean;
  freezeOnHits?: number;
  lobDur?: number;
  toX?: number;
  toY?: number;
  fromX?: number;
  fromY?: number;
  koi?: boolean;
  koiLane?: number;
  vortexRadius?: number;
  koiFrom?: number;
  koiTo?: number;
  crushLeft?: number;
}

export class GameEngine {
  state: GameState;
  muted = false;

  private nextEnemyId = 1;
  private nextProjectileId = 1;
  private nextTowerId = 1;
  private killed = new Set<number>();
  private listeners = new Set<() => void>();
  private cachedSnapshot: UiSnapshot | null = null;
  private uiVersion = 0;
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private accumulator = 0;
  private renderFn: ((canvas: HTMLCanvasElement) => void) | null = null;
  private renderCanvas: HTMLCanvasElement | null = null;
  private destroyed = false;
  private fpsFrames = 0;
  private fpsAccum = 0;
  private codex: string[];
  private ledger: Ledger;
  private comboSoundStep = -1;

  constructor(cfg: { map: MapDef; difficulty: DifficultyDef }) {
    this.codex = loadCodex();
    this.ledger = loadLedger();
    this.state = {
      map: cfg.map,
      difficulty: cfg.difficulty,
      waveIndex: 0,
      wavesCleared: 0,
      targetWave: cfg.difficulty.waves,
      endless: false,
      phase: 'prep',
      waveName: 'Preparation',
      spawnQueue: [],
      spawnClock: 0,
      ink: cfg.difficulty.ink,
      lives: cfg.difficulty.lives,
      maxLives: cfg.difficulty.lives,
      score: 0,
      paused: false,
      modalPaused: false,
      speed: 1,
      autoNext: true,
      autoNextTimer: 0,
      overclocked: false,
      endlessMods: { speed: 1, armor: 0, mist: false },
      modifierBanner: null,
      enemies: [],
      towers: [],
      projectiles: [],
      ground: [],
      vfx: [],
      time: 0,
      shake: 0,
      shopElement: null,
      selectedTowerId: -1,
      pointer: null,
      pointerValid: false,
      rangePreview: null,
      discoveredRun: [],
      endState: null,
      stats: { kills: 0, shotsFired: 0, inkEarned: 0, discovered: this.codex.slice() },
      banner: null,
      fps: 0,
    };
  }

  // ------------------------------------------------------------- lifecycle

  attachCanvas(canvas: HTMLCanvasElement): void {
    this.renderCanvas = canvas;
  }

  start(renderFn: (canvas: HTMLCanvasElement) => void): void {
    this.renderFn = renderFn;
    this.lastFrameTime = performance.now();
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.frame);
    }
  }

  private frame = (now: number): void => {
    if (this.destroyed) return;
    this.rafId = requestAnimationFrame(this.frame);
    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    this.fpsFrames++;
    this.fpsAccum += rawDt;
    if (this.fpsAccum >= 0.5) {
      this.state.fps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsFrames = 0;
      this.fpsAccum = 0;
      this.uiVersion++;
    }
    this.update(rawDt);
    if (this.renderCanvas && this.renderFn) this.renderFn(this.renderCanvas);
  };

  update(rawDt: number): void {
    if (this.destroyed) return;
    const effectivePause = this.state.paused || this.state.modalPaused || this.state.endState !== null;
    if (!effectivePause) {
      const dt = Math.min(rawDt, STEP_CAP);
      this.accumulator += dt * this.state.speed;
      let steps = Math.floor(this.accumulator / STEP);
      this.accumulator -= steps * STEP;
      if (steps > MAX_STEPS_PER_FRAME) steps = MAX_STEPS_PER_FRAME;
      for (let i = 0; i < steps; i++) this.step(STEP);
      if (steps > 0 && this.cachedSnapshot !== null) this.notify();
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.renderFn = null;
    this.renderCanvas = null;
    this.state.enemies.length = 0;
    this.state.towers.length = 0;
    this.state.projectiles.length = 0;
    this.state.ground.length = 0;
    this.state.vfx.length = 0;
    this.state.spawnQueue.length = 0;
    this.listeners.clear();
    this.cachedSnapshot = null;
    sound.release();
  }

  // ------------------------------------------------------------- ui plumbing

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  getSnapshot = (): UiSnapshot => {
    if (this.cachedSnapshot) return this.cachedSnapshot;
    const s = this.state;
    const selected = s.towers.find((t) => t.id === s.selectedTowerId) ?? null;
    const snapshot: UiSnapshot = {
      version: this.uiVersion,
      phase: s.phase,
      waveIndex: s.waveIndex,
      wavesCleared: s.wavesCleared,
      targetWave: s.targetWave,
      endless: s.endless,
      waveName: s.waveName,
      ink: Math.floor(s.ink),
      lives: s.lives,
      maxLives: s.maxLives,
      score: Math.floor(s.score),
      paused: s.paused,
      speed: s.speed,
      autoNext: s.autoNext,
      muted: this.muted,
      enemiesAlive: s.enemies.length,
      queuedSpawns: s.spawnQueue.length,
      modifier: s.modifierBanner ? { name: s.modifierBanner.name, desc: s.modifierBanner.desc } : null,
      shopElement: s.shopElement,
      selectedTower: selected ? this.uiTower(selected) : null,
      discovered: Array.from(new Set([...this.codex, ...s.discoveredRun])),
      discoveredRun: s.discoveredRun.slice(),
      endState: s.endState,
      canStartWave:
        (s.phase === 'prep' || s.phase === 'cleared') && s.endState === null && (s.endless || s.waveIndex < s.targetWave),
      canOverclock: s.phase === 'wave' && !s.overclocked && (s.endless || s.waveIndex < s.targetWave),
      fps: s.fps,
    };
    this.cachedSnapshot = snapshot;
    return snapshot;
  };

  private notify(): void {
    this.cachedSnapshot = null;
    for (const cb of this.listeners) cb();
  }

  private uiTower(tower: Tower): UiTowerInfo {
    const def = TOWER_DEFS[tower.element];
    const stats = computeTowerStats(tower.element, tower.tierA, tower.tierB);
    return {
      id: tower.id,
      element: tower.element,
      title: def.title,
      tierA: tower.tierA,
      tierB: tower.tierB,
      targeting: tower.targeting,
      kills: tower.kills,
      damageDealt: Math.floor(tower.damageDealt),
      totalInvested: tower.totalInvested,
      sellValue: salvageValue(tower.totalInvested),
      range: Math.round(stats.range * (tower.conduitBoost ? CONDUIT_RANGE_BONUS : 1)),
      rate: stats.rate,
      damage: stats.damage,
      kind: stats.kind,
      pathALabel: def.pathA.label,
      pathBLabel: def.pathB.label,
    };
  }

  // ------------------------------------------------------------- commands

  togglePause(): void {
    if (this.state.endState) return;
    this.state.paused = !this.state.paused;
    sound.ui();
    this.notify();
  }

  setSpeed(speed: number): void {
    this.state.speed = speed;
    sound.ui();
    this.notify();
  }

  toggleAutoNext(): void {
    this.state.autoNext = !this.state.autoNext;
    sound.ui();
    this.notify();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    sound.setMuted(this.muted);
    this.notify();
  }

  setModalPaused(paused: boolean): void {
    this.state.modalPaused = paused;
    this.notify();
  }

  setShopElement(element: Element | null): void {
    this.state.shopElement = element;
    if (element) this.state.selectedTowerId = -1;
    sound.ui();
    this.notify();
  }

  setPointer(x: number, y: number | null): void {
    const s = this.state;
    if (y === null) {
      s.pointer = null;
      s.pointerValid = false;
      return;
    }
    s.pointer = { x, y };
    const check = isValidPlacement(s.map.lanes, s.towers, s.map.conduits, x, y);
    const cost = s.shopElement ? towerCost(s.shopElement, s.difficulty.costMult) : 0;
    s.pointerValid = check.ok && s.ink >= cost;
  }

  click(x: number, y: number): void {
    const s = this.state;
    if (s.endState) return;
    if (s.shopElement) {
      const check = isValidPlacement(s.map.lanes, s.towers, s.map.conduits, x, y);
      if (!check.ok) {
        sound.error();
        const label = check.reason === 'track' ? 'TOO CLOSE TO TRACK' : check.reason === 'tower' ? 'TOWERS TOO CLOSE' : 'OUTSIDE SCROLL';
        this.addCallout(x, y, label, '#C1121F');
        return;
      }
      const cost = towerCost(s.shopElement, s.difficulty.costMult);
      if (s.ink < cost) {
        sound.error();
        this.addCallout(x, y, 'NOT ENOUGH INK', '#C1121F');
        return;
      }
      s.ink -= cost;
      const tower: Tower = {
        id: this.nextTowerId++,
        element: s.shopElement,
        x,
        y,
        tierA: 0,
        tierB: 0,
        targeting: 'first',
        cooldown: 0,
        angle: 0,
        kills: 0,
        damageDealt: 0,
        totalInvested: cost,
        shotCount: 0,
        abilityTimer: 0,
        abilityTimer2: 0,
        coneAngle: 0,
        laserAngle: 0,
        tickAcc: 0,
        orbitalAngle: Math.random() * Math.PI * 2,
        conduitBoost: check.inConduit,
        buildFlash: 0.5,
        fireGlow: 0,
        muzzleX: x,
        muzzleY: y,
      };
      s.towers.push(tower);
      s.selectedTowerId = tower.id;
      s.shopElement = null;
      s.pointer = null;
      s.pointerValid = false;
      sound.place();
      this.addPoof(x, y);
      this.notify();
      return;
    }
    const hit = s.towers.find((t) => Math.hypot(t.x - x, t.y - y) <= 22);
    s.selectedTowerId = hit ? hit.id : -1;
    if (hit) sound.ui();
    this.notify();
  }

  upgradeTower(towerId: number, side: PathSide): void {
    const s = this.state;
    const tower = s.towers.find((t) => t.id === towerId);
    if (!tower) return;
    const current = side === 'A' ? tower.tierA : tower.tierB;
    const other = side === 'A' ? tower.tierB : tower.tierA;
    if (current >= 4) return;
    const nextTier = current + 1;
    if (other >= 3 && nextTier >= 3) {
      sound.error();
      this.addCallout(tower.x, tower.y - 30, 'SEALED PATH', '#C1121F');
      return;
    }
    const def = TOWER_DEFS[tower.element];
    const tierDef = (side === 'A' ? def.pathA : def.pathB).tiers[nextTier - 1];
    if (!tierDef) return;
    const cost = upgradeCost(tierDef.cost, s.difficulty.costMult);
    if (s.ink < cost) {
      sound.error();
      this.addCallout(tower.x, tower.y - 30, 'NOT ENOUGH INK', '#C1121F');
      return;
    }
    s.ink -= cost;
    tower.totalInvested += cost;
    if (side === 'A') tower.tierA = nextTier;
    else tower.tierB = nextTier;
    sound.upgrade();
    if (nextTier === 4) {
      this.addCallout(tower.x, tower.y - 36, 'APEX FORM!', '#C9A227');
      this.addVfx({ kind: 'aura', x: tower.x, y: tower.y, t: 0, dur: 0.9, color: '#C9A227', r: 60 });
    } else if (tierDef.transforms === 'projectile') {
      this.addCallout(tower.x, tower.y - 34, 'TRANSFORMS!', TOWER_DEFS[tower.element].color);
    }
    this.notify();
  }

  salvageTower(towerId: number): void {
    const s = this.state;
    const idx = s.towers.findIndex((t) => t.id === towerId);
    if (idx < 0) return;
    const tower = s.towers[idx];
    const refund = salvageValue(tower.totalInvested);
    s.ink += refund;
    s.towers.splice(idx, 1);
    if (s.selectedTowerId === towerId) s.selectedTowerId = -1;
    sound.salvage();
    this.addPoof(tower.x, tower.y);
    this.addCallout(tower.x, tower.y - 24, `SALVAGED +${refund}`, '#5C8A4A');
    this.notify();
  }

  setTargeting(towerId: number, mode: TargetMode): void {
    const tower = this.state.towers.find((t) => t.id === towerId);
    if (!tower || tower.targeting === mode) return;
    tower.targeting = mode;
    sound.ui();
    this.notify();
  }

  /** Hover preview of an upgrade card: show the range it would unlock. */
  hoverUpgrade(towerId: number, side: PathSide | null): void {
    const s = this.state;
    if (side === null) {
      if (s.rangePreview && s.rangePreview.towerId === towerId) s.rangePreview = null;
      return;
    }
    const tower = s.towers.find((t) => t.id === towerId);
    if (!tower) return;
    const tierA = tower.tierA + (side === 'A' ? 1 : 0);
    const tierB = tower.tierB + (side === 'B' ? 1 : 0);
    const stats = computeTowerStats(tower.element, tierA, tierB);
    const range = stats.range * (tower.conduitBoost ? CONDUIT_RANGE_BONUS : 1);
    if (range > 0) s.rangePreview = { towerId, range };
  }

  startWave(): void {
    const s = this.state;
    if (s.endState || s.phase === 'ended') return;
    if (s.phase === 'wave') {
      if (s.overclocked || !this.canOverclockWave()) {
        sound.error();
        return;
      }
      const bonus = overclockBonus(s.waveIndex);
      s.ink += bonus;
      s.score += bonus;
      s.stats.inkEarned += bonus;
      s.overclocked = true;
      this.addCallout(480, 140, `OVERCLOCK +${bonus} INK`, '#C9A227');
    } else if (s.phase !== 'prep' && s.phase !== 'cleared') {
      return;
    } else if (!s.endless && s.waveIndex >= s.targetWave) {
      return;
    }
    s.waveIndex++;
    this.applyEndlessModifier();
    this.buildWaveQueue();
    s.phase = 'wave';
    s.spawnClock = 0;
    const def = waveDef(s.waveIndex);
    s.waveName = def.name;
    s.banner = { text: `WAVE ${s.waveIndex}${s.endless ? ' - INFINITE SCROLL' : ` / ${s.targetWave}`}`, sub: def.name, t: 2.2 };
    sound.wave();
    this.notify();
  }

  private canOverclockWave(): boolean {
    const s = this.state;
    return s.endless || s.waveIndex < s.targetWave;
  }

  private applyEndlessModifier(): void {
    const s = this.state;
    const diff = s.difficulty;
    if (s.waveIndex <= diff.waves) return;
    const endlessIndex = s.waveIndex - diff.waves - 1;
    if (endlessIndex % 5 !== 0) return;
    const mod = CORRUPTED_MODIFIERS[(endlessIndex / 5) % CORRUPTED_MODIFIERS.length];
    if (mod.id === 'swiftGale') s.endlessMods.speed *= 1.25;
    else if (mod.id === 'ironOrigami') s.endlessMods.armor += 1;
    else s.endlessMods.mist = true;
    s.modifierBanner = { name: mod.name, desc: mod.desc, t: 3.2 };
    this.addCallout(480, 120, `CORRUPTED INK: ${mod.name}`, '#C1121F');
  }

  private buildWaveQueue(): void {
    const s = this.state;
    const def = waveDef(s.waveIndex);
    const laneCount = s.map.lanes.length;
    const orders: SpawnOrder[] = [];
    let spawnCounter = 0;
    def.groups.forEach((group, groupIdx) => {
      for (let i = 0; i < group.count; i++) {
        const laneIndex =
          group.lane !== undefined
            ? group.lane % laneCount
            : (spawnCounter + groupIdx) % laneCount;
        orders.push({
          time: s.spawnClock + group.delay + i * group.gap,
          kind: group.kind,
          laneIndex,
        });
        spawnCounter++;
      }
    });
    orders.sort((a, b) => a.time - b.time);
    s.spawnQueue.push(...orders);
  }

  claimVictory(): EndState | null {
    const s = this.state;
    if (!s.endState || s.endState.kind !== 'victory') return null;
    this.ledger = recordLedgerRun(this.ledger, s.map.id, s.difficulty.id, s.wavesCleared, Math.floor(s.score), true);
    return s.endState;
  }

  continueEndless(): void {
    const s = this.state;
    if (!s.endState || s.endState.kind !== 'victory') return;
    s.endState = null;
    s.endless = true;
    s.phase = 'cleared';
    s.waveName = 'Infinite Scroll';
    s.banner = { text: 'THE INFINITE SCROLL UNROLLS', sub: 'Endless waves await - every 5 waves corrupts the ink', t: 2.6 };
    s.autoNextTimer = 1.4;
    this.notify();
  }

  get ledgerSnapshot(): Ledger {
    return this.ledger;
  }

  static difficultyById(id: DifficultyId): DifficultyDef {
    return DIFFICULTIES[id];
  }

  static difficultyList(): DifficultyDef[] {
    return DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id]);
  }

  // ------------------------------------------------------------- simulation

  private step(dt: number): void {
    const s = this.state;
    if (s.endState || s.phase === 'ended') return;
    s.time += dt;
    if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 10);
    if (s.banner) {
      s.banner.t -= dt;
      if (s.banner.t <= 0) s.banner = null;
    }
    if (s.modifierBanner) {
      s.modifierBanner.t -= dt;
      if (s.modifierBanner.t <= 0) s.modifierBanner = null;
    }

    // Spawner.
    if (s.phase === 'wave' && s.spawnQueue.length > 0) {
      s.spawnClock += dt;
      const remaining: SpawnOrder[] = [];
      for (const order of s.spawnQueue) {
        if (order.time <= s.spawnClock) this.spawnEnemy(order);
        else remaining.push(order);
      }
      s.spawnQueue = remaining;
    }

    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updateGround(dt);
    this.updateVfx(dt);

    // Sweep dead enemies.
    if (s.enemies.some((e) => e.hp <= 0)) s.enemies = s.enemies.filter((e) => e.hp > 0);

    // Wave completion: spawn queue drained AND no enemies alive.
    if (s.phase === 'wave' && s.spawnQueue.length === 0 && s.enemies.length === 0) {
      this.waveCleared();
    }

    // Auto-next.
    if (s.phase === 'cleared' && s.autoNext && !s.endState && (s.endless || s.waveIndex < s.targetWave)) {
      s.autoNextTimer -= dt;
      if (s.autoNextTimer <= 0) this.startWave();
    }
  }

  private spawnEnemy(order: SpawnOrder): void {
    this.spawnEnemyRaw(order.kind, order.laneIndex, 0);
  }

  private spawnEnemyRaw(kind: EnemyKind, laneIndex: number, distance: number): Enemy {
    const s = this.state;
    const def = ENEMY_DEFS[kind];
    const hp = Math.max(1, hpForWave(def.baseHp, Math.max(1, s.waveIndex), s.difficulty));
    const speedFactor =
      s.difficulty.speedMult * endlessSpeedMult(Math.max(1, s.waveIndex), s.difficulty) * s.endlessMods.speed;
    const cloaked = def.phantom || (s.endlessMods.mist && Math.random() < 0.3);
    const enemy: Enemy = {
      id: this.nextEnemyId++,
      kind,
      def,
      laneIndex,
      distance,
      hp,
      maxHp: hp,
      bounty: def.bounty,
      hitRadius: def.hitRadius,
      speedFactor,
      statuses: {},
      reactionCooldown: 0,
      rooted: 0,
      frozen: 0,
      frozenBy: null,
      lotusHits: 0,
      hitProjectileIds: [],
      cloaked,
      armorStripped: false,
      armorLevel: s.endlessMods.armor,
      tetherIds: [],
      tetherTime: 0,
      tetherBound: false,
      orbCd: {},
      vulnAll: 0,
      vulnCombo: 0,
      extraSlow: 0,
      extraSlowT: 0,
      wobble: Math.random() * Math.PI * 2,
      flash: 0,
    };
    s.enemies.push(enemy);
    return enemy;
  }

  private waveCleared(): void {
    const s = this.state;
    s.wavesCleared = s.waveIndex;
    s.phase = 'cleared';
    const bonus = waveClearBonus(s.waveIndex);
    s.ink += bonus;
    s.score += bonus;
    s.stats.inkEarned += bonus;
    s.overclocked = false;
    s.autoNextTimer = 1.0;
    this.addCallout(480, 90, `WAVE ${s.waveIndex} CLEARED +${bonus} INK`, '#5C8A4A');
    if (s.waveIndex === s.targetWave && !s.endless) {
      this.victory();
    } else {
      sound.combo(4);
    }
    this.notify();
  }

  private victory(): void {
    const s = this.state;
    s.phase = 'ended';
    s.endState = this.buildEndState('victory');
    sound.victory();
    this.notify();
  }

  private defeat(): void {
    const s = this.state;
    if (s.endState) return;
    s.phase = 'ended';
    s.endState = this.buildEndState('defeat');
    this.ledger = recordLedgerRun(this.ledger, s.map.id, s.difficulty.id, s.wavesCleared, Math.floor(s.score), false);
    sound.defeat();
    this.notify();
  }

  private buildEndState(kind: 'victory' | 'defeat'): EndState {
    const s = this.state;
    let mvp: Tower | null = null;
    for (const t of s.towers) {
      if (!mvp || t.kills > mvp.kills || (t.kills === mvp.kills && t.damageDealt > mvp.damageDealt)) mvp = t;
    }
    return {
      kind,
      waveReached: s.wavesCleared,
      kills: s.stats.kills,
      score: Math.floor(s.score),
      mvpName: mvp ? TOWER_DEFS[mvp.element].title : null,
      mvpElement: mvp ? mvp.element : null,
      mvpKills: mvp ? mvp.kills : 0,
      mvpDamage: mvp ? Math.floor(mvp.damageDealt) : 0,
    };
  }

  private enemyPos(enemy: Enemy): Vec2 {
    const lane = this.state.map.lanes[enemy.laneIndex];
    if (!lane) return { x: 0, y: 0 };
    const s = sampleLane(lane, enemy.distance);
    return { x: s.x, y: s.y };
  }

  // ------------------------------------------------------------- enemies

  private updateEnemies(dt: number): void {
    const s = this.state;
    const lanes = s.map.lanes;
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i];
      if (e.hp <= 0) continue;
      const lane = lanes[e.laneIndex];
      if (!lane) continue;

      // Timers.
      if (e.reactionCooldown > 0) e.reactionCooldown -= dt;
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
      if (e.tetherTime > 0) {
        e.tetherTime -= dt;
        if (e.tetherTime <= 0) {
          e.tetherIds = [];
          e.tetherBound = false;
        }
      }
      if (e.extraSlowT > 0) {
        e.extraSlowT -= dt;
        if (e.extraSlowT <= 0) e.extraSlow = 0;
      }
      for (const key of Object.keys(e.statuses) as Element[]) {
        const st = e.statuses[key];
        if (!st) continue;
        st.time -= dt;
        if (st.time <= 0) delete e.statuses[key];
      }

      // Void cube detonation on freeze expiry.
      if (e.frozen > 0 && e.frozenBy === 'cube') {
        e.frozen -= dt;
        if (e.frozen <= 0) {
          e.frozenBy = null;
          const pos = this.enemyPos(e);
          this.splash(pos.x, pos.y, 90, 160, { depth: 1, element: null });
          this.addVfx({ kind: 'ring', x: pos.x, y: pos.y, t: 0, dur: 0.4, color: '#1D1E2C', r: 20, r2: 90 });
          this.addCallout(pos.x, pos.y - 20, 'VOID BURST', '#1D1E2C');
        }
      } else if (e.frozen > 0) {
        e.frozen -= dt;
        if (e.frozen <= 0) e.frozenBy = null;
      }

      // Burning DPS.
      const burn = e.statuses.fire;
      if (burn && burn.dps > 0) {
        this.applyDamage(e, burn.dps * dt, { depth: 1, noShare: true });
      }

      if (e.hp <= 0) continue;

      // Ground effects.
      e.vulnAll = 0;
      e.vulnCombo = 0;
      const pos = this.enemyPos(e);
      let groundSlow = 0;
      let ashStacks = 0;
      for (const g of s.ground) {
        if (g.kind === 'wake') {
          if (g.laneIndex === e.laneIndex && e.distance >= g.from - 12 && e.distance <= g.to + 12) {
            groundSlow = Math.max(groundSlow, g.slow);
            if (g.dmgTakenBonus > 0) e.vulnCombo = Math.max(e.vulnCombo, g.dmgTakenBonus);
          }
          continue;
        }
        const d = Math.hypot(pos.x - g.x, pos.y - g.y);
        if (d > g.r + e.hitRadius) continue;
        if (g.slow > 0) groundSlow = Math.max(groundSlow, g.slow);
        if (g.dmgTakenBonus > 0) e.vulnAll = Math.max(e.vulnAll, g.dmgTakenBonus);
        if (g.dps > 0) {
          if (g.kind === 'ash') {
            ashStacks++;
            if (ashStacks <= 3) this.applyDamage(e, g.dps * dt, { depth: 1, noShare: true });
          } else {
            this.applyDamage(e, g.dps * dt, { depth: 1, noShare: true });
            if (g.stripsArmor) e.armorStripped = true;
          }
        }
      }
      if (e.hp <= 0) continue;

      // Whirlpool drag (toward the vortex centre along the lane).
      for (const g of s.ground) {
        if (g.kind !== 'whirlpool') continue;
        const d = Math.hypot(pos.x - g.x, pos.y - g.y);
        if (d <= g.r + e.hitRadius) {
          const target = g.from; // lane distance of the vortex centre
          const dir = Math.sign(target - e.distance);
          e.distance = Math.max(0, e.distance + dir * g.pull * dt);
        }
      }

      // Movement.
      let slow = 0;
      const soaked = e.statuses.water;
      if (soaked && soaked.time > 0 && !e.def.immuneSoakedSlow) slow = Math.max(slow, soaked.slow);
      const stained = e.statuses.ink;
      if (stained && stained.time > 0) slow = Math.max(slow, stained.slow);
      slow = Math.max(slow, groundSlow, e.extraSlow);
      if (e.def.boss) slow = Math.min(slow, BOSS_SLOW_CAP);
      if (e.tetherBound && e.tetherIds.length > 0) slow = Math.max(slow, 0.3);

      const spiralBoost = s.map.spiral && e.distance < lane.length * 0.4 ? 1.15 : 1;
      const speed = e.def.baseSpeed * e.speedFactor * spiralBoost * (1 - slow);
      const frozenSolid = e.frozen > 0 || e.rooted > 0;
      if (e.rooted > 0) e.rooted = Math.max(0, e.rooted - dt);
      if (!frozenSolid) e.distance += speed * dt;

      if (e.distance >= lane.length) {
        // Leak into the sanctuary.
        s.lives = Math.max(0, s.lives - 1);
        sound.leak();
        const exit = sampleLane(lane, lane.length - 26);
        this.addVfx({ kind: 'stamp', x: Math.min(900, exit.x), y: exit.y - 16, t: 0, dur: 0.8, text: '破', color: '#C1121F', r: 30, r2: 0, angle: 0, points: [], scale: 1, spin: 0, vx: 0, vy: 0 });
        this.addCallout(Math.min(880, exit.x), exit.y - 40, 'LEAKED!', '#C1121F');
        s.enemies.splice(i, 1);
        if (s.lives <= 0) {
          this.defeat();
          return;
        }
        this.notify();
      }
    }
  }

  // ------------------------------------------------------------- towers

  private acquireTarget(tower: Tower, range: number): Enemy | null {
    const s = this.state;
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (const e of s.enemies) {
      if (e.hp <= 0 || e.cloaked) continue;
      const pos = this.enemyPos(e);
      if (Math.hypot(pos.x - tower.x, pos.y - tower.y) > range + e.hitRadius) continue;
      const primed = (e.statuses[tower.element]?.time ?? 0) > 0;
      let score: number;
      switch (tower.targeting) {
        case 'first':
          score = e.distance;
          break;
        case 'last':
          score = -e.distance;
          break;
        case 'strong':
          score = e.hp;
          break;
        case 'close':
          score = -Math.hypot(pos.x - tower.x, pos.y - tower.y);
          break;
        case 'unprimed':
        default:
          score = primed ? e.distance - 100000 : e.distance;
          break;
      }
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private updateTowers(dt: number): void {
    const s = this.state;
    for (const tower of s.towers) {
      if (tower.buildFlash > 0) tower.buildFlash = Math.max(0, tower.buildFlash - dt);
      if (tower.fireGlow > 0) tower.fireGlow = Math.max(0, tower.fireGlow - dt);
      const stats = computeTowerStats(tower.element, tower.tierA, tower.tierB);
      const range = stats.range * (tower.conduitBoost ? CONDUIT_RANGE_BONUS : 1);
      tower.cooldown -= dt;
      this.updateAbilities(tower, stats, dt);

      switch (stats.kind) {
        case 'cone':
          this.updateCone(tower, stats, range, dt);
          break;
        case 'laser':
          this.updateLaser(tower, stats, dt);
          break;
        case 'orbital':
          this.updateOrbital(tower, stats, dt);
          break;
        default:
          if (tower.cooldown <= 0) {
            const target = this.acquireTarget(tower, range);
            if (target) {
              this.fireAt(tower, stats, target);
              tower.cooldown = 1 / stats.rate;
              tower.shotCount++;
              tower.fireGlow = 0.18;
            }
          }
          break;
      }
    }
  }

  /** Abilities shared across attack kinds (barrages, pools, dragons, waves). */
  private updateAbilities(tower: Tower, stats: TowerStats, dt: number): void {
    const s = this.state;
    tower.abilityTimer += dt;
    tower.abilityTimer2 += dt;

    if (stats.greatWave && tower.abilityTimer >= 6.0 && s.enemies.length > 0) {
      tower.abilityTimer = 0;
      this.castGreatWave(tower);
    }
    if (stats.skyBarrage && tower.abilityTimer2 >= 2.2 && s.enemies.length > 0) {
      tower.abilityTimer2 = 0;
      this.castSkyBarrage(tower);
    }
    if (stats.puddleRadius > 0 && tower.abilityTimer >= 1.1) {
      tower.abilityTimer = 0;
      this.paintPuddle(tower, stats);
    }
    if (stats.inkDragon && tower.abilityTimer2 >= 7.0 && s.enemies.length > 0) {
      tower.abilityTimer2 = 0;
      this.castInkDragon(tower);
    }
    if (stats.orbDart && stats.kind === 'orbital' && tower.abilityTimer >= 3.0) {
      tower.abilityTimer = 0;
      this.launchOrbDarts(tower, stats);
    }
    if (stats.orbBeam && stats.kind === 'orbital' && tower.abilityTimer2 >= 1.2) {
      tower.abilityTimer2 = 0;
      this.castStoneBeam(tower);
    }
  }

  private updateCone(tower: Tower, stats: TowerStats, range: number, dt: number): void {
    // Sweep toward the strongest target; tick damage 12/s.
    const target = this.strongestInRange(tower, range);
    if (target) {
      const pos = this.enemyPos(target);
      const desired = Math.atan2(pos.y - tower.y, pos.x - tower.x);
      let diff = desired - tower.coneAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      tower.coneAngle += Math.max(-4 * dt, Math.min(4 * dt, diff));
      tower.angle = tower.coneAngle;
    }
    tower.tickAcc += dt;
    const tick = 1 / stats.rate;
    while (tower.tickAcc >= tick) {
      tower.tickAcc -= tick;
      const half = (stats.coneAngle * Math.PI) / 180 / 2;
      for (const e of this.state.enemies) {
        if (e.hp <= 0 || e.cloaked) continue;
        const pos = this.enemyPos(e);
        const d = Math.hypot(pos.x - tower.x, pos.y - tower.y);
        if (d > range + e.hitRadius) continue;
        let a = Math.atan2(pos.y - tower.y, pos.x - tower.x) - tower.coneAngle;
        while (a > Math.PI) a -= Math.PI * 2;
        while (a < -Math.PI) a += Math.PI * 2;
        if (Math.abs(a) > half) continue;
        // Cone tick: melt armor permanently.
        e.armorStripped = true;
        this.applyDamage(e, stats.damage, { element: 'fire', towerId: tower.id, depth: 0 });
        if (e.hp > 0) {
          this.tryCombo(e, 'fire', 0);
          this.primeStatus(e, 'fire', stats);
        }
      }
      tower.fireGlow = 0.12;
    }
  }

  private updateLaser(tower: Tower, stats: TowerStats, dt: number): void {
    const target = this.strongestInRange(tower, 4000);
    if (target) {
      const pos = this.enemyPos(target);
      const desired = Math.atan2(pos.y - tower.y, pos.x - tower.x);
      let diff = desired - tower.laserAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      tower.laserAngle += Math.max(-6 * dt, Math.min(6 * dt, diff));
      tower.angle = tower.laserAngle;
    }
    tower.tickAcc += dt;
    const tick = 1 / stats.rate;
    const end = 2000;
    while (tower.tickAcc >= tick) {
      tower.tickAcc -= tick;
      const dx = Math.cos(tower.laserAngle);
      const dy = Math.sin(tower.laserAngle);
      for (const e of this.state.enemies) {
        if (e.hp <= 0 || e.cloaked) continue;
        const pos = this.enemyPos(e);
        const px = pos.x - tower.x;
        const py = pos.y - tower.y;
        const proj = px * dx + py * dy;
        if (proj < 0 || proj > end) continue;
        const perp = Math.abs(px * dy - py * dx);
        if (perp > 7 + e.hitRadius) continue;
        e.armorStripped = true;
        this.applyDamage(e, stats.damage, { element: 'fire', towerId: tower.id, depth: 0 });
        if (e.hp > 0) {
          this.tryCombo(e, 'fire', 0);
          this.primeStatus(e, 'fire', stats);
        }
      }
      this.addVfx({
        kind: 'laserBeam',
        x: tower.x,
        y: tower.y,
        t: 0,
        dur: 1 / 22,
        color: '',
        r: 14,
        r2: 0,
        angle: tower.laserAngle,
        points: [
          { x: tower.x, y: tower.y },
          { x: tower.x + dx * end, y: tower.y + dy * end },
        ],
        scale: 1,
        spin: 0,
        vx: 0,
        vy: 0,
      });
      tower.fireGlow = 0.1;
    }
  }

  private updateOrbital(tower: Tower, stats: TowerStats, dt: number): void {
    const s = this.state;
    tower.orbitalAngle += 3.4 * dt;
    for (let i = 0; i < stats.orbitalCount; i++) {
      const a = tower.orbitalAngle + (i / stats.orbitalCount) * Math.PI * 2;
      const ox = tower.x + Math.cos(a) * stats.orbitalRadius;
      const oy = tower.y + Math.sin(a) * stats.orbitalRadius;
      for (const e of s.enemies) {
        if (e.hp <= 0 || e.cloaked) continue;
        const pos = this.enemyPos(e);
        if (Math.hypot(pos.x - ox, pos.y - oy) > e.hitRadius + 8) continue;
        const until = e.orbCd[tower.id] ?? 0;
        if (s.time < until) continue;
        e.orbCd[tower.id] = s.time + 0.4;
        this.applyDamage(e, stats.orbitalDamage, { element: 'earth', towerId: tower.id, depth: 0 });
        if (e.hp > 0) {
          this.tryCombo(e, 'earth', 0);
          this.primeStatus(e, 'earth', stats);
        }
      }
    }
  }

  private strongestInRange(tower: Tower, range: number): Enemy | null {
    let best: Enemy | null = null;
    for (const e of this.state.enemies) {
      if (e.hp <= 0 || e.cloaked) continue;
      const pos = this.enemyPos(e);
      if (Math.hypot(pos.x - tower.x, pos.y - tower.y) > range + e.hitRadius) continue;
      if (!best || e.hp > best.hp) best = e;
    }
    return best;
  }

  private launchOrbDarts(tower: Tower, stats: TowerStats): void {
    for (let i = 0; i < 3; i++) {
      const a = tower.orbitalAngle + (i / 3) * Math.PI * 2;
      this.spawnProjectile({
        kind: 'orbDart',
        element: 'earth',
        towerId: tower.id,
        x: tower.x + Math.cos(a) * stats.orbitalRadius,
        y: tower.y + Math.sin(a) * stats.orbitalRadius,
        vx: Math.cos(a) * 320,
        vy: Math.sin(a) * 320,
        speed: 320,
        damage: 45,
        pierce: 1,
        homing: 6,
        life: 1.6,
      });
    }
    this.state.stats.shotsFired += 3;
  }

  private castStoneBeam(tower: Tower): void {
    const target = this.strongestInRange(tower, 2000);
    if (!target) return;
    const pos = this.enemyPos(target);
    const dx = pos.x - tower.x;
    const dy = pos.y - tower.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    for (const e of this.state.enemies) {
      if (e.hp <= 0) continue;
      const p = this.enemyPos(e);
      const px = p.x - tower.x;
      const py = p.y - tower.y;
      const proj = px * ux + py * uy;
      if (proj < 0) continue;
      const perp = Math.abs(px * uy - py * ux);
      if (perp > 12 + e.hitRadius) continue;
      this.applyDamage(e, 65, { element: 'earth', towerId: tower.id, depth: 0 });
      if (e.hp > 0) {
        this.tryCombo(e, 'earth', 0);
        const stats = computeTowerStats(tower.element, tower.tierA, tower.tierB);
        this.primeStatus(e, 'earth', stats);
      }
    }
    this.addVfx({
      kind: 'beamFlash',
      x: tower.x,
      y: tower.y,
      t: 0,
      dur: 0.16,
      color: '',
      r: 5,
      r2: 0,
      angle: 0,
      points: [
        { x: tower.x, y: tower.y },
        { x: tower.x + ux * 1100, y: tower.y + uy * 1100 },
      ],
      scale: 1,
      spin: 0,
      vx: 0,
      vy: 0,
    });
  }

  private castGreatWave(tower: Tower): void {
    const s = this.state;
    this.addVfx({ kind: 'waveSweep', x: 0, y: 0, t: 0, dur: 1.3, color: '', r: 0, r2: 0, angle: 0, points: [], scale: 1, spin: 0, vx: 0, vy: 0 });
    this.addCallout(480, 300, 'GREAT WAVE!', '#3A86FF');
    s.shake = Math.max(s.shake, 2);
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      this.applyDamage(e, 95, { element: 'water', towerId: tower.id, depth: 0 });
      if (e.hp > 0) {
        this.tryCombo(e, 'water', 0);
        this.primeStatus(e, 'water', computeTowerStats(tower.element, tower.tierA, tower.tierB));
        this.applyKnockback(e, 65);
      }
    }
  }

  private castSkyBarrage(tower: Tower): void {
    const s = this.state;
    const scored = s.enemies
      .filter((e) => e.hp > 0)
      .map((e) => {
        const pos = this.enemyPos(e);
        let density = 0;
        for (const other of s.enemies) {
          if (other.hp <= 0) continue;
          const op = this.enemyPos(other);
          if (Math.hypot(op.x - pos.x, op.y - pos.y) <= 64) density++;
        }
        return { e, pos, density };
      })
      .sort((a, b) => b.density - a.density);
    const targets = scored.slice(0, 8);
    for (const t of targets) {
      const lead = 0.55;
      const lane = s.map.lanes[t.e.laneIndex];
      const future = lane ? sampleLane(lane, t.e.distance + t.e.def.baseSpeed * t.e.speedFactor * lead) : t.pos;
      this.spawnProjectile({
        kind: 'skyLantern',
        element: 'fire',
        towerId: tower.id,
        x: future.x,
        y: -16,
        fromX: future.x,
        fromY: -16,
        toX: future.x,
        toY: future.y,
        lobDur: 0.55,
        speed: 300,
        damage: 65,
        splash: 64,
        statusDuration: 3,
        burnDps: 6,
        life: 2,
      });
    }
    if (targets.length > 0) s.stats.shotsFired += targets.length;
  }

  private paintPuddle(tower: Tower, stats: TowerStats): void {
    const s = this.state;
    const range = stats.range * (tower.conduitBoost ? CONDUIT_RANGE_BONUS : 1);
    let best: { pos: Vec2; along: number; laneIndex: number; d: number } | null = null;
    for (let li = 0; li < s.map.lanes.length; li++) {
      const lane = s.map.lanes[li];
      for (let i = 0; i < lane.samples.length; i += 3) {
        const sm = lane.samples[i];
        const d = Math.hypot(sm.x - tower.x, sm.y - tower.y);
        if (d > range) continue;
        if (!best || d < best.d) best = { pos: { x: sm.x, y: sm.y }, along: i * lane.spacing, laneIndex: li, d };
      }
    }
    if (!best) return;
    const puddle: GroundFx = {
      kind: 'puddle',
      x: best.pos.x,
      y: best.pos.y,
      r: 64,
      t: 0,
      dur: 5.5,
      dps: stats.puddleDps,
      slow: 0.6,
      pull: 0,
      dmgTakenBonus: 0,
      comboOnlyBonus: false,
      stripsArmor: stats.puddleDps > 0,
      laneIndex: best.laneIndex,
      from: best.along,
      to: best.along,
    };
    s.ground.push(puddle);
  }

  private castInkDragon(tower: Tower): void {
    const s = this.state;
    // Pick the lane holding the most enemies.
    const counts = s.map.lanes.map((lane, li) => ({
      li,
      n: s.enemies.filter((e) => e.hp > 0 && e.laneIndex === li).length,
      len: lane.length,
    }));
    counts.sort((a, b) => b.n - a.n);
    const laneIdx = counts[0]?.li ?? 0;
    const lane = s.map.lanes[laneIdx];
    if (!lane) return;
    const points: Vec2[] = [];
    for (let d = lane.length; d >= 0; d -= 14) {
      const sm = sampleLane(lane, d);
      points.push({ x: sm.x, y: sm.y });
    }
    this.addVfx({
      kind: 'dragonSweep',
      x: 0,
      y: 0,
      t: 0,
      dur: 2.0,
      color: '',
      r: 0,
      r2: 0,
      angle: 0,
      points,
      scale: 1,
      spin: 0,
      vx: 0,
      vy: 0,
    });
    this.addCallout(480, 80, 'INK DRAGON!', '#1D1E2C');
    for (const e of s.enemies) {
      if (e.hp <= 0 || e.laneIndex !== laneIdx) continue;
      this.applyDamage(e, 120, { element: 'ink', towerId: tower.id, depth: 0 });
      if (e.hp > 0) {
        e.statuses.ink = { time: 6, slow: 0.65, dps: 0 };
      }
    }
    s.shake = Math.max(s.shake, 3);
  }

  // ------------------------------------------------------------- firing

  private fireAt(tower: Tower, stats: TowerStats, target: Enemy): void {
    const s = this.state;
    s.stats.shotsFired++;
    const pos = this.enemyPos(target);
    tower.angle = Math.atan2(pos.y - tower.y, pos.x - tower.x);
    tower.muzzleX = tower.x + Math.cos(tower.angle) * 14;
    tower.muzzleY = tower.y + Math.sin(tower.angle) * 14;

    if (tower.element === 'air') {
      if (stats.kind === 'fan' && stats.whirlwind && tower.shotCount % 4 === 3) {
        // Typhoon Gale: every 4th shot is an ink whirlwind.
        const dirX = pos.x - tower.x;
        const dirY = pos.y - tower.y;
        const len = Math.hypot(dirX, dirY) || 1;
        this.spawnProjectile({
          kind: 'whirlwind',
          element: 'air',
          towerId: tower.id,
          x: tower.muzzleX,
          y: tower.muzzleY,
          vx: (dirX / len) * 46,
          vy: (dirY / len) * 46,
          speed: 46,
          damage: 55,
          pierce: 15,
          knockback: 75,
          life: 2.5,
          stripsCloak: stats.stripsCloak,
        });
        return;
      }
      if (stats.kind === 'crane') {
        for (let i = 0; i < stats.craneVolley; i++) {
          const spread = (i - (stats.craneVolley - 1) / 2) * 0.22;
          this.spawnProjectile({
            kind: 'crane',
            element: 'air',
            towerId: tower.id,
            x: tower.muzzleX,
            y: tower.muzzleY,
            vx: Math.cos(tower.angle + spread) * stats.projSpeed,
            vy: Math.sin(tower.angle + spread) * stats.projSpeed,
            speed: stats.projSpeed,
            damage: stats.damage,
            pierce: stats.pierce,
            homing: stats.homing,
            life: 3.5,
            retargets: true,
            splits: stats.craneSplit,
            targetId: target.id,
          });
        }
        return;
      }
      if (stats.kind === 'fan') {
        this.spawnProjectile({
          kind: 'fan',
          element: 'air',
          towerId: tower.id,
          x: tower.muzzleX,
          y: tower.muzzleY,
          vx: Math.cos(tower.angle) * stats.projSpeed,
          vy: Math.sin(tower.angle) * stats.projSpeed,
          speed: stats.projSpeed,
          damage: stats.damage,
          pierce: stats.pierce,
          knockback: stats.knockback,
          fanBounces: stats.fanBounces,
          life: 2.4,
          stripsCloak: stats.stripsCloak,
        });
        return;
      }
      this.spawnProjectile({
        kind: 'shuriken',
        element: 'air',
        towerId: tower.id,
        x: tower.muzzleX,
        y: tower.muzzleY,
        vx: Math.cos(tower.angle) * stats.projSpeed,
        vy: Math.sin(tower.angle) * stats.projSpeed,
        speed: stats.projSpeed,
        damage: stats.damage,
        pierce: stats.pierce,
        homing: stats.homing,
        life: 2.2,
        statusDuration: stats.statusDuration,
        targetId: target.id,
      });
      return;
    }

    if (tower.element === 'fire') {
      const dist = Math.hypot(pos.x - tower.x, pos.y - tower.y);
      const lead = dist / Math.max(60, stats.projSpeed);
      const lane = s.map.lanes[target.laneIndex];
      const future = lane ? sampleLane(lane, target.distance + target.def.baseSpeed * target.speedFactor * lead) : pos;
      this.spawnProjectile({
        kind: 'lantern',
        element: 'fire',
        towerId: tower.id,
        x: tower.x,
        y: tower.y,
        fromX: tower.x,
        fromY: tower.y,
        toX: future.x,
        toY: future.y,
        lobDur: Math.max(0.28, dist / Math.max(60, stats.projSpeed)),
        speed: stats.projSpeed,
        damage: stats.damage,
        splash: stats.splash,
        statusDuration: stats.statusDuration,
        burnDps: stats.burnDps,
        clusterBombs: stats.clusterBombs,
        ashDuration: stats.ashDuration,
        ashDps: stats.ashDps,
        life: 4,
      });
      return;
    }

    if (tower.element === 'water') {
      if (stats.kind === 'koi') {
        const lane = s.map.lanes[target.laneIndex];
        if (lane) {
          const start = Math.min(lane.length, target.distance + 30);
          this.spawnProjectile({
            kind: 'koi',
            element: 'water',
            towerId: tower.id,
            x: pos.x,
            y: pos.y,
            vx: 0,
            vy: 0,
            speed: 240,
            damage: stats.damage,
            pierce: 8,
            life: 1.2,
            statusDuration: stats.statusDuration,
            splashSlow: stats.slowPct,
            koi: true,
            koiLane: target.laneIndex,
            koiFrom: start,
            koiTo: Math.max(0, start - 220),
            dropsWake: stats.koiWake,
            vortexRadius: stats.vortexRadius,
          });
          return;
        }
      }
      this.spawnProjectile({
        kind: 'crest',
        element: 'water',
        towerId: tower.id,
        x: tower.muzzleX,
        y: tower.muzzleY,
        vx: Math.cos(tower.angle) * stats.projSpeed,
        vy: Math.sin(tower.angle) * stats.projSpeed,
        speed: stats.projSpeed,
        damage: stats.damage,
        pierce: 1,
        life: 2.0,
        ricochets: stats.ricochets,
        statusDuration: stats.statusDuration,
        splashSlow: stats.slowPct,
        targetId: target.id,
        homing: 2.2,
        vortexRadius: stats.vortexRadius,
        freezeOnHits: stats.freezeOnHits,
      });
      return;
    }

    if (tower.element === 'earth') {
      if (stats.kind === 'boulder') {
        const lane = s.map.lanes[target.laneIndex];
        if (lane) {
          this.spawnProjectile({
            kind: 'boulder',
            element: 'earth',
            towerId: tower.id,
            x: pos.x,
            y: pos.y,
            vx: 0,
            vy: 0,
            speed: 130,
            damage: stats.damage,
            pierce: stats.pierce,
            life: 30,
            statusDuration: stats.statusDuration,
            koi: true,
            koiLane: target.laneIndex,
            koiFrom: Math.min(lane.length, target.distance),
            koiTo: lane.length,
            crushLeft: stats.pierce,
          });
          return;
        }
      }
      this.spawnProjectile({
        kind: 'spike',
        element: 'earth',
        towerId: tower.id,
        x: tower.muzzleX,
        y: tower.muzzleY,
        vx: Math.cos(tower.angle) * stats.projSpeed,
        vy: Math.sin(tower.angle) * stats.projSpeed,
        speed: stats.projSpeed,
        damage: stats.damage,
        pierce: 1,
        life: 2.0,
        stun: stats.stun,
        statusDuration: stats.statusDuration,
        clusterBombs: stats.shardCount,
      });
      return;
    }

    // Ink blot.
    const isFifth = stats.voidCube && tower.shotCount % 5 === 4;
    this.spawnProjectile({
      kind: 'blot',
      element: 'ink',
      towerId: tower.id,
      x: tower.muzzleX,
      y: tower.muzzleY,
      vx: Math.cos(tower.angle) * stats.projSpeed,
      vy: Math.sin(tower.angle) * stats.projSpeed,
      speed: stats.projSpeed,
      damage: stats.damage,
      pierce: 1,
      life: 2.0,
      splash: stats.splash,
      statusDuration: stats.statusDuration,
      splashSlow: stats.slowPct,
      clusterBombs: stats.tetherCount,
      targetId: isFifth ? target.id : -1,
      stun: isFifth ? 2.5 : 0,
    });
  }

  // ------------------------------------------------------------- projectiles

  private spawnProjectile(seed: ProjectileSeed): void {
    const p: Projectile = {
      id: this.nextProjectileId++,
      kind: seed.kind,
      element: seed.element,
      towerId: seed.towerId,
      x: seed.x,
      y: seed.y,
      prevX: seed.x,
      prevY: seed.y,
      vx: seed.vx ?? 0,
      vy: seed.vy ?? 0,
      life: seed.life ?? 2,
      damage: seed.damage,
      pierce: seed.pierce ?? 1,
      hitIds: [],
      targetId: seed.targetId ?? -1,
      speed: seed.speed,
      homing: seed.homing ?? 0,
      ricochets: seed.ricochets ?? 0,
      splash: seed.splash ?? 0,
      splashSlow: seed.splashSlow ?? 0,
      statusDuration: seed.statusDuration ?? 0,
      burnDps: seed.burnDps ?? 0,
      knockback: seed.knockback ?? 0,
      stun: seed.stun ?? 0,
      spin: 0,
      lobT: 0,
      lobDur: seed.lobDur ?? 0,
      fromX: seed.fromX ?? seed.x,
      fromY: seed.fromY ?? seed.y,
      toX: seed.toX ?? seed.x,
      toY: seed.toY ?? seed.y,
      fanBounces: seed.fanBounces ?? 0,
      fanWidth: 44,
      retargets: seed.retargets ?? false,
      splits: seed.splits ?? false,
      clusterBombs: seed.clusterBombs ?? 0,
      ashDuration: seed.ashDuration ?? 0,
      ashDps: seed.ashDps ?? 0,
      meltsArmor: seed.meltsArmor ?? false,
      stripsCloak: seed.stripsCloak ?? false,
      dropsWake: seed.dropsWake ?? false,
      dropsPuddle: seed.dropsPuddle ?? false,
      koi: seed.koi ?? false,
      koiLane: seed.koiLane ?? 0,
      koiFrom: seed.koiFrom ?? 0,
      koiTo: seed.koiTo ?? 0,
      koiProgress: 0,
      koiHits: 0,
      crushLeft: seed.crushLeft ?? 0,
      trueDamage: false,
      freezeOnHits: seed.freezeOnHits ?? 0,
      vortexRadius: seed.vortexRadius ?? 0,
    };
    this.state.projectiles.push(p);
  }

  private updateProjectiles(dt: number): void {
    const s = this.state;
    for (let i = s.projectiles.length - 1; i >= 0; i--) {
      const p = s.projectiles[i];
      p.prevX = p.x;
      p.prevY = p.y;
      p.life -= dt;
      p.spin += dt * 14;

      // Lobbed lanterns.
      if (p.kind === 'lantern' || p.kind === 'skyLantern') {
        p.lobT += dt / Math.max(0.01, p.lobDur);
        const f = Math.min(1, p.lobT);
        p.x = p.fromX + (p.toX - p.fromX) * f;
        p.y = p.fromY + (p.toY - p.fromY) * f;
        if (p.lobT >= 1) {
          this.lanternImpact(p);
          s.projectiles.splice(i, 1);
        }
        continue;
      }

      // Lane-following (koi / boulder).
      if (p.koi && (p.kind === 'koi' || p.kind === 'boulder')) {
        const lane = s.map.lanes[p.koiLane];
        if (!lane) {
          s.projectiles.splice(i, 1);
          continue;
        }
        p.koiProgress += p.speed * dt;
        const d =
          p.kind === 'koi'
            ? Math.max(0, p.koiFrom - p.koiProgress)
            : Math.min(lane.length, p.koiFrom + p.koiProgress);
        const sm = sampleLane(lane, d);
        p.x = sm.x;
        p.y = sm.y;
        p.prevX = sm.x;
        p.prevY = sm.y;
        for (const e of s.enemies) {
          if (e.hp <= 0 || e.laneIndex !== p.koiLane || p.hitIds.includes(e.id) || e.hitProjectileIds.includes(p.id)) continue;
          if (Math.abs(e.distance - d) > e.hitRadius + 16) continue;
          p.hitIds.push(e.id);
          if (p.kind === 'koi') {
            p.koiHits++;
            this.strike(e, p);
          } else {
            p.crushLeft--;
            this.strike(e, p);
          }
        }
        const exhausted = p.kind === 'koi' ? p.koiHits >= p.pierce : p.crushLeft <= 0;
        const finished = p.kind === 'koi' ? d <= p.koiTo : d >= lane.length;
        if (exhausted || finished || p.life <= 0) {
          if (p.kind === 'koi' && p.dropsWake) {
            s.ground.push({
              kind: 'wake',
              x: 0,
              y: 0,
              r: 24,
              t: 0,
              dur: 3.0,
              dps: 0,
              slow: 0.35,
              pull: 0,
              dmgTakenBonus: 0.2,
              comboOnlyBonus: true,
              stripsArmor: false,
              laneIndex: p.koiLane,
              from: Math.max(0, p.koiFrom - p.koiProgress),
              to: p.koiFrom,
            });
          }
          if (p.kind === 'boulder') {
            this.splash(p.x, p.y, 70, 180, { element: 'earth', towerId: p.towerId, depth: 1 });
            this.addVfx({ kind: 'ring', x: p.x, y: p.y, t: 0, dur: 0.4, color: '#D4A373', r: 20, r2: 70, angle: 0, points: [], scale: 1, spin: 0, vx: 0, vy: 0 });
          }
          s.projectiles.splice(i, 1);
        }
        continue;
      }

      // Steering for homing projectiles.
      if (p.homing > 0) {
        let target: Enemy | null = null;
        if (p.targetId >= 0) {
          const t = s.enemies.find((e) => e.id === p.targetId && e.hp > 0);
          if (t) target = t;
        }
        if (!target && (p.retargets || p.kind === 'orbDart' || p.kind === 'galeBlade' || p.kind === 'swallow')) {
          target = this.nearestEnemyTo(p.x, p.y, p.hitIds);
        }
        if (target) {
          const tp = this.enemyPos(target);
          const desired = Math.atan2(tp.y - p.y, tp.x - p.x);
          const current = Math.atan2(p.vy, p.vx);
          let diff = desired - current;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = Math.max(-p.homing * dt, Math.min(p.homing * dt, diff));
          const a = current + turn;
          const sp = Math.hypot(p.vx, p.vy) || p.speed;
          p.vx = Math.cos(a) * sp;
          p.vy = Math.sin(a) * sp;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Fan border bounces.
      if (p.kind === 'fan' && p.fanBounces > 0) {
        if ((p.x < 6 && p.vx < 0) || (p.x > 954 && p.vx > 0)) {
          p.vx = -p.vx;
          p.fanBounces--;
          p.x = Math.max(6, Math.min(954, p.x));
        }
        if ((p.y < 6 && p.vy < 0) || (p.y > 594 && p.vy > 0)) {
          p.vy = -p.vy;
          p.fanBounces--;
          p.y = Math.max(6, Math.min(594, p.y));
        }
      }

      // Swept segment-to-circle collisions.
      let remove = false;
      if (p.kind !== 'whirlwind') {
        for (const e of s.enemies) {
          if (e.hp <= 0 || p.hitIds.includes(e.id) || e.hitProjectileIds.includes(p.id)) continue;
          const ep = this.enemyPos(e);
          if (this.segCircle(p.prevX, p.prevY, p.x, p.y, ep.x, ep.y, e.hitRadius + PROJECTILE_HIT_PAD)) {
            p.hitIds.push(e.id);
            p.pierce--;
            this.strike(e, p);
            if (p.kind === 'crest' && p.ricochets > 0) {
              const next = this.nearestEnemyTo(ep.x, ep.y, p.hitIds, 90);
              if (next) {
                const np = this.enemyPos(next);
                const a = Math.atan2(np.y - p.y, np.x - p.x);
                p.vx = Math.cos(a) * p.speed;
                p.vy = Math.sin(a) * p.speed;
                p.ricochets--;
                p.targetId = next.id;
                continue;
              }
            }
            if (p.pierce <= 0) {
              remove = true;
              break;
            }
          }
        }
      } else {
        // Whirlwind: wide slow vortex hitting everything once.
        for (const e of s.enemies) {
          if (e.hp <= 0 || p.hitIds.includes(e.id) || e.hitProjectileIds.includes(p.id)) continue;
          const ep = this.enemyPos(e);
          if (Math.hypot(ep.x - p.x, ep.y - p.y) <= 110 + e.hitRadius) {
            p.hitIds.push(e.id);
            p.pierce--;
            this.strike(e, p);
            if (p.pierce <= 0) {
              remove = true;
              break;
            }
          }
        }
      }

      if (remove) {
        this.onProjectileDeath(p);
        s.projectiles.splice(i, 1);
        continue;
      }
      if (p.life <= 0) {
        this.onProjectileDeath(p);
        s.projectiles.splice(i, 1);
        continue;
      }
      if (p.x < -60 || p.x > 1020 || p.y < -60 || p.y > 660) {
        s.projectiles.splice(i, 1);
      }
    }
  }

  /** Cranes split into two mini-swallows on their final hit or expiry. */
  private onProjectileDeath(p: Projectile): void {
    if (p.kind !== 'crane' || !p.splits) return;
    for (let i = 0; i < 2; i++) {
      this.spawnProjectile({
        kind: 'swallow',
        element: 'air',
        towerId: p.towerId,
        x: p.x,
        y: p.y,
        vx: Math.cos(i === 0 ? 0.6 : -0.6) * 420,
        vy: Math.sin(i === 0 ? 0.6 : -0.6) * 420,
        speed: 420,
        damage: 8,
        pierce: 2,
        homing: 8,
        life: 1.2,
        retargets: true,
      });
    }
  }

  private lanternImpact(p: Projectile): void {
    const s = this.state;
    // Direct splash + burning prime + combo.
    this.splash(p.toX, p.toY, p.splash, p.damage, { element: 'fire', towerId: p.towerId, depth: 0 });
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const ep = this.enemyPos(e);
      if (Math.hypot(ep.x - p.toX, ep.y - p.toY) > p.splash + e.hitRadius) continue;
      if (e.hp > 0) {
        this.tryCombo(e, 'fire', 0);
        e.statuses.fire = { time: p.statusDuration, slow: 0, dps: p.burnDps };
      }
    }
    // Cluster Lotus spark-bombs in a 55px ring.
    for (let i = 0; i < p.clusterBombs; i++) {
      const a = (i / Math.max(1, p.clusterBombs)) * Math.PI * 2 + 0.35;
      const bx = p.toX + Math.cos(a) * SPARK_RING;
      const by = p.toY + Math.sin(a) * SPARK_RING;
      this.splash(bx, by, 36, 14, { element: 'fire', towerId: p.towerId, depth: 1 });
      this.addVfx({ kind: 'ring', x: bx, y: by, t: 0, dur: 0.3, color: '#E63946', r: 8, r2: 36, angle: 0, points: [], scale: 1, spin: 0, vx: 0, vy: 0 });
    }
    // Ash patch.
    if (p.ashDuration > 0) {
      s.ground.push({
        kind: 'ash',
        x: p.toX,
        y: p.toY,
        r: 42,
        t: 0,
        dur: p.ashDuration,
        dps: p.ashDps,
        slow: 0,
        pull: 0,
        dmgTakenBonus: 0,
        comboOnlyBonus: false,
        stripsArmor: false,
        laneIndex: 0,
        from: 0,
        to: 0,
      });
    }
    this.addVfx({ kind: 'ring', x: p.toX, y: p.toY, t: 0, dur: 0.35, color: '#E63946', r: 10, r2: p.splash, angle: 0, points: [], scale: 1, spin: 0, vx: 0, vy: 0 });
  }

  private nearestEnemyTo(x: number, y: number, exclude: number[], maxDist = Infinity): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxDist;
    for (const e of this.state.enemies) {
      if (e.hp <= 0 || e.cloaked || exclude.includes(e.id)) continue;
      const p = this.enemyPos(e);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private segCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number): boolean {
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby;
    let t = 0;
    if (len2 > 0) t = ((cx - ax) * abx + (cy - ay) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const dx = ax + abx * t - cx;
    const dy = ay + aby * t - cy;
    return dx * dx + dy * dy <= r * r;
  }

  // ------------------------------------------------------------- combat core

  /** A projectile strikes an enemy: damage, elemental prime, combos, extras. */
  private strike(e: Enemy, p: Projectile): void {
    if (e.hp <= 0) return;
    let damage = p.damage;
    // Crystal Prism crit vs statused targets.
    if (p.kind === 'shard') {
      const statused =
        (e.statuses.water?.time ?? 0) > 0 || (e.statuses.ink?.time ?? 0) > 0 || (e.statuses.earth?.time ?? 0) > 0;
      if (statused) damage *= 2;
    }
    this.applyDamage(e, damage, { element: p.element, towerId: p.towerId, projId: p.id, trueDamage: p.trueDamage, depth: 0 });
    if (p.stun > 0 && e.hp > 0 && p.kind !== 'blot') this.applyStun(e, p.stun);
    if (p.knockback > 0 && e.hp > 0) this.applyKnockback(e, p.knockback);
    if (p.stripsCloak && e.hp > 0) e.cloaked = false;
    if (e.hp <= 0) return;

    // Glacial Lotus: soak-hit counting.
    if (p.element === 'water' && p.freezeOnHits > 0 && (e.statuses.water?.time ?? 0) > 0 && e.frozen <= 0) {
      e.lotusHits++;
      if (e.lotusHits >= p.freezeOnHits) {
        e.lotusHits = 0;
        this.applyFreeze(e, 1.8, 'lotus');
        const pos = this.enemyPos(e);
        this.addCallout(pos.x, pos.y - 22, 'FROZEN!', '#90E0EF');
      }
    }

    // Elemental strike: combo check, then prime.
    this.tryCombo(e, p.element, 0);
    if (e.hp <= 0) return;
    this.primeFromProjectile(e, p);

    // Ink Tendrils (B2+) or Void Cube (B4) on direct hits.
    if (p.kind === 'blot' && p.clusterBombs > 0 && p.stun === 0) {
      this.linkTethers(e, p.clusterBombs, this.towerHasBind(p.towerId));
    }
    if (p.kind === 'blot' && p.stun > 0) {
      this.applyFreeze(e, p.stun, 'cube');
      const pos = this.enemyPos(e);
      this.addCallout(pos.x, pos.y - 22, 'VOID CUBE!', '#1D1E2C');
    }

    // Ink splash: stain + strip shrouds in splash radius.
    if (p.splash > 0) {
      const pos = this.enemyPos(e);
      for (const other of this.state.enemies) {
        if (other.hp <= 0 || other.id === e.id) continue;
        const op = this.enemyPos(other);
        if (Math.hypot(op.x - pos.x, op.y - pos.y) > p.splash + other.hitRadius) continue;
        this.applyDamage(other, p.damage, { element: p.element, towerId: p.towerId, depth: 1 });
        if (other.hp > 0) {
          this.tryCombo(other, p.element, 1);
          if (other.hp > 0) this.primeFromProjectile(other, p);
          if (p.element === 'ink') other.cloaked = false;
        }
      }
      this.addVfx({ kind: 'ring', x: pos.x, y: pos.y, t: 0, dur: 0.3, color: RESONANCE_INK, r: 8, r2: p.splash, angle: 0, points: [], scale: 1, spin: 0, vx: 0, vy: 0 });
    }

    // Crystal Prism shards behind the target.
    if (p.kind === 'spike' && p.clusterBombs > 0) {
      const pos = this.enemyPos(e);
      const baseAngle = Math.atan2(pos.y - this.towerY(p.towerId), pos.x - this.towerX(p.towerId));
      for (let i = 0; i < p.clusterBombs; i++) {
        const a = baseAngle + ((i + 0.5) / p.clusterBombs - 0.5) * (70 * Math.PI) / 180;
        this.spawnProjectile({
          kind: 'shard',
          element: 'earth',
          towerId: p.towerId,
          x: pos.x,
          y: pos.y,
          vx: Math.cos(a) * 300,
          vy: Math.sin(a) * 300,
          speed: 300,
          damage: 18,
          pierce: 1,
          life: SHARD_RANGE_LIFE,
        });
      }
    }

    // Calligraphy Gale blades drop mini puddles.
    if (p.kind === 'galeBlade' && p.dropsPuddle) {
      const pos = this.enemyPos(e);
      this.state.ground.push({
        kind: 'miniPuddle',
        x: pos.x,
        y: pos.y,
        r: 28,
        t: 0,
        dur: 1.5,
        dps: 0,
        slow: 0.35,
        pull: 0,
        dmgTakenBonus: 0,
        comboOnlyBonus: false,
        stripsArmor: false,
        laneIndex: 0,
        from: 0,
        to: 0,
      });
    }

    // Water impacts (crest / koi) spawn Paper Whirlpools.
    if ((p.kind === 'crest' || p.kind === 'koi') && p.vortexRadius > 0) {
      const pos = this.enemyPos(e);
      const lane = this.state.map.lanes[e.laneIndex];
      if (lane) {
        const along = nearestLanePoint([lane], pos.x, pos.y);
        this.state.ground.push({
          kind: 'whirlpool',
          x: pos.x,
          y: pos.y,
          r: p.vortexRadius,
          t: 0,
          dur: 2.0,
          dps: 10,
          slow: 0,
          pull: 45,
          dmgTakenBonus: this.towerHasVuln(p.towerId) ? 0.25 : 0,
          comboOnlyBonus: false,
          stripsArmor: false,
          laneIndex: e.laneIndex,
          from: along.along,
          to: 0,
        });
      }
    }
  }

  private primeFromProjectile(e: Enemy, p: Projectile): void {
    switch (p.element) {
      case 'air':
        if (p.statusDuration > 0) e.statuses.air = { time: p.statusDuration, slow: 0, dps: 0 };
        break;
      case 'fire':
        e.statuses.fire = { time: p.statusDuration || 3, slow: 0, dps: p.burnDps || 6 };
        break;
      case 'water':
        e.statuses.water = { time: p.statusDuration || 3.5, slow: p.splashSlow || 0.25, dps: 0 };
        if (e.cloaked) e.cloaked = false;
        break;
      case 'earth':
        if (p.statusDuration > 0) e.statuses.earth = { time: p.statusDuration, slow: 0, dps: 0 };
        break;
      case 'ink':
        e.statuses.ink = { time: p.statusDuration || 4, slow: p.splashSlow || 0.45, dps: 0 };
        e.cloaked = false;
        break;
      default:
        break;
    }
  }

  private primeStatus(e: Enemy, element: Element, stats: TowerStats): void {
    switch (element) {
      case 'air':
        e.statuses.air = { time: stats.statusDuration || 3, slow: 0, dps: 0 };
        break;
      case 'fire':
        e.statuses.fire = { time: stats.statusDuration || 3, slow: 0, dps: stats.burnDps || 6 };
        break;
      case 'water':
        e.statuses.water = { time: stats.statusDuration || 3.5, slow: stats.slowPct || 0.25, dps: 0 };
        if (e.cloaked) e.cloaked = false;
        break;
      case 'earth':
        e.statuses.earth = { time: stats.statusDuration || 3, slow: 0, dps: 0 };
        break;
      case 'ink':
        e.statuses.ink = { time: stats.statusDuration || 4, slow: stats.slowPct || 0.45, dps: 0 };
        e.cloaked = false;
        break;
      default:
        break;
    }
  }

  private linkTethers(target: Enemy, count: number, bound: boolean): void {
    const s = this.state;
    const tpos = this.enemyPos(target);
    const group: Enemy[] = [target];
    for (const e of s.enemies) {
      if (group.length >= count + 1) break;
      if (e.hp <= 0 || e.id === target.id) continue;
      const pos = this.enemyPos(e);
      if (Math.hypot(pos.x - tpos.x, pos.y - tpos.y) <= 95) group.push(e);
    }
    const ids = group.map((g) => g.id);
    for (const g of group) {
      g.tetherIds = ids.filter((id) => id !== g.id);
      g.tetherTime = 3.5;
      g.tetherBound = bound;
    }
    for (let i = 1; i < group.length; i++) {
      const a = this.enemyPos(group[0]);
      const b = this.enemyPos(group[i]);
      this.addVfx({ kind: 'inkSplash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0, dur: 0.5, color: 'rgba(29,30,44,0.5)', r: 10, r2: 0, angle: 0, points: [{ x: 4, y: 2 }, { x: -3, y: 5 }, { x: 5, y: -4 }], scale: 1, spin: 0, vx: 0, vy: 0 });
    }
  }

  private towerHasBind(towerId: number): boolean {
    const tower = this.state.towers.find((t) => t.id === towerId);
    if (!tower) return false;
    return computeTowerStats(tower.element, tower.tierA, tower.tierB).tetherBind;
  }

  private towerHasVuln(towerId: number): boolean {
    const tower = this.state.towers.find((t) => t.id === towerId);
    if (!tower) return false;
    return computeTowerStats(tower.element, tower.tierA, tower.tierB).vortexVuln;
  }

  private towerX(towerId: number): number {
    return this.state.towers.find((t) => t.id === towerId)?.x ?? 480;
  }

  private towerY(towerId: number): number {
    return this.state.towers.find((t) => t.id === towerId)?.y ?? 300;
  }

  /** Two-element seal reaction: consumes both statuses, cooldown 1.2s. */
  private tryCombo(enemy: Enemy, newElement: Element, depth: number): void {
    if (depth > COMBO_RECURSION_DEPTH) return;
    if (enemy.reactionCooldown > 0) return;
    let found: Element | null = null;
    for (const key of Object.keys(enemy.statuses) as Element[]) {
      if (key === newElement) continue;
      if ((enemy.statuses[key]?.time ?? 0) > 0) {
        found = key;
        break;
      }
    }
    if (!found) return;
    const combo = comboFor(found, newElement);
    if (!combo) return;
    delete enemy.statuses[found];
    delete enemy.statuses[newElement];
    enemy.reactionCooldown = COMBO_REACTION_COOLDOWN;
    this.runCombo(combo, enemy, depth + 1);
  }

  private runCombo(combo: ComboDef, enemy: Enemy, depth: number): void {
    const s = this.state;
    const w = s.waveIndex;
    const pos = this.enemyPos(enemy);
    const idx = COMBOS.indexOf(combo);

    // VFX + audio + micro screen shake.
    this.addVfx({ kind: 'stamp', x: pos.x, y: pos.y, t: 0, dur: 0.75, text: combo.kanji, color: '#C1121F', r: 30, r2: 0, angle: 0, points: [], scale: 1, spin: 0, vx: 0, vy: 0 });
    this.addVfx({ kind: 'ring', x: pos.x, y: pos.y, t: 0, dur: 0.4, color: '#C1121F', r: 14, r2: 60, angle: 0, points: [], scale: 1, spin: 0, vx: 0, vy: 0 });
    this.addCallout(pos.x, pos.y - 30, combo.callout, comboColor(combo.id));
    s.shake = Math.max(s.shake, 3);
    if (this.comboSoundStep !== Math.floor(s.time * 60)) {
      this.comboSoundStep = Math.floor(s.time * 60);
      sound.combo(Math.max(0, idx));
    }

    // One-time discovery bonus per run + permanent codex entry.
    if (!s.discoveredRun.includes(combo.id)) {
      s.discoveredRun.push(combo.id);
      s.ink += COMBO_DISCOVERY_BONUS;
      s.score += COMBO_DISCOVERY_BONUS;
      s.stats.inkEarned += COMBO_DISCOVERY_BONUS;
      this.addCallout(pos.x, pos.y - 48, `DISCOVERED +${COMBO_DISCOVERY_BONUS}`, '#C9A227');
      if (!this.codex.includes(combo.id)) {
        this.codex.push(combo.id);
        saveCodex(this.codex);
        s.stats.discovered = this.codex.slice();
      }
      this.notify();
    }

    switch (combo.id) {
      case 'water_fire': {
        // Scalding Steam
        this.splash(pos.x, pos.y, 85, 45 + 6 * w, { depth });
        for (const e of s.enemies) {
          if (e.hp <= 0) continue;
          const ep = this.enemyPos(e);
          if (Math.hypot(ep.x - pos.x, ep.y - pos.y) <= 85 + e.hitRadius) {
            e.extraSlow = Math.max(e.extraSlow, 0.4);
            e.extraSlowT = 2.5;
          }
        }
        break;
      }
      case 'water_air': {
        // Monsoon Squall
        let chains = 0;
        let cx = pos.x;
        let cy = pos.y;
        const hit = new Set<number>([enemy.id]);
        while (chains < 5) {
          const next = this.nearestEnemyTo(cx, cy, Array.from(hit), 110);
          if (!next) break;
          hit.add(next.id);
          const np = this.enemyPos(next);
          this.addVfx({ kind: 'chainArc', x: 0, y: 0, t: 0, dur: 0.3, color: '#3A86FF', r: 0, r2: 0, angle: 0, points: [{ x: cx, y: cy }, { x: np.x, y: np.y }], scale: 1, spin: 0, vx: 0, vy: 0 });
          this.applyDamage(next, 35 + 4 * w, { element: null, depth });
          cx = np.x;
          cy = np.y;
          chains++;
        }
        break;
      }
      case 'water_earth': {
        // Mudslide
        if (enemy.def.boss) {
          enemy.extraSlow = Math.max(enemy.extraSlow, BOSS_SLOW_CAP);
          enemy.extraSlowT = 1.3;
        } else {
          enemy.rooted = Math.max(enemy.rooted, 1.3);
        }
        enemy.armorStripped = true;
        this.applyDamage(enemy, 40 + 5 * w, { element: null, depth });
        break;
      }
      case 'water_ink': {
        // Spreading Wash
        for (const e of s.enemies) {
          if (e.hp <= 0) continue;
          const ep = this.enemyPos(e);
          if (Math.hypot(ep.x - pos.x, ep.y - pos.y) > 115 + e.hitRadius) continue;
          e.statuses.water = { time: 3.5, slow: 0.25, dps: 0 };
          e.statuses.ink = { time: 4, slow: 0.45, dps: 0 };
          this.applyDamage(e, 25, { element: null, depth });
        }
        break;
      }
      case 'fire_air': {
        // Firestorm
        this.splash(pos.x, pos.y, 80, 50 + 6 * w, { depth });
        for (const e of s.enemies) {
          if (e.hp <= 0) continue;
          const ep = this.enemyPos(e);
          if (Math.hypot(ep.x - pos.x, ep.y - pos.y) <= 80 + e.hitRadius) {
            this.applyKnockback(e, 35);
          }
        }
        enemy.statuses.fire = { time: 3, slow: 0, dps: 6 };
        break;
      }
      case 'fire_earth': {
        // Molten Slag
        s.ground.push({
          kind: 'magma',
          x: pos.x,
          y: pos.y,
          r: 65,
          t: 0,
          dur: 4.0,
          dps: 28 + 3 * w,
          slow: 0,
          pull: 0,
          dmgTakenBonus: 0,
          comboOnlyBonus: false,
          stripsArmor: false,
          laneIndex: 0,
          from: 0,
          to: 0,
        });
        break;
      }
      case 'fire_ink': {
        // Scorched Lacquer
        this.applyDamage(enemy, 75 + 9 * w, { trueDamage: true, depth });
        this.addVfx({ kind: 'inkSplash', x: pos.x, y: pos.y, t: 0, dur: 0.6, color: 'rgba(29,30,44,0.7)', r: 16, r2: 0, angle: 0, points: [{ x: 8, y: 3 }, { x: -6, y: 9 }, { x: 10, y: -8 }], scale: 1, spin: 0, vx: 0, vy: 0 });
        break;
      }
      case 'air_earth': {
        // Sandstorm Shrapnel
        const base = Math.random() * Math.PI * 2;
        for (let i = 0; i < 6; i++) {
          const a = base + ((i + 0.5) / 6 - 0.5) * (Math.PI / 2);
          this.spawnProjectile({
            kind: 'needle',
            element: 'earth',
            towerId: -1,
            x: pos.x,
            y: pos.y,
            vx: Math.cos(a) * 260,
            vy: Math.sin(a) * 260,
            speed: 260,
            damage: 16 + 2 * w,
            pierce: 1,
            life: 0.6,
          });
        }
        break;
      }
      case 'air_ink': {
        // Calligraphy Gale
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          this.spawnProjectile({
            kind: 'galeBlade',
            element: 'air',
            towerId: -1,
            x: pos.x,
            y: pos.y,
            vx: Math.cos(a) * 280,
            vy: Math.sin(a) * 280,
            speed: 280,
            damage: 24 + 3 * w,
            pierce: 1,
            homing: 5,
            life: 1.4,
            retargets: true,
            dropsPuddle: true,
          });
        }
        break;
      }
      case 'earth_ink': {
        // Petrified Seal
        this.applyFreeze(enemy, 1.6, 'petrify');
        break;
      }
      default:
        break;
    }
  }

  private applyDamage(enemy: Enemy, amount: number, opts: DamageOpts): number {
    if (this.destroyed || enemy.hp <= 0 || amount <= 0) return 0;
    let amt = amount;

    // Status amplifiers.
    if ((enemy.statuses.earth?.time ?? 0) > 0) amt *= 1.15; // Fractured
    if (enemy.frozenBy === 'petrify' && enemy.frozen > 0) amt *= 1.5;
    if (enemy.vulnAll > 0) amt *= 1 + enemy.vulnAll;
    if (opts.isCombo && enemy.vulnCombo > 0) amt *= 1 + enemy.vulnCombo;

    if (!opts.trueDamage) {
      let reduction = 0;
      if (enemy.def.armored && !enemy.armorStripped) reduction += 0.5;
      reduction += 0.15 * enemy.armorLevel;
      if (reduction > 0 && (opts.element === 'air' || opts.element === 'water')) {
        amt *= 1 - Math.min(0.85, reduction);
      }
      if (opts.element === 'earth' && enemy.def.armored && !enemy.armorStripped) {
        amt *= 2; // +100% vs Armor
      }
    }

    // Glacial Lotus shatter on the next hit while frozen.
    if (enemy.frozen > 0 && enemy.frozenBy === 'lotus') {
      enemy.frozen = 0;
      enemy.frozenBy = null;
      enemy.lotusHits = 0;
      const pos = this.enemyPos(enemy);
      this.splash(pos.x, pos.y, 64, 110, { depth: opts.depth + 1 });
      this.addCallout(pos.x, pos.y - 26, 'SHATTER!', '#90E0EF');
      this.addVfx({ kind: 'ring', x: pos.x, y: pos.y, t: 0, dur: 0.4, color: '#9FD8F2', r: 12, r2: 64, angle: 0, points: [], scale: 1, spin: 0, vx: 0, vy: 0 });
    }

    enemy.hp -= amt;
    enemy.flash = 0.12;
    if (opts.towerId && opts.towerId > 0) {
      const tower = this.state.towers.find((t) => t.id === opts.towerId);
      if (tower) tower.damageDealt += amt;
    }

    // Tether damage sharing (40% to each linked enemy).
    if (!opts.noShare && enemy.tetherIds.length > 0 && enemy.tetherTime > 0) {
      for (const id of enemy.tetherIds) {
        const other = this.state.enemies.find((e) => e.id === id && e.hp > 0);
        if (!other) continue;
        this.applyDamage(other, amt * 0.4, { ...opts, depth: opts.depth + 1, noShare: true, element: null, isCombo: false });
      }
    }

    if (enemy.hp <= 0) {
      this.killEnemy(enemy, opts.projId ?? -1, opts.towerId ?? -1);
    }
    return amt;
  }

  private splash(x: number, y: number, radius: number, amount: number, opts: DamageOpts): void {
    for (const e of this.state.enemies) {
      if (e.hp <= 0) continue;
      const pos = this.enemyPos(e);
      if (Math.hypot(pos.x - x, pos.y - y) > radius + e.hitRadius) continue;
      this.applyDamage(e, amount, opts);
    }
  }

  private killEnemy(enemy: Enemy, projId: number, towerId: number): void {
    if (this.killed.has(enemy.id)) return;
    this.killed.add(enemy.id);
    const s = this.state;
    s.ink += enemy.bounty;
    s.score += enemy.bounty;
    s.stats.inkEarned += enemy.bounty;
    s.stats.kills++;
    const tower = towerId > 0 ? s.towers.find((t) => t.id === towerId) : undefined;
    if (tower) tower.kills++;
    sound.pop();

    const pos = this.enemyPos(enemy);
    const points: Vec2[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random();
      points.push({ x: Math.cos(a) * (10 + Math.random() * 14), y: Math.sin(a) * (10 + Math.random() * 14) });
    }
    this.addVfx({ kind: 'confetti', x: pos.x, y: pos.y, t: 0, dur: 0.8, color: enemy.def.boss ? '#C1121F' : '#EDE4CE', r: 0, r2: 0, angle: 0, points, scale: 1, spin: Math.random() * 3, vx: 0, vy: 0 });
    this.addVfx({ kind: 'inkSplash', x: pos.x, y: pos.y, t: 0, dur: 0.5, color: 'rgba(26,25,24,0.35)', r: 9, r2: 0, angle: 0, points: [{ x: 7, y: 3 }, { x: -5, y: 8 }, { x: 9, y: -6 }], scale: 1, spin: 0, vx: 0, vy: 0 });

    // Safe child-layer spawn: at parent distance +/- 6px, clamped >= 0,
    // inheriting the killing projectile id so pierce can't double-hit.
    if (!enemy.tetherBound) {
      for (const peel of enemy.def.peelsInto) {
        for (let i = 0; i < peel.count; i++) {
          const offset = i % 2 === 0 ? 6 : -6;
          const child = this.spawnEnemyRaw(peel.kind, enemy.laneIndex, Math.max(0, enemy.distance + offset));
          if (projId > 0) child.hitProjectileIds.push(projId);
        }
      }
    }
    this.notify();
  }

  private applyKnockback(enemy: Enemy, px: number): void {
    if (px <= 0) return;
    if (enemy.def.boss) return;
    if (enemy.def.immuneKnockbackBelow > 0 && px < enemy.def.immuneKnockbackBelow) return;
    enemy.distance = Math.max(0, enemy.distance - px);
  }

  private applyStun(enemy: Enemy, dur: number): void {
    if (enemy.def.boss) {
      enemy.extraSlow = Math.max(enemy.extraSlow, BOSS_SLOW_CAP);
      enemy.extraSlowT = Math.max(enemy.extraSlowT, dur);
      return;
    }
    enemy.rooted = Math.max(enemy.rooted, dur);
  }

  private applyFreeze(enemy: Enemy, dur: number, by: 'lotus' | 'petrify' | 'cube'): void {
    if (enemy.def.boss) {
      enemy.extraSlow = Math.max(enemy.extraSlow, BOSS_SLOW_CAP);
      enemy.extraSlowT = Math.max(enemy.extraSlowT, dur);
      return;
    }
    enemy.frozen = Math.max(enemy.frozen, dur);
    enemy.frozenBy = by;
  }

  // ------------------------------------------------------------- ground + vfx

  private updateGround(dt: number): void {
    const s = this.state;
    if (s.ground.length === 0) return;
    s.ground = s.ground.filter((g) => {
      g.t += dt;
      return g.t < g.dur;
    });
  }

  private updateVfx(dt: number): void {
    const s = this.state;
    if (s.vfx.length === 0) return;
    s.vfx = s.vfx.filter((v) => {
      v.t += dt;
      return v.t < v.dur;
    });
  }

  private addVfx(partial: Partial<Vfx> & Pick<Vfx, 'kind' | 'x' | 'y' | 'dur'>): void {
    const vfx: Vfx = {
      kind: partial.kind,
      x: partial.x,
      y: partial.y,
      vx: partial.vx ?? 0,
      vy: partial.vy ?? 0,
      t: partial.t ?? 0,
      dur: partial.dur,
      text: partial.text ?? '',
      color: partial.color ?? '',
      r: partial.r ?? 0,
      r2: partial.r2 ?? 0,
      angle: partial.angle ?? 0,
      points: partial.points ?? [],
      scale: partial.scale ?? 1,
      spin: partial.spin ?? 0,
    };
    this.state.vfx.push(vfx);
  }

  private addCallout(x: number, y: number, text: string, color: string): void {
    this.addVfx({
      kind: 'callout',
      x,
      y,
      t: 0,
      dur: 1.1,
      text,
      color,
      r: 0,
      r2: 0,
      angle: 0,
      points: [],
      scale: 1,
      spin: Math.random() * 4 - 2,
    });
  }

  private addPoof(x: number, y: number): void {
    this.addVfx({ kind: 'poof', x, y, t: 0, dur: 0.5, color: '', r: 0, r2: 0, angle: 0, points: [], scale: 1, spin: Math.random() * 3 });
  }
}

const RESONANCE_INK = '#1D1E2C';

function comboColor(id: string): string {
  switch (id) {
    case 'water_fire':
      return '#E8632C';
    case 'water_air':
      return '#3A86FF';
    case 'water_earth':
      return '#8D7748';
    case 'water_ink':
      return '#5C5F73';
    case 'fire_air':
      return '#E63946';
    case 'fire_earth':
      return '#C98A2D';
    case 'fire_ink':
      return '#1D1E2C';
    case 'air_earth':
      return '#C2A76C';
    case 'air_ink':
      return '#2A9D8F';
    case 'earth_ink':
      return '#D4A373';
    default:
      return '#C1121F';
  }
}

/** Element reference for the codex modal (labels + status descriptions). */
export function elementReference(): { element: Element; label: string; kanji: string; color: string; statusName: string; statusDesc: string }[] {
  return (Object.keys(ELEMENT_META) as Element[]).map((el) => ({
    element: el,
    label: ELEMENT_META[el].label,
    kanji: ELEMENT_META[el].kanji,
    color: ELEMENT_META[el].color,
    statusName: ELEMENT_META[el].statusName,
    statusDesc: ELEMENT_META[el].statusDesc,
  }));
}
