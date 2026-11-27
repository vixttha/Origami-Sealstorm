import { useEffect, useRef, useState } from 'react';
import { ChevronRight, ScrollText } from 'lucide-react';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../lib/constants';
import { MAPS } from '../lib/maps';
import { drawMapThumb } from '../lib/renderer';
import type { DifficultyId, Ledger } from '../lib/types';

/**
 * Title screen: scroll map selection (3 rice-paper maps with live procedural
 * thumbnails), difficulty seals and the local High-Score Ledger (per map x
 * difficulty, persisted in localStorage).
 */
export default function TitleScreen({
  onStart,
  ledger,
}: {
  onStart: (mapId: string, difficulty: DifficultyId) => void;
  ledger: Ledger;
}) {
  const [mapId, setMapId] = useState(MAPS[0].id);
  const [difficulty, setDifficulty] = useState<DifficultyId>('apprentice');
  const thumbRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  // Render the procedural map thumbnails (offscreen washi cache reused).
  useEffect(() => {
    MAPS.forEach((m, i) => {
      const canvas = thumbRefs.current[i];
      if (!canvas) return;
      canvas.width = 560;
      canvas.height = 350;
      drawMapThumb(canvas, m);
    });
  }, []);

  const map = MAPS.find((m) => m.id === mapId) ?? MAPS[0];

  return (
    <div className="h-full w-full overflow-y-auto bg-night">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center px-6 py-8">
        {/* Title */}
        <div className="relative text-center">
          <div className="mb-2 flex items-center justify-center gap-3">
            <span className="hanko-stamp px-2 py-1 font-brush text-lg font-bold">印</span>
            <span className="hanko-stamp px-2 py-1 font-brush text-lg font-bold">墨</span>
          </div>
          <h1 className="font-brush text-[44px] font-bold leading-none tracking-wide text-washi drop-shadow-[0_3px_0_rgba(0,0,0,0.5)] md:text-[56px]">
            RUNIC ORIGAMI <span className="text-crimson">&amp;</span> INK
          </h1>
          <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.3em] text-washi/70">
            A tower defense of folded seals and ink reactions
          </p>
        </div>

        {/* Map selection */}
        <h2 className="mt-8 self-start font-brush text-lg font-bold tracking-widest text-washi/90">
          CHOOSE YOUR SCROLL
        </h2>
        <div className="mt-3 grid w-full grid-cols-1 gap-3 md:grid-cols-3">
          {MAPS.map((m, i) => {
            const active = m.id === mapId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMapId(m.id)}
                className={`group relative overflow-hidden rounded-md border-[3px] p-2 text-left transition ${
                  active
                    ? 'border-crimson shadow-[0_0_24px_rgba(193,18,31,0.4)]'
                    : 'border-washi/25 hover:border-washi/60'
                }`}
              >
                <div className="overflow-hidden rounded-sm ring-1 ring-black/30">
                  <canvas
                    ref={(el) => {
                      thumbRefs.current[i] = el;
                    }}
                    className="block w-full"
                    aria-label={`${m.name} preview`}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between px-1 pb-1">
                  <div className="min-w-0">
                    <p className="truncate font-brush text-[15px] font-bold text-washi">{m.name}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-washi/60">{m.tier}</p>
                  </div>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      active ? 'border-crimson bg-crimson text-washi' : 'border-washi/40 text-washi/50'
                    }`}
                  >
                    <ChevronRight size={13} />
                  </span>
                </div>
                <p className="px-1 pb-1 text-[10px] leading-snug text-washi/60">{m.flavor}</p>
              </button>
            );
          })}
        </div>

        {/* Difficulty seals */}
        <h2 className="mt-8 self-start font-brush text-lg font-bold tracking-widest text-washi/90">
          CARVE THE DIFFICULTY SEAL
        </h2>
        <div className="mt-3 grid w-full grid-cols-1 gap-3 md:grid-cols-3">
          {DIFFICULTY_ORDER.map((id) => {
            const def = DIFFICULTIES[id];
            const active = id === difficulty;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setDifficulty(id)}
                className={`flex items-center gap-3 rounded-md border-[3px] px-3 py-3 text-left transition ${
                  active ? 'border-crimson bg-crimson/15' : 'border-washi/25 hover:border-washi/60'
                }`}
              >
                <span
                  className={`flex h-12 w-12 shrink-0 rotate-[-7deg] items-center justify-center rounded-md border-2 font-brush text-2xl font-bold ${
                    active ? 'border-washi/90 bg-crimson text-washi' : 'border-washi/40 bg-washi/10 text-washi/70'
                  }`}
                >
                  {def.sealKanji}
                </span>
                <span className="min-w-0">
                  <span className="block font-brush text-[14px] font-bold text-washi">{def.name}</span>
                  <span className="mt-0.5 block text-[9px] leading-snug text-washi/60">{def.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* High-Score Ledger */}
        <h2 className="mt-8 self-start font-brush text-lg font-bold tracking-widest text-washi/90">
          HIGH-SCORE LEDGER - {map.name.toUpperCase()}
        </h2>
        <div className="mt-3 w-full overflow-hidden rounded-md border-2 border-washi/25">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-washi/10 text-washi/70">
                <th className="px-3 py-1.5 text-left font-bold uppercase tracking-widest">Difficulty</th>
                <th className="px-3 py-1.5 text-right font-bold uppercase tracking-widest">Best Wave</th>
                <th className="px-3 py-1.5 text-right font-bold uppercase tracking-widest">Best Score</th>
                <th className="px-3 py-1.5 text-right font-bold uppercase tracking-widest">Victories</th>
              </tr>
            </thead>
            <tbody>
              {DIFFICULTY_ORDER.map((id) => {
                const entry = ledger[map.id]?.[id];
                return (
                  <tr key={id} className="border-t border-washi/15 text-washi/90">
                    <td className="px-3 py-1.5 text-left font-bold">{DIFFICULTIES[id].name}</td>
                    <td className="px-3 py-1.5 text-right font-brush text-[14px] font-bold">
                      {entry ? entry.bestWave : '-'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-brush text-[14px] font-bold">
                      {entry ? entry.bestScore : '-'}
                    </td>
                    <td className="px-3 py-1.5 text-right text-crimson">
                      {entry && entry.victories > 0 ? `${entry.victories} 勝` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Start */}
        <button
          type="button"
          onClick={() => onStart(mapId, difficulty)}
          className="mt-8 flex items-center gap-2.5 rounded-md border-[3px] border-crimson bg-crimson px-10 py-3.5 font-brush text-xl font-bold tracking-widest text-washi shadow-[0_6px_0_rgba(0,0,0,0.35)] transition hover:bg-crimson/90 active:translate-y-[2px] active:shadow-[0_3px_0_rgba(0,0,0,0.35)]"
        >
          <ScrollText size={20} />
          UNROLL THE SCROLL
        </button>
        <p className="mt-4 pb-2 text-center text-[10px] leading-relaxed text-washi/45">
          5 elemental seals - 20 branching upgrades - 10 hidden seal reactions.
          <br />
          Hover a buildable tile to preview range and Resonance Lines. Discoveries and best runs are
          saved in this browser.
        </p>
      </div>
    </div>
  );
}
