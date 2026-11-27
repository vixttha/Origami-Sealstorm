import React from 'react';
import { Award, Infinity as InfinityIcon, RotateCcw, Home, Trophy } from 'lucide-react';
import { DIFFICULTY_SPECS, TOWER_SPECS } from '../lib/constants';
import { SCROLL_MAPS } from '../lib/maps';
import { EngineSnapshot, TowerEntity } from '../lib/types';

interface EndModalProps {
  snapshot: EngineSnapshot;
  onClaimVictory: () => void;
  onContinueEndless: () => void;
  onRestartMatch: () => void;
  onReturnToTitle: () => void;
}

export const EndModal: React.FC<EndModalProps> = ({
  snapshot,
  onClaimVictory,
  onContinueEndless,
  onRestartMatch,
  onReturnToTitle,
}) => {
  if (snapshot.gameState !== 'victory_prompt' && snapshot.gameState !== 'defeat') {
    return null;
  }

  const isVictory = snapshot.gameState === 'victory_prompt';
  const mapSpec = SCROLL_MAPS[snapshot.mapId];
  const diffSpec = DIFFICULTY_SPECS[snapshot.difficultyId];

  let mvpTower: TowerEntity | null = null;
  for (const t of snapshot.towers) {
    if (!mvpTower || t.damageDealt > mvpTower.damageDealt) {
      mvpTower = t;
    }
  }

  return (
    <div
      data-testid="end-modal"
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-lg washi-surface border-4 border-[#2B2927] rounded-lg shadow-2xl p-6 text-[#1A1918] relative">
        {/* Crimson Hanko Stamp Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div
            className={`w-16 h-16 rounded border-4 flex items-center justify-center font-brush font-black text-3xl mb-3 shadow-md ${
              isVictory
                ? 'border-[#C1121F] bg-[#C1121F] text-[#F4EFE6] -rotate-6'
                : 'border-[#2B2927] bg-[#1A1918] text-[#F4EFE6]'
            }`}
          >
            {isVictory ? '勝' : '破'}
          </div>

          <h2 className="text-2xl md:text-3xl font-brush font-black text-[#1A1918]">
            {isVictory ? 'SANCTUARY SEALED!' : 'SANCTUARY BREACHED'}
          </h2>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#5C5349] mt-1">
            {mapSpec.name} • {diffSpec.name}
          </p>
        </div>

        {/* Run Telemetry Summary */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <div className="p-3 rounded border-2 border-[#2B2927] bg-[#FAF6F0] text-center">
            <div className="text-[10px] uppercase text-[#5C5349] font-bold">Wave Cleared</div>
            <div className="text-lg font-mono-stats font-extrabold text-[#1A1918] mt-0.5">
              {snapshot.wave}
            </div>
          </div>

          <div className="p-3 rounded border-2 border-[#2B2927] bg-[#FAF6F0] text-center">
            <div className="text-[10px] uppercase text-[#5C5349] font-bold">Beasts Unfolded</div>
            <div className="text-lg font-mono-stats font-extrabold text-[#2A9D8F] mt-0.5">
              {snapshot.totalKills}
            </div>
          </div>

          <div className="p-3 rounded border-2 border-[#2B2927] bg-[#FAF6F0] text-center">
            <div className="text-[10px] uppercase text-[#5C5349] font-bold">Seal Combos</div>
            <div className="text-lg font-mono-stats font-extrabold text-[#C1121F] mt-0.5">
              {snapshot.runCombosTriggered}
            </div>
          </div>
        </div>

        {/* MVP Shrine Card */}
        {mvpTower && (
          <div className="p-3 rounded border-2 border-[#2B2927] bg-[#FAF6F0] mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full border-2 border-[#1A1918] flex items-center justify-center text-white font-brush font-bold text-base"
                style={{ backgroundColor: TOWER_SPECS[mvpTower.element].waxColor }}
              >
                {TOWER_SPECS[mvpTower.element].kanji}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#C1121F] flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  <span>MVP Elemental Shrine</span>
                </div>
                <div className="font-brush font-bold text-sm">
                  {TOWER_SPECS[mvpTower.element].name} (Tier {mvpTower.tierA}-{mvpTower.tierB})
                </div>
              </div>
            </div>

            <div className="text-right font-mono-stats text-xs">
              <div className="font-bold text-[#1A1918]">
                {Math.round(mvpTower.damageDealt).toLocaleString()} Dmg
              </div>
              <div className="text-[#5C5349]">{mvpTower.kills} Kills</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {isVictory ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              data-testid="claim-victory-btn"
              onClick={onClaimVictory}
              className="flex-1 py-2.5 px-4 rounded border-2 border-[#2B2927] bg-[#FAF6F0] hover:bg-[#E5DBC9] text-[#1A1918] font-brush font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Award className="w-4 h-4 text-[#C1121F]" />
              <span>Claim Victory</span>
            </button>

            <button
              type="button"
              data-testid="endless-mode-btn"
              onClick={onContinueEndless}
              className="flex-1 py-2.5 px-4 rounded border-2 border-[#1A1918] bg-[#C1121F] hover:bg-[#9B0F19] text-[#F4EFE6] font-brush font-bold text-xs flex items-center justify-center gap-2 shadow-[3px_3px_0px_#1A1918] cursor-pointer"
            >
              <InfinityIcon className="w-4 h-4" />
              <span>Unroll Infinite Scroll (Endless)</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              data-testid="defeat-title-btn"
              onClick={onReturnToTitle}
              className="flex-1 py-2.5 px-4 rounded border-2 border-[#2B2927] bg-[#FAF6F0] hover:bg-[#E5DBC9] text-[#1A1918] font-brush font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Select Scroll</span>
            </button>

            <button
              type="button"
              data-testid="defeat-restart-btn"
              onClick={onRestartMatch}
              className="flex-1 py-2.5 px-4 rounded border-2 border-[#1A1918] bg-[#C1121F] hover:bg-[#9B0F19] text-[#F4EFE6] font-brush font-bold text-xs flex items-center justify-center gap-2 shadow-[3px_3px_0px_#1A1918] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Fold Again (Restart)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
