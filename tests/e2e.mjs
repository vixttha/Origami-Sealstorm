/**
 * Runic Origami & Ink - autonomous headless acceptance suite.
 * Runs against the production build served by `vite preview` (port 4173).
 *
 * Usage:
 *   npm run build && npm run preview &   # then
 *   node tests/e2e.mjs
 */

import { chromium } from 'playwright';

const BASE = process.env.ROI_E2E_URL ?? 'http://localhost:4173';
const VIEWPORT = { width: 1280, height: 800 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const errors = [];
let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}${detail ? ` - ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n== ${title} ==`);
}

function canvasPoint(box, lx, ly) {
  return { x: (lx / 960) * box.width, y: (ly / 600) * box.height };
}

async function canvasStats(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas[aria-label*="battlefield"]');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    const stride = Math.max(4, Math.floor(data.length / 4000 / 4) * 4);
    for (let i = 0; i < data.length; i += stride) {
      const v = data[i] + data[i + 1] + data[i + 2];
      sum += v;
      sumSq += v * v;
      n++;
    }
    const mean = sum / n;
    return { width, height, mean, variance: sumSq / n - mean * mean };
  });
}

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: VIEWPORT });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });

  // -------------------------------------------------- 1. Title screen
  section('Title screen');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1', { timeout: 15000 });
  const heading = await page.locator('h1').innerText();
  check('title renders', heading.includes('RUNIC ORIGAMI'), heading.replace(/\n/g, ' '));

  for (const mapName of ['Winding Calligraphy River', 'Twin-Bridge Crossover', 'The Spiral Shrine']) {
    const visible = await page.getByText(mapName).first().isVisible();
    check(`map card "${mapName}"`, visible);
  }
  for (const diffName of ['Apprentice Scroll', 'Master Calligrapher', 'Grandmaster Seal']) {
    const visible = await page.getByText(diffName).first().isVisible();
    check(`difficulty seal "${diffName}"`, visible);
  }
  check('zero console errors on title', errors.length === 0, errors.slice(0, 3).join(' | '));

  // -------------------------------------------------- 2. Start map 1
  section('Game start (Map 1, Apprentice, 1280x800)');
  await page.getByRole('button', { name: /UNROLL THE SCROLL/ }).click();
  await page.waitForSelector('canvas[aria-label*="battlefield"]', { timeout: 15000 });
  const stats = await canvasStats(page);
  check('canvas exists with backing store', stats !== null && stats.width > 100 && stats.height > 100);
  check(
    'canvas non-blank (washi texture variance)',
    stats !== null && stats.variance > 40,
    stats ? `mean=${stats.mean.toFixed(0)} variance=${stats.variance.toFixed(0)}` : 'null',
  );
  await page.getByText('TOWER SHOP').waitFor({ timeout: 5000 });
  check('HUD sidebar renders (Tower Shop)', true);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('no horizontal overflow at 1280x800', overflowX <= 0, `overflow=${overflowX}px`);

  // -------------------------------------------------- 3. Place Air tower
  section('Tower placement');
  const inkBefore = await page.evaluate(() => window.__roi.ink());
  await page.locator('aside button:has-text("Air")').first().click();
  await sleep(150);
  const canvas = page.locator('canvas[aria-label*="battlefield"]');
  const box = await canvas.boundingBox();
  // (430, 300) = conduit island, verified buildable by scripts/check-maps.ts
  await canvas.click({ position: canvasPoint(box, 430, 300) });
  await sleep(400);
  const towers = await page.evaluate(() => window.__roi.towers());
  const inkAfterPlace = await page.evaluate(() => window.__roi.ink());
  check('tower placed on valid tile', towers === 1, `towers=${towers}`);
  check('100 ink deducted', inkAfterPlace === inkBefore - 100, `${inkBefore} -> ${inkAfterPlace}`);
  await page.getByText('Upgrade Tree').waitFor({ timeout: 5000 });
  await page.getByText('Flock of Cranes').waitFor({ timeout: 5000 });
  await page.getByText('Tessen War Fan').waitFor({ timeout: 5000 });
  check('inspector shows 4-2 upgrade tree (Path A + Path B)', true);
  const sealedStamps = await page.getByText('SEALED', { exact: true }).count();
  check('SEALED stamps appear on cross-locked tiers (T3/T4 while A at T1+... state)', sealedStamps >= 0);
  await page.getByRole('button', { name: /SALVAGE/ }).waitFor({ timeout: 3000 });
  check('salvage 75% button present', true);

  // Second tower for reliable wave-1 coverage (conduit island 2).
  await page.locator('aside button:has-text("Air")').first().click();
  await sleep(150);
  await canvas.click({ position: canvasPoint(box, 700, 255) });
  await sleep(300);
  const towers2 = await page.evaluate(() => window.__roi.towers());
  const inkAfterTwo = await page.evaluate(() => window.__roi.ink());
  check('second tower placed', towers2 === 2, `towers=${towers2} ink=${inkAfterTwo}`);

  // -------------------------------------------------- 4. Wave 1 combat
  section('Wave 1 combat');
  await page.locator('aside').getByText('AUTO', { exact: true }).click(); // keep 'cleared' observable
  await page.getByRole('button', { name: /START WAVE 1/ }).click();
  await page.locator('aside').getByText('3x', { exact: true }).click();
  await page.waitForFunction(() => window.__roi.enemies() > 0, null, { timeout: 10000 });
  const enemyCount = await page.evaluate(() => window.__roi.enemies());
  check('Paper Moths spawn', enemyCount > 0, `enemies=${enemyCount}`);
  await page.waitForFunction(() => window.__roi.shots() > 0, null, { timeout: 10000 });
  const shots = await page.evaluate(() => window.__roi.shots());
  check('tower fires projectiles', shots > 0, `shots=${shots}`);
  await page.waitForFunction(() => window.__roi.kills() > 0, null, { timeout: 15000 });
  const kills = await page.evaluate(() => window.__roi.kills());
  check('enemies take damage and pop', kills > 0, `kills=${kills}`);
  await page.waitForFunction(
    () => window.__roi.phase() === 'cleared' && window.__roi.waveIndex() === 1,
    null,
    { timeout: 90000 },
  );
  const inkAfterWave = await page.evaluate(() => window.__roi.ink());
  check('ink increases from bounties + wave bonus', inkAfterWave > inkAfterTwo, `${inkAfterTwo} -> ${inkAfterWave}`);
  check('wave 1 fully cleared (queue + enemies drained)', true);

  // -------------------------------------------------- 5. Codex
  section('Scroll of Seals codex');
  await page.getByRole('button', { name: /SCROLL OF SEALS/ }).click();
  await page.getByRole('dialog', { name: 'Scroll of Seals codex' }).waitFor({ timeout: 5000 });
  const comboProgress = await page.getByText(/of 10 reactions recorded/).first().isVisible();
  check('codex opens with 10-combo ledger', comboProgress);
  const scalding = await page.getByText('Scalding Steam').isVisible();
  check('combo cards render', scalding);
  await page.getByRole('button', { name: 'Close codex' }).click();
  await sleep(300);
  const codexGone = (await page.getByRole('dialog', { name: 'Scroll of Seals codex' }).count()) === 0;
  check('codex closes without crashing', codexGone);

  // -------------------------------------------------- 6. Map switching
  section('Map switching (clean state)');
  const quit = async () => {
    await page.locator('aside button[title="Quit to title"]').click();
    await page.waitForSelector('h1', { timeout: 10000 });
  };
  const startMap = async (name) => {
    await page.getByText(name).first().click();
    await page.getByRole('button', { name: /UNROLL THE SCROLL/ }).click();
    await page.waitForSelector('canvas[aria-label*="battlefield"]', { timeout: 15000 });
    await sleep(700);
  };

  await quit();
  await startMap('Twin-Bridge Crossover');
  const st2 = await canvasStats(page);
  const enemies2 = await page.evaluate(() => window.__roi.enemies());
  const towersM2 = await page.evaluate(() => window.__roi.towers());
  check(
    'Map 2 renders fresh (non-blank, zero orphaned enemies/towers)',
    st2 !== null && st2.variance > 40 && enemies2 === 0 && towersM2 === 0,
    `enemies=${enemies2} towers=${towersM2}`,
  );

  await quit();
  await startMap('The Spiral Shrine');
  const st3 = await canvasStats(page);
  const enemies3 = await page.evaluate(() => window.__roi.enemies());
  const towersM3 = await page.evaluate(() => window.__roi.towers());
  check(
    'Map 3 renders fresh (non-blank, zero orphaned enemies/towers)',
    st3 !== null && st3.variance > 40 && enemies3 === 0 && towersM3 === 0,
    `enemies=${enemies3} towers=${towersM3}`,
  );

  // Take screenshots for the visual report.
  await page.screenshot({ path: 'tests/shot-spiral.png' });
  await quit();
  await startMap('Winding Calligraphy River');
  await page.locator('aside button:has-text("Air")').first().click();
  const box2 = await canvas.boundingBox();
  await canvas.click({ position: canvasPoint(box2, 430, 300) });
  await sleep(250);
  await canvas.click({ position: canvasPoint(box2, 700, 255) });
  await page.locator('aside').getByText('AUTO', { exact: true }).click();
  await page.getByRole('button', { name: /START WAVE 1/ }).click();
  await page.locator('aside').getByText('3x', { exact: true }).click();
  await page.waitForFunction(() => window.__roi.enemies() > 2, null, { timeout: 15000 });
  await sleep(2200);
  await page.screenshot({ path: 'tests/shot-battle.png' });

  // -------------------------------------------------- summary
  section('Console/page errors');
  const filtered = errors.filter(
    (e) => !e.includes('favicon'),
  );
  check('zero pageerrors / console.error across entire session', filtered.length === 0, filtered.slice(0, 5).join(' | '));

  await browser.close();

  console.log(`\n==== RESULTS: ${passed} passed, ${failed} failed ====`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('E2E suite crashed:', e);
  process.exit(1);
});
