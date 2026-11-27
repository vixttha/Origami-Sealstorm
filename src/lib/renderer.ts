import {
  COMBO_DEFINITIONS,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  RESONANCE_MAX_DIST,
  resolveComboId,
  TOWER_RADIUS,
  TOWER_SPECS,
} from './constants';
import { GameEngine } from './engine';
import {
  ElementType,
  EnemyEntity,
  MapId,
  PrecomputedMapData,
  ProjectileEntity,
  TowerEntity,
} from './types';

const mapBackgroundCache: Partial<Record<MapId, HTMLCanvasElement>> = {};

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildStaticMapCanvas(mapData: PrecomputedMapData): HTMLCanvasElement {
  const off = document.createElement('canvas');
  off.width = LOGICAL_WIDTH;
  off.height = LOGICAL_HEIGHT;
  const ctx = off.getContext('2d');
  if (!ctx) return off;

  const rand = seededRandom(
    mapData.definition.id === 'river'
      ? 101
      : mapData.definition.id === 'twin_bridge'
      ? 202
      : 303
  );

  // 1. Dark sumi desk/scroll backing
  ctx.fillStyle = '#24211E';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  // 2. Washi rice-paper scroll body with subtle deckled edge
  ctx.save();
  ctx.beginPath();
  const margin = 12;
  ctx.moveTo(margin, margin);
  for (let x = margin; x <= LOGICAL_WIDTH - margin; x += 18) {
    ctx.lineTo(x, margin + (rand() - 0.5) * 4);
  }
  for (let y = margin; y <= LOGICAL_HEIGHT - margin; y += 18) {
    ctx.lineTo(LOGICAL_WIDTH - margin + (rand() - 0.5) * 4, y);
  }
  for (let x = LOGICAL_WIDTH - margin; x >= margin; x -= 18) {
    ctx.lineTo(x, LOGICAL_HEIGHT - margin + (rand() - 0.5) * 4);
  }
  for (let y = LOGICAL_HEIGHT - margin; y >= margin; y -= 18) {
    ctx.lineTo(margin + (rand() - 0.5) * 4, y);
  }
  ctx.closePath();

  const paperGrad = ctx.createRadialGradient(
    LOGICAL_WIDTH * 0.5,
    LOGICAL_HEIGHT * 0.5,
    80,
    LOGICAL_WIDTH * 0.5,
    LOGICAL_HEIGHT * 0.5,
    600
  );
  paperGrad.addColorStop(0, '#F7F3EB');
  paperGrad.addColorStop(0.7, '#F4EFE6');
  paperGrad.addColorStop(1, '#E6DEC8');
  ctx.fillStyle = paperGrad;
  ctx.fill();

  ctx.strokeStyle = '#2B2927';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Inner subtle ink frame line
  ctx.strokeStyle = 'rgba(43, 41, 39, 0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, LOGICAL_WIDTH - 40, LOGICAL_HEIGHT - 40);

  // 3. Washi paper fibers & gold-leaf flecks
  for (let i = 0; i < 420; i++) {
    const fx = 24 + rand() * (LOGICAL_WIDTH - 48);
    const fy = 24 + rand() * (LOGICAL_HEIGHT - 48);
    const len = 6 + rand() * 16;
    const ang = rand() * Math.PI * 2;
    ctx.strokeStyle =
      i % 9 === 0 ? 'rgba(212, 163, 115, 0.22)' : 'rgba(120, 105, 90, 0.09)';
    ctx.lineWidth = i % 9 === 0 ? 1.4 : 0.8;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + Math.cos(ang) * len, fy + Math.sin(ang) * len);
    ctx.stroke();
  }

  // Subtle decorative sumi grass tufts in open areas
  for (let g = 0; g < 26; g++) {
    const gx = 60 + rand() * (LOGICAL_WIDTH - 120);
    const gy = 55 + rand() * (LOGICAL_HEIGHT - 110);
    let nearTrack = false;
    for (const pt of mapData.clearanceSamples) {
      if (Math.hypot(pt.x - gx, pt.y - gy) < mapData.definition.trackHalfWidth + 28) {
        nearTrack = true;
        break;
      }
    }
    if (nearTrack) continue;
    ctx.strokeStyle = 'rgba(42, 157, 143, 0.28)';
    ctx.lineWidth = 1.2;
    for (let b = -1; b <= 1; b++) {
      ctx.beginPath();
      ctx.moveTo(gx + b * 3, gy);
      ctx.lineTo(gx + b * 5, gy - 6 - rand() * 4);
      ctx.stroke();
    }
  }

  // 4. Conduit Stone Circles
  for (const conduit of mapData.definition.conduits) {
    ctx.save();
    ctx.translate(conduit.x, conduit.y);

    const cGrad = ctx.createRadialGradient(0, 0, 6, 0, 0, conduit.radius);
    cGrad.addColorStop(0, 'rgba(42, 157, 143, 0.16)');
    cGrad.addColorStop(0.8, 'rgba(212, 163, 115, 0.12)');
    cGrad.addColorStop(1, 'rgba(212, 163, 115, 0)');
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.arc(0, 0, conduit.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(42, 157, 143, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, conduit.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Runic octagon inside conduit
    ctx.strokeStyle = 'rgba(212, 163, 115, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const rx = Math.cos(a) * (conduit.radius * 0.68);
      const ry = Math.sin(a) * (conduit.radius * 0.68);
      if (k === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = 'rgba(42, 157, 143, 0.72)';
    ctx.font = 'bold 9px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('+15% RANGE SEAL', 0, conduit.radius + 12);
    ctx.restore();
  }

  // 5. Sumi-e Black Ink Brushstroke Track per Lane
  const halfW = mapData.definition.trackHalfWidth;
  for (let laneIdx = 0; laneIdx < mapData.lanes.length; laneIdx++) {
    const lane = mapData.lanes[laneIdx];
    if (lane.length < 2) continue;

    // Outer dry-brush ink wash halo
    ctx.strokeStyle = 'rgba(26, 25, 24, 0.22)';
    ctx.lineWidth = halfW * 2 + 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lane[0].x, lane[0].y);
    for (let i = 1; i < lane.length; i += 2) {
      ctx.lineTo(lane[i].x, lane[i].y);
    }
    ctx.stroke();

    // Main rich sumi-e ink stroke
    ctx.strokeStyle = '#1A1918';
    ctx.lineWidth = halfW * 2;
    ctx.beginPath();
    ctx.moveTo(lane[0].x, lane[0].y);
    for (let i = 1; i < lane.length; i++) {
      ctx.lineTo(lane[i].x, lane[i].y);
    }
    ctx.stroke();

    // Bristle texture streaks inside the ink stroke
    for (const offsetRatio of [-0.55, -0.2, 0.25, 0.62]) {
      ctx.strokeStyle =
        offsetRatio > 0 ? 'rgba(244, 239, 230, 0.09)' : 'rgba(60, 56, 52, 0.35)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < lane.length; i += 3) {
        const s = lane[i];
        const nx = -Math.sin(s.angle) * halfW * offsetRatio;
        const ny = Math.cos(s.angle) * halfW * offsetRatio;
        if (i === 0) ctx.moveTo(s.x + nx, s.y + ny);
        else ctx.lineTo(s.x + nx, s.y + ny);
      }
      ctx.stroke();
    }

    // Organic ink-splatter droplets along the edges of bends
    for (let i = 8; i < lane.length - 8; i += 5) {
      if (rand() < 0.42) {
        const s = lane[i];
        const side = rand() < 0.5 ? -1 : 1;
        const dist = halfW + 2 + rand() * 11;
        const sx = s.x - Math.sin(s.angle) * dist * side;
        const sy = s.y + Math.cos(s.angle) * dist * side;
        const r = 1.2 + rand() * 2.8;
        ctx.fillStyle = rand() < 0.8 ? '#1A1918' : 'rgba(26, 25, 24, 0.55)';
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // If Map 2 (Twin-Bridge) and lane 0 just finished, draw Wooden Origami Bridge before lane 1 or over intersection
    if (mapData.definition.bridge && laneIdx === 0) {
      const br = mapData.definition.bridge;
      ctx.save();
      ctx.translate(br.x, br.y);
      ctx.rotate(br.angle);
      ctx.fillStyle = '#C89F74';
      ctx.strokeStyle = '#2B2927';
      ctx.lineWidth = 2;
      ctx.fillRect(-br.width / 2, -br.height / 2, br.width, br.height);
      ctx.strokeRect(-br.width / 2, -br.height / 2, br.width, br.height);

      // Bridge wooden plank lines
      ctx.strokeStyle = 'rgba(43, 41, 39, 0.35)';
      ctx.lineWidth = 1.2;
      for (let px = -br.width / 2 + 10; px < br.width / 2; px += 10) {
        ctx.beginPath();
        ctx.moveTo(px, -br.height / 2);
        ctx.lineTo(px, br.height / 2);
        ctx.stroke();
      }
      // Crimson bridge railings
      ctx.fillStyle = '#C1121F';
      ctx.fillRect(-br.width / 2, -br.height / 2 - 3, br.width, 4);
      ctx.fillRect(-br.width / 2, br.height / 2 - 1, br.width, 4);
      ctx.restore();
    }
  }

  // 6. Entrance Calligraphy Arrow(s) & Crimson Hanko Sanctuary Seal(s)
  for (let laneIdx = 0; laneIdx < mapData.lanes.length; laneIdx++) {
    const lane = mapData.lanes[laneIdx];
    if (lane.length < 2) continue;

    const start = lane[0];
    ctx.save();
    ctx.translate(start.x, start.y);
    ctx.rotate(start.angle);
    ctx.fillStyle = '#F4EFE6';
    ctx.strokeStyle = '#1A1918';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, -7);
    ctx.lineTo(8, 0);
    ctx.lineTo(-12, 7);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#2B2927';
    ctx.font = 'italic bold 12px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('Entrance', Math.max(26, start.x - 18), start.y + 34);

    // Sanctuary Crimson Hanko Seal at lane exit
    const end = lane[lane.length - 1];
    ctx.save();
    ctx.translate(end.x, end.y);

    // Ornate square Hanko stamp
    ctx.fillStyle = 'rgba(244, 239, 230, 0.92)';
    ctx.fillRect(-20, -20, 40, 40);
    ctx.strokeStyle = '#C1121F';
    ctx.lineWidth = 3;
    ctx.strokeRect(-20, -20, 40, 40);
    ctx.lineWidth = 1;
    ctx.strokeRect(-16, -16, 32, 32);

    ctx.fillStyle = '#C1121F';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('封', 0, 1);

    ctx.font = 'italic bold 11px Georgia, serif';
    ctx.fillText('Sanctuary', 0, 32);
    ctx.restore();
  }

  // Map Calligraphic Title Watermark on scroll
  ctx.fillStyle = 'rgba(43, 41, 39, 0.55)';
  ctx.font = 'italic bold 14px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `${mapData.definition.name} (${mapData.definition.japaneseTitle})`,
    34,
    42
  );

  ctx.restore();
  return off;
}

export function getCachedMapCanvas(mapData: PrecomputedMapData): HTMLCanvasElement {
  const id = mapData.definition.id;
  if (!mapBackgroundCache[id]) {
    mapBackgroundCache[id] = buildStaticMapCanvas(mapData);
  }
  return mapBackgroundCache[id]!;
}

export interface CanvasHoverState {
  x: number;
  y: number;
  inside: boolean;
  previewRangeBonus: number;
}

export function renderGameCanvas(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  hover: CanvasHoverState
): void {
  ctx.save();

  // Micro-screen-shake on elemental combo
  if (engine.screenShakeTimer > 0) {
    const dx = (Math.random() - 0.5) * 2 * engine.screenShakeIntensity;
    const dy = (Math.random() - 0.5) * 2 * engine.screenShakeIntensity;
    ctx.translate(dx, dy);
  }

  // 1. Blit pre-rendered offscreen Washi & Brushstroke Track canvas
  const bgCanvas = getCachedMapCanvas(engine.mapData);
  ctx.drawImage(bgCanvas, 0, 0);

  // 2. Render Ground Zones (Ash Patches, Whirlpools, Wet Wakes, Ink Puddles, Magma, Dragon Scroll)
  renderGroundZones(ctx, engine);

  // 3. Render Dashed Elemental Resonance Lines between neighboring different-element towers
  renderResonanceLines(ctx, engine);

  // 4. Render Placement Preview or Selected Tower Range Ring
  renderRangeOverlays(ctx, engine, hover);

  // 5. Render Origami Towers & Tier Evolutions
  for (const tower of engine.towers) {
    renderOrigamiTower(ctx, tower, engine.selectedTowerId === tower.id);
  }

  // 6. Render Continuous Tower Beams / Ember Cones
  renderTowerBeamsAndCones(ctx, engine);

  // 7. Render Layered Origami Enemies & Tether Lines
  renderEnemyTethers(ctx, engine);
  for (const enemy of engine.enemies) {
    renderOrigamiEnemy(ctx, enemy);
  }

  // 8. Render Projectiles
  for (const proj of engine.projectiles) {
    renderProjectile(ctx, proj);
  }

  // 9. Render Visual Effects (Hanko Stamp Flashes, Shockwave Rings, Lightning Arcs)
  renderVisualEffects(ctx, engine);

  // 10. Render Paper Confetti & Ink Splatter Particles
  for (const p of engine.confetti) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    if (p.isInkDrop) {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(p.size * 0.85, p.size * 0.7);
      ctx.lineTo(-p.size * 0.85, p.size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1A1918';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    ctx.restore();
  }

  // 11. Render Floating Combat Callouts
  for (const cal of engine.callouts) {
    ctx.save();
    const alpha = Math.min(1, (cal.life / cal.maxLife) * 1.4);
    ctx.globalAlpha = alpha;
    ctx.translate(cal.x, cal.y);
    ctx.scale(cal.scale, cal.scale);

    ctx.font = '900 14px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#F4EFE6';
    ctx.lineWidth = 3.5;
    ctx.strokeText(cal.text, 0, 0);
    ctx.fillStyle = cal.color;
    ctx.fillText(cal.text, 0, 0);

    if (cal.subtext) {
      ctx.font = 'bold 10px Georgia, serif';
      ctx.strokeText(cal.subtext, 0, 13);
      ctx.fillStyle = '#1A1918';
      ctx.fillText(cal.subtext, 0, 13);
    }
    ctx.restore();
  }

  ctx.restore();
}

function renderGroundZones(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  const now = performance.now() * 0.004;
  for (const gz of engine.groundZones) {
    ctx.save();
    ctx.translate(gz.x, gz.y);
    const alpha = Math.min(1, gz.duration / 0.8) * 0.78;
    ctx.globalAlpha = alpha;

    if (gz.kind === 'ash_patch') {
      ctx.fillStyle = 'rgba(45, 36, 30, 0.65)';
      ctx.beginPath();
      ctx.arc(0, 0, gz.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#E63946';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Glowing ember specs
      ctx.fillStyle = '#F4A261';
      for (let i = 0; i < 4; i++) {
        const a = now + i * 1.57;
        ctx.beginPath();
        ctx.arc(
          Math.cos(a) * (gz.radius * 0.45),
          Math.sin(a) * (gz.radius * 0.45),
          2.2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    } else if (gz.kind === 'whirlpool') {
      ctx.rotate(now * 2.2);
      ctx.strokeStyle = '#3A86FF';
      ctx.lineWidth = 2;
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath();
        const baseA = (arm * Math.PI * 2) / 3;
        for (let r = 4; r <= gz.radius; r += 6) {
          const a = baseA + r * 0.06;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (r === 4) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    } else if (gz.kind === 'wet_wake') {
      ctx.fillStyle = 'rgba(76, 201, 240, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, gz.radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (gz.kind === 'ink_puddle') {
      ctx.fillStyle = 'rgba(20, 20, 30, 0.82)';
      ctx.beginPath();
      ctx.arc(0, 0, gz.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5C5470';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (gz.kind === 'magma_patch') {
      const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, gz.radius);
      grad.addColorStop(0, 'rgba(255, 183, 3, 0.85)');
      grad.addColorStop(0.6, 'rgba(214, 40, 40, 0.72)');
      grad.addColorStop(1, 'rgba(26, 25, 24, 0.65)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, gz.radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (gz.kind === 'dragon_scroll') {
      ctx.fillStyle = '#1D1E2C';
      ctx.beginPath();
      ctx.arc(0, 0, gz.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#C1121F';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#F4EFE6';
      ctx.font = 'bold 16px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('龍', 0, 0);
    }

    ctx.restore();
  }
}

function renderResonanceLines(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  ctx.save();
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 5]);
  for (const link of engine.resonanceLinks) {
    ctx.strokeStyle = link.color;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(link.x1, link.y1);
    ctx.lineTo(link.x2, link.y2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function renderRangeOverlays(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  hover: CanvasHoverState
): void {
  // 1. Selected tower range ring (+ upgrade hover range preview)
  if (engine.selectedTowerId) {
    const tower = engine.towers.find((t) => t.id === engine.selectedTowerId);
    if (tower) {
      const currentRange = engine.getTowerEffectiveRange(tower, 0);
      ctx.save();
      ctx.translate(tower.x, tower.y);
      ctx.fillStyle = 'rgba(43, 41, 39, 0.05)';
      ctx.strokeStyle = TOWER_SPECS[tower.element].waxColor;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, currentRange, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (hover.previewRangeBonus > 0) {
        const previewRange = engine.getTowerEffectiveRange(tower, hover.previewRangeBonus);
        ctx.strokeStyle = '#C1121F';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, previewRange, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // 2. Active placement preview when user selected an Elemental Seal from the shop
  if (engine.placingElement && hover.inside) {
    const spec = TOWER_SPECS[engine.placingElement];
    const check = engine.canPlaceTowerAt(hover.x, hover.y);
    const previewRange = Math.round(spec.range * (check.inConduit ? 1.15 : 1.0));

    ctx.save();

    // Preview resonance lines to nearby different-element towers
    if (check.valid) {
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      for (const other of engine.towers) {
        if (other.element === engine.placingElement) continue;
        const d = Math.hypot(other.x - hover.x, other.y - hover.y);
        if (d <= RESONANCE_MAX_DIST) {
          const comboId = resolveComboId(other.element, engine.placingElement);
          if (comboId) {
            ctx.strokeStyle = COMBO_DEFINITIONS[comboId].color;
            ctx.beginPath();
            ctx.moveTo(hover.x, hover.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }
      }
    }

    ctx.translate(hover.x, hover.y);
    ctx.fillStyle = check.valid
      ? 'rgba(42, 157, 143, 0.12)'
      : 'rgba(193, 18, 31, 0.18)';
    ctx.strokeStyle = check.valid ? spec.waxColor : '#C1121F';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, previewRange, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // Ghost pyramid footprint
    ctx.globalAlpha = 0.85;
    drawPyramidCreases(ctx, TOWER_RADIUS, spec.waxColor, spec.secondaryColor);
    ctx.restore();
  }
}

function drawPyramidCreases(
  ctx: CanvasRenderingContext2D,
  r: number,
  primaryColor: string,
  secondaryColor: string
): void {
  const pts = [
    { x: 0, y: -r * 1.15 },
    { x: r * 1.05, y: r * 0.2 },
    { x: 0, y: r * 1.0 },
    { x: -r * 1.05, y: r * 0.2 },
  ];

  // Left facet
  ctx.fillStyle = primaryColor;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[3].x, pts[3].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right facet
  ctx.fillStyle = secondaryColor;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Bottom-left facet
  ctx.fillStyle = secondaryColor;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(pts[3].x, pts[3].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Bottom-right facet
  ctx.fillStyle = primaryColor;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function renderOrigamiTower(
  ctx: CanvasRenderingContext2D,
  tower: TowerEntity,
  isSelected: boolean
): void {
  const spec = TOWER_SPECS[tower.element];
  const maxTier = Math.max(tower.tierA, tower.tierB);
  const now = performance.now() * 0.003;

  ctx.save();
  ctx.translate(tower.x, tower.y);

  const scaleBounce = 1 + tower.pulseAnim * 0.18;
  ctx.scale(scaleBounce, scaleBounce);

  // Selection halo
  if (isSelected) {
    ctx.strokeStyle = '#C1121F';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, TOWER_RADIUS + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Drop shadow on rice paper
  ctx.fillStyle = 'rgba(26, 25, 24, 0.18)';
  ctx.beginPath();
  ctx.ellipse(2, 4, TOWER_RADIUS + 2, TOWER_RADIUS * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1A1918';
  ctx.lineWidth = 1.6;

  // Tier 1-2+: Extended Origami Wings / Fans / Petals
  if (maxTier >= 1) {
    const wingSpan = TOWER_RADIUS + 5 + maxTier * 2.5;
    ctx.fillStyle = '#F4EFE6';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(dir * wingSpan, -10);
      ctx.lineTo(dir * (wingSpan - 4), 6);
      ctx.lineTo(0, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // Tier 4 Apex Back Crest (e.g., Shogun Crane Wings, Dragon Horns, Lotus Halo)
  if (maxTier >= 4) {
    ctx.save();
    ctx.fillStyle = '#D4A373';
    for (let k = -2; k <= 2; k++) {
      const a = k * 0.35 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.12) * 28, Math.sin(a - 0.12) * 28);
      ctx.lineTo(Math.cos(a) * 33, Math.sin(a) * 33);
      ctx.lineTo(Math.cos(a + 0.12) * 28, Math.sin(a + 0.12) * 28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Core Folded Paper Pyramid
  drawPyramidCreases(ctx, TOWER_RADIUS, '#F7F3EB', '#E6DEC8');

  // Tier 3+ Gold-Leaf Trim & Orbiting Calligraphy Talismans (Ofuda)
  if (maxTier >= 3) {
    ctx.strokeStyle = '#D4A373';
    ctx.lineWidth = 2;
    ctx.strokeRect(-9, -9, 18, 18);

    const talismanCount = maxTier >= 4 ? 5 : 3;
    for (let t = 0; t < talismanCount; t++) {
      const a = now + (t * Math.PI * 2) / talismanCount;
      const tx = Math.cos(a) * 24;
      const ty = Math.sin(a) * 24;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = '#FAF6F0';
      ctx.strokeStyle = '#C1121F';
      ctx.lineWidth = 1;
      ctx.fillRect(-3, -5, 6, 10);
      ctx.strokeRect(-3, -5, 6, 10);
      ctx.restore();
    }
  }

  // Colored Wax Seal Emblem at Core
  ctx.fillStyle = spec.waxColor;
  ctx.strokeStyle = '#1A1918';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 1, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F4EFE6';
  ctx.font = 'bold 10px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.kanji, 0, 1.5);

  // Earth Path B Orbiting Polyhedrons (T2-T4)
  if (tower.element === 'earth' && tower.tierB >= 2) {
    const orbitRadius = tower.tierB >= 4 ? 90 : 68;
    for (const orb of tower.orbiters) {
      const ox = Math.cos(orb.angle) * orbitRadius;
      const oy = Math.sin(orb.angle) * orbitRadius;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(orb.angle * 2);
      ctx.fillStyle = tower.tierB >= 4 ? '#E9C46A' : '#D4A373';
      ctx.strokeStyle = '#1A1918';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(8, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
}

function renderTowerBeamsAndCones(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  for (const tower of engine.towers) {
    // Fire A4: Sun-Seal Lance continuous crimson-gold laser
    if (tower.element === 'fire' && tower.tierA >= 4 && tower.laserTargetId) {
      const endX = tower.x + Math.cos(tower.angle) * 1100;
      const endY = tower.y + Math.sin(tower.angle) * 1100;
      ctx.save();
      ctx.strokeStyle = 'rgba(230, 57, 70, 0.38)';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(tower.x, tower.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.strokeStyle = '#FFB703';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(tower.x, tower.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.restore();
    }

    // Fire A2/A3: Dragon's Breath sweeping ember cone
    if (
      tower.element === 'fire' &&
      tower.tierA >= 2 &&
      tower.tierA < 4 &&
      tower.coneActiveTimer > 0
    ) {
      const coneRange = tower.inConduit ? 144 : 125;
      const halfCone = ((tower.tierA >= 3 ? 65 : 46) * Math.PI) / 360;
      ctx.save();
      ctx.translate(tower.x, tower.y);
      ctx.rotate(tower.angle);
      const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, coneRange);
      grad.addColorStop(0, 'rgba(230, 57, 70, 0.65)');
      grad.addColorStop(0.6, 'rgba(244, 162, 97, 0.42)');
      grad.addColorStop(1, 'rgba(244, 162, 97, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, coneRange, -halfCone, halfCone);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function renderEnemyTethers(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  ctx.save();
  ctx.strokeStyle = '#1D1E2C';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  for (const enemy of engine.enemies) {
    if (enemy.tetherTimer > 0 && enemy.tetheredToIds.length > 0) {
      for (const targetId of enemy.tetheredToIds) {
        const other = engine.enemies.find((e) => e.id === targetId && e.hp > 0);
        if (other) {
          ctx.beginPath();
          ctx.moveTo(enemy.x, enemy.y);
          ctx.lineTo(other.x, other.y);
          ctx.stroke();
        }
      }
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function renderOrigamiEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyEntity): void {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);

  // Phantom / Camo visual state: translucent with dashed ink tracing outline
  const isCloaked = enemy.isCamo && !enemy.camoStripped;
  if (isCloaked) {
    ctx.globalAlpha = 0.48;
  }

  ctx.save();
  ctx.rotate(enemy.angle);
  if (isCloaked) {
    ctx.setLineDash([4, 3]);
  }

  const flap = Math.sin(enemy.foldPhase) * 0.22;
  const r = enemy.radius;
  ctx.strokeStyle = '#1A1918';
  ctx.lineWidth = 1.5;

  if (enemy.type === 'moth') {
    // Paper Moth: multi-faceted folded triangle wings
    ctx.fillStyle = enemy.hitFlash > 0 ? '#FFFFFF' : '#F3E9D2';
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.8, -r * (0.95 + flap));
    ctx.lineTo(-r * 0.35, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = enemy.hitFlash > 0 ? '#FFFFFF' : '#D4A373';
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.8, r * (0.95 + flap));
    ctx.lineTo(-r * 0.35, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (enemy.type === 'crane') {
    // Folded Crane (Orizuru)
    ctx.fillStyle = enemy.hitFlash > 0 ? '#FFFFFF' : '#E5989B';
    // Body diamond
    ctx.beginPath();
    ctx.moveTo(r * 1.15, 0);
    ctx.lineTo(0, -r * 0.4);
    ctx.lineTo(-r * 1.1, 0);
    ctx.lineTo(0, r * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Left & Right Wings
    ctx.fillStyle = enemy.hitFlash > 0 ? '#FFFFFF' : '#FFB4A2';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(r * 0.2, 0);
      ctx.lineTo(-r * 0.2, dir * r * (1.25 + flap));
      ctx.lineTo(-r * 0.65, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (enemy.type === 'fox') {
    // Origami Fox (Kitsune)
    ctx.fillStyle = enemy.hitFlash > 0 ? '#FFFFFF' : '#F4A261';
    ctx.beginPath();
    ctx.moveTo(r * 1.1, 0);
    ctx.lineTo(-r * 0.2, -r * 0.65);
    ctx.lineTo(-r * 1.0, 0);
    ctx.lineTo(-r * 0.2, r * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pointed Fox Ears
    ctx.fillStyle = '#E76F51';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(r * 0.3, dir * r * 0.25);
      ctx.lineTo(0, dir * r * 0.95);
      ctx.lineTo(-r * 0.2, dir * r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (enemy.type === 'serpent') {
    // Tidal Serpent: Segmented turquoise ribbon folds
    for (let seg = 2; seg >= 0; seg--) {
      const offset = -seg * 7;
      const sway = Math.sin(enemy.foldPhase - seg * 1.1) * 4;
      ctx.fillStyle = seg % 2 === 0 ? '#48CAE4' : '#0077B6';
      ctx.beginPath();
      ctx.moveTo(offset + 9, sway);
      ctx.lineTo(offset, sway - 8 + seg);
      ctx.lineTo(offset - 9, sway);
      ctx.lineTo(offset, sway + 8 - seg);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (enemy.type === 'tortoise') {
    // Iron-Fold Tortoise: Hexagonal origami shell
    ctx.fillStyle = enemy.hitFlash > 0 ? '#FFFFFF' : '#4A4E69';
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 0.85;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner shell crease lines
    ctx.strokeStyle = '#9A8C98';
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.85);
    }
    ctx.stroke();
  } else if (enemy.type === 'dragon') {
    // Paper Dragon (Boss): Multi-segment crimson & gold shogun dragon
    for (let seg = 3; seg >= 1; seg--) {
      const ox = -seg * 13;
      const sway = Math.sin(enemy.foldPhase - seg * 0.9) * 5;
      ctx.fillStyle = seg % 2 === 0 ? '#C1121F' : '#F4A261';
      ctx.beginPath();
      ctx.moveTo(ox + 12, sway);
      ctx.lineTo(ox, sway - 13);
      ctx.lineTo(ox - 12, sway);
      ctx.lineTo(ox, sway + 13);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Dragon Head & Horns
    ctx.fillStyle = enemy.hitFlash > 0 ? '#FFFFFF' : '#C1121F';
    ctx.beginPath();
    ctx.moveTo(r * 1.15, 0);
    ctx.lineTo(-4, -r * 0.75);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-4, r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFB703';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(4, dir * 6);
      ctx.lineTo(-10, dir * 20);
      ctx.lineTo(-6, dir * 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // Iron-Fold Armor Plating Badge if currently armored
  if (enemy.isArmored && !enemy.armorStripped) {
    ctx.strokeStyle = '#E9C46A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore(); // undo rotation

  // Frozen / Petrified Crystal Lotus Overlay
  if (enemy.freezeTimer > 0) {
    ctx.fillStyle = 'rgba(76, 201, 240, 0.45)';
    ctx.strokeStyle = '#3A86FF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r - 4);
    ctx.lineTo(r + 4, 0);
    ctx.lineTo(0, r + 4);
    ctx.lineTo(-r - 4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Void Origami Cube Overlay
  if (enemy.voidCubeTimer > 0) {
    ctx.fillStyle = 'rgba(29, 30, 44, 0.65)';
    ctx.strokeStyle = '#C1121F';
    ctx.lineWidth = 1.8;
    ctx.fillRect(-r - 3, -r - 3, (r + 3) * 2, (r + 3) * 2);
    ctx.strokeRect(-r - 3, -r - 3, (r + 3) * 2, (r + 3) * 2);
  }

  // Active Elemental Status Pips above Enemy
  const activeEls = Object.keys(enemy.statuses) as ElementType[];
  if (activeEls.length > 0) {
    const pipSpacing = 8;
    const startX = -((activeEls.length - 1) * pipSpacing) / 2;
    activeEls.forEach((el, idx) => {
      ctx.fillStyle = TOWER_SPECS[el].waxColor;
      ctx.strokeStyle = '#1A1918';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(startX + idx * pipSpacing, -r - 11, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  // Health Bar (shown when damaged or for Bosses)
  if (enemy.hp < enemy.maxHp || enemy.isBoss) {
    const barW = enemy.isBoss ? 48 : 26;
    const barH = enemy.isBoss ? 5 : 3.5;
    const barY = -r - 6;
    ctx.fillStyle = 'rgba(26, 25, 24, 0.75)';
    ctx.fillRect(-barW / 2, barY, barW, barH);
    const pct = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
    ctx.fillStyle = enemy.isBoss ? '#C1121F' : '#2A9D8F';
    ctx.fillRect(-barW / 2, barY, barW * pct, barH);
  }

  ctx.restore();
}

function renderProjectile(ctx: CanvasRenderingContext2D, p: ProjectileEntity): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.strokeStyle = '#1A1918';
  ctx.lineWidth = 1.2;

  if (p.kind === 'shuriken') {
    ctx.rotate(performance.now() * 0.015);
    ctx.fillStyle = '#2A9D8F';
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.lineTo(Math.cos(a + 0.4) * 3, Math.sin(a + 0.4) * 3);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === 'crane' || p.kind === 'swallow') {
    const sz = p.kind === 'crane' ? 9 : 6;
    ctx.fillStyle = p.kind === 'crane' ? '#76C893' : '#F4EFE6';
    ctx.beginPath();
    ctx.moveTo(sz, 0);
    ctx.lineTo(-sz * 0.7, -sz * 0.9);
    ctx.lineTo(-sz * 0.3, 0);
    ctx.lineTo(-sz * 0.7, sz * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === 'war_fan') {
    ctx.fillStyle = '#2A9D8F';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 16, -0.9, 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === 'typhoon') {
    ctx.rotate(performance.now() * 0.02);
    ctx.strokeStyle = '#1D1E2C';
    ctx.lineWidth = 2.5;
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      const base = (arm * Math.PI * 2) / 3;
      ctx.arc(0, 0, 24, base, base + 1.3);
      ctx.stroke();
    }
  } else if (p.kind === 'lantern' || p.kind === 'spark_bomb') {
    ctx.fillStyle = '#E63946';
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFB703';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'koi') {
    // Red-and-white origami Koi
    ctx.fillStyle = '#FAF6F0';
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-2, -6);
    ctx.lineTo(-11, 0);
    ctx.lineTo(-2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E63946';
    ctx.beginPath();
    ctx.arc(3, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'water_wave') {
    ctx.fillStyle = '#3A86FF';
    ctx.beginPath();
    ctx.arc(0, 0, 6, -1.2, 1.2);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (
    p.kind === 'earth_spike' ||
    p.kind === 'crystal_shard' ||
    p.kind === 'homing_poly' ||
    p.kind === 'grit_needle'
  ) {
    ctx.fillStyle = p.kind === 'crystal_shard' ? '#E9C46A' : '#D4A373';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (p.kind === 'boulder') {
    ctx.rotate(performance.now() * 0.01);
    ctx.fillStyle = '#D4A373';
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k * Math.PI * 2) / 7;
      const r = 15;
      if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Ink blot / ink wind blade
    ctx.fillStyle = '#1D1E2C';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function renderVisualEffects(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  for (const v of engine.visualEffects) {
    ctx.save();
    const progress = 1 - v.life / v.maxLife;
    const alpha = Math.max(0, v.life / v.maxLife);
    ctx.globalAlpha = alpha;

    if (v.kind === 'ring' || v.kind === 'great_wave') {
      const curR = v.radius + (v.maxRadius - v.radius) * progress;
      ctx.strokeStyle = v.color;
      ctx.lineWidth = v.kind === 'great_wave' ? 6 : 2.5;
      ctx.beginPath();
      ctx.arc(v.x, v.y, curR, 0, Math.PI * 2);
      ctx.stroke();
    } else if (v.kind === 'hanko_stamp') {
      ctx.translate(v.x, v.y);
      ctx.rotate(-0.12);
      const scale = 1 + (1 - alpha) * 0.25;
      ctx.scale(scale, scale);
      ctx.strokeStyle = '#C1121F';
      ctx.fillStyle = 'rgba(193, 18, 31, 0.12)';
      ctx.lineWidth = 2.5;
      ctx.fillRect(-18, -18, 36, 36);
      ctx.strokeRect(-18, -18, 36, 36);
      ctx.fillStyle = '#C1121F';
      ctx.font = 'bold 20px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(v.kanji ?? '印', 0, 1);
    } else if (v.kind === 'lightning_arc' && v.x2 !== undefined && v.y2 !== undefined) {
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(v.x, v.y);
      const midX = (v.x + v.x2) / 2 + (Math.random() - 0.5) * 16;
      const midY = (v.y + v.y2) / 2 + (Math.random() - 0.5) * 16;
      ctx.lineTo(midX, midY);
      ctx.lineTo(v.x2, v.y2);
      ctx.stroke();
    } else if (v.kind === 'stone_beam' && v.x2 !== undefined && v.y2 !== undefined) {
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(v.x, v.y);
      ctx.lineTo(v.x2, v.y2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
