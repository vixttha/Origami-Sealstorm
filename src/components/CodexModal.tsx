import { X } from 'lucide-react';
import { COMBOS, ELEMENT_META, ELEMENTS } from '../lib/constants';
import type { Element, UiSnapshot } from '../lib/types';

/**
 * "Scroll of Seals" - the discoverable 10-combo Elemental Codex drawer
 * plus the five-element status reference. Discoveries persist forever in
 * localStorage; the run tracker highlights this run's finds.
 */
export default function CodexModal({ snapshot, onClose }: { snapshot: UiSnapshot; onClose: () => void }) {
  const discovered = snapshot.discovered;
  const runFound = new Set(snapshot.discoveredRun);

  return (
    <div
      className="roi-fade-in fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-label="Scroll of Seals codex"
      onClick={onClose}
    >
      <div
        className="roi-pop-in relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border-[3px] border-sumi bg-parch shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-sumi/60 bg-parch-dark/70 px-5 py-3">
          <div>
            <h2 className="font-brush text-xl font-bold tracking-wide text-sumi">Scroll of Seals</h2>
            <p className="text-[11px] opacity-70">
              {discovered.length} of 10 reactions recorded - strike an enemy carrying one element with
              another to discover them. First discovery each run grants +25 Ink.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close codex"
            className="rounded border-2 border-sumi/70 bg-washi p-1.5 transition hover:bg-parch-dark"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Element reference */}
          <h3 className="mb-2 font-brush text-[13px] font-bold uppercase tracking-widest opacity-80">
            The Five Starter Seals
          </h3>
          <div className="mb-5 grid grid-cols-5 gap-2">
            {ELEMENTS.map((el: Element) => {
              const meta = ELEMENT_META[el];
              return (
                <div key={el} className="rounded border-2 border-sumi/50 bg-washi px-2 py-2 text-center">
                  <span
                    className="mx-auto flex h-9 w-9 rotate-45 items-center justify-center rounded-[4px] border-2"
                    style={{ background: meta.color, borderColor: 'rgba(244,239,230,0.75)' }}
                  >
                    <span className="-rotate-45 font-brush text-lg font-bold text-washi">{meta.kanji}</span>
                  </span>
                  <p className="mt-2 text-[11px] font-bold">{meta.label}</p>
                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
                    {meta.statusName}
                  </p>
                  <p className="mt-1 text-[9px] leading-snug opacity-70">{meta.statusDesc}</p>
                </div>
              );
            })}
          </div>

          {/* Combo ledger */}
          <h3 className="mb-2 font-brush text-[13px] font-bold uppercase tracking-widest opacity-80">
            Seal Reactions ({discovered.length}/10 discovered)
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {COMBOS.map((combo) => {
              const known = discovered.includes(combo.id);
              const thisRun = runFound.has(combo.id);
              return (
                <div
                  key={combo.id}
                  className={`relative flex items-start gap-3 rounded border-2 px-3 py-2.5 transition ${
                    known ? 'border-sumi/70 bg-washi' : 'border-sumi/30 bg-washi/40'
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 rotate-[-6deg] items-center justify-center rounded-[3px] border-2 font-brush text-xl font-bold ${
                      known ? 'border-washi/90 bg-crimson text-washi' : 'border-sumi/30 bg-sumi/10 text-sumi/40'
                    }`}
                  >
                    {known ? combo.kanji : '?'}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] font-bold leading-tight">
                      <span className={known ? '' : 'opacity-40'}>{combo.name}</span>
                      {thisRun && (
                        <span className="rounded bg-jade px-1 py-px text-[8px] font-bold uppercase tracking-wider text-washi">
                          found this run
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider opacity-60">
                      {ELEMENT_META[combo.elements[0]].label.split(' ')[0]} +{' '}
                      {ELEMENT_META[combo.elements[1]].label.split(' ')[0]}
                    </p>
                    <p className="mt-1 text-[10px] leading-snug opacity-80">
                      {known ? combo.effect : 'Undiscovered - combine these two elements in battle to record it.'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t-2 border-sumi/60 bg-parch-dark/60 px-5 py-2 text-center text-[10px] uppercase tracking-widest opacity-60">
          Reactions consume both statuses - each enemy reacts at most once per 1.2s
        </div>
      </div>
    </div>
  );
}
