import { glyph } from '../lib/glyph';
import { DIFFICULTIES, ELEMENTS, towerName } from '../lib/constants';
import type { GameEngine } from '../lib/engine';

interface Props {
  engine: GameEngine;
  onRestart: () => void;
  onQuit: () => void;
}

export default function EndModal({ engine, onRestart, onQuit }: Props) {
  const s = engine.status;
  if (s === 'playing') return null;
  const mvp = engine.mvp();
  const diff = DIFFICULTIES[engine.diffId];
  const victory = s === 'victory';
  const won = s === 'won';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4" data-testid="end-modal">
      <div className="washi ink-border relative w-full max-w-md p-6 text-center">
        <div className="stamp-pop mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-md bg-[#C1121F] text-4xl font-bold text-[#F4EFE6] shadow-lg">
          {s === 'defeat' ? glyph('敗') || 'L' : glyph('勝') || 'W'}
        </div>
        <h2 className="font-brush text-4xl font-bold leading-none">
          {victory ? 'Scroll Complete!' : won ? 'Victory Claimed' : 'The Sanctuary Unfolds'}
        </h2>
        <p className="mt-1 text-sm italic text-[#4a4540]">
          {victory
            ? `All ${engine.target} waves cleared on ${diff.name}. Stamp your victory, or keep unrolling the Infinite Scroll.`
            : won
              ? `${diff.name} — wave ${engine.wave} conquered.`
              : `${diff.name} — fell on wave ${engine.wave}.`}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="parchment ink-border p-2">Waves <b>{engine.wave}</b></div>
          <div className="parchment ink-border p-2">Unfolded <b>{engine.run.kills}</b></div>
          <div className="parchment ink-border p-2">Ink earned <b>{engine.run.inkEarned}</b></div>
          <div className="parchment ink-border p-2">Seal reactions <b>{engine.run.combos}</b></div>
        </div>
        {mvp && (
          <div className="parchment ink-border mt-2 p-2 text-sm" data-testid="mvp">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C1121F]">MVP Seal</span>
            <div className="font-bold">{towerName(mvp)} <span className="font-normal text-[#6b6358]">({ELEMENTS[mvp.element].name})</span></div>
            <div className="text-xs">{mvp.kills} kills · {Math.floor(mvp.damage)} damage dealt</div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {victory ? (
            <>
              <button onClick={() => engine.claimVictory()} data-testid="claim-victory" className="ink-border bg-[#C1121F] py-2 font-bold text-[#F4EFE6] hover:bg-[#a30f19]">
                Claim Victory
              </button>
              <button onClick={() => engine.goEndless()} data-testid="go-endless" className="ink-border bg-[#1A1918] py-2 font-bold text-[#F4EFE6] hover:bg-[#333]">
                Unroll Infinite Scroll (Endless)
              </button>
            </>
          ) : (
            <>
              <button onClick={onRestart} data-testid="play-again" className="ink-border bg-[#C1121F] py-2 font-bold text-[#F4EFE6] hover:bg-[#a30f19]">
                Play Again
              </button>
              <button onClick={onQuit} data-testid="to-title" className="ink-border bg-[#EFE7D8] py-2 font-bold hover:bg-white">
                Return to Title
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
