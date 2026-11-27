import { glyph } from '../lib/glyph';
import { useState } from 'react';
import { Coins, FastForward, Heart, Home, Pause, Play, Repeat, RotateCcw, Scroll, Volume2, VolumeX } from 'lucide-react';
import { DIFFICULTIES, ELEMENTS, ELEMENT_ORDER, computeStats, overclockBonus, salvage, towerName, upgradeCost } from '../lib/constants';
import type { GameEngine } from '../lib/engine';
import { isMuted, setMuted } from '../lib/sound';
import type { Element, PathId, TargetMode, Tower } from '../lib/types';

interface Props {
  engine: GameEngine;
  placing: Element | null;
  onPlacing: (e: Element | null) => void;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onPreview: (p: { id: number; path: PathId } | null) => void;
  onCodex: () => void;
  onQuit: () => void;
  onRestart: () => void;
}

const MODES: { id: TargetMode; label: string }[] = [
  { id: 'first', label: 'First' },
  { id: 'last', label: 'Last' },
  { id: 'strong', label: 'Strong' },
  { id: 'close', label: 'Close' },
  { id: 'unprimed', label: 'Unprimed' },
];

function InkBottle({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1A1918" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M9 3h6v3l2 2v10a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V8l2-2z" fill="#2b2a36" />
      <path d="M9 3h6" />
      <circle cx="12" cy="14" r="2.2" fill="#F4EFE6" stroke="none" />
    </svg>
  );
}

function WaxSeal({ el, size = 36 }: { el: Element; size?: number }) {
  const d = ELEMENTS[el];
  return (
    <div
      className="flex items-center justify-center rounded-full border-2 border-[#1A1918] font-bold text-[#F4EFE6] shadow-inner"
      style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, ${d.light}, ${d.color} 55%, ${d.dark})`, fontSize: size * 0.5 }}
    >
      {glyph(d.glyph) || d.name[0]}
    </div>
  );
}

function TierRow({ engine, tower, path, tier, onHover }: { engine: GameEngine; tower: Tower; path: PathId; tier: number; onHover: (h: { path: PathId; tier: number } | null) => void }) {
  const el = ELEMENTS[tower.element];
  const up = (path === 'A' ? el.A : el.B).tiers[tier - 1];
  const cur = path === 'A' ? tower.a : tower.b;
  const other = path === 'A' ? tower.b : tower.a;
  const owned = cur >= tier;
  const sealed = !owned && tier >= 3 && other >= 3;
  const isNext = cur + 1 === tier;
  const cost = upgradeCost(tower.element, tier - 1, engine.diff.cost);
  const afford = engine.ink >= cost;
  const can = isNext && !sealed && afford;
  return (
    <button
      data-testid={`upgrade-${path}-${tier}`}
      disabled={!can}
      onClick={() => engine.upgradeTower(tower.id, path)}
      onMouseEnter={() => onHover({ path, tier })}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover({ path, tier })}
      onBlur={() => onHover(null)}
      className={`relative flex w-full items-center gap-1.5 overflow-hidden border-2 px-1.5 py-1 text-left text-[11px] leading-tight transition ${
        owned ? 'border-[#2B2927] bg-[#d9cdb2]' : can ? 'border-[#2B2927] bg-[#F7F1E3] hover:bg-[#fff8e4]' : 'border-[#2b292766] bg-[#e9e0cc]'
      } ${sealed ? 'opacity-80' : ''}`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#1A1918] text-[9px] font-bold ${owned ? 'bg-[#1A1918] text-[#F4EFE6]' : 'bg-[#F4EFE6]'}`}
      >
        {tier}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">
          {up.name}
          {up.transforms && <span className="ml-1 text-[9px] text-[#2A6FDB]">◆</span>}
          {up.apex && <span className="ml-1 text-[9px] text-[#B8860B]">★</span>}
        </span>
      </span>
      {!owned && !sealed && <span className={`shrink-0 font-bold ${afford ? 'text-[#1A1918]' : 'text-[#C1121F]'}`}>{cost}</span>}
      {owned && <span className="shrink-0 text-[9px] font-bold text-[#1A1918]">✓</span>}
      {sealed && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#efe7d8]/55">
          <span className="rotate-[-10deg] border-2 border-[#C1121F] bg-[#efe7d8]/80 px-1.5 text-[10px] font-extrabold tracking-[0.2em] text-[#C1121F]">SEALED</span>
        </span>
      )}
    </button>
  );
}

export default function HudSidebar({ engine, placing, onPlacing, selectedId, onSelect, onPreview, onCodex, onQuit, onRestart }: Props) {
  const [muted, setMutedState] = useState(isMuted());
  const [hover, setHover] = useState<{ path: PathId; tier: number } | null>(null);
  const tower = selectedId !== null ? engine.towerById(selectedId) : undefined;
  const diff = DIFFICULTIES[engine.diffId];
  const nextWave = engine.wave + 1;
  const canStart = engine.canStartWave();
  const early = engine.waveRunning;

  const setHoverTier = (h: { path: PathId; tier: number } | null) => {
    setHover(h);
    if (tower && h && (h.path === 'A' ? tower.a : tower.b) + 1 === h.tier) onPreview({ id: tower.id, path: h.path });
    else onPreview(null);
  };

  const hoverInfo = (() => {
    if (!tower || !hover) return null;
    const el = ELEMENTS[tower.element];
    const up = (hover.path === 'A' ? el.A : el.B).tiers[hover.tier - 1];
    const cur = hover.path === 'A' ? tower.a : tower.b;
    let rangeNote = '';
    if (cur + 1 === hover.tier) {
      const next = { ...tower, lastPath: hover.path };
      if (hover.path === 'A') next.a += 1;
      else next.b += 1;
      const r0 = engine.towerRange(tower), r1 = engine.towerRange(next);
      if (r1 > r0 + 0.5) rangeNote = `Range ${Math.round(r0)} → ${Math.round(r1)}px`;
    }
    return { up, rangeNote };
  })();

  const st = tower ? computeStats(tower) : null;

  return (
    <div className="flex h-full flex-col text-[#1A1918]">
      {/* Telemetry */}
      <div className="border-b-2 border-[#2B2927] p-2" data-testid="telemetry">
        <div className="grid grid-cols-3 gap-1.5">
          <div className="ink-border flex flex-col items-center bg-[#F7F1E3] py-0.5" title="Current wave">
            <span className="text-[9px] uppercase tracking-wider text-[#6b6358]">Wave</span>
            <span className="text-sm font-bold leading-none" data-testid="wave-counter">
              {engine.wave}
              <span className="text-[10px] font-normal text-[#6b6358]">/{engine.endless ? '∞' : engine.target}</span>
            </span>
          </div>
          <div className="ink-border flex flex-col items-center bg-[#F7F1E3] py-0.5" title="Sanctuary lives">
            <span className="text-[9px] uppercase tracking-wider text-[#6b6358]">Lives</span>
            <span className="flex items-center gap-1 text-sm font-bold leading-none" data-testid="lives">
              <Heart size={13} fill="#C1121F" color="#C1121F" /> {engine.lives}
            </span>
          </div>
          <div className="ink-border flex flex-col items-center bg-[#F7F1E3] py-0.5" title="Ink balance">
            <span className="text-[9px] uppercase tracking-wider text-[#6b6358]">Ink</span>
            <span className="flex items-center gap-1 text-sm font-bold leading-none" data-testid="ink">
              <InkBottle size={14} /> {Math.floor(engine.ink)}
            </span>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <button
            onClick={() => engine.togglePause()}
            title={engine.paused ? 'Resume' : 'Pause'}
            data-testid="pause"
            className="ink-border flex h-7 w-8 items-center justify-center bg-[#F7F1E3] hover:bg-white"
          >
            {engine.paused ? <Play size={14} fill="#2A9D8F" color="#2A9D8F" /> : <Pause size={14} />}
          </button>
          {([1, 2, 3] as const).map((s) => (
            <button
              key={s}
              data-testid={`speed-${s}`}
              onClick={() => engine.setSpeed(s)}
              className={`ink-border flex h-7 min-w-8 items-center justify-center gap-0.5 px-1 text-[11px] font-bold ${engine.speed === s ? 'bg-[#1A1918] text-[#F4EFE6]' : 'bg-[#F7F1E3] hover:bg-white'}`}
            >
              {s === 1 ? <Play size={9} /> : <FastForward size={9} />}
              {s}x
            </button>
          ))}
          <button
            onClick={() => engine.setAutoNext(!engine.autoNext)}
            title="Auto-Next wave"
            data-testid="auto-next"
            className={`ink-border flex h-7 w-8 items-center justify-center ${engine.autoNext ? 'bg-[#2A9D8F] text-white' : 'bg-[#F7F1E3] hover:bg-white'}`}
          >
            <Repeat size={14} />
          </button>
          <button
            onClick={() => { setMuted(!muted); setMutedState(!muted); }}
            title={muted ? 'Unmute' : 'Mute'}
            data-testid="mute"
            className="ink-border flex h-7 w-8 items-center justify-center bg-[#F7F1E3] hover:bg-white"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>
        <div className="mt-1.5 flex gap-1">
          <button
            data-testid="start-wave"
            disabled={!canStart}
            onClick={() => engine.startWave()}
            className="ink-border flex-1 bg-[#C1121F] px-2 py-1.5 text-xs font-bold text-[#F4EFE6] transition hover:bg-[#a30f19] disabled:bg-[#8a8176]"
          >
            {!canStart ? 'Final wave underway' : early ? `Send Wave ${nextWave} Early  +${overclockBonus(nextWave)} Ink` : `Start Wave ${nextWave}`}
          </button>
          <button onClick={onRestart} title="Restart scroll" data-testid="restart" className="ink-border flex w-8 items-center justify-center bg-[#F7F1E3] hover:bg-white">
            <RotateCcw size={14} />
          </button>
          <button onClick={onQuit} title="Return to title" data-testid="quit" className="ink-border flex w-8 items-center justify-center bg-[#F7F1E3] hover:bg-white">
            <Home size={14} />
          </button>
        </div>
      </div>

      {/* Shop */}
      <div className="border-b-2 border-[#2B2927] p-2">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-brush text-lg font-bold leading-none">Tower Shop</h3>
          <span className="text-[10px] text-[#6b6358]">{diff.name}</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {ELEMENT_ORDER.map((el, i) => {
            const d = ELEMENTS[el];
            const afford = engine.ink >= d.cost;
            const sel = placing === el;
            return (
              <button
                key={el}
                data-testid={`shop-${el}`}
                onClick={() => { onPlacing(sel ? null : el); onSelect(null); }}
                className={`ink-border flex flex-col items-center gap-0.5 px-0.5 py-1 transition ${sel ? 'bg-[#d9f0eb] outline outline-2 outline-[#2A9D8F]' : 'bg-[#F7F1E3] hover:bg-white'} ${afford ? '' : 'opacity-60'}`}
                title={`${d.name} — ${d.desc} [${i + 1}]`}
              >
                <WaxSeal el={el} size={32} />
                <span className="text-[10px] font-bold leading-none">{d.name}</span>
                <span className={`flex items-center gap-0.5 text-[10px] font-bold leading-none ${afford ? '' : 'text-[#C1121F]'}`}>
                  <Coins size={9} />
                  {d.cost}
                </span>
              </button>
            );
          })}
        </div>
        {placing && (
          <p className="mt-1 text-[10px] leading-tight text-[#3b3732]">
            <b>{ELEMENTS[placing].name}:</b> {ELEMENTS[placing].desc} Range {ELEMENTS[placing].range}px. Click a buildable tile; Esc cancels.
          </p>
        )}
      </div>

      {/* Inspector */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2" data-testid="inspector">
        {tower && st ? (
          <div>
            <div className="flex items-center gap-2">
              <WaxSeal el={tower.element} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold leading-tight" data-testid="tower-name">{towerName(tower)}</div>
                <div className="text-[10px] text-[#6b6358]">
                  {ELEMENTS[tower.element].name} · Path A {tower.a} / Path B {tower.b}
                  {tower.inConduit && <span className="text-[#2A9D8F]"> · Conduit +15%</span>}
                </div>
              </div>
              <button onClick={() => onSelect(null)} className="text-xs text-[#6b6358] hover:text-black" title="Close">✕</button>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px]">
              <label className="font-bold" htmlFor="tgt">Target</label>
              <select
                id="tgt"
                data-testid="targeting"
                value={tower.mode}
                onChange={(e) => engine.setTargetMode(tower.id, e.target.value as TargetMode)}
                className="ink-border flex-1 bg-[#F7F1E3] px-1 py-0.5 text-[11px]"
              >
                {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1 text-[10px]">
              <div className="ink-border bg-[#F7F1E3] px-1.5 py-0.5">Kills <b data-testid="tower-kills">{tower.kills}</b></div>
              <div className="ink-border bg-[#F7F1E3] px-1.5 py-0.5">Damage <b>{Math.floor(tower.damage)}</b></div>
            </div>
            <div className="mt-1 text-[10px] text-[#3b3732]">
              Range {Math.round(engine.towerRange(tower, st))}px · {st.rate.toFixed(2)}/s · Dmg {st.dmg}
            </div>

            <div className="mt-1.5 flex items-center justify-between border-b border-[#2b292755] pb-0.5">
              <span className="font-brush text-base font-bold leading-none">Upgrade Tree</span>
              <span className="text-[9px] font-bold tracking-widest text-[#C1121F]">4-2</span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(['A', 'B'] as const).map((path) => {
                const pd = path === 'A' ? ELEMENTS[tower.element].A : ELEMENTS[tower.element].B;
                const cur = path === 'A' ? tower.a : tower.b;
                return (
                  <div key={path} data-testid={`path-${path}`}>
                    <div className="mb-0.5 flex items-center gap-1 text-[10px] font-bold leading-tight">
                      <span className="rounded-sm bg-[#1A1918] px-1 text-[#F4EFE6]">{path}</span>
                      <span className="truncate">{pd.name}</span>
                    </div>
                    <div className="mb-0.5 flex gap-0.5">
                      {[1, 2, 3, 4].map((n) => (
                        <span key={n} className={`h-1.5 flex-1 rounded-full border border-[#1A1918] ${cur >= n ? 'bg-[#C1121F]' : 'bg-transparent'}`} />
                      ))}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {[1, 2, 3, 4].map((tier) => (
                        <TierRow key={tier} engine={engine} tower={tower} path={path} tier={tier} onHover={setHoverTier} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="ink-border mt-1.5 min-h-[58px] bg-[#F7F1E3] p-1.5 text-[10px] leading-snug" data-testid="upgrade-info">
              {hoverInfo ? (
                <>
                  <div className="font-bold">
                    {hoverInfo.up.name}
                    {hoverInfo.up.transforms && <span className="ml-1 text-[#2A6FDB]">[TRANSFORMS PROJECTILE]</span>}
                    {hoverInfo.up.apex && <span className="ml-1 text-[#B8860B]">[APEX FORM]</span>}
                  </div>
                  <div>{hoverInfo.up.text}</div>
                  {hoverInfo.rangeNote && <div className="font-bold text-[#C58B3C]">{hoverInfo.rangeNote}</div>}
                </>
              ) : (
                <span className="text-[#6b6358]">
                  Hover a tier for details. ◆ transforms the projectile, ★ is an apex form. Once a path reaches Tier 3 the other path is sealed at Tier 2.
                </span>
              )}
            </div>
            <button
              data-testid="sell"
              onClick={() => { engine.sellTower(tower.id); onSelect(null); onPreview(null); }}
              className="ink-border mt-1.5 w-full bg-[#e7d4b3] py-1.5 text-xs font-bold hover:bg-[#ddc59b]"
            >
              Salvage (75%) +{salvage(tower)} Ink
            </button>
          </div>
        ) : (
          <div className="text-[11px] leading-snug text-[#3b3732]">
            <h3 className="font-brush text-lg font-bold leading-none text-[#1A1918]">Selected Seal</h3>
            <p className="mt-1">Choose a seal from the shop and click a buildable tile on the scroll — or click a placed tower to inspect it.</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              <li>Place seals of different elements near each other to draw <b className="text-[#2A9D8F]">Resonance Lines</b>.</li>
              <li>Strike an enemy carrying one status with a different element to trigger a <b>Seal Reaction</b>.</li>
              <li>Towers inside a Conduit Stone Circle gain +15% range.</li>
              <li>Hotkeys: 1–5 shop · Space pause · N next wave · Esc cancel.</li>
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t-2 border-[#2B2927] p-2">
        <button
          data-testid="open-codex"
          onClick={onCodex}
          className="ink-border flex w-full items-center justify-center gap-2 bg-[#F7F1E3] py-1.5 text-sm font-bold hover:bg-white"
        >
          <Scroll size={15} /> Scroll of Seals
          <span className="rounded-sm bg-[#C1121F] px-1 text-[10px] text-[#F4EFE6]">{engine.codex.size}/10</span>
        </button>
      </div>
    </div>
  );
}
