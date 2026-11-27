import { useEffect, useRef, type RefObject } from 'react';
import type { GameEngine } from '../lib/engine';
import { CANVAS_H, CANVAS_W, type Vec2 } from '../lib/types';

/**
 * Responsive single-canvas wrapper. The canvas is letterboxed to the 960x600
 * logical aspect; the backing store scales with devicePixelRatio so the
 * procedural vector art stays crisp. Pointer coordinates are always mapped
 * back to exact logical (x, y) coordinates.
 */
export default function GameCanvas({
  engine,
  canvasRef,
}: {
  engine: GameEngine;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const resize = (): void => {
      const rect = wrap.getBoundingClientRect();
      const scale = Math.min(rect.width / CANVAS_W, rect.height / CANVAS_H);
      const w = Math.max(240, Math.floor(CANVAS_W * scale));
      const h = Math.max(150, Math.floor(CANVAS_H * scale));
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [canvasRef]);

  const toLogical = (clientX: number, clientY: number): Vec2 => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) * CANVAS_W) / rect.width,
      y: ((clientY - rect.top) * CANVAS_H) / rect.height,
    };
  };

  return (
    <div ref={wrapRef} className="relative flex h-full w-full items-center justify-center">
      <canvas
        ref={canvasRef}
        aria-label="Runic Origami and Ink battlefield scroll"
        className="touch-none rounded-[3px] shadow-[0_10px_50px_rgba(0,0,0,0.55)] ring-1 ring-black/40"
        onPointerMove={(e) => {
          const p = toLogical(e.clientX, e.clientY);
          engine.setPointer(p.x, p.y);
        }}
        onPointerLeave={() => engine.setPointer(0, null)}
        onPointerDown={(e) => {
          if (e.button === 2) {
            engine.setShopElement(null);
            return;
          }
          const p = toLogical(e.clientX, e.clientY);
          engine.setPointer(p.x, p.y);
          engine.click(p.x, p.y);
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
