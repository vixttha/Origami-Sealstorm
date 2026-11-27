import { useCallback, useEffect, useRef, useState } from 'react';
import CodexModal from './components/CodexModal';
import EndModal from './components/EndModal';
import GameCanvas from './components/GameCanvas';
import HudSidebar from './components/HudSidebar';
import TitleScreen from './components/TitleScreen';
import { DIFFICULTIES, ELEMENT_ORDER, MODIFIERS } from './lib/constants';
import { GameEngine } from './lib/engine';
import { getMap } from './lib/maps';
import { initAudio } from './lib/sound';
import type { DifficultyId, Element, MapId, PathId } from './lib/types';

declare global {
  interface Window {
    __runic?: GameEngine;
  }
}

interface GameProps {
  mapId: MapId;
  diffId: DifficultyId;
  onQuit: () => void;
}

function GameScreen({ mapId, diffId, onQuit }: GameProps) {
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [placing, setPlacing] = useState<Element | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ id: number; path: PathId } | null>(null);
  const [codexOpen, setCodexOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [, setTick] = useState(0);
  const msgTimer = useRef<number>(0);

  useEffect(() => {
    const e = new GameEngine(getMap(mapId), diffId);
    window.__runic = e;
    setEngine(e);
    setPlacing(null);
    setSelectedId(null);
    setPreview(null);
    return () => {
      e.destroy();
      if (window.__runic === e) window.__runic = undefined;
    };
  }, [mapId, diffId, runKey]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, []);

  const flash = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setMsg(''), 1600);
  }, []);

  useEffect(() => {
    const h = (ev: KeyboardEvent) => {
      if (!engine) return;
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'SELECT' || tag === 'INPUT') return;
      if (ev.key >= '1' && ev.key <= '5') {
        setPlacing(ELEMENT_ORDER[Number(ev.key) - 1]);
        setSelectedId(null);
      } else if (ev.key === 'Escape') {
        setPlacing(null);
        setSelectedId(null);
      } else if (ev.key === ' ') {
        ev.preventDefault();
        engine.togglePause();
      } else if (ev.key.toLowerCase() === 'n') {
        engine.startWave();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [engine]);

  if (!engine) return <div className="h-full w-full bg-[#241d18]" />;
  const mod = engine.modifier ? MODIFIERS[engine.modifier] : null;

  return (
    <div className="flex h-full w-full" data-testid="game-screen">
      <div className="relative min-w-0 flex-1">
        <GameCanvas
          engine={engine}
          placing={placing}
          selectedId={selectedId}
          previewUpgrade={preview}
          onPlaced={(t) => {
            setPlacing(null);
            setSelectedId(t.id);
          }}
          onSelect={setSelectedId}
          onCancelPlacing={() => setPlacing(null)}
          onMessage={flash}
        />
        <div className="pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center gap-1">
          {engine.bannerT > 0 && mod && (
            <div className="stamp-pop border-2 border-[#C1121F] bg-[#1A1918]/90 px-4 py-1 text-center text-[#F4EFE6]" data-testid="modifier-banner">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#ff8a92]">Corrupted Ink</div>
              <div className="font-brush text-2xl font-bold leading-none">{mod.name}</div>
              <div className="text-xs">{mod.text}</div>
            </div>
          )}
          {mod && engine.bannerT <= 0 && (
            <div className="border border-[#C1121F] bg-[#1A1918]/80 px-2 py-0.5 text-[10px] font-bold text-[#F4EFE6]">Corrupted Ink: {mod.name}</div>
          )}
          {msg && <div className="border-2 border-[#1A1918] bg-[#F4EFE6] px-3 py-1 text-xs font-bold text-[#C1121F]">{msg}</div>}
          {engine.paused && engine.status === 'playing' && (
            <div className="border-2 border-[#1A1918] bg-[#F4EFE6]/95 px-4 py-1 font-brush text-2xl font-bold">Paused</div>
          )}
        </div>
        <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] font-bold text-[#F4EFE6]/80">
          {getMap(mapId).name} · {DIFFICULTIES[diffId].name}
        </div>
      </div>
      <aside className="parchment h-full w-[25%] min-w-[290px] max-w-[390px] shrink-0 border-l-4 border-[#2B2927]">
        <HudSidebar
          engine={engine}
          placing={placing}
          onPlacing={setPlacing}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onPreview={setPreview}
          onCodex={() => setCodexOpen(true)}
          onQuit={onQuit}
          onRestart={() => setRunKey((k) => k + 1)}
        />
      </aside>
      {engine.status !== 'playing' && <EndModal engine={engine} onRestart={() => setRunKey((k) => k + 1)} onQuit={onQuit} />}
      {codexOpen && <CodexModal onClose={() => setCodexOpen(false)} />}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<{ map: MapId; diff: DifficultyId } | null>(null);
  const [codex, setCodex] = useState(false);

  useEffect(() => {
    const h = () => initAudio();
    window.addEventListener('pointerdown', h);
    window.addEventListener('keydown', h);
    return () => {
      window.removeEventListener('pointerdown', h);
      window.removeEventListener('keydown', h);
    };
  }, []);

  return (
    <div className="h-full w-full overflow-hidden">
      {session ? (
        <GameScreen mapId={session.map} diffId={session.diff} onQuit={() => setSession(null)} />
      ) : (
        <TitleScreen onStart={(map, diff) => setSession({ map, diff })} onCodex={() => setCodex(true)} />
      )}
      {codex && !session && <CodexModal onClose={() => setCodex(false)} />}
    </div>
  );
}
