import React from 'react';
import { BookOpen, Award, Play, Shield, Sparkles, Flame } from 'lucide-react';
import { DIFFICULTY_SPECS, ELEMENT_ORDER, TOWER_SPECS } from '../lib/constants';
import { MAP_LIST } from '../lib/maps';
import {
  ComboId,
  DifficultyId,
  HighScoreRecord,
  MapId,
  ScrollMapDefinition,
} from '../lib/types';

interface TitleScreenProps {
  selectedMap: MapId;
  selectedDifficulty: DifficultyId;
  highScores: HighScoreRecord[];
  discoveredCombos: ComboId[];
  onSelectMap: (mapId: MapId) => void;
  onSelectDifficulty: (diffId: DifficultyId) => void;
  onStartGame: () => void;
  onOpenCodex: () => void;
}

function MiniMapPreview({ map }: { map: ScrollMapDefinition }) {
  return (
    <svg
      viewBox="0 0 960 600"
      className="w-full h-28 rounded border border-[#2B2927]/40 bg-[#F4EFE6]"
    >
      {/* Conduit circles */}
      {map.conduits.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={c.radius}
          fill="rgba(42, 157, 143, 0.22)"
          stroke="#2A9D8F"
          strokeWidth="6"
          strokeDasharray="12 8"
        />
      ))}

      {/* Lanes */}
      {map.controlPoints.map((pts, lIdx) => {
        const d = pts
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
          .join(' ');
        const last = pts[pts.length - 1];
        return (
          <g key={lIdx}>
            <path
              d={d}
              fill="none"
              stroke="#1A1918"
              strokeWidth="36"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x={last.x - 24}
              y={last.y - 24}
              width="48"
              height="48"
              fill="#F4EFE6"
              stroke="#C1121F"
              strokeWidth="10"
            />
          </g>
        );
      })}
    </svg>
  );
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedMap,
  selectedDifficulty,
  highScores,
  discoveredCombos,
  onSelectMap,
  onSelectDifficulty,
  onStartGame,
  onOpenCodex,
}) => {
  const getRecord = (mapId: MapId, diffId: DifficultyId) =>
    highScores.find((r) => r.mapId === mapId && r.difficultyId === diffId);

  return (
    <div className="w-screen h-screen overflow-y-auto bg-[#1A1918] flex items-center justify-center p-4">
      <div className="w-full max-w-6xl washi-surface border-4 border-[#2B2927] rounded-lg shadow-2xl p-6 md:p-8 text-[#1A1918] relative">
        {/* Decorative Corner Hanko Stamp */}
        <div className="hidden sm:flex flex-col items-center justify-center w-14 h-14 border-2 border-[#C1121F] text-[#C1121F] bg-[#C1121F]/10 absolute top-6 right-6 rotate-6 font-brush font-bold text-lg leading-tight">
          <span>折り</span>
          <span>紙陣</span>
        </div>

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2B2927] text-[#F4EFE6] text-xs uppercase tracking-widest mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>Autonomous Elemental Scroll Defense</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-brush font-black tracking-tight text-[#1A1918]">
            RUNIC ORIGAMI &amp; INK
          </h1>
          <p className="text-sm md:text-base text-[#4A443F] mt-1.5">
            Fold sacred paper shrines, prime elemental brush statuses, and trigger{' '}
            <span className="font-bold text-[#C1121F]">10 Two-Element Seal Reactions</span> to
            defend the Sanctuary.
          </p>

          {/* 5 Elemental Emblems Strip */}
          <div className="flex items-center justify-center gap-3 mt-3">
            {ELEMENT_ORDER.map((el) => {
              const spec = TOWER_SPECS[el];
              return (
                <div
                  key={el}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#2B2927]/30 bg-[#FAF6F0] text-xs font-semibold"
                >
                  <span
                    className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] text-white font-bold"
                    style={{ backgroundColor: spec.waxColor }}
                  >
                    {spec.kanji}
                  </span>
                  <span>{spec.japaneseName}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 1: Select Scroll Map */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#2B2927] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#2B2927] text-[#F4EFE6] inline-flex items-center justify-center text-xs">
                1
              </span>
              Select Rice-Paper Scroll Map
            </h2>
            <span className="text-xs text-[#5C5349]">
              Click a scroll to inspect its brushstroke geometry
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MAP_LIST.map((map) => {
              const isSelected = selectedMap === map.id;
              const rec = getRecord(map.id, selectedDifficulty);
              return (
                <button
                  key={map.id}
                  type="button"
                  data-testid={`map-card-${map.id}`}
                  onClick={() => onSelectMap(map.id)}
                  className={`text-left p-4 rounded border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#C1121F] washi-card-active ring-2 ring-[#C1121F]/30'
                      : 'border-[#2B2927] washi-card hover:border-[#C1121F]/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-brush font-bold text-base text-[#1A1918]">
                        {map.name}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                          map.difficultyLabel === 'Beginner'
                            ? 'bg-[#2A9D8F]/15 text-[#1F7A6E] border-[#2A9D8F]'
                            : map.difficultyLabel === 'Intermediate'
                            ? 'bg-[#D4A373]/25 text-[#8A5A2B] border-[#D4A373]'
                            : 'bg-[#C1121F]/15 text-[#C1121F] border-[#C1121F]'
                        }`}
                      >
                        {map.difficultyLabel}
                      </span>
                    </div>
                    <p className="text-xs italic text-[#5C5349] mb-2">{map.japaneseTitle}</p>

                    <MiniMapPreview map={map} />

                    <p className="text-xs text-[#3A3530] mt-2.5 leading-relaxed">
                      {map.description}
                    </p>
                    <p className="text-[11px] font-semibold text-[#2A9D8F] mt-1.5">
                      ★ {map.specialRuleText}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#2B2927]/15 flex items-center justify-between text-xs">
                    <span className="text-[#5C5349] flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-[#D4A373]" />
                      Best ({DIFFICULTY_SPECS[selectedDifficulty].name.split(' ')[0]}):
                    </span>
                    {rec ? (
                      <span className="font-mono-stats font-bold text-[#1A1918]">
                        Wave {rec.highestWave}{' '}
                        {rec.victoryAchieved && (
                          <span className="text-[#C1121F] ml-1">[SEALED]</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[#8C7A6B] italic">Unexplored</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Select Difficulty Seal */}
        <div className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#2B2927] flex items-center gap-2 mb-2.5">
            <span className="w-5 h-5 rounded-full bg-[#2B2927] text-[#F4EFE6] inline-flex items-center justify-center text-xs">
              2
            </span>
            Choose Difficulty Seal
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['apprentice', 'master', 'grandmaster'] as DifficultyId[]).map((diffId) => {
              const spec = DIFFICULTY_SPECS[diffId];
              const isSelected = selectedDifficulty === diffId;
              return (
                <button
                  key={diffId}
                  type="button"
                  data-testid={`difficulty-card-${diffId}`}
                  onClick={() => onSelectDifficulty(diffId)}
                  className={`text-left p-3.5 rounded border-2 transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? 'border-[#C1121F] washi-card-active ring-2 ring-[#C1121F]/30'
                      : 'border-[#2B2927] washi-card hover:border-[#C1121F]/60'
                  }`}
                >
                  <div
                    className={`w-11 h-11 shrink-0 rounded border-2 flex items-center justify-center font-brush font-bold text-xl ${
                      isSelected
                        ? 'border-[#C1121F] bg-[#C1121F] text-[#F4EFE6]'
                        : 'border-[#2B2927] bg-[#EFE7D8] text-[#1A1918]'
                    }`}
                  >
                    {spec.kanji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-brush font-bold text-sm text-[#1A1918]">
                        {spec.name}
                      </span>
                      {diffId === 'grandmaster' && (
                        <Flame className="w-4 h-4 text-[#C1121F]" />
                      )}
                      {diffId === 'apprentice' && (
                        <Shield className="w-4 h-4 text-[#2A9D8F]" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#5C5349] italic">{spec.subtitle}</p>
                    <p className="text-xs font-mono-stats text-[#2B2927] mt-1">
                      {spec.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t-2 border-[#2B2927]/20">
          <button
            type="button"
            data-testid="title-codex-btn"
            onClick={onOpenCodex}
            className="w-full sm:w-auto px-5 py-2.5 rounded border-2 border-[#2B2927] bg-[#FAF6F0] hover:bg-[#E6DEC8] text-[#1A1918] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <BookOpen className="w-4 h-4 text-[#C1121F]" />
            <span>Scroll of Seals Codex ({discoveredCombos.length}/10 Discovered)</span>
          </button>

          <button
            type="button"
            data-testid="start-game-btn"
            onClick={onStartGame}
            className="w-full sm:w-auto px-8 py-3 rounded border-2 border-[#1A1918] bg-[#C1121F] hover:bg-[#9B0F19] text-[#F4EFE6] font-brush font-bold text-base tracking-wide flex items-center justify-center gap-2.5 shadow-[3px_3px_0px_#1A1918] cursor-pointer transition-all"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Unroll Scroll (Start Game)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
