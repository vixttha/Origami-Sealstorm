import { useEffect, useRef, useState } from 'react';
import { ELEMENTS, H, W } from '../lib/constants';
import type { GameEngine } from '../lib/engine';
import { drawFrame, getMapCache } from '../lib/renderer';
import type { UiState } from '../lib/renderer';
import type { Element, PathId, Tower } from '../lib/types';
import { initAudio } from '../lib/sound';

interface Props {
  engine: GameEngine;
  placing: Element | null;
  selectedId: number | null;
  previewUpgrade: { id: number; path: PathId } | null;
  onPlaced: (t: Tower) => void;
  onSelect: (id: number | null) => void;
  onCancelPlacing: () => void;
  onMessage: (msg: string) => void;
}

export default function GameCanvas({ engine, placing, selectedId, previewUpgrade, onPlaced, onSelect, onCancelPlacing, onMessage }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ui = useRef<UiState>({ hover: null, placing: null, selectedId: null, previewUpgrade: null });
  const [size, setSize] = useState({ w: W, h: H });
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;

  ui.current.placing = placing;
  ui.current.selectedId = selectedId;
  ui.current.previewUpgrade = previewUpgrade;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const pad = 12;
      const aw = Math.max(200, r.width - pad * 2), ah = Math.max(125, r.height - pad * 2);
      const s = Math.min(aw / W, ah / H);
      setSize({ w: Math.floor(W * s), h: Math.floor(H * s) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cacheScale = dpr > 1.25 ? 2 : 1;
    const draw = (eng: GameEngine) => {
      const c = canvasRef.current;
      if (!c) return;
      const g = c.getContext('2d');
      if (!g) return;
      const s = c.width / W;
      g.setTransform(s, 0, 0, s, 0, 0);
      g.clearRect(0, 0, W, H);
      g.save();
      if (eng.shake > 0) g.translate((Math.random() - 0.5) * 2 * Math.min(3, eng.shake), (Math.random() - 0.5) * 2 * Math.min(3, eng.shake));
      drawFrame(g, eng, ui.current, getMapCache(eng.map, cacheScale), performance.now() / 1000);
      g.restore();
    };
    engine.start(draw);
  }, [engine, dpr]);

  const toLogical = (e: React.PointerEvent | React.MouseEvent) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onClick = (e: React.MouseEvent) => {
    initAudio();
    const p = toLogical(e);
    if (placing) {
      const def = ELEMENTS[placing];
      const chk = engine.canPlace(p.x, p.y);
      if (!chk.ok) return onMessage(chk.reason);
      if (engine.ink < def.cost) return onMessage('Not enough Ink');
      const t = engine.placeTower(placing, p.x, p.y);
      if (t) onPlaced(t);
      return;
    }
    let best: Tower | null = null;
    let bd = 20;
    for (const t of engine.towers) {
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d < bd) { bd = d; best = t; }
    }
    onSelect(best ? best.id : null);
  };

  return (
    <div ref={wrapRef} className="flex h-full w-full items-center justify-center" style={{ background: 'radial-gradient(circle at 50% 40%, #3a2f27, #1d1713)' }}>
      <canvas
        ref={canvasRef}
        data-testid="game-canvas"
        width={Math.round(size.w * dpr)}
        height={Math.round(size.h * dpr)}
        style={{ width: size.w, height: size.h, cursor: placing ? 'crosshair' : 'default', touchAction: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.6)' }}
        onPointerMove={(e) => { ui.current.hover = toLogical(e); }}
        onPointerLeave={() => { ui.current.hover = null; }}
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); onCancelPlacing(); }}
      />
    </div>
  );
}
