import React, { useState } from 'react';
import { BookOpen, Sparkles, X, ShieldAlert } from 'lucide-react';
import { COMBO_LIST, ENEMY_SPECS, TOWER_SPECS } from '../lib/constants';
import { ComboId, EnemyType } from '../lib/types';

interface CodexModalProps {
  isOpen: boolean;
  discoveredCombos: ComboId[];
  onClose: () => void;
}

const ENEMY_ORDER: EnemyType[] = [
  'moth',
  'crane',
  'fox',
  'serpent',
  'tortoise',
  'dragon',
];

export const CodexModal: React.FC<CodexModalProps> = ({
  isOpen,
  discoveredCombos,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'combos' | 'bestiary'>('combos');

  if (!isOpen) return null;

  const discoveredSet = new Set(discoveredCombos);

  return (
    <div
      data-testid="codex-modal"
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[88vh] washi-surface border-4 border-[#2B2927] rounded-lg shadow-2xl flex flex-col text-[#1A1918] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b-2 border-[#2B2927] bg-[#E8DFCE] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded border-2 border-[#C1121F] bg-[#C1121F] text-[#F4EFE6] font-brush font-bold text-lg flex items-center justify-center">
              印
            </div>
            <div>
              <h2 className="font-brush font-bold text-lg leading-tight">
                Scroll of Seals — Elemental Codex
              </h2>
              <p className="text-xs text-[#5C5349]">
                First trigger of each reaction per run grants a{' '}
                <span className="font-bold text-[#C1121F]">+25 Ink Discovery Bonus</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="close-codex-btn"
            onClick={onClose}
            className="p-1.5 rounded border-2 border-[#2B2927] bg-[#FAF6F0] hover:bg-[#C1121F] hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 pt-3 border-b border-[#2B2927]/20 flex items-center justify-between bg-[#EFE7D8]">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('combos')}
              className={`px-4 py-2 rounded-t border-t-2 border-x-2 font-brush font-bold text-xs flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'combos'
                  ? 'border-[#2B2927] bg-[#FAF6F0] text-[#C1121F]'
                  : 'border-transparent bg-[#E5DBC9] text-[#5C5349]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>10 Two-Element Seal Reactions ({discoveredCombos.length}/10)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bestiary')}
              className={`px-4 py-2 rounded-t border-t-2 border-x-2 font-brush font-bold text-xs flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'bestiary'
                  ? 'border-[#2B2927] bg-[#FAF6F0] text-[#C1121F]'
                  : 'border-transparent bg-[#E5DBC9] text-[#5C5349]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Layered Origami Bestiary (6 Folds)</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {activeTab === 'combos' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {COMBO_LIST.map((combo) => {
                const isDiscovered = discoveredSet.has(combo.id);
                const el1 = TOWER_SPECS[combo.elements[0]];
                const el2 = TOWER_SPECS[combo.elements[1]];

                return (
                  <div
                    key={combo.id}
                    data-testid={`codex-combo-${combo.id}`}
                    className={`p-3 rounded border-2 flex items-start gap-3 ${
                      isDiscovered
                        ? 'border-[#2B2927] bg-[#FAF6F0] shadow-[2px_2px_0px_#2B2927]'
                        : 'border-[#2B2927]/40 bg-[#FAF6F0]/75'
                    }`}
                  >
                    <div
                      className="w-11 h-11 rounded border-2 border-[#1A1918] shrink-0 flex flex-col items-center justify-center text-white font-brush font-bold text-lg shadow-sm"
                      style={{ backgroundColor: combo.color }}
                    >
                      <span>{combo.kanji}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-brush font-bold text-sm text-[#1A1918]">
                          {combo.name}
                        </span>
                        {isDiscovered ? (
                          <span className="hanko-stamp px-1.5 py-0.5 rounded text-[9px]">
                            SEALED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-[#E5DBC9] text-[#5C5349] text-[9px] font-bold">
                            UNDISCOVERED (+25 INK)
                          </span>
                        )}
                      </div>

                      {/* Element Pair Badges */}
                      <div className="flex items-center gap-1.5 my-1">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                          style={{ backgroundColor: el1.waxColor }}
                        >
                          {el1.kanji} {el1.japaneseName} ({el1.element.toUpperCase()})
                        </span>
                        <span className="text-xs font-bold text-[#5C5349]">+</span>
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                          style={{ backgroundColor: el2.waxColor }}
                        >
                          {el2.kanji} {el2.japaneseName} ({el2.element.toUpperCase()})
                        </span>
                      </div>

                      <p className="text-xs font-mono-stats font-bold text-[#C1121F] mt-1">
                        {combo.formulaText}
                      </p>
                      <p className="text-[11px] text-[#4A443F] mt-0.5 leading-snug">
                        {combo.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ENEMY_ORDER.map((type) => {
                const spec = ENEMY_SPECS[type];
                return (
                  <div
                    key={type}
                    className="p-3 rounded border-2 border-[#2B2927] bg-[#FAF6F0] shadow-[2px_2px_0px_#2B2927] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h3 className="font-brush font-bold text-sm text-[#1A1918]">
                            {spec.name}{' '}
                            <span className="text-xs italic text-[#5C5349] font-normal">
                              ({spec.japaneseSubtitle})
                            </span>
                          </h3>
                        </div>
                        <div className="flex items-center gap-1">
                          {spec.isCamo && (
                            <span className="px-1.5 py-0.5 rounded bg-[#3A86FF]/15 border border-[#3A86FF] text-[#3A86FF] text-[10px] font-bold">
                              PHANTOM
                            </span>
                          )}
                          {spec.isArmored && (
                            <span className="px-1.5 py-0.5 rounded bg-[#D4A373]/25 border border-[#8A5A2B] text-[#8A5A2B] text-[10px] font-bold">
                              ARMORED
                            </span>
                          )}
                          {spec.isBoss && (
                            <span className="px-1.5 py-0.5 rounded bg-[#C1121F] text-white text-[10px] font-bold">
                              BOSS
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-[#4A443F] mt-1.5 leading-snug">
                        {spec.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#2B2927]/15 flex items-center justify-between text-[11px] font-mono-stats">
                      <span>Base HP: {spec.baseHp}</span>
                      <span>Speed: {spec.speed} px/s</span>
                      <span className="text-[#2A9D8F] font-bold">+{spec.bounty} Ink</span>
                      <span className="text-[#C1121F] font-bold flex items-center gap-0.5">
                        <ShieldAlert className="w-3 h-3" />
                        {spec.peelsInto
                          ? `Peels: ${spec.peelsInto.count}× ${
                              ENEMY_SPECS[spec.peelsInto.type].name
                            }`
                          : 'Confetti'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
