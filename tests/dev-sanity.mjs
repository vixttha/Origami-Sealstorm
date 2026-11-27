import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForSelector('h1', { timeout: 20000 });
console.log('title:', (await page.locator('h1').innerText()).replace(/\n/g, ' '));
await page.getByRole('button', { name: /UNROLL THE SCROLL/ }).click();
await page.waitForSelector('canvas[aria-label*="battlefield"]', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 900));
const stats = await page.evaluate(() => {
  const c = document.querySelector('canvas[aria-label*="battlefield"]');
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4000) { sum += d[i] + d[i+1] + d[i+2]; n++; }
  return { mean: sum / n };
});
console.log('canvas mean brightness:', stats.mean.toFixed(0), '(expect ~600-700 washi)');
console.log('console errors:', errors.length === 0 ? 'NONE' : errors.slice(0, 3));
await page.screenshot({ path: 'tests/shot-devserver.png' });
await browser.close();
process.exit(errors.length === 0 && stats.mean > 300 ? 0 : 1);
