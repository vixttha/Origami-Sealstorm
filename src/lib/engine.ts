import {
  COMBOS, CONDUIT_BONUS, DIFFICULTIES, ELEMENTS, ELEMENT_ORDER, ENEMIES, ENEMY_COLORS, FIXED_DT, H, W,
  comboFor, computeStats, endlessSpeed, hpScale, nextTierAllowed, overclockBonus, salvage, upgradeCost, waveClearBonus,
} from './constants';
import { nearestTrack, pointInConduit, sampleInto, validatePlacement } from './maps';
import type { LanePos } from './maps';
import * as sound from './sound';
import { loadCodex, markDiscovered, recordRun } from './storage';
import { endlessModifier, getWaveGroups } from './waves';
import type {
  Bomb, ComboDef, DifficultyId, Element, Enemy, EnemyKind, Fx, GameStatus, MapDef, ModifierId, PathId, Patch,
  PatchKind, ProjKind, Projectile, RunStats, SpawnEntry, Stats, TargetMode, Tether, Tower,
} from './types';

interface HitCtx {
  element: Element | null;
  tower?: Tower;
  st?: Stats;
  projId?: number;
  depth: number;
  trueDmg?: boolean;
  noReact?: boolean;
  noStatus?: boolean;
  shared?: boolean;
  stun?: boolean;
}

const DEFAULT_STATS: Record<Element, Stats> = {
  air: computeStats({ element: 'air', a: 0, b: 0, lastPath: 'A' }),
  fire: computeStats({ element: 'fire', a: 0, b: 0, lastPath: 'A' }),
  water: computeStats({ element: 'water', a: 0, b: 0, lastPath: 'A' }),
  earth: computeStats({ element: 'earth', a: 0, b: 0, lastPath: 'A' }),
  ink: computeStats({ element: 'ink', a: 0, b: 0, lastPath: 'A' }),
};

const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function segHitsCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number): boolean {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? clamp(((cx - x1) * dx + (cy - y1) * dy) / l2, 0, 1) : 0;
  const px = x1 + dx * t - cx, py = y1 + dy * t - cy;
  return px * px + py * py <= r * r;
}

function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class GameEngine {
  readonly map: MapDef;
  readonly diffId: DifficultyId;
  readonly target: number;
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  projs: Projectile[] = [];
  patches: Patch[] = [];
  fx: Fx[] = [];
  tethers: Tether[] = [];
  bombs: Bomb[] = [];
  queue: SpawnEntry[] = [];
  ink: number;
  lives: number;
  wave = 0;
  time = 0;
  speed: 1 | 2 | 3 = 1;
  paused = false;
  autoNext = false;
  status: GameStatus = 'playing';
  endless = false;
  modifier: ModifierId | null = null;
  bannerT = 0;
  bannerText = '';
  shake = 0;
  waveRunning = false;
  run: RunStats = { kills: 0, leaks: 0, inkEarned: 0, combos: 0 };
  discovered = new Set<string>();
  codex: Set<string>;
  destroyed = false;

  private nextId = 1;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private onFrame: ((e: GameEngine) => void) | null = null;
  private autoTimer = -1;
  private victoryShown = false;
  private recorded = false;
  private byId = new Map<number, Enemy>();
  private tmp: LanePos = { x: 0, y: 0, angle: 0 };

  constructor(map: MapDef, diffId: DifficultyId) {
    this.map = map;
    this.diffId = diffId;
    const d = DIFFICULTIES[diffId];
    this.target = d.waves;
    this.ink = d.ink;
    this.lives = d.lives;
    this.codex = new Set(loadCodex());
  }

  get diff() {
    return DIFFICULTIES[this.diffId];
  }

  // ------------------------------------------------------------ lifecycle
  start(onFrame: (e: GameEngine) => void): void {
    cancelAnimationFrame(this.raf);
    this.onFrame = onFrame;
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.destroyed) return;
      const raw = (now - this.last) / 1000;
      this.last = now;
      this.update(Math.min(Math.max(raw, 0), 0.05));
      if (this.onFrame) this.onFrame(this);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Advance by a (clamped) frame delta using fixed 1/60s sub-steps, 1-3 per frame by speed. */
  update(dt: number): void {
    if (this.destroyed) return;
    if (this.status !== 'playing' || this.paused) {
      this.stepFx(dt);
      return;
    }
    this.acc += dt;
    while (this.acc >= FIXED_DT) {
      this.acc -= FIXED_DT;
      for (let k = 0; k < this.speed; k++) {
        if (this.status !== 'playing') break;
        this.step(FIXED_DT);
      }
    }
  }

  /** Headless helper used for simulation. */
  advance(seconds: number): void {
    const n = Math.floor(seconds / FIXED_DT);
    for (let i = 0; i < n && this.status === 'playing'; i++) this.step(FIXED_DT);
  }

  destroy(): void {
    if (this.destroyed) return;
    if (!this.recorded && this.wave > 0) {
      this.recorded = true;
      recordRun(this.map.id, this.diffId, this.wave, false, this.run.kills);
    }
    this.destroyed = true;
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf);
    this.onFrame = null;
    this.towers = [];
    this.enemies = [];
    this.projs = [];
    this.patches = [];
    this.fx = [];
    this.tethers = [];
    this.bombs = [];
    this.queue = [];
    this.byId.clear();
    sound.silenceAll();
  }

  // ------------------------------------------------------------ player actions
  canPlace(x: number, y: number) {
    return validatePlacement(this.map, this.towers, x, y);
  }

  placeTower(el: Element, x: number, y: number): Tower | null {
    const def = ELEMENTS[el];
    if (this.status !== 'playing' || this.ink < def.cost) return null;
    if (!this.canPlace(x, y).ok) return null;
    this.ink -= def.cost;
    const t: Tower = {
      id: this.nextId++, element: el, x, y, a: 0, b: 0, lastPath: 'A', invested: def.cost, mode: 'first',
      cooldown: 0.2, kills: 0, damage: 0, shots: 0, special: 0.5, special2: 0.5, orbit: Math.random() * 6, inConduit: pointInConduit(this.map, x, y),
      aim: 0, firing: false, tickAcc: 0, flash: 0, age: 0,
    };
    this.towers.push(t);
    this.ring(x, y, 40, def.color, 0.5);
    sound.playPlace();
    return t;
  }

  towerById(id: number): Tower | undefined {
    return this.towers.find((t) => t.id === id);
  }

  upgradeCostFor(t: Tower, path: PathId): number {
    const cur = path === 'A' ? t.a : t.b;
    return upgradeCost(t.element, Math.min(3, cur), this.diff.cost);
  }

  canUpgrade(t: Tower, path: PathId): { ok: boolean; reason: string } {
    const r = nextTierAllowed(t, path);
    if (!r.ok) return r;
    if (this.ink < this.upgradeCostFor(t, path)) return { ok: false, reason: 'Not enough Ink' };
    return { ok: true, reason: '' };
  }

  upgradeTower(id: number, path: PathId): boolean {
    const t = this.towerById(id);
    if (!t || this.status !== 'playing') return false;
    if (!this.canUpgrade(t, path).ok) return false;
    const cost = this.upgradeCostFor(t, path);
    this.ink -= cost;
    t.invested += cost;
    if (path === 'A') t.a += 1;
    else t.b += 1;
    t.lastPath = path;
    t.flash = 1;
    this.ring(t.x, t.y, 50, '#D4A017', 0.6);
    this.text(t.x, t.y - 28, 'FOLDED!', '#B8860B', 14, 0.9);
    sound.playUpgrade();
    return true;
  }

  sellTower(id: number): number {
    const t = this.towerById(id);
    if (!t) return 0;
    const refund = salvage(t);
    this.ink += refund;
    this.towers = this.towers.filter((x) => x.id !== id);
    this.ring(t.x, t.y, 36, '#8a7a5a', 0.4);
    sound.playSell();
    return refund;
  }

  setTargetMode(id: number, mode: TargetMode): void {
    const t = this.towerById(id);
    if (t) t.mode = mode;
  }

  setAutoNext(v: boolean): void {
    this.autoNext = v;
    if (v && !this.waveRunning && this.wave > 0 && this.status === 'playing') this.autoTimer = 1;
  }

  canStartWave(): boolean {
    return this.status === 'playing' && (this.endless || this.wave < this.target);
  }

  startWave(): boolean {
    if (!this.canStartWave()) return false;
    const w = this.wave + 1;
    if (this.waveRunning) {
      const bonus = overclockBonus(w);
      this.ink += bonus;
      this.run.inkEarned += bonus;
      this.text(480, 40, `InkOverclock +${bonus}`, '#1A1918', 18, 1.4);
    }
    this.wave = w;
    this.waveRunning = true;
    this.autoTimer = -1;
    if (this.endless) {
      const m = endlessModifier(w, this.target);
      this.modifier = m.id;
      if (m.id && m.fresh) {
        this.bannerT = 4.5;
        this.bannerText = m.id;
      }
    }
    const groups = getWaveGroups(w, this.target);
    const lanes = this.map.lanes.length;
    const base = this.time + 0.6;
    groups.forEach((g, gi) => {
      for (let i = 0; i < g.count; i++) {
        this.queue.push({ t: base + g.delay + i * g.interval, kind: g.kind, lane: (i + gi) % lanes, wave: w });
      }
    });
    this.queue.sort((a, b) => a.t - b.t);
    sound.playWave();
    return true;
  }

  togglePause(): void {
    if (this.status === 'playing') this.paused = !this.paused;
  }

  setSpeed(s: 1 | 2 | 3): void {
    this.speed = s;
  }

  claimVictory(): void {
    if (this.status !== 'victory') return;
    this.status = 'won';
    if (!this.recorded) {
      this.recorded = true;
      recordRun(this.map.id, this.diffId, this.wave, true, this.run.kills);
    }
  }

  goEndless(): void {
    if (this.status !== 'victory') return;
    this.endless = true;
    this.status = 'playing';
    this.text(480, 80, 'THE INFINITE SCROLL UNROLLS', '#C1121F', 22, 2.2);
  }

  mvp(): Tower | null {
    let best: Tower | null = null;
    for (const t of this.towers) if (!best || t.damage > best.damage) best = t;
    return best;
  }

  // ------------------------------------------------------------ fx helpers
  private pushFx(f: Fx): void {
    if (this.fx.length < 700) this.fx.push(f);
  }
  ring(x: number, y: number, r: number, color: string, life = 0.5): void {
    this.pushFx({ k: 'ring', x, y, r, color, t: 0, life });
  }
  text(x: number, y: number, text: string, color: string, size = 16, life = 1.0): void {
    this.pushFx({ k: 'text', x, y, text, color, size, t: 0, life });
  }
  private confetti(x: number, y: number, n: number, color: string): void {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(30, 130);
      this.pushFx({ k: 'confetti', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, rot: rand(0, 6), vr: rand(-8, 8), color: i % 3 === 0 ? '#1A1918' : color, size: rand(3, 6), t: 0, life: rand(0.6, 1.2) });
    }
  }
  private splat(x: number, y: number, r: number): void {
    this.pushFx({ k: 'splat', x, y, r, seed: Math.random() * 1000, t: 0, life: 3.5 });
  }

  // ------------------------------------------------------------ core step
  private step(dt: number): void {
    this.time += dt;
    while (this.queue.length && this.queue[0].t <= this.time) {
      const s = this.queue.shift();
      if (s) this.spawnFromQueue(s);
    }
    this.byId.clear();
    for (const e of this.enemies) this.byId.set(e.id, e);
    this.stepPatches(dt);
    this.stepEnemies(dt);
    this.stepTowers(dt);
    this.stepProjectiles(dt);
    this.stepBombs(dt);
    this.stepTethers(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.projs = this.projs.filter((p) => !p.dead);
    this.patches = this.patches.filter((p) => p.t > 0);
    this.stepFx(dt);
    if (this.bannerT > 0) this.bannerT -= dt;
    this.checkWave(dt);
  }

  private spawnFromQueue(s: SpawnEntry): void {
    this.makeEnemy(s.kind, s.lane, s.wave, 0);
  }

  private makeEnemy(kind: EnemyKind, lane: number, wave: number, dist: number): Enemy {
    const def = ENEMIES[kind];
    const hp = def.hp * hpScale(wave, this.target) * this.diff.hp;
    const ln = this.map.lanes[lane];
    const e: Enemy = {
      id: this.nextId++, kind, lane, dist: clamp(dist, 0, ln.length - 1), x: 0, y: 0, angle: 0, hp, maxHp: hp, wave, radius: def.radius,
      camo: kind === 'fox', armored: kind === 'tortoise', dead: false, hitIds: new Set(), reactionCd: 0,
      wind: 0, burn: 0, burnDps: 0, soak: 0, soakSlow: 0.25, fract: 0, stain: 0, stainSlow: 0.45, stainPerm: false,
      stun: 0, root: 0, frozen: 0, frozenKind: 'none', slowT: 0, slowPct: 0, patchSlow: 0, pulledT: 0, wakeT: 0,
      soakHits: 0, tetherId: 0, orbitCd: new Map(), flash: 0, age: 0, lastHitBy: 0,
    };
    if (this.modifier === 'iron' && kind !== 'dragon') e.armored = true;
    if (this.modifier === 'mist' && kind !== 'dragon' && Math.random() < 0.3) e.camo = true;
    sampleInto(ln, e.dist, this.tmp);
    e.x = this.tmp.x; e.y = this.tmp.y; e.angle = this.tmp.angle;
    this.enemies.push(e);
    this.byId.set(e.id, e);
    return e;
  }

  enemySpeed(e: Enemy): number {
    const def = ENEMIES[e.kind];
    const ln = this.map.lanes[e.lane];
    let s = def.speed * this.diff.speed * endlessSpeed(e.wave, this.target);
    if (this.modifier === 'swift') s *= 1.25;
    if (this.map.spiralBoost && e.dist < ln.length * 0.4) s *= 1.15;
    return s;
  }

  private hasStatus(e: Enemy, el: Element): boolean {
    switch (el) {
      case 'air': return e.wind > 0;
      case 'fire': return e.burn > 0;
      case 'water': return e.soak > 0;
      case 'earth': return e.fract > 0;
      case 'ink': return e.stain > 0 || e.stainPerm;
    }
  }

  private clearStatus(e: Enemy, el: Element): void {
    switch (el) {
      case 'air': e.wind = 0; break;
      case 'fire': e.burn = 0; break;
      case 'water': e.soak = 0; break;
      case 'earth': e.fract = 0; break;
      case 'ink': e.stain = 0; e.stainPerm = false; break;
    }
  }

  private stepEnemies(dt: number): void {
    const n = this.enemies.length;
    for (let i = 0; i < n; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt * 6);
      e.reactionCd = Math.max(0, e.reactionCd - dt);
      e.wind = Math.max(0, e.wind - dt);
      e.soak = Math.max(0, e.soak - dt);
      e.fract = Math.max(0, e.fract - dt);
      e.stain = Math.max(0, e.stain - dt);
      e.stun = Math.max(0, e.stun - dt);
      e.root = Math.max(0, e.root - dt);
      e.slowT = Math.max(0, e.slowT - dt);
      e.pulledT = Math.max(0, e.pulledT - dt);
      e.wakeT = Math.max(0, e.wakeT - dt);
      if (e.frozen > 0) {
        e.frozen -= dt;
        if (e.frozen <= 0) { e.frozen = 0; e.frozenKind = 'none'; }
      }
      if (e.burn > 0) {
        e.burn -= dt;
        this.hit(e, e.burnDps * dt, { element: null, depth: 1, noReact: true, noStatus: true });
        if (e.dead) continue;
      }
      let slow = 0;
      if (e.soak > 0 && e.kind !== 'serpent') slow = Math.max(slow, e.soakSlow);
      if (e.stain > 0) slow = Math.max(slow, e.stainSlow);
      if (e.slowT > 0) slow = Math.max(slow, e.slowPct);
      slow = Math.max(slow, e.patchSlow);
      e.patchSlow = 0;
      if (e.tetherId) {
        const th = this.tethers.find((x) => x.id === e.tetherId);
        if (th && th.slow) slow = Math.max(slow, 0.3);
      }
      if (e.kind === 'dragon') slow = Math.min(slow, 0.25);
      slow = Math.min(0.9, slow);
      let mult = 1 - slow;
      if (e.kind !== 'dragon' && (e.stun > 0 || e.root > 0 || e.frozen > 0)) mult = 0;
      const ln = this.map.lanes[e.lane];
      e.dist = Math.max(0, e.dist + this.enemySpeed(e) * mult * dt);
      if (e.dist >= ln.length) {
        this.leak(e);
        continue;
      }
      sampleInto(ln, e.dist, this.tmp);
      e.x = this.tmp.x; e.y = this.tmp.y; e.angle = this.tmp.angle;
    }
  }

  private leak(e: Enemy): void {
    e.dead = true;
    const def = ENEMIES[e.kind];
    this.lives = Math.max(0, this.lives - def.leak);
    this.run.leaks += 1;
    this.shake = Math.max(this.shake, 4);
    this.ring(e.x, e.y, 40, '#C1121F', 0.5);
    sound.playLeak();
    if (this.lives <= 0 && this.status === 'playing') {
      this.status = 'defeat';
      if (!this.recorded) {
        this.recorded = true;
        recordRun(this.map.id, this.diffId, this.wave, false, this.run.kills);
      }
      sound.playDefeat();
    }
  }

  private checkWave(dt: number): void {
    if (this.waveRunning && this.queue.length === 0 && this.enemies.length === 0 && this.status === 'playing') {
      this.waveRunning = false;
      const bonus = waveClearBonus(this.wave);
      this.ink += bonus;
      this.run.inkEarned += bonus;
      this.text(480, 300, `Wave ${this.wave} cleared  +${bonus} Ink`, '#1A1918', 20, 1.8);
      if (!this.endless && this.wave >= this.target && !this.victoryShown) {
        this.victoryShown = true;
        this.status = 'victory';
        sound.playVictory();
      } else if (this.autoNext) {
        this.autoTimer = 1.2;
      }
    }
    if (this.autoTimer >= 0) {
      this.autoTimer -= dt;
      if (this.autoTimer < 0) {
        this.autoTimer = -1;
        if (!this.waveRunning) this.startWave();
      }
    }
  }

  // ------------------------------------------------------------ damage model
  private hit(e: Enemy, amount: number, ctx: HitCtx): void {
    if (e.dead || amount <= 0) return;
    const el = ctx.element;
    const st = ctx.st ?? (el ? DEFAULT_STATS[el] : undefined);
    let reacted = false;
    if (el && !ctx.noReact && ctx.depth === 0 && e.reactionCd <= 0) {
      for (const other of ELEMENT_ORDER) {
        if (other === el || !this.hasStatus(e, other)) continue;
        const c = comboFor(other, el);
        if (c) {
          this.triggerReaction(e, c, other, ctx);
          reacted = true;
          break;
        }
      }
    }
    let dmg = amount;
    if (!ctx.trueDmg) {
      if (e.armored) {
        if (el === 'air' || el === 'water') dmg *= 0.5;
        else if (el === 'earth') dmg *= 2;
      }
      if (e.fract > 0) dmg *= 1.15;
      if (e.frozen > 0 && e.frozenKind === 'petrify') dmg *= 1.5;
      if (e.pulledT > 0) dmg *= 1.25;
    }
    e.hp -= dmg;
    if (dmg > 0.5) e.flash = 1;
    const tw = ctx.tower ?? (e.lastHitBy ? this.towerById(e.lastHitBy) : undefined);
    if (tw) tw.damage += dmg;
    if (ctx.tower) e.lastHitBy = ctx.tower.id;
    if (e.tetherId && !ctx.shared) {
      const th = this.tethers.find((x) => x.id === e.tetherId);
      if (th) {
        for (const id of th.members) {
          if (id === e.id) continue;
          const o = this.byId.get(id);
          if (o && !o.dead) this.hit(o, dmg * 0.4, { element: null, depth: 1, noReact: true, noStatus: true, shared: true, tower: ctx.tower });
        }
      }
    }
    if (el && st && !reacted && !ctx.noStatus && e.hp > 0) this.applyStatus(e, el, st, ctx);
    if (e.hp <= 0) this.kill(e, ctx, tw);
  }

  private applyStatus(e: Enemy, el: Element, st: Stats, ctx: HitCtx): void {
    switch (el) {
      case 'air':
        e.wind = 3;
        if (st.stripCamo) e.camo = false;
        break;
      case 'fire':
        e.burnDps = e.burn > 0 ? Math.max(e.burnDps, st.burnDps) : st.burnDps;
        e.burn = st.burnT;
        break;
      case 'water':
        if (st.lotus) {
          if (e.frozen > 0 && e.frozenKind === 'lotus') {
            const x = e.x, y = e.y;
            e.frozen = 0; e.frozenKind = 'none';
            this.pushFx({ k: 'lotus', x, y, t: 0, life: 0.8 });
            this.text(x, y - 22, 'SHATTER!', '#8DB9FF', 18, 0.9);
            this.aoe(x, y, 60, 110, { element: null, depth: 1, noReact: true, noStatus: true, tower: ctx.tower });
          } else if (e.soak > 0) {
            e.soakHits += 1;
            if (e.soakHits >= 3 && e.kind !== 'dragon') {
              e.soakHits = 0; e.frozen = 1.8; e.frozenKind = 'lotus';
              this.pushFx({ k: 'lotus', x: e.x, y: e.y, t: 0, life: 1.0 });
            }
          }
        }
        e.soak = st.soakT; e.soakSlow = st.soakSlow; e.camo = false;
        break;
      case 'earth':
        e.fract = 3;
        if (ctx.stun && st.stun > 0 && e.kind !== 'dragon') e.stun = Math.max(e.stun, st.stun);
        break;
      case 'ink':
        e.stain = st.stainT; e.stainSlow = st.stainSlow; e.camo = false;
        break;
    }
  }

  private aoe(x: number, y: number, r: number, dmg: number, ctx: HitCtx, after?: (e: Enemy) => void): void {
    const n = this.enemies.length;
    for (let i = 0; i < n; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      const rr = r + e.radius * 0.5;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= rr * rr) {
        this.hit(e, dmg, ctx);
        if (after) after(e);
      }
    }
  }

  knock(e: Enemy, px: number): void {
    if (px <= 0 || e.dead || e.kind === 'dragon') return;
    if (e.kind === 'crane' && px < 20) return;
    e.dist = Math.max(0, e.dist - px);
  }

  private kill(e: Enemy, ctx: HitCtx, tw: Tower | undefined): void {
    if (e.dead) return;
    e.dead = true;
    const def = ENEMIES[e.kind];
    this.run.kills += 1;
    this.ink += def.bounty;
    this.run.inkEarned += def.bounty;
    if (tw) tw.kills += 1;
    sound.playPop(this.time);
    this.confetti(e.x, e.y, e.kind === 'dragon' ? 30 : 8, ENEMY_COLORS[e.kind]);
    this.splat(e.x, e.y, e.kind === 'dragon' ? 40 : 10 + def.radius * 0.5);
    let kids: EnemyKind[] = def.peels;
    if (e.kind === 'serpent' && e.tetherId) {
      const th = this.tethers.find((x) => x.id === e.tetherId);
      if (th && th.slow) kids = [];
    }
    const offs = [-6, 6, 0];
    kids.forEach((k, i) => {
      const c = this.makeEnemy(k, e.lane, e.wave, e.dist + offs[i % 3]);
      c.hitIds = new Set(e.hitIds);
      if (ctx.projId !== undefined) c.hitIds.add(ctx.projId);
      c.wind = e.wind; c.burn = e.burn; c.burnDps = e.burnDps; c.soak = e.soak; c.soakSlow = e.soakSlow;
      c.fract = e.fract; c.stain = e.stain; c.stainSlow = e.stainSlow; c.stainPerm = e.stainPerm;
      c.reactionCd = Math.max(e.reactionCd, 0.15); c.lastHitBy = e.lastHitBy;
      if (e.kind === 'dragon') c.dist = clamp(e.dist + (i - 1) * 14, 0, this.map.lanes[e.lane].length - 1);
    });
  }

  // ------------------------------------------------------------ elemental reactions
  private triggerReaction(e: Enemy, c: ComboDef, consumed: Element, ctx: HitCtx): void {
    const w = this.wave;
    this.clearStatus(e, consumed);
    e.reactionCd = 1.2;
    this.run.combos += 1;
    if (!this.discovered.has(c.id)) {
      this.discovered.add(c.id);
      this.ink += 25;
      this.run.inkEarned += 25;
      this.text(e.x + 18, e.y - 36, '+25 Ink Discovery', '#B8860B', 13, 1.5);
    }
    if (!this.codex.has(c.id)) {
      this.codex.add(c.id);
      markDiscovered(c.id);
    }
    this.ring(e.x, e.y, 80, c.color, 0.6);
    this.pushFx({ k: 'stamp', x: e.x + rand(-10, 10), y: e.y - 6, text: c.kanji, t: 0, life: 1.1 });
    this.text(e.x, e.y - 24, c.callout, c.color, 20, 1.1);
    this.shake = 3;
    sound.playCombo();
    const rc: HitCtx = { element: null, depth: 1, noReact: true, noStatus: true, tower: ctx.tower };
    const wake = e.wakeT > 0 ? 1.2 : 1;
    switch (c.id) {
      case 'steam':
        this.aoe(e.x, e.y, 85, (45 + 6 * w) * wake, rc, (o) => { o.slowT = 2.5; o.slowPct = Math.max(o.slowPct, 0.4); });
        break;
      case 'monsoon': {
        const chain: Enemy[] = [e];
        const pts = [{ x: e.x, y: e.y }];
        let cur = e;
        for (let k = 0; k < 5; k++) {
          let best: Enemy | null = null, bd = 110 * 110;
          for (const o of this.enemies) {
            if (o.dead || chain.includes(o)) continue;
            const d = (o.x - cur.x) ** 2 + (o.y - cur.y) ** 2;
            if (d < bd) { bd = d; best = o; }
          }
          if (!best) break;
          chain.push(best); pts.push({ x: best.x, y: best.y }); cur = best;
        }
        this.pushFx({ k: 'chain', pts, color: '#2A9D8F', t: 0, life: 0.5 });
        for (const o of chain) this.hit(o, (35 + 4 * w) * wake, rc);
        break;
      }
      case 'mudslide':
        if (e.kind !== 'dragon') e.root = 1.3;
        e.armored = false;
        this.hit(e, (40 + 5 * w) * wake, rc);
        break;
      case 'wash':
        this.aoe(e.x, e.y, 115, 25, rc, (o) => {
          if (o === e) return;
          o.soak = 3.5; o.soakSlow = 0.25; o.stain = 4; o.stainSlow = 0.45; o.camo = false;
        });
        break;
      case 'firestorm':
        e.burn = 3; e.burnDps = Math.max(e.burnDps, 6);
        this.aoe(e.x, e.y, 80, (50 + 6 * w) * wake, rc, (o) => this.knock(o, 35));
        break;
      case 'slag':
        this.addPatch('magma', e.x, e.y, 65, 4, 28 + 3 * w);
        break;
      case 'lacquer':
        this.hit(e, 75 + 9 * w, { ...rc, trueDmg: true });
        break;
      case 'sandstorm': {
        const tw = ctx.tower;
        const base = tw ? Math.atan2(e.y - tw.y, e.x - tw.x) : e.angle;
        e.armored = false;
        for (let i = 0; i < 6; i++) {
          const a = base + (i - 2.5) * ((Math.PI / 2) / 5);
          const p = this.newProj('needle', 'air', null, DEFAULT_STATS.air, e.x, e.y, {
            vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, dmg: 16 + 2 * w, pierce: 1, life: 0.4, radius: 5, noReact: true,
            hitIds: new Set([e.id]), speed: 380,
          });
          p.rot = a;
        }
        break;
      }
      case 'gale': {
        const cands = this.enemies.filter((o) => !o.dead && o !== e).sort((a, b) => (a.x - e.x) ** 2 + (a.y - e.y) ** 2 - ((b.x - e.x) ** 2 + (b.y - e.y) ** 2));
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + rand(0, 1);
          const tg = cands[i] ?? e;
          const p = this.newProj('blade', 'ink', null, DEFAULT_STATS.ink, e.x, e.y, {
            vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, dmg: 24 + 3 * w, pierce: 1, life: 2, radius: 8, noReact: true,
            targetId: tg.id, speed: 300, turn: 8,
          });
          p.rot = a;
        }
        break;
      }
      case 'petrify':
        if (e.kind !== 'dragon') { e.frozen = 1.6; e.frozenKind = 'petrify'; }
        break;
    }
  }

  // ------------------------------------------------------------ patches
  private addPatch(kind: PatchKind, x: number, y: number, r: number, t: number, dps: number, o: Partial<Patch> = {}, maxStack = 1): void {
    if (kind === 'ash') {
      for (const p of this.patches) {
        if (p.kind === 'ash' && p.t > 0 && Math.hypot(p.x - x, p.y - y) < 26) {
          p.stacks = Math.min(maxStack, p.stacks + 1);
          p.t = Math.max(p.t, t); p.max = Math.max(p.max, t); p.dps = Math.max(p.dps, dps);
          return;
        }
      }
    }
    if (this.patches.length > 140) this.patches.shift();
    this.patches.push({ id: this.nextId++, kind, x, y, r, t, max: t, dps, stacks: 1, slow: 0, corrode: false, pull: 0, pullBonus: false, seed: Math.random() * 100, ...o });
  }

  private stepPatches(dt: number): void {
    for (const p of this.patches) {
      p.t -= dt;
      if (p.t <= 0) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const rr = p.r + e.radius * 0.5;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        const dot = { element: null, depth: 1, noReact: true, noStatus: true } as const;
        switch (p.kind) {
          case 'ash':
          case 'magma':
            this.hit(e, p.dps * p.stacks * dt, dot);
            break;
          case 'puddle':
            e.patchSlow = Math.max(e.patchSlow, p.slow);
            if (p.corrode) { e.armored = false; this.hit(e, p.dps * dt, dot); }
            break;
          case 'mini':
            e.patchSlow = Math.max(e.patchSlow, p.slow);
            break;
          case 'wake':
            e.patchSlow = Math.max(e.patchSlow, p.slow);
            e.wakeT = 0.3;
            break;
          case 'vortex': {
            if (e.kind !== 'dragon') {
              const ln = this.map.lanes[e.lane];
              const a = sampleInto(ln, e.dist + 4, this.tmp);
              const d1 = (a.x - p.x) ** 2 + (a.y - p.y) ** 2;
              const b = sampleInto(ln, e.dist - 4, this.tmp);
              const d2 = (b.x - p.x) ** 2 + (b.y - p.y) ** 2;
              e.dist = clamp(e.dist + (d1 < d2 ? 1 : -1) * p.pull * dt, 0, ln.length - 0.5);
            }
            if (p.pullBonus) e.pulledT = 0.4;
            this.hit(e, p.dps * dt, dot);
            break;
          }
        }
        if (e.dead) continue;
      }
    }
  }

  // ------------------------------------------------------------ towers
  private pickTarget(t: Tower, st: Stats, range: number, mode?: TargetMode): Enemy | null {
    const m = mode ?? t.mode;
    const seeCamo = t.element === 'ink' || t.element === 'water' || (t.element === 'air' && st.stripCamo);
    let best: Enemy | null = null;
    let bs = -Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.camo && !seeCamo) continue;
      const dx = e.x - t.x, dy = e.y - t.y;
      const d2 = dx * dx + dy * dy;
      const rr = range + e.radius * 0.5;
      if (d2 > rr * rr) continue;
      let s: number;
      switch (m) {
        case 'first': s = e.dist; break;
        case 'last': s = -e.dist; break;
        case 'strong': s = e.hp; break;
        case 'close': s = -d2; break;
        case 'unprimed': s = (this.hasStatus(e, t.element) ? 0 : 1e6) + e.dist; break;
      }
      if (s > bs) { bs = s; best = e; }
    }
    return best;
  }

  private stepTowers(dt: number): void {
    for (const t of this.towers) {
      t.age += dt;
      t.flash = Math.max(0, t.flash - dt * 5);
      const st = computeStats(t);
      const range = st.range * (t.inConduit ? CONDUIT_BONUS : 1);
      this.orbitals(t, st, dt);
      this.specials(t, st, range, dt);
      if (st.cone || st.laser) {
        this.continuous(t, st, range, dt);
        continue;
      }
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      const tgt = this.pickTarget(t, st, range);
      if (!tgt) { t.cooldown = 0; continue; }
      this.fire(t, st, tgt);
      t.cooldown += 1 / st.rate;
      if (t.cooldown < 0) t.cooldown = 1 / st.rate;
    }
  }

  private orbitals(t: Tower, st: Stats, dt: number): void {
    if (st.orbit <= 0) return;
    t.orbit += dt * 2.4;
    for (let k = 0; k < st.orbit; k++) {
      const a = t.orbit + (k * Math.PI * 2) / st.orbit;
      const bx = t.x + Math.cos(a) * st.orbitR, by = t.y + Math.sin(a) * st.orbitR;
      for (const e of this.enemies) {
        if (e.dead || e.camo) continue;
        const rr = e.radius + 9;
        if ((e.x - bx) ** 2 + (e.y - by) ** 2 > rr * rr) continue;
        const nxt = e.orbitCd.get(t.id) ?? 0;
        if (nxt > this.time) continue;
        e.orbitCd.set(t.id, this.time + 0.4);
        this.hit(e, st.orbitDmg, { element: 'earth', tower: t, st, depth: 0 });
      }
    }
  }

  private specials(t: Tower, st: Stats, range: number, dt: number): void {
    t.special -= dt;
    t.special2 -= dt;
    switch (t.element) {
      case 'fire':
        if (st.barrage && t.special <= 0 && this.skyBarrage(t, st, range)) t.special = 2.2;
        break;
      case 'water':
        if (st.tsunami && t.special <= 0 && this.enemies.length > 0) {
          this.greatWave(t, st);
          t.special = 6;
        }
        break;
      case 'earth':
        if (st.darts && t.special <= 0 && this.launchDarts(t, st, range)) t.special = 3;
        if (st.beam && t.special2 <= 0) {
          const tg = this.pickTarget(t, st, range);
          if (tg) { this.orreryBeam(t, tg, range); t.special2 = 1.2; }
        }
        break;
      case 'ink':
        if (st.pool && t.special <= 0 && this.pickTarget(t, st, range)) {
          const np = nearestTrack(this.map, t.x, t.y);
          if (np.d <= range) {
            this.addPatch('puddle', np.x, np.y, 64, 5.5, 18, { slow: 0.6, corrode: st.corrode });
            this.ring(np.x, np.y, 50, '#1A1918', 0.5);
          }
          t.special = 1.1;
        }
        if (st.dragon && t.special2 <= 0 && this.enemies.length > 0) {
          for (const ln of this.map.lanes) {
            this.newProj('dragon', 'ink', t, st, ln.xs[ln.xs.length - 1], ln.ys[ln.ys.length - 1], {
              lane: ln.id, dist: ln.length, dir: -1, speed: 330, pierce: 9999, dmg: 120, life: 30, maxTravel: ln.length + 10, radius: 20,
            });
          }
          this.text(480, 60, 'LIVING DRAGON SCROLL', '#1A1918', 20, 1.4);
          t.special2 = 7;
        }
        break;
      default:
        break;
    }
  }

  private leadPos(e: Enemy, secs: number): { x: number; y: number } {
    const ln = this.map.lanes[e.lane];
    sampleInto(ln, clamp(e.dist + this.enemySpeed(e) * secs * 0.8, 0, ln.length), this.tmp);
    return { x: this.tmp.x, y: this.tmp.y };
  }

  private newProj(kind: ProjKind, el: Element, t: Tower | null, st: Stats, x: number, y: number, o: Partial<Projectile>): Projectile {
    const p: Projectile = {
      id: this.nextId++, kind, element: el, towerId: t ? t.id : 0, st, x, y, px: x, py: y, vx: 0, vy: 0, speed: st.speed, turn: st.turn,
      dmg: st.dmg, pierce: st.pierce, splash: st.splash, radius: 7, life: 2, age: 0, targetId: 0, hitIds: new Set(), bounces: 0, knock: 0,
      sx: x, sy: y, tx: x, ty: y, dur: 0.6, height: 0, lane: 0, dist: 0, dir: 1, travelled: 0, maxTravel: 0, noReact: false, sky: false,
      dead: false, wakeAcc: 0, rot: Math.random() * 6.28,
    };
    Object.assign(p, o);
    if (this.projs.length < 900) this.projs.push(p);
    else p.dead = true;
    return p;
  }

  private fire(t: Tower, st: Stats, tgt: Enemy): void {
    t.aim = Math.atan2(tgt.y - t.y, tgt.x - t.x);
    t.flash = 1;
    t.shots += 1;
    sound.playShot(this.time);
    const ang = t.aim;
    const dirv = (a: number, s: number) => ({ vx: Math.cos(a) * s, vy: Math.sin(a) * s });
    switch (t.element) {
      case 'air':
        if (st.whirl && t.shots % 4 === 0) {
          this.newProj('whirlwind', 'air', t, st, t.x, t.y, { ...dirv(ang, 230), speed: 230, dmg: 55, pierce: 15, radius: 55, knock: 75, life: 1.5, maxTravel: 330 });
        } else if (st.fan) {
          this.newProj('fan', 'air', t, st, t.x, t.y, { ...dirv(ang, 300), speed: 300, radius: 22, knock: st.knock, life: 2.6, bounces: 2 });
        } else if (st.crane) {
          for (let i = 0; i < st.volley; i++) {
            const a = ang + (st.volley > 1 ? (i - 1) * 0.28 : 0);
            this.newProj('crane', 'air', t, st, t.x, t.y, { ...dirv(a, st.speed), targetId: tgt.id, life: 3.5, radius: 9 });
          }
        } else {
          this.newProj('shuriken', 'air', t, st, t.x, t.y, { ...dirv(ang, st.speed), targetId: tgt.id, life: 1.8, radius: 8 });
        }
        break;
      case 'fire': {
        const d = Math.hypot(tgt.x - t.x, tgt.y - t.y);
        const dur = clamp(d / 260, 0.35, 1.1);
        const lp = this.leadPos(tgt, dur);
        this.newProj('lantern', 'fire', t, st, t.x, t.y, { tx: lp.x, ty: lp.y, dur, life: dur + 0.2, height: 46 });
        break;
      }
      case 'water':
        if (st.koi) {
          const ln = this.map.lanes[tgt.lane];
          const start = clamp(tgt.dist + 36, 0, ln.length);
          this.newProj('koi', 'water', t, st, t.x, t.y, { lane: tgt.lane, dist: start, dir: -1, speed: 250, maxTravel: 220, life: 6, radius: 12 });
        } else {
          this.newProj('wave', 'water', t, st, t.x, t.y, { ...dirv(ang, st.speed), targetId: tgt.id, bounces: st.bounces, turn: 9, life: 2.6, radius: 9, pierce: 999 });
        }
        break;
      case 'earth':
        if (st.boulder) {
          this.newProj('boulder', 'earth', t, st, t.x, t.y, { ...dirv(ang, 190), speed: 190, radius: 20, life: 4, maxTravel: 280 });
        } else {
          this.newProj('spike', 'earth', t, st, t.x, t.y, { ...dirv(ang, st.speed), targetId: tgt.id, turn: 9, life: 2, radius: 9 });
        }
        break;
      case 'ink':
        if (st.cube && t.shots % 5 === 0) {
          if (tgt.kind !== 'dragon') { tgt.frozen = 2.5; tgt.frozenKind = 'cube'; }
          this.bombs.push({ t: 2.5, enemyId: tgt.id, x: tgt.x, y: tgt.y, r: 90, dmg: 160, towerId: t.id });
          this.ring(tgt.x, tgt.y, 36, '#1D1E2C', 0.7);
          this.text(tgt.x, tgt.y - 26, 'VOID CUBE', '#3b3d5e', 14, 1.2);
        } else {
          const d = Math.hypot(tgt.x - t.x, tgt.y - t.y);
          const dur = clamp(d / 300, 0.28, 0.9);
          const lp = this.leadPos(tgt, dur);
          this.newProj('blot', 'ink', t, st, t.x, t.y, { tx: lp.x, ty: lp.y, dur, life: dur + 0.2, height: 18 });
        }
        break;
    }
  }

  private continuous(t: Tower, st: Stats, range: number, dt: number): void {
    const tgt = this.pickTarget(t, st, range, st.laser ? 'strong' : t.mode);
    if (!tgt) { t.firing = false; t.tickAcc = 0; return; }
    t.firing = true;
    t.aim = Math.atan2(tgt.y - t.y, tgt.x - t.x);
    t.tickAcc += dt;
    const per = 1 / st.rate;
    let guard = 0;
    while (t.tickAcc >= per && guard++ < 4) {
      t.tickAcc -= per;
      const ctx: HitCtx = { element: 'fire', tower: t, st, depth: 0 };
      if (st.laser) {
        const lx = Math.cos(t.aim) * 1400, ly = Math.sin(t.aim) * 1400;
        for (const e of this.enemies) {
          if (e.dead || e.camo) continue;
          if (segHitsCircle(t.x, t.y, t.x + lx, t.y + ly, e.x, e.y, 7 + e.radius * 0.6)) this.hit(e, st.dmg, ctx);
        }
      } else {
        const reach = 125 * (t.inConduit ? CONDUIT_BONUS : 1);
        for (const e of this.enemies) {
          if (e.dead || e.camo) continue;
          const dx = e.x - t.x, dy = e.y - t.y;
          if (dx * dx + dy * dy > (reach + e.radius) ** 2) continue;
          if (Math.abs(angDiff(Math.atan2(dy, dx), t.aim)) > st.coneAng / 2) continue;
          e.armored = false;
          this.hit(e, st.dmg, ctx);
        }
      }
    }
  }

  private skyBarrage(t: Tower, st: Stats, range: number): boolean {
    const cand = this.enemies.filter((e) => !e.dead && !e.camo && (e.x - t.x) ** 2 + (e.y - t.y) ** 2 <= (range + 80) ** 2);
    if (!cand.length) return false;
    const used: { x: number; y: number }[] = [];
    for (let k = 0; k < 8; k++) {
      let best = cand[0], bs = -Infinity;
      for (const c of cand) {
        let s = 0;
        for (const o of cand) if ((o.x - c.x) ** 2 + (o.y - c.y) ** 2 < 64 * 64) s += 1;
        for (const u of used) if ((u.x - c.x) ** 2 + (u.y - c.y) ** 2 < 40 * 40) s -= 3;
        s += Math.random() * 0.5;
        if (s > bs) { bs = s; best = c; }
      }
      const lp = this.leadPos(best, 0.6);
      const tx = lp.x + rand(-14, 14), ty = lp.y + rand(-14, 14);
      used.push({ x: tx, y: ty });
      const dur = 0.55 + k * 0.07;
      this.newProj('lantern', 'fire', t, st, tx + rand(-30, 30), -24, { sky: true, sx: tx + rand(-30, 30), sy: -24, tx, ty, dur, life: dur + 0.2, dmg: 65, splash: 64, height: 0 });
    }
    return true;
  }

  private greatWave(t: Tower, st: Stats): void {
    this.pushFx({ k: 'wave', t: 0, life: 1.2 });
    this.text(480, 70, 'GREAT WAVE', '#3A86FF', 24, 1.4);
    this.shake = 3;
    const n = this.enemies.length;
    for (let i = 0; i < n; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      this.hit(e, 95, { element: 'water', tower: t, st, depth: 0 });
      this.knock(e, 65);
    }
  }

  private launchDarts(t: Tower, st: Stats, range: number): boolean {
    const cand = this.enemies
      .filter((e) => !e.dead && !e.camo && (e.x - t.x) ** 2 + (e.y - t.y) ** 2 <= range * range)
      .sort((a, b) => b.dist - a.dist);
    if (!cand.length) return false;
    for (let k = 0; k < 3; k++) {
      const a = t.orbit + (k * Math.PI * 2) / 3;
      const tg = cand[k % cand.length];
      this.newProj('dart', 'earth', t, st, t.x + Math.cos(a) * 68, t.y + Math.sin(a) * 68, {
        dmg: 45, pierce: 1, speed: 380, turn: 10, targetId: tg.id, life: 2, radius: 8, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380,
      });
    }
    return true;
  }

  private orreryBeam(t: Tower, tgt: Enemy, range: number): void {
    const a = Math.atan2(tgt.y - t.y, tgt.x - t.x);
    t.aim = a;
    const len = range + 70;
    const x2 = t.x + Math.cos(a) * len, y2 = t.y + Math.sin(a) * len;
    this.pushFx({ k: 'beam', x1: t.x, y1: t.y, x2, y2, w: 7, color: '#D4A373', t: 0, life: 0.3 });
    const st = computeStats(t);
    const n = this.enemies.length;
    for (let i = 0; i < n; i++) {
      const e = this.enemies[i];
      if (e.dead || e.camo) continue;
      if (segHitsCircle(t.x, t.y, x2, y2, e.x, e.y, 6 + e.radius * 0.6)) this.hit(e, 65, { element: 'earth', tower: t, st, depth: 0 });
    }
  }

  // ------------------------------------------------------------ projectiles
  private stepProjectiles(dt: number): void {
    const n = this.projs.length;
    for (let i = 0; i < n; i++) {
      const p = this.projs[i];
      if (p.dead) continue;
      p.age += dt;
      p.px = p.x; p.py = p.y;
      switch (p.kind) {
        case 'lantern':
        case 'blot':
        case 'spark':
          this.stepLob(p);
          break;
        case 'koi':
        case 'dragon':
          this.stepLane(p, dt);
          break;
        case 'shuriken':
        case 'crane':
        case 'swallow':
        case 'wave':
        case 'spike':
        case 'dart':
        case 'blade':
          this.stepHoming(p, dt);
          break;
        default:
          this.stepStraight(p, dt);
      }
      if (!p.dead && p.age >= p.life && p.kind !== 'lantern' && p.kind !== 'blot' && p.kind !== 'spark') {
        if (p.kind === 'boulder') this.detonate(p);
        p.dead = true;
      }
    }
  }

  private stepLob(p: Projectile): void {
    const f = Math.min(1, p.age / p.dur);
    p.x = p.sx + (p.tx - p.sx) * f;
    p.y = p.sy + (p.ty - p.sy) * f;
    if (f >= 1) {
      this.explode(p);
      p.dead = true;
    }
  }

  private explode(p: Projectile): void {
    const tower = this.towerById(p.towerId);
    const st = p.st;
    const ctx: HitCtx = { element: p.element, tower, st, projId: p.id, depth: 0 };
    if (p.kind === 'lantern') {
      this.aoe(p.x, p.y, p.splash, p.dmg, ctx);
      this.ring(p.x, p.y, p.splash, p.sky ? '#FFB703' : '#E63946', 0.35);
      if (!p.sky) {
        this.addPatch('ash', p.x, p.y, Math.max(28, p.splash * 0.55), st.ashT, st.ashDps, {}, st.ashStack);
        if (st.cluster) {
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
            this.newProj('spark', 'fire', tower ?? null, st, p.x, p.y, {
              sx: p.x, sy: p.y, tx: p.x + Math.cos(a) * 55, ty: p.y + Math.sin(a) * 55, dur: 0.32, life: 0.4, dmg: 14, splash: 36, height: 16,
            });
          }
        }
      } else {
        this.shake = Math.max(this.shake, 1);
      }
    } else if (p.kind === 'spark') {
      this.aoe(p.x, p.y, p.splash, p.dmg, ctx);
      this.ring(p.x, p.y, 36, '#FFB703', 0.25);
    } else if (p.kind === 'blot') {
      this.aoe(p.x, p.y, p.splash, p.dmg, ctx);
      this.splat(p.x, p.y, p.splash * 0.5);
      if (st.tether && tower) this.makeTether(p.x, p.y, st);
    }
  }

  private makeTether(x: number, y: number, st: Stats): void {
    let first: Enemy | null = null, bd = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; first = e; }
    }
    if (!first || bd > 90 * 90 || first.tetherId) return;
    const near = this.enemies
      .filter((e) => !e.dead && e !== first && !e.tetherId && (e.x - first.x) ** 2 + (e.y - first.y) ** 2 <= 95 * 95)
      .sort((a, b) => (a.x - first.x) ** 2 + (a.y - first.y) ** 2 - ((b.x - first.x) ** 2 + (b.y - first.y) ** 2))
      .slice(0, 3);
    const members = [first, ...near];
    if (members.length < 2) return;
    const th: Tether = { id: this.nextId++, members: members.map((m) => m.id), t: 3.5, slow: st.tetherSlow };
    this.tethers.push(th);
    for (const m of members) {
      m.tetherId = th.id;
      if (st.tetherSlow) m.camo = false;
    }
  }

  private stepTethers(dt: number): void {
    for (const th of this.tethers) th.t -= dt;
    const gone = this.tethers.filter((t) => t.t <= 0);
    if (gone.length) {
      for (const th of gone) for (const id of th.members) {
        const e = this.byId.get(id);
        if (e && e.tetherId === th.id) e.tetherId = 0;
      }
      this.tethers = this.tethers.filter((t) => t.t > 0);
    }
  }

  private stepBombs(dt: number): void {
    if (!this.bombs.length) return;
    const keep: Bomb[] = [];
    for (const b of this.bombs) {
      const e = this.byId.get(b.enemyId);
      if (e && !e.dead) { b.x = e.x; b.y = e.y; }
      b.t -= dt;
      if (b.t > 0) { keep.push(b); continue; }
      if (e && !e.dead && e.frozenKind === 'cube') { e.frozen = 0; e.frozenKind = 'none'; }
      const tower = this.towerById(b.towerId);
      this.ring(b.x, b.y, b.r, '#1D1E2C', 0.5);
      this.splat(b.x, b.y, 34);
      this.shake = Math.max(this.shake, 2);
      this.aoe(b.x, b.y, b.r, b.dmg, { element: null, depth: 1, noReact: true, noStatus: true, tower });
    }
    this.bombs = keep;
  }

  private detonate(p: Projectile): void {
    const tower = this.towerById(p.towerId);
    this.ring(p.x, p.y, 70, '#8F6B3F', 0.5);
    this.splat(p.x, p.y, 30);
    this.shake = Math.max(this.shake, 2);
    this.aoe(p.x, p.y, 70, 180, { element: 'earth', tower, st: p.st, depth: 0 });
  }

  private findNext(p: Projectile, from: { x: number; y: number }, radius: number): Enemy | null {
    let best: Enemy | null = null, bd = radius * radius;
    for (const e of this.enemies) {
      if (e.dead || e.camo || p.hitIds.has(e.id)) continue;
      const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private stepHoming(p: Projectile, dt: number): void {
    let tgt = this.byId.get(p.targetId);
    if (tgt && (tgt.dead || tgt.camo || p.hitIds.has(tgt.id))) tgt = undefined;
    if (!tgt) {
      tgt = this.findNext(p, p, p.kind === 'wave' ? 120 : 240) ?? undefined;
      if (tgt) p.targetId = tgt.id;
      else if (p.kind === 'wave') { p.dead = true; return; }
    }
    if (tgt) {
      const want = Math.atan2(tgt.y - p.y, tgt.x - p.x);
      const cur = p.vx === 0 && p.vy === 0 ? want : Math.atan2(p.vy, p.vx);
      const d = angDiff(want, cur);
      const lim = p.turn * dt;
      const a = cur + clamp(d, -lim, lim);
      p.vx = Math.cos(a) * p.speed;
      p.vy = Math.sin(a) * p.speed;
      p.rot = a;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    this.collide(p);
  }

  private stepStraight(p: Projectile, dt: number): void {
    const mx = p.vx * dt, my = p.vy * dt;
    p.x += mx; p.y += my;
    p.travelled += Math.hypot(mx, my);
    if (p.bounces > 0) {
      if (p.x < 6 || p.x > W - 6) { p.vx = -p.vx; p.x = clamp(p.x, 6, W - 6); p.bounces -= 1; }
      if (p.y < 6 || p.y > H - 6) { p.vy = -p.vy; p.y = clamp(p.y, 6, H - 6); p.bounces -= 1; }
    } else if (p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) {
      p.dead = true;
      return;
    }
    this.collide(p);
    if (!p.dead && p.maxTravel > 0 && p.travelled >= p.maxTravel) {
      if (p.kind === 'boulder') this.detonate(p);
      p.dead = true;
    }
  }

  private collide(p: Projectile): void {
    const n = this.enemies.length;
    for (let i = 0; i < n && !p.dead; i++) {
      const e = this.enemies[i];
      if (e.dead || e.camo || p.hitIds.has(e.id)) continue;
      if (segHitsCircle(p.px, p.py, p.x, p.y, e.x, e.y, e.radius + p.radius)) this.projHit(p, e);
    }
  }

  private waterAfter(p: Projectile, e: Enemy): void {
    if (p.st.vortex && this.patches.filter((x) => x.kind === 'vortex').length < 24) {
      this.addPatch('vortex', e.x, e.y, p.st.vortexR, 2, 10, { pull: 45, pullBonus: p.st.pullDmg });
    }
  }

  private projHit(p: Projectile, e: Enemy): void {
    const tower = this.towerById(p.towerId);
    const ctx: HitCtx = { element: p.element, tower, st: p.st, projId: p.id, depth: 0, noReact: p.noReact, stun: p.kind === 'spike' || p.kind === 'boulder' };
    let dmg = p.dmg;
    if (p.kind === 'shard' && p.st.crit && (e.soak > 0 || e.stain > 0 || e.stainPerm || e.fract > 0)) dmg *= 2;
    const ex = e.x, ey = e.y;
    p.hitIds.add(e.id);
    this.hit(e, dmg, ctx);
    if (p.kind === 'needle') e.armored = false;
    if (p.kind === 'fan' || p.kind === 'whirlwind') this.knock(e, p.knock);
    if (p.kind === 'blade') this.addPatch('mini', ex, ey, 28, 2, 0, { slow: 0.4 });
    p.pierce -= 1;
    switch (p.kind) {
      case 'wave':
        this.waterAfter(p, e);
        p.bounces -= 1;
        if (p.bounces < 0) { p.dead = true; break; }
        {
          const nx = this.findNext(p, { x: ex, y: ey }, p.st.hop);
          if (nx) p.targetId = nx.id;
          else p.dead = true;
        }
        break;
      case 'crane':
        if (p.pierce <= 0) {
          if (p.st.swallows) {
            for (let k = 0; k < 2; k++) {
              const a = rand(0, Math.PI * 2);
              this.newProj('swallow', 'air', tower ?? null, p.st, p.x, p.y, {
                vx: Math.cos(a) * p.speed, vy: Math.sin(a) * p.speed, dmg: 8, pierce: 2, life: 1.6, radius: 7, hitIds: new Set(p.hitIds), speed: p.speed, rot: a,
              });
            }
          }
          p.dead = true;
        } else {
          const nx = this.findNext(p, p, 260);
          if (nx) p.targetId = nx.id;
        }
        break;
      case 'spike':
        if (p.st.shards) {
          const base = Math.atan2(p.vy, p.vx);
          for (let k = 0; k < 5; k++) {
            const a = base + (k - 2) * ((Math.PI * 70) / 180 / 4);
            this.newProj('shard', 'earth', tower ?? null, p.st, ex, ey, {
              vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, dmg: 18, pierce: 1, speed: 420, life: 0.45, radius: 6, hitIds: new Set([e.id]), rot: a,
            });
          }
        }
        p.dead = true;
        break;
      case 'boulder':
        if (p.pierce <= 0) { this.detonate(p); p.dead = true; }
        break;
      default:
        if (p.pierce <= 0) p.dead = true;
    }
  }

  private stepLane(p: Projectile, dt: number): void {
    const ln = this.map.lanes[p.lane];
    const prev = p.dist;
    const mv = p.speed * dt;
    p.dist = clamp(p.dist + p.dir * mv, 0, ln.length);
    p.travelled += mv;
    sampleInto(ln, p.dist, this.tmp);
    p.x = this.tmp.x; p.y = this.tmp.y; p.rot = this.tmp.angle + (p.dir < 0 ? Math.PI : 0);
    const lo = Math.min(prev, p.dist) - 14, hi = Math.max(prev, p.dist) + 14;
    const tower = this.towerById(p.towerId);
    const n = this.enemies.length;
    for (let i = 0; i < n; i++) {
      const e = this.enemies[i];
      if (e.dead || e.lane !== p.lane || e.camo || p.hitIds.has(e.id) || e.dist < lo || e.dist > hi) continue;
      p.hitIds.add(e.id);
      if (p.kind === 'dragon') {
        this.hit(e, p.dmg, { element: 'ink', tower, st: p.st, projId: p.id, depth: 0 });
        if (!e.dead) { e.stainPerm = true; e.stain = 6; e.stainSlow = 0.65; }
      } else {
        this.hit(e, p.dmg, { element: 'water', tower, st: p.st, projId: p.id, depth: 0 });
        this.waterAfter(p, e);
        p.pierce -= 1;
      }
    }
    if (p.kind === 'koi' && p.st.wake) {
      p.wakeAcc += mv;
      while (p.wakeAcc >= 18) {
        p.wakeAcc -= 18;
        this.addPatch('wake', p.x, p.y, 22, 3, 0, { slow: 0.35 });
      }
    }
    if (p.kind === 'koi' && (p.travelled >= p.maxTravel || p.pierce <= 0 || p.dist <= 0)) p.dead = true;
    if (p.kind === 'dragon' && (p.dist <= 0 || p.travelled >= p.maxTravel)) p.dead = true;
  }

  // ------------------------------------------------------------ fx
  private stepFx(dt: number): void {
    let w = 0;
    for (let i = 0; i < this.fx.length; i++) {
      const f = this.fx[i];
      f.t += dt;
      if (f.k === 'confetti') {
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 160 * dt; f.vx *= 0.98; f.rot += f.vr * dt;
      }
      if (f.t < f.life) this.fx[w++] = f;
    }
    this.fx.length = w;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 12);
  }

  towerStats(t: Tower): Stats {
    return computeStats(t);
  }

  towerRange(t: Tower, st?: Stats): number {
    return (st ?? computeStats(t)).range * (t.inConduit ? CONDUIT_BONUS : 1);
  }

  comboList(): ComboDef[] {
    return COMBOS;
  }
}
