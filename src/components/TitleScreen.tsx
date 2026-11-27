import { glyph } from '../lib/glyph';
import { useMemo, useState } from 'react';
import { Scroll, Swords } from 'lucide-react';
import { DIFFICULTIES, DIFFICULTY_ORDER, ELEMENTS, ELEMENT_ORDER } from '../lib/constants';
import { MAP_ORDER, getMap } from '../lib/maps';
import { loadLedger, scoreKey } from '../lib/storage';
import type { DifficultyId, MapId } from '../lib/types';

interface Props {
  onStart: (map: MapId, diff: DifficultyId) => void;
  onCodex: () => void;
}

function MapPreview({ id }: { id: MapId }) {
  const map = getMap(id);
  const paths = map.lanes.map((l) => {
    let d = '';
    for (let i = 0; i < l.xs.length; i += 4) d += `${i === 0 ? 'M' : 'L'}${l.xs[i].toFixed(0)} ${l.ys[i].toFixed(0)} `;
    return d;
  });
  return (
    <svg viewBox="0 0 960 600" className="h-32 w-full rounded-sm" style={{ background: '#F4EFE6' }}>
      <rect x="10" y="10" width="940" height="580" fill="none" stroke="#B7A88B" strokeWidth="8" />
      {map.conduits.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={c.r} fill="rgba(42,157,143,0.25)" stroke="#2A9D8F" strokeWidth="4" strokeDasharray="10 8" />
      ))}
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#1A1918" strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {map.bridge && <rect x={map.bridge.x - 75} y={map.bridge.y - 39} width="150" height="78" fill="#A57544" stroke="#5B3A1E" strokeWidth="6" />}
      {map.exits.map((e, i) => (
        <rect key={i} x={Math.min(e.x, 920) - 22} y={e.y - 22} width="44" height="44" rx="6" fill="#C1121F" />
      ))}
    </svg>
  );
}

export default function TitleScreen({ onStart, onCodex }: Props) {
  const [mapId, setMapId] = useState<MapId>('river');
  const [diff, setDiff] = useState<DifficultyId>('apprentice');
  const ledger = useMemo(() => loadLedger(), []);

  return (
    <div className="washi h-full w-full overflow-y-auto" data-testid="title-screen">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-5 px-6 py-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 rotate-[-6deg] items-center justify-center rounded-md bg-[#C1121F] text-2xl font-bold text-[#F4EFE6] shadow">{glyph('折') || 'O'}</div>
              <h1 className="font-brush text-5xl font-bold leading-none tracking-tight text-[#1A1918] md:text-6xl">Runic Origami &amp; Ink</h1>
            </div>
            <p className="mt-2 text-sm italic text-[#4a4540]">
              Fold elemental seals, stain the scroll with sumi, and keep the Sanctuary from being unfolded.
            </p>
          </div>
          <button
            onClick={onCodex}
            data-testid="title-codex"
            className="ink-border flex shrink-0 items-center gap-2 bg-[#EFE7D8] px-3 py-2 text-sm font-bold hover:bg-[#e6dcc6]"
          >
            <Scroll size={16} /> Scroll of Seals
          </button>
        </header>

        <section>
          <h2 className="mb-2 flex items-center gap-2 border-b-2 border-[#1A1918] pb-1 text-lg font-bold">
            <span className="inline-block h-3 w-8 -skew-x-12 bg-[#1A1918]" /> Choose a Scroll
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {MAP_ORDER.map((id) => {
              const m = getMap(id);
              const sel = id === mapId;
              return (
                <button
                  key={id}
                  data-testid={`map-${id}`}
                  onClick={() => setMapId(id)}
                  className={`parchment ink-border p-3 text-left transition ${sel ? 'outline outline-4 outline-offset-2 outline-[#C1121F]' : 'opacity-90 hover:opacity-100'}`}
                >
                  <MapPreview id={id} />
                  <div className="mt-2 flex items-baseline justify-between">
                    <h3 className="text-base font-bold">{m.name}</h3>
                    <span className="text-xs font-bold text-[#C1121F]">{m.level}</span>
                  </div>
                  <div className="text-xs text-[#6b6358]">{glyph(m.jp)}</div>
                  <p className="mt-1 text-xs leading-snug text-[#3b3732]">{m.blurb}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-2 border-b-2 border-[#1A1918] pb-1 text-lg font-bold">
            <span className="inline-block h-3 w-8 -skew-x-12 bg-[#1A1918]" /> Choose a Seal
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {DIFFICULTY_ORDER.map((id) => {
              const d = DIFFICULTIES[id];
              const sel = id === diff;
              return (
                <button
                  key={id}
                  data-testid={`diff-${id}`}
                  onClick={() => setDiff(id)}
                  className={`parchment ink-border flex items-center gap-3 p-3 text-left transition ${sel ? 'outline outline-4 outline-offset-2 outline-[#C1121F]' : 'opacity-90 hover:opacity-100'}`}
                >
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-md text-xl font-bold text-[#F4EFE6] ${sel ? 'bg-[#C1121F] rotate-[-6deg]' : 'bg-[#8a6a64]'}`}>
                    {glyph(d.jp) || d.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-bold">
                      {d.name} <span className="text-xs font-normal text-[#6b6358]">({d.tag})</span>
                    </div>
                    <div className="text-xs text-[#3b3732]">
                      {d.ink} Ink · {d.lives === 1 ? '1 Life (Sudden Death)' : `${d.lives} Lives`} · {d.waves} Waves
                    </div>
                    <div className="text-xs text-[#6b6358]">
                      {d.hp.toFixed(2)}× HP · {d.speed.toFixed(2)}× Speed · {d.cost.toFixed(2)}× Upgrades
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => onStart(mapId, diff)}
            data-testid="start-game"
            className="ink-border flex items-center gap-2 bg-[#1A1918] px-8 py-3 text-lg font-bold text-[#F4EFE6] transition hover:bg-[#C1121F]"
          >
            <Swords size={20} /> Start Game
          </button>
          <div className="flex items-center gap-2">
            {ELEMENT_ORDER.map((e) => (
              <div
                key={e}
                title={`${ELEMENTS[e].name} (${e})`}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#1A1918] text-sm font-bold text-[#F4EFE6]"
                style={{ background: ELEMENTS[e].color }}
              >
                {glyph(ELEMENTS[e].glyph) || ELEMENTS[e].name[0]}
              </div>
            ))}
          </div>
        </div>

        <section className="pb-4">
          <h2 className="mb-2 flex items-center gap-2 border-b-2 border-[#1A1918] pb-1 text-lg font-bold">
            <span className="inline-block h-3 w-8 -skew-x-12 bg-[#1A1918]" /> High-Score Ledger
          </h2>
          <div className="parchment ink-border overflow-x-auto" data-testid="ledger">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-[#1A1918]">
                  <th className="p-2">Scroll</th>
                  {DIFFICULTY_ORDER.map((d) => (
                    <th key={d} className="p-2">{DIFFICULTIES[d].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MAP_ORDER.map((m) => (
                  <tr key={m} className="border-b border-[#2b292733]">
                    <td className="p-2 font-bold">{getMap(m).name}</td>
                    {DIFFICULTY_ORDER.map((d) => {
                      const s = ledger[scoreKey(m, d)];
                      return (
                        <td key={d} className="p-2">
                          {s ? (
                            <span>
                              Wave {s.bestWave} · {s.kills} kills {s.won && <span className="font-bold text-[#C1121F]">· CLEARED</span>}
                            </span>
                          ) : (
                            <span className="text-[#8a8176]">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
