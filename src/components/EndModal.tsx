import { RotateCcw, Scroll, Skull, Trophy } from 'lucide-react';
import { TOWER_DEFS } from '../lib/constants';
import type { GameEngine } from '../lib/engine';
import type { UiSnapshot } from '../lib/types';

/**
 * Victory stamp ("Claim Victory" / "Unroll Infinite Scroll") and Defeat
 * MVP stats modal. Rendered whenever engine.state.endState is set.
 */
export default function EndModal({
  engine,
  snapshot,
  onExit,
  onRetry,
}: {
  engine: GameEngine;
  snapshot: UiSnapshot;
  onExit: () => void;
  onRetry: () => void;
}) {
  const end = snapshot.endState;
  if (!end) return null;
  const victory = end.kind === 'victory';
  const mvpColor = end.mvpElement ? TOWER_DEFS[end.mvpElement].color : '#2B2927';

  return (
    <div
      className="roi-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-label={victory ? 'Victory' : 'Defeat'}
    >
      <div className="roi-pop-in relative w-full max-w-md overflow-hidden rounded-md border-[3px] border-sumi bg-parch px-6 py-7 text-center shadow-2xl">
        {/* Crimson victory / defeat stamp */}
        <div className="roi-stamp-in mx-auto flex h-24 w-24 items-center justify-center rounded-md border-[3px] border-crimson bg-crimson/95 shadow-lg">
          <span className="font-brush text-5xl font-bold text-washi">{victory ? '勝' : '敗'}</span>
        </div>

        <h2 className="mt-4 font-brush text-3xl font-bold tracking-wide text-sumi">
          {victory ? 'THE SCROLL HOLDS' : 'THE INK RUNS DRY'}
        </h2>
        <p className="mt-1 text-[12px] font-bold uppercase tracking-widest opacity-70">
          {victory
            ? `${snapshot.wavesCleared} waves cleared on ${engine.state.map.name}`
            : `Defeated on wave ${end.waveReached + 1} of ${engine.state.map.name}`}
        </p>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: 'Waves Cleared', value: end.waveReached },
            { label: 'Foes Unfolded', value: end.kills },
            { label: 'Score', value: end.score },
          ].map((s) => (
            <div key={s.label} className="rounded border-2 border-sumi/50 bg-washi px-2 py-2">
              <p className="font-brush text-2xl font-bold leading-none">{s.value}</p>
              <p className="mt-1 text-[8px] font-bold uppercase tracking-widest opacity-60">{s.label}</p>
            </div>
          ))}
        </div>

        {/* MVP */}
        {end.mvpName && (
          <div className="mt-3 flex items-center justify-center gap-2 rounded border-2 border-sumi/50 bg-washi/70 px-3 py-2">
            {victory ? <Trophy size={16} className="text-crimson" /> : <Skull size={16} className="text-sumi" />}
            <p className="text-[12px] font-bold">
              MVP: <span style={{ color: mvpColor }}>{end.mvpName}</span>
              <span className="opacity-70">
                {' '}
                - {end.mvpKills} kills, {end.mvpDamage} damage
              </span>
            </p>
          </div>
        )}

        {/* Actions */}
        {victory ? (
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                engine.claimVictory();
                onExit();
              }}
              className="flex w-full items-center justify-center gap-2 rounded border-2 border-crimson bg-crimson py-2.5 font-brush text-[15px] font-bold tracking-wide text-washi transition hover:bg-crimson/90 active:scale-[0.98]"
            >
              <Trophy size={16} />
              CLAIM VICTORY
            </button>
            <button
              type="button"
              onClick={() => engine.continueEndless()}
              className="flex w-full items-center justify-center gap-2 rounded border-2 border-sumi bg-washi py-2.5 font-brush text-[15px] font-bold tracking-wide text-sumi transition hover:bg-parch-dark active:scale-[0.98]"
            >
              <Scroll size={16} />
              UNROLL INFINITE SCROLL (ENDLESS)
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="flex w-full items-center justify-center gap-2 rounded border-2 border-crimson bg-crimson py-2.5 font-brush text-[15px] font-bold tracking-wide text-washi transition hover:bg-crimson/90 active:scale-[0.98]"
            >
              <RotateCcw size={16} />
              RETRY THE SCROLL
            </button>
            <button
              type="button"
              onClick={onExit}
              className="flex w-full items-center justify-center gap-2 rounded border-2 border-sumi bg-washi py-2.5 font-brush text-[15px] font-bold tracking-wide text-sumi transition hover:bg-parch-dark active:scale-[0.98]"
            >
              RETURN TO TITLE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
