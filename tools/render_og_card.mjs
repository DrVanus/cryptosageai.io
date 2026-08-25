#!/usr/bin/env node
/**
 * Render tools/og-card.html -> banner.jpg (1200x630), the og:image/twitter:image
 * for every page on cryptosageai.io.
 *
 *   node tools/render_og_card.mjs
 *
 * Playwright is not a dependency of this repo; it is borrowed from the wrapper
 * checkout that already has Chromium downloaded.
 *
 * After re-rendering: bump the ?v= token on EVERY banner.jpg reference in the
 * site at once (index.html, privacy-policy.html, terms.html, support.html,
 * 404.html). Facebook, X, Slack, iMessage and LinkedIn all cache og:image by
 * URL; a page that references it with no token serves the old card forever.
 */
import { chromium } from '/Users/dee/Developer/DrVanus/cortana-openai-wrapper/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.OG_CARD_ROOT || path.resolve(HERE, '..');
const SRC = process.env.OG_CARD_SRC || path.join(HERE, 'og-card.html');
const SEAL = path.join(ROOT, 'owl-logo-72.webp');
const OUT = process.env.OG_CARD_OUT || path.join(ROOT, 'banner.jpg');

const W = 1200, H = 630;

const seal = `data:image/webp;base64,${fs.readFileSync(SEAL).toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,          // render at 2x, downsample -> clean type edges
  colorScheme: 'dark',
  reducedMotion: 'reduce',
});

await page.goto('file://' + SRC, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: `:root { --seal: url("${seal}"); }` });

// Inter must actually be the face that paints. A fallback to system-ui silently
// changes every metric on the card, so fail loudly instead of shipping it.
await page.evaluate(() => document.fonts.ready);
const interLoaded = await page.evaluate(() =>
  document.fonts.check('800 62px Inter') && document.fonts.check('500 35px Inter'));
if (!interLoaded) {
  await browser.close();
  throw new Error('Inter did not load — refusing to render the card in a fallback face.');
}

const png = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
await browser.close();

// Downsample 2400x1260 -> 1200x630 and encode JPEG with macOS sips.
const tmpPng = path.join(process.env.TMPDIR || '/tmp', `og-card-${process.pid}.png`);
fs.writeFileSync(tmpPng, png);
const { execFileSync } = await import('node:child_process');
execFileSync('sips', ['-z', String(H), String(W), tmpPng, '--out', tmpPng]);
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '86', tmpPng, '--out', OUT]);
fs.unlinkSync(tmpPng);

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`wrote ${OUT}  ${W}x${H}  ${kb} KB`);
console.log('NOW: open it with the Read tool and read the pixels. A copy gate cannot.');
