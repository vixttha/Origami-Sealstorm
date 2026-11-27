/**
 * Dev utility: verify spline geometry, conduit placement and buildable tiles
 * for all three maps. Run: npx tsx scripts/check-maps.ts
 */

import { ENEMY_DEFS, DIFFICULTIES, hpForWave, TRACK_CLEARANCE } from '../src/lib/constants';
import { MAPS, isValidPlacement, nearestLanePoint } from '../src/lib/maps';
import type { Tower } from '../src/lib/types';

function fakeTower(x: number, y: number): Tower {
  return {
    id: 1,
    element: 'air',
    x,
    y,
    tierA: 0,
    tierB: 0,
    targeting: 'first',
    cooldown: 0,
    angle: 0,
    kills: 0,
    damageDealt: 0,
    totalInvested: 100,
    shotCount: 0,
    abilityTimer: 0,
    abilityTimer2: 0,
    coneAngle: 0,
    laserAngle: 0,
    tickAcc: 0,
    orbitalAngle: 0,
    conduitBoost: false,
    buildFlash: 0,
    fireGlow: 0,
    muzzleX: 0,
    muzzleY: 0,
  };
}

let failures = 0;
function check(label: string, ok: boolean, detail: string): void {
  const mark = ok ? 'OK ' : 'FAIL';
  if (!ok) failures++;
  console.log(`[${mark}] ${label}: ${detail}`);
}

for (const map of MAPS) {
  console.log(`\n=== ${map.name} (${map.id}) ===`);
  for (const lane of map.lanes) {
    console.log(`  lane length: ${Math.round(lane.length)}px, samples: ${lane.samples.length}`);
  }

  // Conduits must themselves be valid build spots (or at least not on track).
  for (const c of map.conduits) {
    const v = isValidPlacement(map.lanes, [], map.conduits, c.x, c.y);
    check(`conduit (${c.x},${c.y}) buildable`, v.ok, `reason=${String(v.reason)} trackDist=${Math.round(nearestLanePoint(map.lanes, c.x, c.y).dist)}`);
  }

  // Count buildable cells on an 8px grid.
  let buildable = 0;
  for (let x = 30; x <= 930; x += 8) {
    for (let y = 30; y <= 570; y += 8) {
      if (isValidPlacement(map.lanes, [], map.conduits, x, y).ok) buildable++;
    }
  }
  const totalCells = Math.ceil((930 - 30) / 8) * Math.ceil((570 - 30) / 8);
  check('buildable cells', buildable > 150, `${buildable}/${totalCells} cells buildable`);

  // Find good "near track" build spots (dist 46..115px) for tower coverage.
  const spots: string[] = [];
  outer: for (let y = 40; y <= 560; y += 10) {
    for (let x = 60; x <= 920; x += 10) {
      const d = nearestLanePoint(map.lanes, x, y).dist;
      if (d >= TRACK_CLEARANCE + 1 && d <= 115 && isValidPlacement(map.lanes, [], map.conduits, x, y).ok) {
        spots.push(`(${x},${y}) dist=${Math.round(d)}`);
        if (spots.length >= 6) break outer;
      }
    }
  }
  check('near-track build spots', spots.length >= 3, spots.join(' | '));
}

// Tower spacing rule sanity check on map 1.
const river = MAPS[0];
const spotA = { x: 430, y: 300 };
const towerA = fakeTower(spotA.x, spotA.y);
const near = isValidPlacement(river.lanes, [towerA], river.conduits, 455, 300);
check('tower proximity rule', !near.ok && near.reason === 'tower', `placing 25px away: reason=${String(near.reason)}`);

// HP scaling sanity per spec (moth = 24 HP at wave 1 apprentice).
check('wave 1 moth hp', hpForWave(ENEMY_DEFS.moth.baseHp, 1, DIFFICULTIES.apprentice) === 24, String(hpForWave(ENEMY_DEFS.moth.baseHp, 1, DIFFICULTIES.apprentice)));
check('boss wave-25 apprentice hp', hpForWave(ENEMY_DEFS.dragon.baseHp, 25, DIFFICULTIES.apprentice) === 11547, String(hpForWave(ENEMY_DEFS.dragon.baseHp, 25, DIFFICULTIES.apprentice)));

console.log(failures === 0 ? '\nALL MAP CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
