/**
 * Programmatic visual verification: samples real canvas pixels at known
 * logical coordinates to confirm the procedural art actually renders as
 * designed (washi paper, ink brushstroke track, folded towers, hanko stamps).
 */

import { chromium } from 'playwright';

const BASE = process.env.ROI_E2E_URL ?? 'http://localhost:4173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const checks = [];
function check(name, ok, detail = '') {
  checks.push(ok);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
}

async function canvasHistogram(page, lx, ly, radius) {
  return page.evaluate(
    ([lx, ly, radius]) => {
      const canvas = document.querySelector('canvas[aria-label*="battlefield"]');
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      const sx = canvas.width / 960;
      const sy = canvas.height / 600;
      const cx = lx * sx;
      const cy = ly * sy;
      const rx = Math.max(2, radius * sx);
      const ry = Math.max(2, radius * sy);
      const x0 = Math.max(0, Math.floor(cx - rx));
      const y0 = Math.max(0, Math.floor(cy - ry));
      const w = Math.min(canvas.width - x0, Math.ceil(rx * 2));
      const h = Math.min(canvas.height - y0, Math.ceil(ry * 2));
      if (w <= 0 || h <= 0) return null;
      const data = ctx.getImageData(x0, y0, w, h).data;
      let dark = 0;
      let light = 0;
      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 40) continue;
        const sum = data[i] + data[i + 1] + data[i + 2];
        if (sum < 210) dark++;
        else if (sum > 540) light++;
        total++;
      }
      return { total, darkRatio: total ? dark / total : 0, lightRatio: total ? light / total : 0 };
    },
    [lx, ly, radius],
  );
}

async function findColor(page, lx, ly, radius, target, tolerance = 60) {
  return page.evaluate(
    ([lx, ly, radius, target, tolerance]) => {
      const canvas = document.querySelector('canvas[aria-label*="battlefield"]');
      if (!canvas) return 0;
      const ctx = canvas.getContext('2d');
      const sx = canvas.width / 960;
      const sy = canvas.height / 600;
      const cx = lx * sx;
      const cy = ly * sy;
      const rx = Math.max(3, radius * sx);
      const ry = Math.max(3, radius * sy);
      const x0 = Math.max(0, Math.floor(cx - rx));
      const y0 = Math.max(0, Math.floor(cy - ry));
      const w = Math.min(canvas.width - x0, Math.ceil(rx * 2));
      const h = Math.min(canvas.height - y0, Math.ceil(ry * 2));
      if (w <= 0 || h <= 0) return 0;
      const data = ctx.getImageData(x0, y0, w, h).data;
      let hits = 0;
      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - target[0];
        const dg = data[i + 1] - target[1];
        const db = data[i + 2] - target[2];
        if (dr * dr + dg * dg + db * db < tolerance * tolerance * 3) hits++;
      }
      return hits;
    },
    [lx, ly, radius, target, tolerance],
  );
}

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });

  // Title thumbnails non-blank.
  const thumbs = await page.evaluate(() => {
    const out = [];
    for (const c of document.querySelectorAll('canvas')) {
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 400) {
        sum += data[i] + data[i + 1] + data[i + 2];
        n++;
      }
      out.push({ w: c.width, mean: sum / n });
    }
    return out;
  });
  check(
    'title map thumbnails rendered',
    thumbs.length === 3 && thumbs.every((t) => t.w > 100 && t.mean > 350 && t.mean < 780),
    JSON.stringify(thumbs.map((t) => Math.round(t.mean))),
  );

  await page.getByRole('button', { name: /UNROLL THE SCROLL/ }).click();
  await page.waitForSelector('canvas[aria-label*="battlefield"]');
  await sleep(900);

  // Washi paper field (empty area).
  const paper = await canvasHistogram(page, 480, 60, 40);
  check(
    'washi paper field is light parchment',
    paper !== null && paper.lightRatio > 0.7,
    paper ? `light=${(paper.lightRatio * 100).toFixed(0)}%` : 'null',
  );

  // Ink brushstroke track (map 1 passes through (480, 525)).
  const track = await canvasHistogram(page, 480, 525, 16);
  check(
    'sumi-e brushstroke track is dark ink',
    track !== null && track.darkRatio > 0.3,
    track ? `dark=${(track.darkRatio * 100).toFixed(0)}%` : 'null',
  );

  // Crimson hanko stamp at the sanctuary exit (map 1 exit clamps to x=920, y~497).
  const hanko = await findColor(page, 920, 497, 30, [193, 18, 31], 70);
  check('crimson hanko sanctuary stamp renders', hanko > 60, `hits=${hanko}`);

  // Conduit stone circle ring (ochre) near (430, 300).
  const conduit = await findColor(page, 430, 300, 50, [160, 130, 86], 60);
  check('conduit stone circle renders', conduit > 30, `hits=${conduit}`);

  // Place an Air tower at the conduit and verify its jade wax seal renders.
  await page.locator('aside button:has-text("Air")').first().click();
  const canvas = page.locator('canvas[aria-label*="battlefield"]');
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: (430 / 960) * box.width, y: (300 / 600) * box.height } });
  await sleep(700);
  const towerHits = await findColor(page, 430, 300, 16, [42, 157, 143], 80);
  check('folded air tower with jade wax seal renders', towerHits > 20, `hits=${towerHits}`);

  // HUD sidebar geometry + colors.
  const hud = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (!aside) return null;
    const styles = getComputedStyle(aside);
    const shop = document.querySelector('aside h3');
    return { width: aside.getBoundingClientRect().width, bg: styles.backgroundColor, shopText: shop?.textContent ?? '' };
  });
  check(
    'HUD sidebar ~25% width parchment panel',
    hud !== null && Math.abs(hud.width - 304) < 12 && hud.bg === 'rgb(239, 231, 216)',
    hud ? `w=${hud.width} bg=${hud.bg}` : 'null',
  );

  // Start a wave and verify enemies + projectiles render (non-empty enemy pixels at track).
  await page.locator('aside').getByText('AUTO', { exact: true }).click();
  await page.getByRole('button', { name: /START WAVE 1/ }).click();
  await page.locator('aside').getByText('3x', { exact: true }).click();
  await page.waitForFunction(() => window.__roi.enemies() > 0, null, { timeout: 10000 });
  await sleep(700);
  // Paper moths are LIGHT folded triangles crossing the DARK ink band near the entrance.
  const mothHits = await findColor(page, 110, 150, 40, [237, 228, 206], 18);
  check('paper moths render as light folds over the ink track', mothHits > 8, `hits=${mothHits}`);

  check('zero page errors during visual pass', errors.length === 0, errors.slice(0, 3).join(' | '));

  await page.screenshot({ path: 'tests/shot-visual-final.png' });
  await browser.close();
  const failed = checks.filter((c) => !c).length;
  console.log(`\n==== VISUAL CHECKS: ${checks.length - failed} passed, ${failed} failed ====`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('visual check crashed:', e);
  process.exit(1);
});
