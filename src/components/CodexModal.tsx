import { glyph } from '../lib/glyph';
import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { COMBOS, ELEMENTS, ELEMENT_ORDER } from '../lib/constants';
import { loadCodex } from '../lib/storage';

interface Props {
  onClose: () => void;
}

export default function CodexModal({ onClose }: Props) {
  const found = useMemo(() => new Set(loadCodex()), []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} data-testid="codex-modal">
      <div className="washi ink-border relative max-h-full w-full max-w-4xl overflow-y-auto p-5 scroll-thin" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} data-testid="codex-close" className="absolute right-3 top-3 ink-border bg-[#EFE7D8] p-1 hover:bg-white" aria-label="Close">
          <X size={16} />
        </button>
        <h2 className="font-brush text-4xl font-bold leading-none">Scroll of Seals</h2>
        <p className="mt-1 text-sm italic text-[#4a4540]">
          Ten two-element Seal Reactions. Strike an enemy carrying one status with a different element to discover them. ({found.size}/10 discovered)
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {COMBOS.map((c) => {
            const known = found.has(c.id);
            return (
              <div key={c.id} className={`parchment ink-border flex gap-3 p-3 ${known ? '' : 'opacity-75'}`} data-testid={`combo-${c.id}`}>
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <div className={`flex h-12 w-12 rotate-[-6deg] items-center justify-center rounded-md text-2xl font-bold text-[#F4EFE6] ${known ? 'bg-[#C1121F]' : 'bg-[#8a8176]'}`}>
                    {known ? glyph(c.kanji) || c.name[0] : '?'}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[c.a, c.b].map((e) => (
                      <span key={e} className="flex h-5 w-5 items-center justify-center rounded-full border border-[#1A1918] text-[10px] font-bold text-[#F4EFE6]" style={{ background: ELEMENTS[e].color }}>
                        {glyph(ELEMENTS[e].glyph) || ELEMENTS[e].name[0]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold">{known ? c.name : 'Undiscovered Reaction'}</h3>
                  <p className="text-xs text-[#3b3732]">
                    {known ? c.desc : `Combine ${ELEMENTS[c.a].name} and ${ELEMENTS[c.b].name} to reveal this seal. (+25 Ink on first discovery per run.)`}
                  </p>
                  {known && <p className="mt-0.5 text-[10px] font-bold" style={{ color: c.color }}>{c.callout}</p>}
                </div>
              </div>
            );
          })}
        </div>

        <h3 className="mt-5 border-b-2 border-[#1A1918] pb-1 font-bold">Element Reference</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-5">
          {ELEMENT_ORDER.map((e) => {
            const d = ELEMENTS[e];
            return (
              <div key={e} className="parchment ink-border p-2 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#1A1918] font-bold text-[#F4EFE6]" style={{ background: d.color }}>{glyph(d.glyph) || d.name[0]}</span>
                  <b>{d.name}</b>
                </div>
                <div className="text-[10px] text-[#6b6358]">Status: {d.status}</div>
                <div className="mt-0.5 text-[10px] leading-snug">{d.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
