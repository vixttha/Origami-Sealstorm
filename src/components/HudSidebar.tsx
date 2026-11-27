import { Heart, Droplet, Play, Pause, Volume2, VolumeX, ScrollText, LogOut, Zap } from 'lucide-react';
import { ELEMENTS, TARGET_MODES, TOWER_DEFS, overclockBonus, towerCost, upgradeCost } from '../lib/constants';
import type { GameEngine } from '../lib/engine';
import type { Element, PathSide, UiSnapshot } from '../lib/types';

const SPEEDS = [1, 2, 3] as const;

function SealEmblem({ element, size = 34 }: { element: Element; size?: number }) {
  const def = TOWER_DEFS[element];
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-0 rotate-45 rounded-[4px] border-2"
        style={{ background: def.color, borderColor: 'rgba(244,239,230,0.75)' }}
      />
      <span
        className="relative font-brush font-bold text-washi"
        style={{ fontSize: size * 0.42, textShadow: '0 1px 1px rgba(0,0,0,0.35)' }}
      >
        {def.kanji}
      </span>
    </span>
  );
}

export default function HudSidebar({
  engine,
  snapshot,
  onOpenCodex,
  onExit,
}: {
  engine: GameEngine;
  snapshot: UiSnapshot;
  onOpenCodex: () => void;
  onExit: () => void;
}) {
  const selected = snapshot.selectedTower;
  const costMult = engine.state.difficulty.costMult;
  const overclock = overclockBonus(Math.max(1, snapshot.waveIndex));

  return (
    <aside className="flex h-full w-[304px] min-w-[272px] max-w-[340px] shrink-0 flex-col overflow-hidden border-l-[3px] border-sumi/80 bg-parch text-sumi shadow-[-8px_0_30px_rgba(0,0,0,0.45)]">
      {/* ---------------- Telemetry strip ---------------- */}
      <div className="border-b-2 border-sumi/60 bg-parch-dark/60 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-brush text-[15px] font-bold tracking-wide">
              {snapshot.endless ? '∞' : `${Math.max(0, snapshot.waveIndex)}/${snapshot.targetWave}`}
            </span>
            <span className="text-[10px] uppercase tracking-widest opacity-70">Wave</span>
          </div>
          <div className="flex items-center gap-3 text-[13px] font-bold">
            <span className="flex items-center gap-1" title="Sanctuary lives">
              <Heart size={14} className="fill-crimson text-crimson" />
              {snapshot.lives}
            </span>
            <span className="flex items-center gap-1" title="Ink balance">
              <Droplet size={14} className="fill-ink text-ink" />
              {snapshot.ink}
            </span>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => engine.togglePause()}
            title={snapshot.paused ? 'Resume (Space)' : 'Pause (Space)'}
            className="flex h-7 w-7 items-center justify-center rounded border-2 border-sumi/70 bg-washi transition hover:bg-parch-dark active:scale-95"
          >
            {snapshot.paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <div className="flex overflow-hidden rounded border-2 border-sumi/70">
            {SPEEDS.map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => engine.setSpeed(sp)}
                title={`${sp}x speed (key ${sp})`}
                className={`h-7 w-8 text-[12px] font-bold transition ${
                  snapshot.speed === sp ? 'bg-crimson text-washi' : 'bg-washi hover:bg-parch-dark'
                }`}
              >
                {sp}x
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => engine.toggleAutoNext()}
            title="Auto-start next wave (A)"
            className={`h-7 rounded border-2 px-2 text-[11px] font-bold transition ${
              snapshot.autoNext
                ? 'border-jade bg-jade text-washi'
                : 'border-sumi/70 bg-washi hover:bg-parch-dark'
            }`}
          >
            AUTO
          </button>
          <button
            type="button"
            onClick={() => engine.toggleMute()}
            title="Mute (M)"
            className="flex h-7 w-7 items-center justify-center rounded border-2 border-sumi/70 bg-washi transition hover:bg-parch-dark"
          >
            {snapshot.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <button
            type="button"
            onClick={onExit}
            title="Quit to title"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded border-2 border-sumi/70 bg-washi transition hover:bg-parch-dark"
          >
            <LogOut size={13} />
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-wider opacity-70">
          <span className="truncate">{snapshot.waveName}</span>
          <span>
            {snapshot.enemiesAlive} foes{snapshot.queuedSpawns > 0 ? ` · ${snapshot.queuedSpawns} queued` : ''}
          </span>
        </div>
      </div>

      {/* ---------------- Wave control ---------------- */}
      <div className="border-b-2 border-sumi/60 px-3 py-2">
        {snapshot.phase === 'wave' ? (
          <button
            type="button"
            disabled={!snapshot.canOverclock}
            onClick={() => engine.startWave()}
            className={`flex w-full items-center justify-center gap-1.5 rounded border-2 py-1.5 font-brush text-[13px] font-bold tracking-wide transition active:scale-[0.98] ${
              snapshot.canOverclock
                ? 'border-crimson bg-crimson/95 text-washi hover:bg-crimson'
                : 'cursor-not-allowed border-sumi/40 bg-sumi/10 text-sumi/50'
            }`}
          >
            <Zap size={14} />
            SEND NEXT EARLY +{overclock} INK
          </button>
        ) : (
          <button
            type="button"
            disabled={!snapshot.canStartWave}
            onClick={() => engine.startWave()}
            className={`flex w-full items-center justify-center gap-1.5 rounded border-2 py-1.5 font-brush text-[13px] font-bold tracking-wide transition active:scale-[0.98] ${
              snapshot.canStartWave
                ? 'border-crimson bg-crimson/95 text-washi hover:bg-crimson'
                : 'cursor-not-allowed border-sumi/40 bg-sumi/10 text-sumi/50'
            }`}
          >
            <Play size={13} />
            START WAVE {Math.max(1, snapshot.waveIndex + 1)}
          </button>
        )}
        {snapshot.modifier && (
          <div className="mt-1.5 rounded border border-crimson/60 bg-ink/90 px-2 py-1 text-center text-[10px] font-bold tracking-wide text-washi">
            CORRUPTED INK: {snapshot.modifier.name} - {snapshot.modifier.desc}
          </div>
        )}
      </div>

      {/* ---------------- Tower shop ---------------- */}
      <div className="border-b-2 border-sumi/60 px-3 py-2">
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="font-brush text-[13px] font-bold tracking-widest">TOWER SHOP</h3>
          <span className="text-[9px] uppercase tracking-wider opacity-60">Elemental Seals</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {ELEMENTS.map((element) => {
            const def = TOWER_DEFS[element];
            const cost = towerCost(element, costMult);
            const affordable = snapshot.ink >= cost;
            const active = snapshot.shopElement === element;
            return (
              <button
                key={element}
                type="button"
                onClick={() => engine.setShopElement(active ? null : element)}
                title={def.baseDesc}
                className={`relative flex flex-col items-center gap-0.5 rounded border-2 px-1 pb-1.5 pt-2 transition active:scale-95 ${
                  active
                    ? 'border-crimson bg-crimson/15 ring-2 ring-crimson/50'
                    : affordable
                      ? 'border-sumi/60 bg-washi hover:border-sumi hover:bg-parch-dark'
                      : 'border-sumi/30 bg-sumi/5 opacity-55'
                }`}
              >
                <SealEmblem element={element} size={30} />
                <span className="mt-1 text-[11px] font-bold leading-none">{def.sealName}</span>
                <span className="flex items-center gap-0.5 text-[10px] font-bold leading-none">
                  <Droplet size={9} className="fill-ink text-ink" />
                  {cost}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-center text-[9px] leading-snug opacity-60">
          Pick a seal, then click a clear tile on the scroll to fold it.
        </p>
      </div>

      {/* ---------------- Inspector / upgrade tree ---------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {selected ? (
          <Inspector engine={engine} snapshot={snapshot} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
            <SealEmblem element="ink" size={40} />
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-60">Tower Inspector</p>
            <p className="max-w-[200px] text-[10px] leading-relaxed opacity-60">
              Select a folded tower on the scroll to view its kills, targeting mode and the 4-2 upgrade
              tree with two branching paths.
            </p>
          </div>
        )}
      </div>

      {/* ---------------- Footer ---------------- */}
      <div className="border-t-2 border-sumi/60 px-3 py-2">
        <button
          type="button"
          onClick={onOpenCodex}
          className="flex w-full items-center justify-center gap-2 rounded border-2 border-crimson bg-crimson/95 py-1.5 font-brush text-[13px] font-bold tracking-wide text-washi transition hover:bg-crimson active:scale-[0.98]"
        >
          <ScrollText size={14} />
          SCROLL OF SEALS ({snapshot.discovered.length}/10)
        </button>
        <div className="mt-1 flex items-center justify-between text-[9px] uppercase tracking-wider opacity-50">
          <span>Space pause · 1/2/3 speed · A auto · M mute</span>
          <span>{snapshot.fps} fps</span>
        </div>
      </div>
    </aside>
  );
}

function TierPips({ tier, max = 4, color }: { tier: number; max?: number; color: string }) {
  return (
    <span className="flex items-center gap-[3px]">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className="h-[6px] w-[6px] rotate-45 rounded-[1px] border border-sumi/50"
          style={{ background: i < tier ? color : 'transparent' }}
        />
      ))}
    </span>
  );
}

function Inspector({ engine, snapshot }: { engine: GameEngine; snapshot: UiSnapshot }) {
  const tower = snapshot.selectedTower;
  if (!tower) return null;
  const def = TOWER_DEFS[tower.element];
  const costMult = engine.state.difficulty.costMult;

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2 rounded border-2 border-sumi/60 bg-washi px-2 py-1.5">
        <SealEmblem element={tower.element} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-brush text-[14px] font-bold leading-tight">{def.title}</p>
          <div className="flex items-center gap-2">
            <TierPips tier={tower.tierA} color={def.color} />
            <span className="text-[9px] opacity-60">A</span>
            <TierPips tier={tower.tierB} color={def.color} />
            <span className="text-[9px] opacity-60">B</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-1 text-center">
        {[
          { label: 'Kills', value: tower.kills },
          { label: 'Damage', value: tower.damageDealt },
          { label: 'Range', value: tower.range },
        ].map((s) => (
          <div key={s.label} className="rounded border border-sumi/40 bg-washi/70 px-1 py-1">
            <p className="text-[13px] font-bold leading-none">{s.value}</p>
            <p className="mt-0.5 text-[8px] uppercase tracking-widest opacity-60">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Targeting */}
      <div>
        <p className="mb-1 text-[9px] font-bold uppercase tracking-widest opacity-70">Targeting</p>
        <div className="flex flex-wrap gap-1">
          {TARGET_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              title={mode.hint}
              onClick={() => engine.setTargeting(tower.id, mode.id)}
              className={`rounded border px-1.5 py-[3px] text-[10px] font-bold transition ${
                tower.targeting === mode.id
                  ? 'border-sumi bg-sumi text-washi'
                  : 'border-sumi/50 bg-washi hover:bg-parch-dark'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4-2 upgrade tree */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">Upgrade Tree</p>
          <p className="text-[9px] opacity-50">4-2 cross-path rule</p>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(['A', 'B'] as PathSide[]).map((side) => {
            const current = side === 'A' ? tower.tierA : tower.tierB;
            const other = side === 'A' ? tower.tierB : tower.tierA;
            const path = side === 'A' ? def.pathA : def.pathB;
            return (
              <div key={side} className="flex flex-col gap-1">
                <p className="truncate text-center font-brush text-[11px] font-bold" title={path.label}>
                  {side === 'A' ? 'Path A' : 'Path B'} · {path.label}
                </p>
                {path.tiers.map((tier, idx) => {
                  const tierNum = idx + 1;
                  const purchased = current >= tierNum;
                  const isNext = current + 1 === tierNum;
                  const sealed = other >= 3 && tierNum >= 3;
                  const maxed = current >= 4;
                  const cost = upgradeCost(tier.cost, costMult);
                  const affordable = snapshot.ink >= cost;
                  const clickable = isNext && !sealed && !maxed;
                  return (
                    <button
                      key={tierNum}
                      type="button"
                      disabled={!clickable}
                      onMouseEnter={() => clickable && engine.hoverUpgrade(tower.id, side)}
                      onMouseLeave={() => engine.hoverUpgrade(tower.id, null)}
                      onClick={() => engine.upgradeTower(tower.id, side)}
                      title={`${tier.name} - ${tier.desc}`}
                      className={`relative rounded border-2 px-1.5 py-1 text-left transition ${
                        purchased
                          ? 'border-jade bg-jade/15'
                          : sealed
                            ? 'cursor-not-allowed border-sumi/25 bg-sumi/5'
                            : clickable && affordable
                              ? 'border-sumi/70 bg-washi hover:border-crimson hover:bg-parch-dark active:scale-[0.97]'
                              : 'cursor-not-allowed border-sumi/30 bg-washi/50 opacity-60'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1">
                          <span className="font-brush text-[10px] font-bold opacity-60">T{tierNum}</span>
                          <span
                            className={`text-[11px] font-bold leading-tight ${purchased ? 'text-jade' : ''}`}
                          >
                            {tier.name}
                          </span>
                        </span>
                        {purchased ? (
                          <span className="text-[9px] font-bold text-jade">OWNED</span>
                        ) : sealed ? null : maxed ? null : (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold">
                            <Droplet size={9} className="fill-ink text-ink" />
                            {cost}
                          </span>
                        )}
                      </span>
                      {tier.transforms && !purchased && (
                        <span
                          className={`mt-0.5 block text-[8px] font-bold tracking-wider ${
                            tier.transforms === 'apex' ? 'text-[#8C6A1A]' : 'text-crimson'
                          }`}
                        >
                          {tier.transforms === 'apex' ? '[APEX FORM]' : '[TRANSFORMS PROJECTILE]'}
                        </span>
                      )}
                      {sealed && (
                        <span className="hanko-stamp pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-bold">
                          SEALED
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Salvage */}
      <button
        type="button"
        onClick={() => engine.salvageTower(tower.id)}
        className="flex w-full items-center justify-center gap-1.5 rounded border-2 border-sumi/60 bg-washi py-1.5 font-brush text-[12px] font-bold transition hover:border-crimson hover:bg-parch-dark active:scale-[0.98]"
      >
        SALVAGE (75%) - REFUND {tower.sellValue} INK
      </button>
    </div>
  );
}
