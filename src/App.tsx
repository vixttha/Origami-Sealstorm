import { useCallback, useEffect, useRef, useState } from 'react';
import { CodexModal } from './components/CodexModal';
import { EndModal } from './components/EndModal';
import { GameCanvas } from './components/GameCanvas';
import { HudSidebar } from './components/HudSidebar';
import { TitleScreen } from './components/TitleScreen';
import {
  GameEngine,
  loadDiscoveredCombos,
  loadHighScores,
} from './lib/engine';
import {
  ComboId,
  DifficultyId,
  EngineSnapshot,
  HighScoreRecord,
  MapId,
} from './lib/types';

export function App() {
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  const [selectedMap, setSelectedMap] = useState<MapId>('river');
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<DifficultyId>('apprentice');
  const [codexOpen, setCodexOpen] = useState(false);
  const [previewRangeBonus, setPreviewRangeBonus] = useState(0);

  const [highScores, setHighScores] = useState<HighScoreRecord[]>(() =>
    loadHighScores()
  );
  const [discoveredCombos, setDiscoveredCombos] = useState<ComboId[]>(() =>
    loadDiscoveredCombos()
  );

  const engineRef = useRef<GameEngine | null>(null);
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);

  const syncSnapshot = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const snap = eng.getSnapshot();
    setSnapshot(snap);
    setDiscoveredCombos(snap.discoveredCombos);
  }, []);

  const cleanupEngine = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
  }, []);

  const startNewGame = useCallback(
    (mapId: MapId, diffId: DifficultyId) => {
      cleanupEngine();
      const eng = new GameEngine(mapId, diffId, () => {
        setSnapshot(eng.getSnapshot());
        setDiscoveredCombos(Array.from(eng.discoveredCombos));
      });
      engineRef.current = eng;
      setSnapshot(eng.getSnapshot());
      setPreviewRangeBonus(0);
      setScreen('game');
    },
    [cleanupEngine]
  );

  const handleReturnToTitle = useCallback(() => {
    cleanupEngine();
    setSnapshot(null);
    setHighScores(loadHighScores());
    setDiscoveredCombos(loadDiscoveredCombos());
    setScreen('title');
  }, [cleanupEngine]);

  useEffect(() => {
    return () => {
      cleanupEngine();
    };
  }, [cleanupEngine]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#1A1918] flex flex-col">
      {screen === 'title' || !engineRef.current || !snapshot ? (
        <TitleScreen
          selectedMap={selectedMap}
          selectedDifficulty={selectedDifficulty}
          highScores={highScores}
          discoveredCombos={discoveredCombos}
          onSelectMap={setSelectedMap}
          onSelectDifficulty={setSelectedDifficulty}
          onStartGame={() => startNewGame(selectedMap, selectedDifficulty)}
          onOpenCodex={() => setCodexOpen(true)}
        />
      ) : (
        <main className="w-screen h-screen flex flex-row overflow-hidden">
          <GameCanvas
            engine={engineRef.current}
            snapshot={snapshot}
            previewRangeBonus={previewRangeBonus}
            onSyncSnapshot={syncSnapshot}
          />
          <HudSidebar
            engine={engineRef.current}
            snapshot={snapshot}
            onSyncSnapshot={syncSnapshot}
            onHoverUpgradeRange={setPreviewRangeBonus}
            onOpenCodex={() => setCodexOpen(true)}
            onReturnToTitle={handleReturnToTitle}
          />
          <EndModal
            snapshot={snapshot}
            onClaimVictory={handleReturnToTitle}
            onContinueEndless={() => {
              engineRef.current?.continueToEndless();
            }}
            onRestartMatch={() => startNewGame(selectedMap, selectedDifficulty)}
            onReturnToTitle={handleReturnToTitle}
          />
        </main>
      )}

      <CodexModal
        isOpen={codexOpen}
        discoveredCombos={discoveredCombos}
        onClose={() => setCodexOpen(false)}
      />
    </div>
  );
}

export default App;
