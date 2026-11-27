import React from 'react';
import {
  BookOpen,
  Droplets,
  FastForward,
  Heart,
  Home,
  Pause,
  Play,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  DIFFICULTY_SPECS,
  ELEMENT_ORDER,
  getOverclockBonus,
  getSalvageValue,
  getScaledUpgradeCost,
  TOWER_SPECS,
} from '../lib/constants';
import { GameEngine } from '../lib/engine';
import { soundManager } from '../lib/sound';
import { ElementType, EngineSnapshot, TargetingMode, TowerEntity } from '../lib/types';

interface HudSidebarProps {
  engine: GameEngine;
  snapshot: EngineSnapshot;
  onSyncSnapshot: () => void;
  onHoverUpgradeRange: (bonus: number) => void;
  onOpenCodex: () => void;
  onReturnToTitle: () => void;
}

const TARGETING_MODES: { id: TargetingMode; label: string }[] = [
  { id: 'first', label: 'First' },
  { id: 'last', label: 'Last' },
  { id: 'strong', label: 'Strong' },
  { id: 'close', label: 'Close' },
  { id: 'unprimed', label: 'Unprimed' },
];

export const HudSidebar: React.FC<HudSidebarProps> = ({
  engine,
  snapshot,
  onSyncSnapshot,
  onHoverUpgradeRange,
  onOpenCodex,
  onReturnToTitle,
}) => {
  const selectedTower: TowerEntity | undefined = snapshot.towers.find(
    (t) => t.id === snapshot.selectedTowerId
  );

  const diffMult = DIFFICULTY_SPECS[snapshot.difficultyId].upgradeCostMultiplier;

  const handleSelectShopElement = (el: ElementType) => {
    if (engine.placingElement === el) {
      engine.placingElement = null;
    } else {
      engine.placingElement = el;
      engine.selectedTowerId = null;
    }
    onSyncSnapshot();
  };

  const handleTogglePause = () => {
    if (!snapshot.waveActive && snapshot.wave === 0) {
      engine.startNextWave();
    } else if (!snapshot.waveActive) {
      engine.startNextWave();
    } else {
      engine.isPaused = !engine.isPaused;
    }
    onSyncSnapshot();
  };

  const handleSpeedChange = (spd: 1 | 2 | 3) => {
    engine.speedMultiplier = spd;
    onSyncSnapshot();
  };

  const handleToggleAutoNext = () => {
    engine.autoNextWave = !engine.autoNextWave;
    onSyncSnapshot();
  };

  const handleToggleMute = () => {
    soundManager.setMuted(!soundManager.getMuted());
    onSyncSnapshot();
  };

  return (
    <aside
      data-testid="hud-sidebar"
      className="w-80 lg:w-88 shrink-0 h-full washi-surface border-l-3 border-[#2B2927] flex flex-col justify-between text-[#1A1918] overflow-hidden select-none"
    >
      {/* 1. TOP TELEMETRY STRIP */}
      <div className="p-3 border-b-2 border-[#2B2927] bg-[#E8DFCE]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5C5349]">
              Wave
            </span>
            <span
              data-testid="hud-wave"
              className="font-mono-stats font-extrabold text-sm px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#2B2927]"
            >
              {snapshot.wave} / {snapshot.targetWaves}
              {snapshot.gameState === 'endless' ? ' ∞' : ''}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              data-testid="hud-lives"
              className="flex items-center gap-1 font-mono-stats font-bold text-sm text-[#C1121F]"
              title="Sanctuary Lives"
            >
              <Heart className="w-4 h-4 fill-[#C1121F] text-[#C1121F]" />
              <span>{snapshot.lives}</span>
            </div>

            <div
              data-testid="hud-ink"
              className="flex items-center gap-1 font-mono-stats font-bold text-sm text-[#1A1918] bg-[#FAF6F0] px-2 py-0.5 rounded border border-[#2B2927]"
              title="Sumi Ink Balance"
            >
              <Droplets className="w-3.5 h-3.5 fill-[#1A1918] text-[#1A1918]" />
              <span>{snapshot.ink}</span>
            </div>
          </div>
        </div>

        {/* Playback & Wave Controls */}
        <div className="flex items-center gap-1.5">
          {!snapshot.waveActive ? (
            <button
              type="button"
              data-testid="start-wave-btn"
              onClick={() => engine.startNextWave()}
              className="flex-1 py-1.5 px-2.5 rounded border-2 border-[#1A1918] bg-[#C1121F] hover:bg-[#9B0F19] text-[#F4EFE6] font-brush font-bold text-xs flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#1A1918] cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Wave {snapshot.wave + 1}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                data-testid="pause-wave-btn"
                onClick={handleTogglePause}
                className="px-2.5 py-1.5 rounded border border-[#2B2927] bg-[#FAF6F0] hover:bg-[#DFD5C3] text-xs font-bold flex items-center gap-1 cursor-pointer"
                title={snapshot.isPaused ? 'Resume' : 'Pause'}
              >
                {snapshot.isPaused ? (
                  <Play className="w-3.5 h-3.5 fill-current text-[#2A9D8F]" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
                <span>{snapshot.isPaused ? 'Resume' : 'Pause'}</span>
              </button>

              <button
                type="button"
                data-testid="overclock-wave-btn"
                onClick={() => engine.startNextWave()}
                className="flex-1 py-1.5 px-2 rounded border border-[#C1121F] bg-[#C1121F]/10 hover:bg-[#C1121F]/20 text-[#C1121F] text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                title="Call Next Wave Early for Overclock Ink Bonus"
              >
                <Zap className="w-3 h-3" />
                <span>Send Early (+{getOverclockBonus(snapshot.wave + 1)})</span>
              </button>
            </>
          )}

          {/* 1x / 2x / 3x Speed Selector */}
          <div className="flex rounded border border-[#2B2927] overflow-hidden bg-[#FAF6F0]">
            {([1, 2, 3] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                data-testid={`speed-${spd}x-btn`}
                onClick={() => handleSpeedChange(spd)}
                className={`px-1.5 py-1 text-[11px] font-mono-stats font-bold cursor-pointer ${
                  snapshot.speedMultiplier === spd
                    ? 'bg-[#2B2927] text-[#F4EFE6]'
                    : 'text-[#1A1918] hover:bg-[#E5DBC9]'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Toggles: Auto-Next, Mute, Return to Title */}
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[#2B2927]/15 text-[11px]">
          <button
            type="button"
            onClick={handleToggleAutoNext}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border cursor-pointer ${
              snapshot.autoNextWave
                ? 'border-[#2A9D8F] bg-[#2A9D8F]/15 text-[#1F7A6E] font-bold'
                : 'border-[#2B2927]/30 text-[#5C5349]'
            }`}
          >
            <FastForward className="w-3 h-3" />
            <span>Auto-Wave: {snapshot.autoNextWave ? 'ON' : 'OFF'}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleMute}
              className="p-1 rounded border border-[#2B2927]/30 bg-[#FAF6F0] hover:bg-[#E5DBC9] cursor-pointer"
              title={snapshot.isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {snapshot.isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-[#C1121F]" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-[#1A1918]" />
              )}
            </button>

            <button
              type="button"
              data-testid="return-title-btn"
              onClick={onReturnToTitle}
              className="px-2 py-0.5 rounded border border-[#2B2927]/40 bg-[#FAF6F0] hover:bg-[#E5DBC9] text-[#1A1918] font-semibold flex items-center gap-1 cursor-pointer"
              title="Change Scroll Map or Difficulty"
            >
              <Home className="w-3 h-3" />
              <span>Scrolls</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. TOWER SHOP GRID (5 STARTER ELEMENTAL SEALS) */}
      <div className="p-3 border-b-2 border-[#2B2927]">
        <div className="flex items-center justify-between mb-2">
          <span className="font-brush font-bold text-xs uppercase tracking-wider text-[#2B2927]">
            Elemental Tower Shop
          </span>
          <span className="text-[10px] text-[#5C5349]">Select seal &amp; click paper</span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {ELEMENT_ORDER.map((el) => {
            const spec = TOWER_SPECS[el];
            const isSelected = snapshot.placingElement === el;
            const canAfford = snapshot.ink >= spec.cost;

            return (
              <button
                key={el}
                type="button"
                data-testid={`shop-tower-${el}`}
                onClick={() => handleSelectShopElement(el)}
                className={`p-1.5 rounded border-2 flex flex-col items-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#C1121F] bg-[#FFFDF9] shadow-[2px_2px_0px_#C1121F] -translate-y-0.5'
                    : canAfford
                    ? 'border-[#2B2927] bg-[#FAF6F0] hover:border-[#C1121F]'
                    : 'border-[#2B2927]/40 bg-[#E5DBC9]/60 opacity-65'
                }`}
              >
                <div
                  className="w-7 h-7 rounded-full border border-[#1A1918] flex items-center justify-center text-white font-brush font-bold text-xs shadow-sm"
                  style={{ backgroundColor: spec.waxColor }}
                >
                  {spec.kanji}
                </div>
                <span className="text-[11px] font-bold mt-1 leading-none">
                  {spec.element.charAt(0).toUpperCase() + spec.element.slice(1)}
                </span>
                <span
                  className={`text-[10px] font-mono-stats font-bold mt-0.5 ${
                    canAfford ? 'text-[#1A1918]' : 'text-[#C1121F]'
                  }`}
                >
                  {spec.cost}
                </span>
              </button>
            );
          })}
        </div>

        {snapshot.placingElement && (
          <div className="mt-2 p-2 rounded border border-[#2B2927]/30 bg-[#FAF6F0] text-[11px]">
            <div className="font-bold text-[#1A1918] flex items-center justify-between">
              <span>
                {TOWER_SPECS[snapshot.placingElement].name} (
                {TOWER_SPECS[snapshot.placingElement].japaneseName})
              </span>
              <span className="font-mono-stats text-[#2A9D8F]">
                Range {TOWER_SPECS[snapshot.placingElement].range}px
              </span>
            </div>
            <p className="text-[#4A443F] mt-0.5 leading-snug">
              {TOWER_SPECS[snapshot.placingElement].description}
            </p>
          </div>
        )}
      </div>

      {/* 3. SELECTED TOWER INSPECTOR & 4-2 UPGRADE TREE */}
      <div className="flex-1 overflow-y-auto p-3">
        {selectedTower ? (
          <div data-testid="tower-inspector" className="space-y-2.5">
            {/* Tower Header & Salvage */}
            <div className="p-2.5 rounded border-2 border-[#2B2927] bg-[#FAF6F0]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full border border-[#1A1918] flex items-center justify-center text-white font-brush font-bold text-sm shrink-0"
                    style={{ backgroundColor: TOWER_SPECS[selectedTower.element].waxColor }}
                  >
                    {TOWER_SPECS[selectedTower.element].kanji}
                  </div>
                  <div>
                    <h3 className="font-brush font-bold text-sm leading-tight">
                      {TOWER_SPECS[selectedTower.element].name} ({selectedTower.tierA}-
                      {selectedTower.tierB})
                    </h3>
                    <div className="text-[11px] text-[#5C5349] flex items-center gap-2 font-mono-stats">
                      <span>Kills: {selectedTower.kills}</span>
                      <span>•</span>
                      <span>Dmg: {Math.round(selectedTower.damageDealt)}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="salvage-tower-btn"
                  onClick={() => engine.salvageTower(selectedTower.id)}
                  className="px-2 py-1 rounded border border-[#C1121F] bg-[#C1121F]/10 hover:bg-[#C1121F] hover:text-white text-[#C1121F] text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Salvage Fold for 75% Ink Refund"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>+{getSalvageValue(selectedTower.totalInvested)}</span>
                </button>
              </div>

              {selectedTower.inConduit && (
                <div className="mt-1.5 px-2 py-0.5 rounded bg-[#2A9D8F]/15 border border-[#2A9D8F] text-[#1F7A6E] text-[10px] font-bold">
                  ★ Conduit Stone Active (+15% Effective Range:{' '}
                  {engine.getTowerEffectiveRange(selectedTower)}px)
                </div>
              )}

              {/* Targeting Mode Selector */}
              <div className="mt-2 pt-2 border-t border-[#2B2927]/15">
                <div className="text-[10px] uppercase tracking-wider text-[#5C5349] font-bold mb-1">
                  Targeting Priority
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {TARGETING_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => engine.setTowerTargeting(selectedTower.id, m.id)}
                      className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                        selectedTower.targeting === m.id
                          ? 'border-[#1A1918] bg-[#2B2927] text-[#F4EFE6]'
                          : 'border-[#2B2927]/30 bg-[#EFE7D8] text-[#1A1918] hover:bg-[#DFD5C3]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4-2 Branching Upgrade Paths */}
            <div className="space-y-2.5">
              {(['A', 'B'] as const).map((path) => {
                const spec = TOWER_SPECS[selectedTower.element];
                const pathName = path === 'A' ? spec.pathAName : spec.pathBName;
                const tiers = path === 'A' ? spec.pathA : spec.pathB;
                const currentTier = path === 'A' ? selectedTower.tierA : selectedTower.tierB;
                const oppositeTier = path === 'A' ? selectedTower.tierB : selectedTower.tierA;
                const upgradeCheck = engine.canUpgradeTower(selectedTower, path);
                const nextTierSpec =
                  currentTier < 4 ? tiers[currentTier as 0 | 1 | 2 | 3] : null;

                return (
                  <div
                    key={path}
                    className="p-2.5 rounded border-2 border-[#2B2927] bg-[#FAF6F0] relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-brush font-bold text-xs text-[#1A1918]">
                        Path {path}: {pathName}
                      </span>
                      {/* Tier 1-4 Pips */}
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4].map((tNum) => {
                          const isUnlocked = currentTier >= tNum;
                          const isSealed = tNum >= 3 && oppositeTier >= 3;
                          return (
                            <span
                              key={tNum}
                              className={`w-4 h-4 rounded-sm text-[9px] font-mono-stats font-bold flex items-center justify-center border ${
                                isUnlocked
                                  ? 'bg-[#2A9D8F] text-white border-[#1A1918]'
                                  : isSealed
                                  ? 'bg-[#C1121F]/20 text-[#C1121F] border-[#C1121F]'
                                  : 'bg-[#E5DBC9] text-[#5C5349] border-[#2B2927]/40'
                              }`}
                            >
                              {isSealed ? '×' : tNum}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {currentTier >= 4 ? (
                      <div className="py-2 text-center text-xs font-brush font-bold text-[#2A9D8F] bg-[#2A9D8F]/10 rounded border border-[#2A9D8F]">
                        ★ APEX FORM MASTERED (TIER 4) ★
                      </div>
                    ) : upgradeCheck.sealed && nextTierSpec ? (
                      <div className="p-2 rounded border border-[#C1121F]/50 bg-[#E5DBC9]/60 relative">
                        <div className="text-xs font-bold text-[#5C5349] opacity-60">
                          T{nextTierSpec.tier}: {nextTierSpec.name}
                        </div>
                        <p className="text-[11px] text-[#5C5349] opacity-60 mt-0.5">
                          {nextTierSpec.description}
                        </p>
                        {/* Angled Crimson SEALED Stamp */}
                        <div
                          data-testid={`sealed-stamp-${path}`}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                          <span className="hanko-stamp px-3 py-0.5 rounded text-xs -rotate-12 shadow-sm">
                            SEALED (4-2 LIMIT)
                          </span>
                        </div>
                      </div>
                    ) : (
                      nextTierSpec && (
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-xs font-bold text-[#1A1918]">
                              T{nextTierSpec.tier}: {nextTierSpec.name}
                            </span>
                            {nextTierSpec.tag === 'TRANSFORMS' && (
                              <span className="px-1.5 py-0.5 rounded bg-[#D4A373]/30 border border-[#8A5A2B] text-[#8A5A2B] text-[9px] font-extrabold">
                                [TRANSFORMS PROJECTILE]
                              </span>
                            )}
                            {nextTierSpec.tag === 'APEX' && (
                              <span className="px-1.5 py-0.5 rounded bg-[#C1121F]/15 border border-[#C1121F] text-[#C1121F] text-[9px] font-extrabold">
                                [APEX FORM]
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#4A443F] leading-snug mb-2">
                            {nextTierSpec.description}
                          </p>
                          <button
                            type="button"
                            data-testid={`upgrade-path-${path}-btn`}
                            disabled={!upgradeCheck.allowed}
                            onMouseEnter={() =>
                              onHoverUpgradeRange(nextTierSpec.rangeBonus ?? 0)
                            }
                            onMouseLeave={() => onHoverUpgradeRange(0)}
                            onClick={() => {
                              onHoverUpgradeRange(0);
                              engine.upgradeTower(selectedTower.id, path);
                            }}
                            className={`w-full py-1.5 px-2.5 rounded border font-bold text-xs flex items-center justify-between transition-all ${
                              upgradeCheck.allowed
                                ? 'border-[#1A1918] bg-[#2B2927] hover:bg-[#C1121F] text-[#F4EFE6] cursor-pointer shadow-[2px_2px_0px_#1A1918]'
                                : 'border-[#2B2927]/30 bg-[#E5DBC9] text-[#8C7A6B] cursor-not-allowed'
                            }`}
                          >
                            <span>Fold Tier {nextTierSpec.tier}</span>
                            <span className="font-mono-stats">
                              {getScaledUpgradeCost(nextTierSpec.baseCost, diffMult)} Ink
                            </span>
                          </button>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-[#2B2927]/30 rounded bg-[#FAF6F0]/60">
            <div className="w-10 h-10 rounded-full border-2 border-[#2B2927]/40 flex items-center justify-center font-brush font-bold text-lg text-[#5C5349] mb-2">
              印
            </div>
            <p className="text-xs font-bold text-[#2B2927]">No Elemental Shrine Selected</p>
            <p className="text-[11px] text-[#5C5349] mt-1 leading-relaxed">
              Choose one of the 5 Elemental Seals above and click on the rice-paper scroll to
              fold a shrine, or click an existing shrine to inspect its{' '}
              <span className="font-bold text-[#C1121F]">4-2 Upgrade Tree</span>.
            </p>
          </div>
        )}
      </div>

      {/* 4. FOOTER TRIGGER: SCROLL OF SEALS CODEX */}
      <div className="p-3 border-t-2 border-[#2B2927] bg-[#E8DFCE]">
        <button
          type="button"
          data-testid="open-codex-btn"
          onClick={onOpenCodex}
          className="w-full py-2 px-3 rounded border-2 border-[#2B2927] bg-[#FAF6F0] hover:bg-[#FFFDF9] text-[#1A1918] font-brush font-bold text-xs flex items-center justify-between shadow-[2px_2px_0px_#2B2927] cursor-pointer transition-all"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#C1121F]" />
            <span>Scroll of Seals (Combo Codex)</span>
          </span>
          <span className="px-2 py-0.5 rounded bg-[#C1121F] text-[#F4EFE6] font-mono-stats text-[10px] font-bold">
            {snapshot.discoveredCombos.length}/10
          </span>
        </button>
      </div>
    </aside>
  );
};
