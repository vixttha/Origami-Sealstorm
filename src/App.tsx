import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DIFFICULTIES, loadLedger } from './lib/constants';
import { GameEngine } from './lib/engine';
import { getMapById } from './lib/maps';
import { drawFrame } from './lib/renderer';
import { sound } from './lib/sound';
import type { DifficultyId, RoiDebug } from './lib/types';
import TitleScreen from './components/TitleScreen';
import GameCanvas from './components/GameCanvas';
import HudSidebar from './components/HudSidebar';
import CodexModal from './components/CodexModal';
import EndModal from './components/EndModal';

type Screen = { kind: 'title' } | { kind: 'game'; mapId: string; difficulty: DifficultyId };

function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  const [gameKey, setGameKey] = useState(0);

  // Lazily initialize the Web Audio context on the very first user gesture.
  useEffect(() => {
    const unlock = (): void => sound.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const startGame = useCallback((mapId: string, difficulty: DifficultyId) => {
    setGameKey((k) => k + 1);
    setScreen({ kind: 'game', mapId, difficulty });
  }, []);

  const exitToTitle = useCallback(() => setScreen({ kind: 'title' }), []);

  if (screen.kind === 'title') {
    return <TitleScreen onStart={startGame} ledger={loadLedger()} />;
  }
  return (
    <GameScreen
      key={`${screen.mapId}-${screen.difficulty}-${gameKey}`}
      mapId={screen.mapId}
      difficulty={screen.difficulty}
      onExit={exitToTitle}
      onRetry={() => setGameKey((k) => k + 1)}
    />
  );
}

function GameScreen({
  mapId,
  difficulty,
  onExit,
  onRetry,
}: {
  mapId: string;
  difficulty: DifficultyId;
  onExit: () => void;
  onRetry: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [engine] = useState(() => {
    const map = getMapById(mapId);
    if (!map) throw new Error(`Unknown map: ${mapId}`);
    return new GameEngine({ map, difficulty: DIFFICULTIES[difficulty] });
  });
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [codexOpen, setCodexOpen] = useState(false);

  // Engine lifecycle: own the rAF loop, tear down cleanly on unmount.
  useEffect(() => {
    if (canvasRef.current) engine.attachCanvas(canvasRef.current);
    engine.start((canvas) => drawFrame(canvas, engine.state));
    return () => {
      engine.destroy();
    };
  }, [engine]);

  // Pause the simulation while the codex drawer is open.
  useEffect(() => {
    engine.setModalPaused(codexOpen);
    return () => engine.setModalPaused(false);
  }, [codexOpen, engine]);

  // Debug handle for the automated Playwright acceptance suite.
  useEffect(() => {
    const debug: RoiDebug = {
      ink: () => Math.floor(engine.state.ink),
      towers: () => engine.state.towers.length,
      enemies: () => engine.state.enemies.length,
      phase: () => engine.state.phase,
      waveIndex: () => engine.state.waveIndex,
      kills: () => engine.state.stats.kills,
      shots: () => engine.state.stats.shotsFired,
      speed: () => engine.state.speed,
      inkEarned: () => Math.floor(engine.state.stats.inkEarned),
      startWave: () => engine.startWave(),
    };
    (window as Window & { __roi?: RoiDebug }).__roi = debug;
    return () => {
      delete (window as Window & { __roi?: RoiDebug }).__roi;
    };
  }, [engine]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (codexOpen) setCodexOpen(false);
        else engine.setShopElement(null);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        engine.togglePause();
      } else if (e.key === '1') {
        engine.setSpeed(1);
      } else if (e.key === '2') {
        engine.setSpeed(2);
      } else if (e.key === '3') {
        engine.setSpeed(3);
      } else if (e.key.toLowerCase() === 'a') {
        engine.toggleAutoNext();
      } else if (e.key.toLowerCase() === 'm') {
        engine.toggleMute();
      } else if (e.key.toLowerCase() === 's') {
        engine.startWave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine, codexOpen]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-night">
      <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden p-2">
        <GameCanvas engine={engine} canvasRef={canvasRef} />
      </div>
      <HudSidebar engine={engine} snapshot={snapshot} onOpenCodex={() => setCodexOpen(true)} onExit={onExit} />
      {codexOpen && <CodexModal snapshot={snapshot} onClose={() => setCodexOpen(false)} />}
      {snapshot.endState && (
        <EndModal engine={engine} snapshot={snapshot} onExit={onExit} onRetry={onRetry} />
      )}
    </div>
  );
}

export default App;
