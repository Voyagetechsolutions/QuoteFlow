/**
 * Render the brand SVG logos to high-res transparent PNGs (with Inter loaded),
 * so they're usable in email / social / docs without depending on a font.
 *   node scripts/render-logos.cjs
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'brand');
const ITEMS = [
  { svg: 'quoteflow-logo.svg', png: 'quoteflow-logo.png', bg: 'transparent' },
  { svg: 'quoteflow-logo-reversed.svg', png: 'quoteflow-logo-reversed.png', bg: 'transparent' },
  { svg: 'quoteflow-mark.svg', png: 'quoteflow-mark.png', bg: 'transparent' },
];

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ deviceScaleFactor: 4 });
  for (const it of ITEMS) {
    const svg = fs.readFileSync(path.join(DIR, it.svg), 'utf8');
    await page.setContent(
      `<!doctype html><html><head>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
       </head>
       <body style="margin:0;padding:0;display:inline-block;line-height:0;background:${it.bg}">${svg}</body></html>`,
      { waitUntil: 'networkidle' },
    );
    await page.evaluate(() => (document).fonts.ready);
    const el = await page.$('svg');
    await el.screenshot({
      path: path.join(DIR, it.png),
      omitBackground: it.bg === 'transparent',
    });
    console.log('rendered', it.png);
  }
  await browser.close();
})();
