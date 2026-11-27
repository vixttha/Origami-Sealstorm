import React, { useEffect, useRef, useState } from 'react';
import {
  CORRUPTED_MODIFIERS,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  TOWER_RADIUS,
  TOWER_SPECS,
} from '../lib/constants';
import { GameEngine } from '../lib/engine';
import { CanvasHoverState, renderGameCanvas } from '../lib/renderer';
import { EngineSnapshot } from '../lib/types';

interface GameCanvasProps {
  engine: GameEngine;
  snapshot: EngineSnapshot;
  previewRangeBonus: number;
  onSyncSnapshot: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  engine,
  snapshot,
  previewRangeBonus,
  onSyncSnapshot,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hoverRef = useRef<CanvasHoverState>({
    x: 0,
    y: 0,
    inside: false,
    previewRangeBonus: 0,
  });
  const [cursorHint, setCursorHint] = useState<string | null>(null);

  useEffect(() => {
    hoverRef.current.previewRangeBonus = previewRangeBonus;
  }, [previewRangeBonus]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = LOGICAL_WIDTH * dpr;
    canvas.height = LOGICAL_HEIGHT * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;

      engine.stepFrame(rawDt);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderGameCanvas(ctx, engine, hoverRef.current);
      ctx.restore();

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [engine]);

  const toLogicalCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_WIDTH / rect.width;
    const scaleY = LOGICAL_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toLogicalCoords(e);
    hoverRef.current.x = x;
    hoverRef.current.y = y;
    hoverRef.current.inside = true;

    if (engine.placingElement) {
      const check = engine.canPlaceTowerAt(x, y);
      if (!check.valid) {
        setCursorHint(check.reason ?? 'Invalid placement');
      } else if (check.inConduit) {
        setCursorHint('Conduit Stone Circle: +15% Range Bonus!');
      } else {
        setCursorHint(
          `Click to fold ${TOWER_SPECS[engine.placingElement].name} (${
            TOWER_SPECS[engine.placingElement].cost
          } Ink)`
        );
      }
    } else {
      setCursorHint(null);
    }
  };

  const handleMouseLeave = () => {
    hoverRef.current.inside = false;
    setCursorHint(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toLogicalCoords(e);

    // 1. If placing a new tower
    if (engine.placingElement) {
      const placed = engine.placeTower(engine.placingElement, x, y);
      if (placed) {
        setCursorHint(null);
        onSyncSnapshot();
        return;
      }
    }

    // 2. Otherwise check if clicking an existing tower to inspect it
    let clickedTowerId: string | null = null;
    for (const t of engine.towers) {
      if (Math.hypot(t.x - x, t.y - y) <= TOWER_RADIUS + 8) {
        clickedTowerId = t.id;
        break;
      }
    }

    engine.selectedTowerId = clickedTowerId;
    if (clickedTowerId) {
      engine.placingElement = null;
    }
    onSyncSnapshot();
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (engine.placingElement) {
      engine.placingElement = null;
      setCursorHint(null);
      onSyncSnapshot();
    }
  };

  const activeModSpec = snapshot.activeModifier
    ? CORRUPTED_MODIFIERS[snapshot.activeModifier]
    : null;

  return (
    <div className="relative flex-1 h-full bg-[#1A1918] flex items-center justify-center overflow-hidden p-2 select-none">
      <div className="relative w-full h-full flex items-center justify-center">
        <canvas
          ref={canvasRef}
          data-testid="battlefield-canvas"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleCanvasClick}
          onContextMenu={handleContextMenu}
          style={{
            aspectRatio: `${LOGICAL_WIDTH} / ${LOGICAL_HEIGHT}`,
          }}
          className={`max-w-full max-h-full w-auto h-auto shadow-2xl rounded border-2 border-[#2B2927] ${
            snapshot.placingElement ? 'cursor-crosshair' : 'cursor-pointer'
          }`}
        />

        {/* Top-Center Active Corrupted Ink Modifier Banner (Endless Waves) */}
        {activeModSpec && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded border-2 border-[#1A1918] bg-[#FAF6F0]/95 shadow-lg flex items-center gap-2.5 pointer-events-none"
            style={{ borderColor: activeModSpec.color }}
          >
            <span
              className="w-6 h-6 rounded flex items-center justify-center text-white font-brush font-bold text-sm"
              style={{ backgroundColor: activeModSpec.color }}
            >
              {activeModSpec.kanji}
            </span>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#1A1918]">
                {activeModSpec.name}
              </div>
              <div className="text-[11px] text-[#4A443F]">{activeModSpec.description}</div>
            </div>
          </div>
        )}

        {/* Recent Elemental Combo Stamp Banner */}
        {snapshot.recentComboBanner && (
          <div className="absolute bottom-5 left-5 px-3.5 py-2 rounded border-2 border-[#C1121F] bg-[#FAF6F0]/95 shadow-lg flex items-center gap-2.5 pointer-events-none">
            <div className="w-8 h-8 rounded border-2 border-[#C1121F] bg-[#C1121F]/10 text-[#C1121F] font-brush font-bold text-lg flex items-center justify-center">
              {snapshot.recentComboBanner.kanji}
            </div>
            <div>
              <div className="text-xs font-brush font-bold text-[#1A1918] flex items-center gap-1.5">
                <span>{snapshot.recentComboBanner.name}</span>
                {snapshot.recentComboBanner.isNewDiscovery && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#C1121F] text-[#F4EFE6] font-bold">
                    +25 INK DISCOVERY!
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[#5C5349] uppercase tracking-wider">
                Two-Element Seal Reaction Triggered
              </div>
            </div>
          </div>
        )}

        {/* Placement Hint Pill */}
        {cursorHint && (
          <div className="absolute top-4 right-4 px-3 py-1 rounded border border-[#2B2927] bg-[#FAF6F0]/95 text-xs font-semibold text-[#1A1918] shadow pointer-events-none">
            {cursorHint} <span className="text-[#8C7A6B] ml-1">(Right-click to cancel)</span>
          </div>
        )}
      </div>
    </div>
  );
};
