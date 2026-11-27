import {
  COMBO_DEFINITIONS,
  DIFFICULTY_SPECS,
  ENEMY_SPECS,
  getOverclockBonus,
  getSalvageValue,
  getScaledUpgradeCost,
  getWaveClearBonus,
  getWaveHpMultiplier,
  getWaveSpeedMultiplier,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  RESONANCE_MAX_DIST,
  resolveComboId,
  TOWER_SPECS,
} from './constants';
import {
  findNearestTrackPoint,
  getPrecomputedMap,
  sampleLaneAtDistance,
  validateTowerPlacement,
} from './maps';
import { soundManager } from './sound';
import {
  ComboId,
  CorruptedModifierId,
  DifficultyId,
  ElementType,
  EnemyEntity,
  EnemyType,
  EngineSnapshot,
  FloatingCallout,
  GroundZoneEntity,
  HighScoreRecord,
  MapId,
  PaperConfetti,
  PrecomputedMapData,
  ProjectileEntity,
  QueuedSpawn,
  ResonanceLink,
  StatusEffectType,
  TargetingMode,
  TowerEntity,
  VisualEffect,
} from './types';
import { getEndlessModifierForWave, getWaveSpawnQueue } from './waves';

const STORAGE_CODEX_KEY = 'runic_origami_codex_v1';
const STORAGE_SCORES_KEY = 'runic_origami_highscores_v1';

export function loadDiscoveredCombos(): ComboId[] {
  try {
    const raw = localStorage.getItem(STORAGE_CODEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ComboId[]) : [];
  } catch {
    return [];
  }
}

export function saveDiscoveredCombos(combos: ComboId[]): void {
  try {
    localStorage.setItem(STORAGE_CODEX_KEY, JSON.stringify(combos));
  } catch {
    // ignore storage errors
  }
}

export function loadHighScores(): HighScoreRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_SCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HighScoreRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveHighScore(record: HighScoreRecord): void {
  try {
    const all = loadHighScores();
    const idx = all.findIndex(
      (r) => r.mapId === record.mapId && r.difficultyId === record.difficultyId
    );
    if (idx >= 0) {
      const existing = all[idx];
      if (
        record.highestWave > existing.highestWave ||
        (record.highestWave === existing.highestWave &&
          record.totalKills > existing.totalKills)
      ) {
        all[idx] = {
          ...record,
          victoryAchieved: existing.victoryAchieved || record.victoryAchieved,
        };
      } else if (record.victoryAchieved && !existing.victoryAchieved) {
        all[idx].victoryAchieved = true;
      }
    } else {
      all.push(record);
    }
    localStorage.setItem(STORAGE_SCORES_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

function segmentIntersectsCircle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) {
    return Math.hypot(cx - x1, cy - y1) <= r;
  }
  let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nearX = x1 + t * dx;
  const nearY = y1 + t * dy;
  return Math.hypot(cx - nearX, cy - nearY) <= r;
}

export class GameEngine {
  public mapId: MapId;
  public difficultyId: DifficultyId;
  public mapData: PrecomputedMapData;

  public wave = 0;
  public targetWaves: number;
  public lives: number;
  public maxLives: number;
  public ink: number;
  public waveActive = false;
  public waveElapsed = 0;
  public speedMultiplier: 1 | 2 | 3 = 1;
  public isPaused = false;
  public autoNextWave = false;
  public gameState: 'playing' | 'victory_prompt' | 'endless' | 'defeat' = 'playing';
  public activeModifier: CorruptedModifierId | null = null;

  public selectedTowerId: string | null = null;
  public placingElement: ElementType | null = null;

  public towers: TowerEntity[] = [];
  public enemies: EnemyEntity[] = [];
  public projectiles: ProjectileEntity[] = [];
  public groundZones: GroundZoneEntity[] = [];
  public visualEffects: VisualEffect[] = [];
  public callouts: FloatingCallout[] = [];
  public confetti: PaperConfetti[] = [];
  public spawnQueue: QueuedSpawn[] = [];
  public resonanceLinks: ResonanceLink[] = [];

  public discoveredCombos: Set<ComboId>;
  public runDiscoveredCombos: Set<ComboId> = new Set();
  public runCombosTriggered = 0;
  public totalKills = 0;
  public totalDamageDealt = 0;

  public screenShakeTimer = 0;
  public screenShakeIntensity = 0;

  public recentComboBanner: {
    name: string;
    kanji: string;
    color: string;
    isNewDiscovery: boolean;
    timer: number;
  } | null = null;

  private idCounter = 1;
  private onChangeCallback: (() => void) | null = null;
  private destroyed = false;

  constructor(mapId: MapId, difficultyId: DifficultyId, onChange?: () => void) {
    this.mapId = mapId;
    this.difficultyId = difficultyId;
    this.mapData = getPrecomputedMap(mapId);
    this.onChangeCallback = onChange ?? null;

    const diff = DIFFICULTY_SPECS[difficultyId];
    this.targetWaves = diff.targetWaves;
    this.lives = diff.startingLives;
    this.maxLives = diff.startingLives;
    this.ink = diff.startingInk;

    this.discoveredCombos = new Set<ComboId>(loadDiscoveredCombos());
  }

  private nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}_${this.idCounter}`;
  }

  public notify(): void {
    if (!this.destroyed && this.onChangeCallback) {
      this.onChangeCallback();
    }
  }

  public destroy(): void {
    this.destroyed = true;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.groundZones = [];
    this.visualEffects = [];
    this.callouts = [];
    this.confetti = [];
    this.spawnQueue = [];
    soundManager.silenceAll();
  }

  public getTowerEffectiveRange(tower: TowerEntity, extraPreviewBonus = 0): number {
    const spec = TOWER_SPECS[tower.element];
    let range = spec.range;
    for (let i = 0; i < tower.tierA; i++) {
      range += spec.pathA[i].rangeBonus ?? 0;
    }
    for (let i = 0; i < tower.tierB; i++) {
      range += spec.pathB[i].rangeBonus ?? 0;
    }
    range += extraPreviewBonus;
    if (tower.inConduit) {
      range *= 1.15;
    }
    return Math.round(range);
  }

  public getTowerFireRate(tower: TowerEntity): number {
    const spec = TOWER_SPECS[tower.element];
    let rate = spec.fireRate;
    if (tower.element === 'air' && tower.tierA >= 4) {
      rate *= 2.0;
    }
    if (tower.element === 'earth' && tower.tierB >= 1) {
      rate = 0.85;
    }
    if (tower.element === 'ink' && tower.tierB >= 1) {
      rate = 1.3;
    }
    return rate;
  }

  public canPlaceTowerAt(x: number, y: number): { valid: boolean; reason?: string; inConduit: boolean } {
    return validateTowerPlacement(this.mapData, this.towers, x, y);
  }

  public placeTower(element: ElementType, x: number, y: number): boolean {
    if (this.gameState === 'defeat') return false;
    const spec = TOWER_SPECS[element];
    if (this.ink < spec.cost) return false;

    const check = this.canPlaceTowerAt(x, y);
    if (!check.valid) return false;

    this.ink -= spec.cost;
    const tower: TowerEntity = {
      id: this.nextId('twr'),
      element,
      x,
      y,
      tierA: 0,
      tierB: 0,
      targeting: 'first',
      totalInvested: spec.cost,
      kills: 0,
      damageDealt: 0,
      cooldown: 0.1,
      specialTimer: 1.5,
      shotCounter: 0,
      angle: 0,
      inConduit: check.inConduit,
      orbiters: [],
      laserTargetId: null,
      coneActiveTimer: 0,
      pulseAnim: 1.0,
    };

    this.towers.push(tower);
    this.selectedTowerId = tower.id;
    this.placingElement = null;
    this.recomputeResonanceLinks();
    soundManager.playTowerPlace();

    this.visualEffects.push({
      id: this.nextId('vfx'),
      kind: 'ring',
      x,
      y,
      radius: 12,
      maxRadius: 46,
      color: spec.waxColor,
      life: 0.35,
      maxLife: 0.35,
    });

    this.notify();
    return true;
  }

  public recomputeResonanceLinks(): void {
    const links: ResonanceLink[] = [];
    for (let i = 0; i < this.towers.length; i++) {
      for (let j = i + 1; j < this.towers.length; j++) {
        const a = this.towers[i];
        const b = this.towers[j];
        if (a.element === b.element) continue;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist <= RESONANCE_MAX_DIST) {
          const comboId = resolveComboId(a.element, b.element);
          if (comboId) {
            links.push({
              fromTowerId: a.id,
              toTowerId: b.id,
              x1: a.x,
              y1: a.y,
              x2: b.x,
              y2: b.y,
              comboId,
              color: COMBO_DEFINITIONS[comboId].color,
            });
          }
        }
      }
    }
    this.resonanceLinks = links;
  }

  public canUpgradeTower(tower: TowerEntity, path: 'A' | 'B'): {
    allowed: boolean;
    sealed: boolean;
    cost: number;
    nextTier: 1 | 2 | 3 | 4 | null;
  } {
    const spec = TOWER_SPECS[tower.element];
    const diffMult = DIFFICULTY_SPECS[this.difficultyId].upgradeCostMultiplier;
    const currentTier = path === 'A' ? tower.tierA : tower.tierB;
    const oppositeTier = path === 'A' ? tower.tierB : tower.tierA;

    if (currentTier >= 4) {
      return { allowed: false, sealed: false, cost: 0, nextTier: null };
    }

    const nextTier = (currentTier + 1) as 1 | 2 | 3 | 4;
    // Strict 4-2 Cross-Path Rule
    if (nextTier >= 3 && oppositeTier >= 3) {
      const tierSpec = path === 'A' ? spec.pathA[nextTier - 1] : spec.pathB[nextTier - 1];
      return {
        allowed: false,
        sealed: true,
        cost: getScaledUpgradeCost(tierSpec.baseCost, diffMult),
        nextTier,
      };
    }

    const tierSpec = path === 'A' ? spec.pathA[nextTier - 1] : spec.pathB[nextTier - 1];
    const cost = getScaledUpgradeCost(tierSpec.baseCost, diffMult);
    return {
      allowed: this.ink >= cost,
      sealed: false,
      cost,
      nextTier,
    };
  }

  public upgradeTower(towerId: string, path: 'A' | 'B'): boolean {
    const tower = this.towers.find((t) => t.id === towerId);
    if (!tower) return false;

    const check = this.canUpgradeTower(tower, path);
    if (!check.allowed || check.sealed || !check.nextTier) return false;

    this.ink -= check.cost;
    tower.totalInvested += check.cost;
    if (path === 'A') {
      tower.tierA = check.nextTier;
    } else {
      tower.tierB = check.nextTier;
    }
    tower.pulseAnim = 1.0;

    // Configure Earth Path B Orbiting Polyhedrons
    if (tower.element === 'earth' && tower.tierB >= 2) {
      const count = tower.tierB >= 4 ? 6 : 3;
      tower.orbiters = Array.from({ length: count }, (_, idx) => ({
        angle: (idx * Math.PI * 2) / count,
        hitCooldowns: {},
      }));
    }

    soundManager.playUpgrade();
    this.visualEffects.push({
      id: this.nextId('vfx'),
      kind: 'ring',
      x: tower.x,
      y: tower.y,
      radius: 14,
      maxRadius: 56,
      color: TOWER_SPECS[tower.element].waxColor,
      life: 0.4,
      maxLife: 0.4,
    });

    this.notify();
    return true;
  }

  public salvageTower(towerId: string): boolean {
    const idx = this.towers.findIndex((t) => t.id === towerId);
    if (idx < 0) return false;
    const tower = this.towers[idx];
    const refund = getSalvageValue(tower.totalInvested);
    this.ink += refund;
    this.towers.splice(idx, 1);
    if (this.selectedTowerId === towerId) {
      this.selectedTowerId = null;
    }
    this.recomputeResonanceLinks();
    soundManager.playTowerPlace();
    this.callouts.push({
      id: this.nextId('cal'),
      x: tower.x,
      y: tower.y - 10,
      vy: -28,
      text: `+${refund} INK`,
      color: '#D4A373',
      scale: 0.95,
      life: 0.9,
      maxLife: 0.9,
    });
    this.notify();
    return true;
  }

  public setTowerTargeting(towerId: string, mode: TargetingMode): void {
    const tower = this.towers.find((t) => t.id === towerId);
    if (!tower) return;
    tower.targeting = mode;
    this.notify();
  }

  public startNextWave(): void {
    if (this.gameState === 'defeat' || this.gameState === 'victory_prompt') return;

    // If wave is currently active, allow Overclock (Send Wave Early) if spawnQueue is empty or after 3s
    if (this.waveActive) {
      const overclockInk = getOverclockBonus(this.wave + 1);
      this.ink += overclockInk;
      this.callouts.push({
        id: this.nextId('cal'),
        x: LOGICAL_WIDTH / 2,
        y: 65,
        vy: -22,
        text: `OVERCLOCK +${overclockInk} INK!`,
        color: '#C1121F',
        scale: 1.15,
        life: 1.2,
        maxLife: 1.2,
      });
    }

    this.wave += 1;
    this.waveActive = true;
    this.isPaused = false;
    this.activeModifier = getEndlessModifierForWave(this.wave, this.targetWaves);

    const newSpawns = getWaveSpawnQueue(this.wave, this.mapData.lanes.length);
    const timeOffset = this.spawnQueue.length > 0 ? this.waveElapsed + 0.3 : 0;
    if (this.spawnQueue.length === 0) {
      this.waveElapsed = 0;
    }
    for (const s of newSpawns) {
      this.spawnQueue.push({
        ...s,
        spawnTime: s.spawnTime + timeOffset,
      });
    }

    soundManager.playWaveStart();
    this.notify();
  }

  public continueToEndless(): void {
    if (this.gameState === 'victory_prompt') {
      this.gameState = 'endless';
      this.notify();
    }
  }

  private isHalted(): boolean {
    return (
      this.destroyed ||
      this.isPaused ||
      this.gameState === 'defeat' ||
      this.gameState === 'victory_prompt'
    );
  }

  public stepFrame(rawDt: number): void {
    if (this.isHalted()) {
      return;
    }

    // Clamp raw frame delta and step physics in fixed 1/60s increments
    const clampedDt = Math.min(rawDt, 0.05);
    const fixedStep = 1 / 60;
    const subSteps = this.speedMultiplier;
    const scaledDt = (clampedDt / fixedStep) > 0.25 ? fixedStep : clampedDt;

    for (let s = 0; s < subSteps; s++) {
      this.updateFixedStep(scaledDt);
      if (this.isHalted()) {
        break;
      }
    }
  }

  private updateFixedStep(dt: number): void {
    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer = Math.max(0, this.screenShakeTimer - dt);
    }

    if (this.recentComboBanner) {
      this.recentComboBanner.timer -= dt;
      if (this.recentComboBanner.timer <= 0) {
        this.recentComboBanner = null;
        this.notify();
      }
    }

    // 1. Spawn queued enemies
    if (this.waveActive) {
      this.waveElapsed += dt;
      while (
        this.spawnQueue.length > 0 &&
        this.spawnQueue[0].spawnTime <= this.waveElapsed
      ) {
        const next = this.spawnQueue.shift()!;
        this.spawnEnemy(next.enemyType, next.laneIndex, 0);
      }
    }

    // 2. Update Ground Zones
    this.updateGroundZones(dt);

    // 3. Update Enemies
    this.updateEnemies(dt);

    // 4. Update Towers
    this.updateTowers(dt);

    // 5. Update Projectiles (with swept anti-tunneling collision)
    this.updateProjectiles(dt);

    // 6. Update Visual Effects, Callouts, Confetti
    this.updateEffects(dt);

    // 7. Check Wave Completion (Zero Deadlocks safeguard)
    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.onWaveComplete();
    }
  }

  private spawnEnemy(
    type: EnemyType,
    laneIndex: number,
    distanceTraveled: number,
    inheritedHitProjectiles?: Set<string>
  ): EnemyEntity {
    const spec = ENEMY_SPECS[type];
    const diff = DIFFICULTY_SPECS[this.difficultyId];
    const hpMult = getWaveHpMultiplier(Math.max(1, this.wave), this.targetWaves, diff.hpMultiplier);
    let speedMult = getWaveSpeedMultiplier(
      Math.max(1, this.wave),
      this.targetWaves,
      diff.speedMultiplier
    );

    if (this.activeModifier === 'swift_gale') {
      speedMult *= 1.25;
    }

    const clampedDist = Math.max(0, distanceTraveled);
    const sample = sampleLaneAtDistance(this.mapData, laneIndex, clampedDist);
    const maxHp = Math.max(1, Math.round(spec.baseHp * hpMult));

    let isArmored = spec.isArmored;
    if (this.activeModifier === 'iron_origami') {
      isArmored = true;
    }

    let isCamo = spec.isCamo;
    if (this.activeModifier === 'phantom_mist' && !spec.isBoss && Math.random() < 0.35) {
      isCamo = true;
    }

    const enemy: EnemyEntity = {
      id: this.nextId('enm'),
      type,
      laneIndex,
      distanceTraveled: clampedDist,
      x: sample.x,
      y: sample.y,
      angle: sample.angle,
      hp: maxHp,
      maxHp,
      baseSpeed: spec.speed * speedMult,
      radius: spec.radius,
      bounty: spec.bounty,
      lifeDamage: spec.lifeDamage,
      isCamo,
      camoStripped: false,
      isArmored,
      armorStripped: false,
      isBoss: spec.isBoss,
      statuses: {},
      reactionCooldown: 0,
      stunTimer: 0,
      rootTimer: 0,
      freezeTimer: 0,
      voidCubeTimer: 0,
      voidCubeSourceId: null,
      glacialHitCount: 0,
      glacialShatterPrimed: false,
      tetheredToIds: [],
      tetherTimer: 0,
      tetherNoSplit: false,
      vulnerabilityBonus: 0,
      hitProjectileIds: inheritedHitProjectiles ? new Set(inheritedHitProjectiles) : new Set(),
      foldPhase: Math.random() * Math.PI * 2,
      hitFlash: 0,
    };

    this.enemies.push(enemy);
    return enemy;
  }

  private updateGroundZones(dt: number): void {
    for (let i = this.groundZones.length - 1; i >= 0; i--) {
      const zone = this.groundZones[i];
      zone.duration -= dt;
      if (zone.duration <= 0) {
        this.groundZones.splice(i, 1);
        continue;
      }

      // Living Dragon Scroll swims backward along spline
      if (zone.kind === 'dragon_scroll' && zone.laneIndex !== undefined && zone.splineDist !== undefined) {
        zone.splineDist -= 185 * dt;
        if (zone.splineDist <= 0) {
          this.groundZones.splice(i, 1);
          continue;
        }
        const pt = sampleLaneAtDistance(this.mapData, zone.laneIndex, zone.splineDist);
        zone.x = pt.x;
        zone.y = pt.y;
      }

      zone.tickTimer -= dt;
      const shouldTickDamage = zone.tickTimer <= 0;
      if (shouldTickDamage) {
        zone.tickTimer = 0.25;
      }

      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue;
        const dist = Math.hypot(enemy.x - zone.x, enemy.y - zone.y);
        if (dist <= zone.radius + enemy.radius) {
          // Ink puddles reveal Camo
          if (zone.element === 'ink') {
            enemy.camoStripped = true;
            this.applyElementalStatus(enemy, 'ink', zone.towerId, 4.0, zone.slowPct, 0, 1);
          }
          if (zone.stripsArmor) {
            enemy.armorStripped = true;
          }
          if (zone.vulnBonus > enemy.vulnerabilityBonus) {
            enemy.vulnerabilityBonus = zone.vulnBonus;
          }

          // Paper Whirlpool pulls enemies toward center along spline
          if (zone.kind === 'whirlpool' && !enemy.isBoss && zone.pullSpeed > 0) {
            const near = findNearestTrackPoint(this.mapData, zone.x, zone.y);
            if (near.laneIndex === enemy.laneIndex) {
              const diffDist = near.distance - enemy.distanceTraveled;
              const step = Math.sign(diffDist) * Math.min(Math.abs(diffDist), zone.pullSpeed * dt);
              enemy.distanceTraveled = Math.max(0, enemy.distanceTraveled + step);
            }
          }

          if (shouldTickDamage && zone.dps > 0) {
            this.dealDamage(enemy, zone.dps * 0.25, zone.element, zone.towerId, false, 1);
          }
        }
      }
    }
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.hp <= 0) continue;

      enemy.foldPhase += dt * 7.5;
      if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 5);
      if (enemy.reactionCooldown > 0) {
        enemy.reactionCooldown = Math.max(0, enemy.reactionCooldown - dt);
      }
      if (enemy.stunTimer > 0) enemy.stunTimer = Math.max(0, enemy.stunTimer - dt);
      if (enemy.rootTimer > 0) enemy.rootTimer = Math.max(0, enemy.rootTimer - dt);
      if (enemy.freezeTimer > 0) enemy.freezeTimer = Math.max(0, enemy.freezeTimer - dt);

      if (enemy.tetherTimer > 0) {
        enemy.tetherTimer -= dt;
        if (enemy.tetherTimer <= 0) {
          enemy.tetheredToIds = [];
          enemy.tetherNoSplit = false;
        }
      }

      // Void Origami Cube (Ink B4)
      if (enemy.voidCubeTimer > 0) {
        enemy.voidCubeTimer -= dt;
        if (enemy.voidCubeTimer <= 0) {
          this.visualEffects.push({
            id: this.nextId('vfx'),
            kind: 'ring',
            x: enemy.x,
            y: enemy.y,
            radius: 15,
            maxRadius: 90,
            color: '#1D1E2C',
            life: 0.4,
            maxLife: 0.4,
          });
          this.callouts.push({
            id: this.nextId('cal'),
            x: enemy.x,
            y: enemy.y - 12,
            vy: -25,
            text: 'VOID DETONATION!',
            color: '#5C5470',
            scale: 1.0,
            life: 0.75,
            maxLife: 0.75,
          });
          for (const other of this.enemies) {
            if (other.hp > 0 && Math.hypot(other.x - enemy.x, other.y - enemy.y) <= 90) {
              this.dealDamage(
                other,
                160,
                'ink',
                enemy.voidCubeSourceId ?? '',
                true,
                1
              );
            }
          }
          enemy.voidCubeSourceId = null;
        }
      }

      // Tick Elemental Statuses & Burn DoT
      let highestSlow = 0;
      const statusKeys = Object.keys(enemy.statuses) as ElementType[];
      for (const el of statusKeys) {
        const st = enemy.statuses[el];
        if (!st) continue;
        st.duration -= dt;
        if (st.dps > 0) {
          this.dealDamage(enemy, st.dps * dt, el, st.sourceTowerId, false, 1);
        }
        if (st.slowPct > highestSlow) {
          if (!(el === 'water' && ENEMY_SPECS[enemy.type].soakedImmune)) {
            highestSlow = st.slowPct;
          }
        }
        if (st.duration <= 0) {
          delete enemy.statuses[el];
        }
      }

      if (enemy.hp <= 0) continue;

      if (enemy.tetherTimer > 0 && enemy.tetherNoSplit) {
        highestSlow = Math.max(highestSlow, 0.3);
      }

      if (enemy.isBoss) {
        highestSlow = Math.min(0.25, highestSlow);
      } else {
        highestSlow = Math.min(0.75, highestSlow);
      }

      const immobilized =
        enemy.stunTimer > 0 ||
        (!enemy.isBoss && enemy.rootTimer > 0) ||
        enemy.freezeTimer > 0 ||
        enemy.voidCubeTimer > 0;

      if (!immobilized) {
        let speed = enemy.baseSpeed * (1 - highestSlow);
        // Spiral Shrine special rule: outer 40% moves +15% faster
        const laneLen = this.mapData.laneLengths[enemy.laneIndex] ?? 1000;
        if (this.mapId === 'spiral' && enemy.distanceTraveled < laneLen * 0.4) {
          speed *= 1.15;
        }

        enemy.distanceTraveled += speed * dt;
      }

      const maxLaneDist = this.mapData.laneLengths[enemy.laneIndex] ?? 1000;
      if (enemy.distanceTraveled >= maxLaneDist) {
        // Reached Sanctuary Hanko Seal
        this.lives = Math.max(0, this.lives - enemy.lifeDamage);
        const exitPt = sampleLaneAtDistance(this.mapData, enemy.laneIndex, maxLaneDist);
        this.visualEffects.push({
          id: this.nextId('vfx'),
          kind: 'hanko_stamp',
          x: exitPt.x,
          y: exitPt.y,
          radius: 26,
          maxRadius: 34,
          color: '#C1121F',
          kanji: '破',
          life: 0.65,
          maxLife: 0.65,
        });
        this.enemies.splice(i, 1);

        if (this.lives <= 0) {
          this.gameState = 'defeat';
          saveHighScore({
            mapId: this.mapId,
            difficultyId: this.difficultyId,
            highestWave: this.wave,
            victoryAchieved: false,
            totalKills: this.totalKills,
            combosTriggered: this.runCombosTriggered,
            timestamp: Date.now(),
          });
        }
        this.notify();
        continue;
      }

      const sample = sampleLaneAtDistance(
        this.mapData,
        enemy.laneIndex,
        enemy.distanceTraveled
      );
      enemy.x = sample.x;
      enemy.y = sample.y;
      enemy.angle = sample.angle;
      enemy.vulnerabilityBonus = 0;
    }

    // Cleanup dead enemies cleanly
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].hp <= 0) {
        this.enemies.splice(i, 1);
      }
    }
  }

  private isEnemyTargetable(enemy: EnemyEntity, tower: TowerEntity): boolean {
    if (enemy.hp <= 0) return false;
    const canSeeCamo =
      tower.element === 'ink' ||
      (tower.element === 'air' && tower.tierB >= 3);
    if (enemy.isCamo && !enemy.camoStripped && !canSeeCamo) {
      return false;
    }
    return true;
  }

  private selectTarget(tower: TowerEntity, range: number): EnemyEntity | null {
    const candidates: EnemyEntity[] = [];
    for (const enemy of this.enemies) {
      if (!this.isEnemyTargetable(enemy, tower)) continue;
      if (Math.hypot(enemy.x - tower.x, enemy.y - tower.y) <= range) {
        candidates.push(enemy);
      }
    }
    if (candidates.length === 0) return null;

    if (tower.targeting === 'unprimed') {
      const unprimed = candidates.filter((e) => !e.statuses[tower.element]);
      if (unprimed.length > 0) {
        unprimed.sort((a, b) => b.distanceTraveled - a.distanceTraveled);
        return unprimed[0];
      }
    }

    if (tower.targeting === 'first' || tower.targeting === 'unprimed') {
      candidates.sort((a, b) => b.distanceTraveled - a.distanceTraveled);
      return candidates[0];
    }
    if (tower.targeting === 'last') {
      candidates.sort((a, b) => a.distanceTraveled - b.distanceTraveled);
      return candidates[0];
    }
    if (tower.targeting === 'strong') {
      candidates.sort((a, b) => b.hp - a.hp || b.distanceTraveled - a.distanceTraveled);
      return candidates[0];
    }
    // 'close'
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - tower.x, a.y - tower.y) -
        Math.hypot(b.x - tower.x, b.y - tower.y)
    );
    return candidates[0];
  }

  private updateTowers(dt: number): void {
    for (const tower of this.towers) {
      if (tower.pulseAnim > 0) {
        tower.pulseAnim = Math.max(0, tower.pulseAnim - dt * 3);
      }

      const range = this.getTowerEffectiveRange(tower);

      // Handle Earth Path B Orbiting Polyhedrons (T2-T4)
      if (tower.element === 'earth' && tower.tierB >= 2) {
        const orbitRadius = tower.tierB >= 4 ? 90 : 68;
        const contactDmg = tower.tierB >= 4 ? 42 : 24;
        const rotSpeed = tower.tierB >= 4 ? 3.4 : 2.6;

        for (const orb of tower.orbiters) {
          orb.angle = (orb.angle + rotSpeed * dt) % (Math.PI * 2);
          const ox = tower.x + Math.cos(orb.angle) * orbitRadius;
          const oy = tower.y + Math.sin(orb.angle) * orbitRadius;

          for (const enemyId of Object.keys(orb.hitCooldowns)) {
            orb.hitCooldowns[enemyId] -= dt;
            if (orb.hitCooldowns[enemyId] <= 0) {
              delete orb.hitCooldowns[enemyId];
            }
          }

          for (const enemy of this.enemies) {
            if (enemy.hp <= 0 || orb.hitCooldowns[enemy.id]) continue;
            if (Math.hypot(enemy.x - ox, enemy.y - oy) <= enemy.radius + 11) {
              orb.hitCooldowns[enemy.id] = 0.4;
              this.applyElementalStatus(enemy, 'earth', tower.id, 3.0, 0, 0, 0);
              this.dealDamage(enemy, contactDmg, 'earth', tower.id, false, 0);
            }
          }
        }

        // Earth B3/B4 periodic specials
        tower.specialTimer -= dt;
        if (tower.specialTimer <= 0) {
          if (tower.tierB >= 4) {
            // Celestial Orrery: instant piercing stone beams every 1.2s
            tower.specialTimer = 1.2;
            const target = this.selectTarget(tower, range + 40);
            if (target) {
              const beamAngle = Math.atan2(target.y - tower.y, target.x - tower.x);
              const endX = tower.x + Math.cos(beamAngle) * 260;
              const endY = tower.y + Math.sin(beamAngle) * 260;
              this.visualEffects.push({
                id: this.nextId('vfx'),
                kind: 'stone_beam',
                x: tower.x,
                y: tower.y,
                x2: endX,
                y2: endY,
                radius: 8,
                maxRadius: 12,
                color: '#D4A373',
                life: 0.25,
                maxLife: 0.25,
              });
              for (const enemy of this.enemies) {
                if (
                  enemy.hp > 0 &&
                  segmentIntersectsCircle(
                    tower.x,
                    tower.y,
                    endX,
                    endY,
                    enemy.x,
                    enemy.y,
                    enemy.radius + 10
                  )
                ) {
                  this.applyElementalStatus(enemy, 'earth', tower.id, 3.0, 0, 0, 0);
                  this.dealDamage(enemy, 65, 'earth', tower.id, false, 0);
                }
              }
            }
          } else if (tower.tierB === 3) {
            // Every 3.0s launches copies of all 3 polyhedrons as homing darts (45 dmg)
            tower.specialTimer = 3.0;
            const target = this.selectTarget(tower, range + 50);
            if (target) {
              for (const orb of tower.orbiters) {
                const ox = tower.x + Math.cos(orb.angle) * orbitRadius;
                const oy = tower.y + Math.sin(orb.angle) * orbitRadius;
                this.spawnProjectile({
                  tower,
                  kind: 'homing_poly',
                  x: ox,
                  y: oy,
                  angle: orb.angle,
                  speed: 310,
                  damage: 45,
                  pierce: 1,
                  splashRadius: 0,
                  ricochetsLeft: 0,
                  homingTurnRate: 0.14,
                  targetId: target.id,
                  stunDuration: 0.25,
                });
              }
            }
          }
        }
      }

      // Handle Fire Path A T4: Sun-Seal Lance (map-spanning continuous laser)
      if (tower.element === 'fire' && tower.tierA >= 4) {
        let target: EnemyEntity | null = null;
        let bestHp = -1;
        for (const e of this.enemies) {
          if (this.isEnemyTargetable(e, tower) && e.hp > bestHp) {
            bestHp = e.hp;
            target = e;
          }
        }
        if (target) {
          tower.laserTargetId = target.id;
          tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
          tower.cooldown -= dt;
          if (tower.cooldown <= 0) {
            tower.cooldown = 1 / 15; // 15 ticks/sec
            const endX = tower.x + Math.cos(tower.angle) * 1100;
            const endY = tower.y + Math.sin(tower.angle) * 1100;
            for (const enemy of this.enemies) {
              if (
                enemy.hp > 0 &&
                segmentIntersectsCircle(
                  tower.x,
                  tower.y,
                  endX,
                  endY,
                  enemy.x,
                  enemy.y,
                  enemy.radius + 9
                )
              ) {
                enemy.armorStripped = true;
                this.applyElementalStatus(enemy, 'fire', tower.id, 3.0, 0, 28, 0);
                this.dealDamage(enemy, 18, 'fire', tower.id, false, 0);
              }
            }
          }
        } else {
          tower.laserTargetId = null;
        }
        continue;
      }

      // Handle Fire Path A T2/T3: Dragon's Breath sweeping ember cone (12 ticks/sec)
      if (tower.element === 'fire' && tower.tierA >= 2) {
        const coneRange = tower.inConduit ? Math.round(125 * 1.15) : 125;
        const target = this.selectTarget(tower, coneRange);
        if (target) {
          tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
          tower.coneActiveTimer = 0.15;
          tower.cooldown -= dt;
          if (tower.cooldown <= 0) {
            tower.cooldown = 1 / 12;
            const halfConeRad = ((tower.tierA >= 3 ? 65 : 46) * Math.PI) / 360;
            const burnDps = tower.tierA >= 3 ? 28 : 14;
            for (const enemy of this.enemies) {
              if (!this.isEnemyTargetable(enemy, tower)) continue;
              const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
              if (dist <= coneRange + enemy.radius) {
                const angTo = Math.atan2(enemy.y - tower.y, enemy.x - tower.x);
                let diff = Math.abs(angTo - tower.angle);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                if (diff <= halfConeRad) {
                  enemy.armorStripped = true;
                  this.applyElementalStatus(enemy, 'fire', tower.id, 3.0, 0, burnDps, 0);
                  this.dealDamage(enemy, 6, 'fire', tower.id, false, 0);
                }
              }
            }
          }
        } else if (tower.coneActiveTimer > 0) {
          tower.coneActiveTimer = Math.max(0, tower.coneActiveTimer - dt);
        }
        continue;
      }

      // Handle Fire Path B T4: Sky-Lantern Barrage every 2.2s
      if (tower.element === 'fire' && tower.tierB >= 4) {
        tower.specialTimer -= dt;
        if (tower.specialTimer <= 0 && this.enemies.length > 0) {
          tower.specialTimer = 2.2;
          for (let k = 0; k < 8; k++) {
            const pick = this.enemies[k % this.enemies.length];
            const tx = pick.x + (Math.random() - 0.5) * 38;
            const ty = pick.y + (Math.random() - 0.5) * 38;
            this.visualEffects.push({
              id: this.nextId('vfx'),
              kind: 'ring',
              x: tx,
              y: ty,
              radius: 10,
              maxRadius: 64,
              color: '#E63946',
              life: 0.35,
              maxLife: 0.35,
            });
            for (const enemy of this.enemies) {
              if (enemy.hp > 0 && Math.hypot(enemy.x - tx, enemy.y - ty) <= 64) {
                this.applyElementalStatus(enemy, 'fire', tower.id, 3.0, 0, 22, 0);
                this.dealDamage(enemy, 65, 'fire', tower.id, false, 0);
              }
            }
          }
        }
      }

      // Handle Water Path A T4: Great Wave every 6.0s
      if (tower.element === 'water' && tower.tierA >= 4) {
        tower.specialTimer -= dt;
        if (tower.specialTimer <= 0 && this.enemies.length > 0) {
          tower.specialTimer = 6.0;
          this.visualEffects.push({
            id: this.nextId('vfx'),
            kind: 'great_wave',
            x: LOGICAL_WIDTH / 2,
            y: LOGICAL_HEIGHT / 2,
            radius: 40,
            maxRadius: 960,
            color: '#3A86FF',
            life: 0.65,
            maxLife: 0.65,
          });
          this.callouts.push({
            id: this.nextId('cal'),
            x: tower.x,
            y: tower.y - 18,
            vy: -25,
            text: 'GREAT WAVE!',
            color: '#3A86FF',
            scale: 1.2,
            life: 1.0,
            maxLife: 1.0,
          });
          for (const enemy of this.enemies) {
            if (enemy.hp <= 0) continue;
            this.applyElementalStatus(enemy, 'water', tower.id, 4.5, 0.35, 0, 0);
            if (!enemy.isBoss) {
              enemy.distanceTraveled = Math.max(0, enemy.distanceTraveled - 65);
            }
            this.dealDamage(enemy, 95, 'water', tower.id, false, 0);
          }
        }
      }

      // Handle Ink Path A T2+: Calligraphy Pool every 1.1s & T4 Living Dragon Scroll every 7.0s
      if (tower.element === 'ink' && tower.tierA >= 2) {
        tower.cooldown -= dt;
        if (tower.cooldown <= 0) {
          tower.cooldown = 1.1;
          const near = findNearestTrackPoint(this.mapData, tower.x, tower.y);
          this.groundZones.push({
            id: this.nextId('gz'),
            towerId: tower.id,
            element: 'ink',
            kind: 'ink_puddle',
            x: near.x + (Math.random() - 0.5) * 14,
            y: near.y + (Math.random() - 0.5) * 14,
            radius: 32,
            duration: 5.5,
            maxDuration: 5.5,
            dps: tower.tierA >= 3 ? 18 : 0,
            slowPct: 0.6,
            pullSpeed: 0,
            vulnBonus: 0,
            stripsArmor: tower.tierA >= 3,
            tickTimer: 0.1,
          });
        }

        if (tower.tierA >= 4) {
          tower.specialTimer -= dt;
          if (tower.specialTimer <= 0 && this.enemies.length > 0) {
            tower.specialTimer = 7.0;
            const laneIdx = 0;
            const maxLen = this.mapData.laneLengths[laneIdx] ?? 800;
            const startPt = sampleLaneAtDistance(this.mapData, laneIdx, maxLen);
            this.groundZones.push({
              id: this.nextId('gz'),
              towerId: tower.id,
              element: 'ink',
              kind: 'dragon_scroll',
              x: startPt.x,
              y: startPt.y,
              radius: 46,
              duration: 5.0,
              maxDuration: 5.0,
              dps: 120,
              slowPct: 0.65,
              pullSpeed: 0,
              vulnBonus: 0,
              stripsArmor: true,
              tickTimer: 0.1,
              laneIndex: laneIdx,
              splineDist: maxLen,
            });
          }
        }
        continue;
      }

      // Standard projectile firing cadence
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;

      const target = this.selectTarget(tower, range);
      if (!target) continue;

      const fireRate = this.getTowerFireRate(tower);
      tower.cooldown = 1 / fireRate;
      tower.shotCounter += 1;
      tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);

      this.fireTowerWeapon(tower, target);
    }
  }

  private fireTowerWeapon(tower: TowerEntity, target: EnemyEntity): void {
    const baseAngle = Math.atan2(target.y - tower.y, target.x - tower.x);

    if (tower.element === 'air') {
      // Path B T4: Typhoon Gale on every 4th shot
      if (tower.tierB >= 4 && tower.shotCounter % 4 === 0) {
        this.spawnProjectile({
          tower,
          kind: 'typhoon',
          x: tower.x,
          y: tower.y,
          angle: baseAngle,
          speed: 220,
          damage: 55,
          pierce: 15,
          splashRadius: 0,
          ricochetsLeft: 0,
          homingTurnRate: 0.04,
          targetId: target.id,
          radius: 42,
          knockbackPx: 75,
          stripsCamo: true,
        });
        return;
      }

      // Path B T2+: Folding War Fan
      if (tower.tierB >= 2) {
        this.spawnProjectile({
          tower,
          kind: 'war_fan',
          x: tower.x,
          y: tower.y,
          angle: baseAngle,
          speed: 260,
          damage: 15,
          pierce: 4,
          splashRadius: 0,
          ricochetsLeft: 0,
          homingTurnRate: 0,
          targetId: null,
          radius: 22,
          knockbackPx: tower.tierB >= 3 ? 42 : 28,
          bouncesLeft: 2,
          stripsCamo: tower.tierB >= 3,
        });
        return;
      }

      // Path A or Base Shuriken / Folded Crane
      const isCrane = tower.tierA >= 2;
      const volleyCount = tower.tierA >= 4 ? 3 : 1;
      const speed = (tower.tierA >= 1 ? 1.3 : 1.0) * 290;
      const turnRate = (tower.tierA >= 1 ? 2.0 : 1.0) * 0.08;
      let pierce = 2 + (tower.tierB >= 1 ? 2 : 0) + (isCrane ? 1 : 0);
      if (tower.tierA >= 4) pierce = 4;
      const dmg = tower.tierA >= 4 ? 18 : 12;

      for (let v = 0; v < volleyCount; v++) {
        const spread = volleyCount > 1 ? (v - 1) * 0.22 : 0;
        this.spawnProjectile({
          tower,
          kind: isCrane ? 'crane' : 'shuriken',
          x: tower.x,
          y: tower.y,
          angle: baseAngle + spread,
          speed,
          damage: dmg,
          pierce,
          splashRadius: 0,
          ricochetsLeft: 0,
          homingTurnRate: turnRate,
          targetId: target.id,
          maxLife: isCrane ? 3.5 : 2.0,
        });
      }
      return;
    }

    if (tower.element === 'fire') {
      const splash = tower.tierB >= 1 ? 68 : 48;
      const dmg = tower.tierB >= 1 ? 26 : 18;
      const ashDur = tower.tierB >= 3 ? 5.0 : 2.5;
      const ashDps = tower.tierB >= 3 ? 22 : tower.tierA >= 1 ? 14 : 6;

      this.spawnProjectile({
        tower,
        kind: 'lantern',
        x: tower.x,
        y: tower.y,
        angle: baseAngle,
        speed: 250,
        damage: dmg,
        pierce: 1,
        splashRadius: splash,
        ricochetsLeft: 0,
        homingTurnRate: 0.04,
        targetId: target.id,
        spawnsClusterLotus: tower.tierB >= 2,
        ashDuration: ashDur,
        ashDps,
      });
      return;
    }

    if (tower.element === 'water') {
      if (tower.tierA >= 2) {
        // Leaping Koi swimming backward along the spline
        this.spawnProjectile({
          tower,
          kind: 'koi',
          x: target.x,
          y: target.y,
          angle: target.angle + Math.PI,
          speed: 210,
          damage: 16,
          pierce: 8,
          splashRadius: 0,
          ricochetsLeft: 0,
          homingTurnRate: 0,
          targetId: null,
          isKoiSpline: true,
          koiLaneIndex: target.laneIndex,
          koiDistanceLeft: 220,
          koiCurrentSplineDist: target.distanceTraveled,
          leavesWetWake: tower.tierA >= 3,
        });
        return;
      }

      const bounces = 2 + (tower.tierA >= 1 ? 2 : 0);
      const speed = (tower.tierA >= 1 ? 1.25 : 1.0) * 280;
      this.spawnProjectile({
        tower,
        kind: 'water_wave',
        x: tower.x,
        y: tower.y,
        angle: baseAngle,
        speed,
        damage: 11,
        pierce: 1,
        splashRadius: 0,
        ricochetsLeft: bounces,
        homingTurnRate: 0.06,
        targetId: target.id,
        spawnsWhirlpool: tower.tierB >= 2,
        whirlpoolRadius: tower.tierB >= 3 ? 76 : 58,
        whirlpoolVuln: tower.tierB >= 3,
      });
      return;
    }

    if (tower.element === 'earth') {
      if (tower.tierA >= 4) {
        // Tectonic Monolith rolling origami boulder
        this.spawnProjectile({
          tower,
          kind: 'boulder',
          x: tower.x,
          y: tower.y,
          angle: baseAngle,
          speed: 210,
          damage: 140,
          pierce: 12,
          splashRadius: 75,
          ricochetsLeft: 0,
          homingTurnRate: 0.03,
          targetId: target.id,
          radius: 18,
          stunDuration: 0.5,
          isBoulder: true,
        });
        return;
      }

      const dmg = tower.tierA >= 1 ? 55 : 34;
      const stun = tower.tierA >= 1 ? 0.5 : 0.35;
      this.spawnProjectile({
        tower,
        kind: 'earth_spike',
        x: tower.x,
        y: tower.y,
        angle: baseAngle,
        speed: 310,
        damage: dmg,
        pierce: 1,
        splashRadius: 0,
        ricochetsLeft: 0,
        homingTurnRate: 0.05,
        targetId: target.id,
        stunDuration: stun,
        shattersIntoPrisms: tower.tierA >= 2,
        prismCrit: tower.tierA >= 3,
      });
      return;
    }

    if (tower.element === 'ink') {
      const splash = tower.tierA >= 1 ? 62 : 42;
      const trapsVoid = tower.tierB >= 4 && tower.shotCounter % 5 === 0;
      this.spawnProjectile({
        tower,
        kind: 'ink_blot',
        x: tower.x,
        y: tower.y,
        angle: baseAngle,
        speed: 275,
        damage: 8,
        pierce: 1,
        splashRadius: splash,
        ricochetsLeft: 0,
        homingTurnRate: 0.05,
        targetId: target.id,
        stripsCamo: true,
        tethersTargets: tower.tierB >= 2,
        tetherSlowAndNoSplit: tower.tierB >= 3,
        trapsInVoidCube: trapsVoid,
      });
    }
  }

  private spawnProjectile(opts: {
    tower: TowerEntity;
    kind: ProjectileEntity['kind'];
    x: number;
    y: number;
    angle: number;
    speed: number;
    damage: number;
    pierce: number;
    splashRadius: number;
    ricochetsLeft: number;
    homingTurnRate: number;
    targetId: string | null;
    maxLife?: number;
    radius?: number;
    knockbackPx?: number;
    bouncesLeft?: number;
    stripsCamo?: boolean;
    stripsArmor?: boolean;
    stunDuration?: number;
    isKoiSpline?: boolean;
    koiLaneIndex?: number;
    koiDistanceLeft?: number;
    koiCurrentSplineDist?: number;
    leavesWetWake?: boolean;
    spawnsClusterLotus?: boolean;
    ashDuration?: number;
    ashDps?: number;
    spawnsWhirlpool?: boolean;
    whirlpoolRadius?: number;
    whirlpoolVuln?: boolean;
    shattersIntoPrisms?: boolean;
    prismCrit?: boolean;
    isBoulder?: boolean;
    tethersTargets?: boolean;
    tetherSlowAndNoSplit?: boolean;
    trapsInVoidCube?: boolean;
    spawnsMiniPuddle?: boolean;
    initialHitEnemies?: Set<string>;
  }): ProjectileEntity {
    const life = opts.maxLife ?? 2.4;
    const proj: ProjectileEntity = {
      id: this.nextId('prj'),
      towerId: opts.tower.id,
      element: opts.tower.element,
      kind: opts.kind,
      x: opts.x,
      y: opts.y,
      prevX: opts.x,
      prevY: opts.y,
      vx: Math.cos(opts.angle) * opts.speed,
      vy: Math.sin(opts.angle) * opts.speed,
      speed: opts.speed,
      angle: opts.angle,
      damage: opts.damage,
      pierce: opts.pierce,
      maxPierce: opts.pierce,
      splashRadius: opts.splashRadius,
      ricochetsLeft: opts.ricochetsLeft,
      ricochetRange: 95,
      homingTurnRate: opts.homingTurnRate,
      targetId: opts.targetId,
      life,
      maxLife: life,
      radius: opts.radius ?? 8,
      knockbackPx: opts.knockbackPx ?? 0,
      bouncesLeft: opts.bouncesLeft ?? 0,
      stripsCamo: opts.stripsCamo ?? false,
      stripsArmor: opts.stripsArmor ?? false,
      stunDuration: opts.stunDuration ?? 0,
      isKoiSpline: opts.isKoiSpline ?? false,
      koiLaneIndex: opts.koiLaneIndex ?? 0,
      koiDistanceLeft: opts.koiDistanceLeft ?? 0,
      koiCurrentSplineDist: opts.koiCurrentSplineDist ?? 0,
      leavesWetWake: opts.leavesWetWake ?? false,
      spawnsClusterLotus: opts.spawnsClusterLotus ?? false,
      ashDuration: opts.ashDuration ?? 0,
      ashDps: opts.ashDps ?? 0,
      spawnsWhirlpool: opts.spawnsWhirlpool ?? false,
      whirlpoolRadius: opts.whirlpoolRadius ?? 58,
      whirlpoolVuln: opts.whirlpoolVuln ?? false,
      shattersIntoPrisms: opts.shattersIntoPrisms ?? false,
      prismCrit: opts.prismCrit ?? false,
      isBoulder: opts.isBoulder ?? false,
      tethersTargets: opts.tethersTargets ?? false,
      tetherSlowAndNoSplit: opts.tetherSlowAndNoSplit ?? false,
      trapsInVoidCube: opts.trapsInVoidCube ?? false,
      spawnsMiniPuddle: opts.spawnsMiniPuddle ?? false,
      hitEnemyIds: opts.initialHitEnemies ? new Set(opts.initialHitEnemies) : new Set(),
    };
    this.projectiles.push(proj);
    return proj;
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      p.prevX = p.x;
      p.prevY = p.y;

      if (p.isKoiSpline) {
        const step = p.speed * dt;
        p.koiDistanceLeft -= step;
        p.koiCurrentSplineDist = Math.max(0, p.koiCurrentSplineDist - step);
        const pt = sampleLaneAtDistance(
          this.mapData,
          p.koiLaneIndex,
          p.koiCurrentSplineDist
        );
        p.x = pt.x;
        p.y = pt.y;
        p.angle = pt.angle + Math.PI;

        if (p.leavesWetWake && Math.random() < 0.35) {
          this.groundZones.push({
            id: this.nextId('gz'),
            towerId: p.towerId,
            element: 'water',
            kind: 'wet_wake',
            x: p.x,
            y: p.y,
            radius: 26,
            duration: 3.0,
            maxDuration: 3.0,
            dps: 0,
            slowPct: 0.35,
            pullSpeed: 0,
            vulnBonus: 0.2,
            stripsArmor: false,
            tickTimer: 0.25,
          });
        }

        if (p.koiDistanceLeft <= 0 || p.koiCurrentSplineDist <= 0) {
          this.projectiles.splice(i, 1);
          continue;
        }
      } else {
        // Homing steering
        if (p.homingTurnRate > 0) {
          let target = this.enemies.find(
            (e) => e.id === p.targetId && e.hp > 0 && !p.hitEnemyIds.has(e.id)
          );
          if (!target) {
            // Auto-retarget nearest unhit enemy
            let bestD = Infinity;
            for (const e of this.enemies) {
              if (e.hp <= 0 || p.hitEnemyIds.has(e.id)) continue;
              const d = Math.hypot(e.x - p.x, e.y - p.y);
              if (d < bestD) {
                bestD = d;
                target = e;
              }
            }
            p.targetId = target ? target.id : null;
          }
          if (target) {
            const desired = Math.atan2(target.y - p.y, target.x - p.x);
            let diff = desired - p.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const maxTurn = p.homingTurnRate * (dt * 60);
            p.angle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn);
            p.vx = Math.cos(p.angle) * p.speed;
            p.vy = Math.sin(p.angle) * p.speed;
          }
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // War Fan canvas border bounces
        if (p.bouncesLeft > 0) {
          let bounced = false;
          if (p.x <= 24 || p.x >= LOGICAL_WIDTH - 24) {
            p.vx = -p.vx;
            bounced = true;
          }
          if (p.y <= 24 || p.y >= LOGICAL_HEIGHT - 24) {
            p.vy = -p.vy;
            bounced = true;
          }
          if (bounced) {
            p.bouncesLeft -= 1;
            p.angle = Math.atan2(p.vy, p.vx);
            p.hitEnemyIds.clear();
          }
        }
      }

      // Swept segment-to-circle collision check against enemies
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue;
        if (p.hitEnemyIds.has(enemy.id) || enemy.hitProjectileIds.has(p.id)) {
          continue;
        }

        if (
          segmentIntersectsCircle(
            p.prevX,
            p.prevY,
            p.x,
            p.y,
            enemy.x,
            enemy.y,
            enemy.radius + p.radius
          )
        ) {
          p.hitEnemyIds.add(enemy.id);
          enemy.hitProjectileIds.add(p.id);
          this.onProjectileHitEnemy(p, enemy);

          if (p.ricochetsLeft > 0) {
            p.ricochetsLeft -= 1;
            let nextTarget: EnemyEntity | null = null;
            let bestDist = p.ricochetRange;
            for (const cand of this.enemies) {
              if (cand.hp <= 0 || p.hitEnemyIds.has(cand.id)) continue;
              const d = Math.hypot(cand.x - enemy.x, cand.y - enemy.y);
              if (d <= bestDist) {
                bestDist = d;
                nextTarget = cand;
              }
            }
            if (nextTarget) {
              p.targetId = nextTarget.id;
              p.angle = Math.atan2(nextTarget.y - p.y, nextTarget.x - p.x);
              p.vx = Math.cos(p.angle) * p.speed;
              p.vy = Math.sin(p.angle) * p.speed;
              break;
            }
          }

          p.pierce -= 1;
          if (p.pierce <= 0) {
            this.onProjectileFinalHit(p, enemy);
            this.projectiles.splice(i, 1);
            break;
          }
        }
      }
    }
  }

  private onProjectileHitEnemy(p: ProjectileEntity, enemy: EnemyEntity): void {
    const tower = this.towers.find((t) => t.id === p.towerId);

    if (p.stripsCamo || p.element === 'ink') {
      enemy.camoStripped = true;
    }
    if (p.stripsArmor) {
      enemy.armorStripped = true;
    }
    if (p.stunDuration > 0 && !enemy.isBoss) {
      enemy.stunTimer = Math.max(enemy.stunTimer, p.stunDuration);
    }

    // Knockback along spline (strictly clamped >= 0)
    if (p.knockbackPx > 0 && !enemy.isBoss) {
      const minThreshold = ENEMY_SPECS[enemy.type].knockbackMinThreshold;
      if (p.knockbackPx >= minThreshold) {
        enemy.distanceTraveled = Math.max(0, enemy.distanceTraveled - p.knockbackPx);
      }
    }

    // Water B4: Glacial Lotus 3-hit crystal freeze & shatter
    if (tower && tower.element === 'water' && tower.tierB >= 4) {
      if (enemy.glacialShatterPrimed && enemy.freezeTimer > 0) {
        enemy.glacialShatterPrimed = false;
        enemy.freezeTimer = 0;
        this.callouts.push({
          id: this.nextId('cal'),
          x: enemy.x,
          y: enemy.y - 12,
          vy: -26,
          text: 'GLACIAL SHATTER!',
          color: '#4CC9F0',
          scale: 1.05,
          life: 0.8,
          maxLife: 0.8,
        });
        for (const other of this.enemies) {
          if (other.hp > 0 && Math.hypot(other.x - enemy.x, other.y - enemy.y) <= 75) {
            this.dealDamage(other, 110, 'water', p.towerId, false, 1);
          }
        }
      } else if (enemy.statuses.water) {
        enemy.glacialHitCount += 1;
        if (enemy.glacialHitCount >= 3) {
          enemy.glacialHitCount = 0;
          enemy.freezeTimer = 1.8;
          enemy.glacialShatterPrimed = true;
        }
      }
    }

    // Ink B2/B3: Soul Tether
    if (p.tethersTargets) {
      const links: string[] = [];
      for (const other of this.enemies) {
        if (other.id !== enemy.id && other.hp > 0) {
          if (Math.hypot(other.x - enemy.x, other.y - enemy.y) <= 95) {
            links.push(other.id);
            if (links.length >= 3) break;
          }
        }
      }
      enemy.tetheredToIds = links;
      enemy.tetherTimer = 3.5;
      enemy.tetherNoSplit = p.tetherSlowAndNoSplit;
    }

    // Ink B4: Void Origami Cube
    if (p.trapsInVoidCube) {
      enemy.voidCubeTimer = 2.5;
      enemy.voidCubeSourceId = p.towerId;
    }

    // Spawn Ash Patch (Fire)
    if (p.ashDuration > 0) {
      const activeAshAtSpot = this.groundZones.filter(
        (gz) => gz.kind === 'ash_patch' && Math.hypot(gz.x - enemy.x, gz.y - enemy.y) < 35
      );
      if (activeAshAtSpot.length < 3) {
        this.groundZones.push({
          id: this.nextId('gz'),
          towerId: p.towerId,
          element: 'fire',
          kind: 'ash_patch',
          x: enemy.x,
          y: enemy.y,
          radius: 36,
          duration: p.ashDuration,
          maxDuration: p.ashDuration,
          dps: p.ashDps,
          slowPct: 0,
          pullSpeed: 0,
          vulnBonus: 0,
          stripsArmor: false,
          tickTimer: 0.15,
        });
      }
    }

    // Spawn Paper Whirlpool (Water B2+)
    if (p.spawnsWhirlpool) {
      this.groundZones.push({
        id: this.nextId('gz'),
        towerId: p.towerId,
        element: 'water',
        kind: 'whirlpool',
        x: enemy.x,
        y: enemy.y,
        radius: p.whirlpoolRadius,
        duration: 2.0,
        maxDuration: 2.0,
        dps: 10,
        slowPct: 0.38,
        pullSpeed: 45,
        vulnBonus: p.whirlpoolVuln ? 0.25 : 0,
        stripsArmor: false,
        tickTimer: 0.2,
      });
    }

    // Spawn mini puddle from Calligraphy Gale combo blade
    if (p.spawnsMiniPuddle) {
      this.groundZones.push({
        id: this.nextId('gz'),
        towerId: p.towerId,
        element: 'ink',
        kind: 'ink_puddle',
        x: enemy.x,
        y: enemy.y,
        radius: 24,
        duration: 3.0,
        maxDuration: 3.0,
        dps: 0,
        slowPct: 0.45,
        pullSpeed: 0,
        vulnBonus: 0,
        stripsArmor: false,
        tickTimer: 0.25,
      });
    }

    // Earth A2/A3: Crystal Prism shatters into 5 shards in 70° cone behind target
    if (p.shattersIntoPrisms && tower) {
      const coneRad = (70 * Math.PI) / 180;
      for (let s = 0; s < 5; s++) {
        const offset = (s / 4 - 0.5) * coneRad;
        this.spawnProjectile({
          tower,
          kind: 'crystal_shard',
          x: enemy.x,
          y: enemy.y,
          angle: p.angle + offset,
          speed: 350,
          damage: 18,
          pierce: 2,
          splashRadius: 0,
          ricochetsLeft: 0,
          homingTurnRate: 0,
          targetId: null,
          maxLife: 0.45,
          prismCrit: p.prismCrit,
          initialHitEnemies: new Set([enemy.id]),
        });
      }
    }

    // Calculate status parameters
    let statusDur = TOWER_SPECS[p.element].statusDuration;
    let slowPct = 0;
    let burnDps = 0;
    if (p.element === 'water') {
      slowPct = tower && tower.tierB >= 1 ? 0.38 : 0.25;
      if (tower && tower.tierB >= 1) statusDur = 5.0;
    } else if (p.element === 'ink') {
      slowPct = tower && tower.tierA >= 1 ? 0.52 : 0.45;
    } else if (p.element === 'fire') {
      burnDps = tower && tower.tierA >= 1 ? 14 : 6;
    }

    let finalDmg = p.damage;
    if (
      p.prismCrit &&
      (enemy.statuses.water || enemy.statuses.ink || enemy.statuses.earth)
    ) {
      finalDmg *= 2.0;
    }

    if (p.splashRadius > 0) {
      this.visualEffects.push({
        id: this.nextId('vfx'),
        kind: 'ring',
        x: enemy.x,
        y: enemy.y,
        radius: 8,
        maxRadius: p.splashRadius,
        color: TOWER_SPECS[p.element].waxColor,
        life: 0.25,
        maxLife: 0.25,
      });
      for (const other of this.enemies) {
        if (
          other.hp > 0 &&
          Math.hypot(other.x - enemy.x, other.y - enemy.y) <= p.splashRadius
        ) {
          if (p.element === 'ink') other.camoStripped = true;
          this.applyElementalStatus(
            other,
            p.element,
            p.towerId,
            statusDur,
            slowPct,
            burnDps,
            0
          );
          this.dealDamage(other, finalDmg, p.element, p.towerId, false, 0);
        }
      }
    } else {
      this.applyElementalStatus(
        enemy,
        p.element,
        p.towerId,
        statusDur,
        slowPct,
        burnDps,
        0
      );
      this.dealDamage(enemy, finalDmg, p.element, p.towerId, false, 0);
    }
  }

  private onProjectileFinalHit(p: ProjectileEntity, enemy: EnemyEntity): void {
    const tower = this.towers.find((t) => t.id === p.towerId);
    if (!tower) return;

    // Air A3: Cranes split into 2 mini-swallows (8 dmg, 2 pierce) on their final hit
    if (p.kind === 'crane' && tower.tierA >= 3) {
      for (const offset of [-0.45, 0.45]) {
        this.spawnProjectile({
          tower,
          kind: 'swallow',
          x: enemy.x,
          y: enemy.y,
          angle: p.angle + offset,
          speed: 330,
          damage: 8,
          pierce: 2,
          splashRadius: 0,
          ricochetsLeft: 0,
          homingTurnRate: 0.12,
          targetId: null,
          maxLife: 1.5,
          initialHitEnemies: new Set([enemy.id]),
        });
      }
    }

    // Fire B2: Cluster Lotus bursts into 4 secondary spark-bombs in a 55px ring
    if (p.spawnsClusterLotus) {
      for (let k = 0; k < 4; k++) {
        const ang = (k * Math.PI) / 2 + 0.4;
        const bx = enemy.x + Math.cos(ang) * 45;
        const by = enemy.y + Math.sin(ang) * 45;
        this.visualEffects.push({
          id: this.nextId('vfx'),
          kind: 'ring',
          x: bx,
          y: by,
          radius: 6,
          maxRadius: 36,
          color: '#F4A261',
          life: 0.25,
          maxLife: 0.25,
        });
        for (const other of this.enemies) {
          if (other.hp > 0 && Math.hypot(other.x - bx, other.y - by) <= 36) {
            this.dealDamage(other, 14, 'fire', tower.id, false, 1);
          }
        }
      }
    }

    // Earth A4: Tectonic Monolith detonates for 180 AoE damage
    if (p.isBoulder) {
      this.visualEffects.push({
        id: this.nextId('vfx'),
        kind: 'ring',
        x: enemy.x,
        y: enemy.y,
        radius: 14,
        maxRadius: 85,
        color: '#D4A373',
        life: 0.38,
        maxLife: 0.38,
      });
      for (const other of this.enemies) {
        if (other.hp > 0 && Math.hypot(other.x - enemy.x, other.y - enemy.y) <= 85) {
          this.dealDamage(other, 180, 'earth', tower.id, false, 1);
        }
      }
    }
  }

  private applyElementalStatus(
    enemy: EnemyEntity,
    element: ElementType,
    sourceTowerId: string,
    duration: number,
    slowPct: number,
    dps: number,
    recursionDepth: number
  ): void {
    if (enemy.hp <= 0) return;

    // Check for Two-Element Seal Reaction (Combo)
    if (recursionDepth === 0 && enemy.reactionCooldown <= 0) {
      const existingElements = Object.keys(enemy.statuses) as ElementType[];
      for (const existingEl of existingElements) {
        if (existingEl !== element && enemy.statuses[existingEl]) {
          const comboId = resolveComboId(existingEl, element);
          if (comboId) {
            delete enemy.statuses[existingEl];
            delete enemy.statuses[element];
            enemy.reactionCooldown = 1.2;
            this.triggerElementalCombo(comboId, enemy, sourceTowerId);
            return;
          }
        }
      }
    }

    const statusType: StatusEffectType = TOWER_SPECS[element].statusApplied;
    enemy.statuses[element] = {
      type: statusType,
      element,
      duration,
      maxDuration: duration,
      dps,
      slowPct,
      sourceTowerId,
    };
  }

  private triggerElementalCombo(
    comboId: ComboId,
    target: EnemyEntity,
    sourceTowerId: string
  ): void {
    const def = COMBO_DEFINITIONS[comboId];
    const w = Math.max(1, this.wave);

    this.runCombosTriggered += 1;
    let isNewDiscovery = false;
    if (!this.runDiscoveredCombos.has(comboId)) {
      this.runDiscoveredCombos.add(comboId);
      this.ink += 25;
      isNewDiscovery = true;
    }
    if (!this.discoveredCombos.has(comboId)) {
      this.discoveredCombos.add(comboId);
      saveDiscoveredCombos(Array.from(this.discoveredCombos));
    }

    this.recentComboBanner = {
      name: def.name,
      kanji: def.kanji,
      color: def.color,
      isNewDiscovery,
      timer: 2.4,
    };

    soundManager.playElementalCombo();
    this.screenShakeTimer = 0.18;
    this.screenShakeIntensity = 3;

    // Render crimson kanji hanko stamp + shockwave ring + floating callout
    this.visualEffects.push({
      id: this.nextId('vfx'),
      kind: 'hanko_stamp',
      x: target.x,
      y: target.y,
      radius: 24,
      maxRadius: 34,
      color: '#C1121F',
      kanji: def.kanji,
      life: 0.75,
      maxLife: 0.75,
    });
    this.visualEffects.push({
      id: this.nextId('vfx'),
      kind: 'ring',
      x: target.x,
      y: target.y,
      radius: 12,
      maxRadius: 85,
      color: def.color,
      life: 0.42,
      maxLife: 0.42,
    });
    this.callouts.push({
      id: this.nextId('cal'),
      x: target.x,
      y: target.y - 16,
      vy: -32,
      text: def.callout,
      subtext: isNewDiscovery ? '+25 INK NEW SEAL!' : def.name,
      color: def.color,
      scale: 1.15,
      life: 1.0,
      maxLife: 1.0,
    });

    const tower = this.towers.find((t) => t.id === sourceTowerId) ?? this.towers[0];

    switch (comboId) {
      case 'water_fire': {
        // Scalding Steam: 45 + 6w AoE dmg (85px radius) + 40% slow (2.5s)
        const dmg = 45 + 6 * w;
        for (const other of this.enemies) {
          if (other.hp > 0 && Math.hypot(other.x - target.x, other.y - target.y) <= 85) {
            this.applyElementalStatus(other, 'water', sourceTowerId, 2.5, 0.4, 0, 1);
            this.dealDamage(other, dmg, 'fire', sourceTowerId, false, 1);
          }
        }
        break;
      }
      case 'water_air': {
        // Monsoon Squall: Chains 35 + 4w arcs to up to 5 enemies within 110px
        const dmg = 35 + 4 * w;
        let count = 0;
        let prevX = target.x;
        let prevY = target.y;
        for (const other of this.enemies) {
          if (other.hp > 0 && Math.hypot(other.x - target.x, other.y - target.y) <= 110) {
            this.visualEffects.push({
              id: this.nextId('vfx'),
              kind: 'lightning_arc',
              x: prevX,
              y: prevY,
              x2: other.x,
              y2: other.y,
              radius: 3,
              maxRadius: 6,
              color: '#0096C7',
              life: 0.28,
              maxLife: 0.28,
            });
            prevX = other.x;
            prevY = other.y;
            this.dealDamage(other, dmg, 'air', sourceTowerId, false, 1);
            count += 1;
            if (count >= 5) break;
          }
        }
        break;
      }
      case 'water_earth': {
        // Mudslide: Roots target 1.3s, strips Armor, deals 40 + 5w dmg
        target.rootTimer = Math.max(target.rootTimer, 1.3);
        target.armorStripped = true;
        this.dealDamage(target, 40 + 5 * w, 'earth', sourceTowerId, false, 1);
        break;
      }
      case 'water_ink': {
        // Spreading Wash: Spreads Soaked + Stained to all enemies within 115px + 25 burst dmg
        for (const other of this.enemies) {
          if (other.hp > 0 && Math.hypot(other.x - target.x, other.y - target.y) <= 115) {
            other.camoStripped = true;
            this.applyElementalStatus(other, 'water', sourceTowerId, 3.5, 0.25, 0, 1);
            this.applyElementalStatus(other, 'ink', sourceTowerId, 4.0, 0.45, 0, 1);
            this.dealDamage(other, 25, 'ink', sourceTowerId, false, 1);
          }
        }
        break;
      }
      case 'fire_air': {
        // Firestorm: 50 + 6w AoE dmg (80px) + 35px knockback + refreshes Burning
        const dmg = 50 + 6 * w;
        for (const other of this.enemies) {
          if (other.hp > 0 && Math.hypot(other.x - target.x, other.y - target.y) <= 80) {
            if (!other.isBoss) {
              other.distanceTraveled = Math.max(0, other.distanceTraveled - 35);
            }
            this.applyElementalStatus(other, 'fire', sourceTowerId, 3.0, 0, 12, 1);
            this.dealDamage(other, dmg, 'fire', sourceTowerId, false, 1);
          }
        }
        break;
      }
      case 'fire_earth': {
        // Molten Slag: Spawns 65px magma patch (4.0s) dealing 28 + 3w DPS
        this.groundZones.push({
          id: this.nextId('gz'),
          towerId: sourceTowerId,
          element: 'fire',
          kind: 'magma_patch',
          x: target.x,
          y: target.y,
          radius: 65,
          duration: 4.0,
          maxDuration: 4.0,
          dps: 28 + 3 * w,
          slowPct: 0.2,
          pullSpeed: 0,
          vulnBonus: 0,
          stripsArmor: true,
          tickTimer: 0.1,
        });
        break;
      }
      case 'fire_ink': {
        // Scorched Lacquer: 75 + 9w True Burst Damage (bypasses all Armor/Resistances)
        this.dealDamage(target, 75 + 9 * w, 'fire', sourceTowerId, true, 1);
        break;
      }
      case 'air_earth': {
        // Sandstorm Shrapnel: Fires 6 grit needles (16 + 2w dmg each) in a 90° cone; strips Armor
        if (tower) {
          const cone = Math.PI / 2;
          for (let k = 0; k < 6; k++) {
            const offset = (k / 5 - 0.5) * cone;
            this.spawnProjectile({
              tower,
              kind: 'grit_needle',
              x: target.x,
              y: target.y,
              angle: target.angle + offset,
              speed: 360,
              damage: 16 + 2 * w,
              pierce: 2,
              splashRadius: 0,
              ricochetsLeft: 0,
              homingTurnRate: 0,
              targetId: null,
              maxLife: 0.55,
              stripsArmor: true,
            });
          }
        }
        break;
      }
      case 'air_ink': {
        // Calligraphy Gale: Launches 3 seeking ink-wind blades (24 + 3w dmg) dropping mini puddles
        if (tower) {
          for (let k = 0; k < 3; k++) {
            const ang = (k * Math.PI * 2) / 3;
            this.spawnProjectile({
              tower,
              kind: 'ink_wind_blade',
              x: target.x,
              y: target.y,
              angle: ang,
              speed: 295,
              damage: 24 + 3 * w,
              pierce: 2,
              splashRadius: 0,
              ricochetsLeft: 0,
              homingTurnRate: 0.14,
              targetId: null,
              maxLife: 1.8,
              spawnsMiniPuddle: true,
            });
          }
        }
        break;
      }
      case 'earth_ink': {
        // Petrified Seal: Freezes target 1.6s; target takes +50% damage from all sources while frozen
        target.freezeTimer = Math.max(target.freezeTimer, 1.6);
        this.dealDamage(target, 30 + 3 * w, 'earth', sourceTowerId, false, 1);
        break;
      }
    }

    this.notify();
  }

  private dealDamage(
    enemy: EnemyEntity,
    rawAmount: number,
    element: ElementType,
    sourceTowerId: string,
    isTrueDamage: boolean,
    recursionDepth: number
  ): void {
    if (enemy.hp <= 0 || rawAmount <= 0) return;

    let amount = rawAmount;

    if (!isTrueDamage) {
      // Armored: 50% dmg reduction vs Air & Water until stripped; +100% dmg from Earth
      if (enemy.isArmored && !enemy.armorStripped) {
        if (element === 'air' || element === 'water') {
          amount *= 0.5;
        } else if (element === 'earth') {
          amount *= 2.0;
        }
      }

      // Fractured status: +15% dmg taken
      if (enemy.statuses.earth) {
        amount *= 1.15;
      }

      // Petrified / Frozen: +50% dmg taken
      if (enemy.freezeTimer > 0) {
        amount *= 1.5;
      }

      // Ground zone vulnerability bonus (e.g. Wet Wake +20%, Abyssal Funnel +25%)
      if (enemy.vulnerabilityBonus > 0) {
        amount *= 1 + enemy.vulnerabilityBonus;
      }
    }

    const actualDamage = Math.min(enemy.hp, amount);
    enemy.hp -= actualDamage;
    enemy.hitFlash = 1.0;
    this.totalDamageDealt += actualDamage;

    const tower = this.towers.find((t) => t.id === sourceTowerId);
    if (tower) {
      tower.damageDealt += actualDamage;
    }

    // Ink B2 Soul Tether: share 40% of damage across linked enemies (guarded by recursionDepth)
    if (recursionDepth === 0 && enemy.tetherTimer > 0 && enemy.tetheredToIds.length > 0) {
      const shared = actualDamage * 0.4;
      for (const linkedId of enemy.tetheredToIds) {
        const linked = this.enemies.find((e) => e.id === linkedId && e.hp > 0);
        if (linked) {
          this.dealDamage(linked, shared, 'ink', sourceTowerId, true, 1);
        }
      }
    }

    if (enemy.hp <= 0) {
      this.onEnemyPopped(enemy, tower ?? null);
    }
  }

  private onEnemyPopped(enemy: EnemyEntity, killerTower: TowerEntity | null): void {
    this.ink += enemy.bounty;
    this.totalKills += 1;
    if (killerTower) {
      killerTower.kills += 1;
    }

    soundManager.playEnemyPop();

    // Spawn fluttering triangular paper confetti + ink splatters
    const spec = ENEMY_SPECS[enemy.type];
    const confettiCount = enemy.isBoss ? 22 : 7;
    for (let c = 0; c < confettiCount; c++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 25 + Math.random() * 85;
      const isInk = c % 3 === 0;
      this.confetti.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 15,
        size: isInk ? 3 + Math.random() * 4 : 5 + Math.random() * 5,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 10,
        color: isInk ? '#1A1918' : c % 2 === 0 ? spec.primaryColor : spec.secondaryColor,
        life: 0.55 + Math.random() * 0.35,
        maxLife: 0.85,
        isInkDrop: isInk,
      });
    }

    // Safe Child-Layer Spawning (unless prevented by Ink T3 tether)
    const peels = spec.peelsInto;
    const blockedByTether = enemy.tetherTimer > 0 && enemy.tetherNoSplit;
    if (peels && !blockedByTether) {
      for (let k = 0; k < peels.count; k++) {
        const offset = (k - (peels.count - 1) / 2) * 10;
        const childDist = Math.max(0, enemy.distanceTraveled + offset);
        this.spawnEnemy(
          peels.type,
          enemy.laneIndex,
          childDist,
          enemy.hitProjectileIds
        );
      }
    }

    this.notify();
  }

  private updateEffects(dt: number): void {
    for (let i = this.visualEffects.length - 1; i >= 0; i--) {
      const v = this.visualEffects[i];
      v.life -= dt;
      if (v.life <= 0) {
        this.visualEffects.splice(i, 1);
      }
    }

    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.life -= dt;
      c.y += c.vy * dt;
      if (c.life <= 0) {
        this.callouts.splice(i, 1);
      }
    }

    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const p = this.confetti[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
      p.vx *= 0.96;
      p.angle += p.vAngle * dt;
      if (p.life <= 0) {
        this.confetti.splice(i, 1);
      }
    }
  }

  private onWaveComplete(): void {
    this.waveActive = false;
    const bonus = getWaveClearBonus(this.wave);
    this.ink += bonus;

    this.callouts.push({
      id: this.nextId('cal'),
      x: LOGICAL_WIDTH / 2,
      y: 80,
      vy: -20,
      text: `WAVE ${this.wave} SEALED! +${bonus} INK`,
      color: '#2A9D8F',
      scale: 1.2,
      life: 1.5,
      maxLife: 1.5,
    });

    const isVictoryWave = this.wave === this.targetWaves && this.gameState === 'playing';
    saveHighScore({
      mapId: this.mapId,
      difficultyId: this.difficultyId,
      highestWave: this.wave,
      victoryAchieved: isVictoryWave || this.gameState === 'endless',
      totalKills: this.totalKills,
      combosTriggered: this.runCombosTriggered,
      timestamp: Date.now(),
    });

    if (isVictoryWave) {
      this.gameState = 'victory_prompt';
      soundManager.playElementalCombo();
      this.notify();
      return;
    }

    this.notify();

    if (this.autoNextWave && this.gameState !== 'defeat') {
      this.startNextWave();
    }
  }

  public getSnapshot(): EngineSnapshot {
    return {
      mapId: this.mapId,
      difficultyId: this.difficultyId,
      wave: this.wave,
      targetWaves: this.targetWaves,
      lives: this.lives,
      maxLives: this.maxLives,
      ink: this.ink,
      waveActive: this.waveActive,
      speedMultiplier: this.speedMultiplier,
      isPaused: this.isPaused,
      autoNextWave: this.autoNextWave,
      isMuted: soundManager.getMuted(),
      gameState: this.gameState,
      activeModifier: this.activeModifier,
      selectedTowerId: this.selectedTowerId,
      placingElement: this.placingElement,
      towers: this.towers.map((t) => ({ ...t })),
      enemiesCount: this.enemies.length + this.spawnQueue.length,
      discoveredCombos: Array.from(this.discoveredCombos),
      runCombosTriggered: this.runCombosTriggered,
      totalKills: this.totalKills,
      totalDamageDealt: Math.round(this.totalDamageDealt),
      resonanceLinks: this.resonanceLinks,
      recentComboBanner: this.recentComboBanner
        ? {
            name: this.recentComboBanner.name,
            kanji: this.recentComboBanner.kanji,
            color: this.recentComboBanner.color,
            isNewDiscovery: this.recentComboBanner.isNewDiscovery,
          }
        : null,
    };
  }
}
