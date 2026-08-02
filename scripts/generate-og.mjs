/**
 * Generates the social preview card at public/og.png.
 *
 * Run deliberately, not on build:
 *
 *     node scripts/generate-og.mjs
 *
 * The PNG is committed. It is a build *input* rather than a build output — the
 * deployed site serves it as a static asset, and crawlers fetch it without ever
 * running our toolchain — so it changes only when this script does, and keeping
 * it in the repository means the preview cannot silently break because an image
 * step was skipped in CI.
 *
 * The card is composed as SVG and rasterised with sharp. Text is left to the
 * renderer's own font stack rather than converted to paths, which is why the
 * families below are ones a desktop actually has; the output is checked in, so
 * the rendering only has to be right once, here.
 *
 * Nothing is set below 28px. A social card is read as a thumbnail in a feed
 * before it is read at full size, and anything smaller is texture, not type.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../public/og.png');

/** Facebook and X both crop to 1.91:1; 1200x630 is that, at the size they cache. */
const WIDTH = 1200;
const HEIGHT = 630;

/* The site's own palette, from tailwind.config.js — void-900 through star. */
const VOID = '#06080d';
const INK = '#d5dcea';
const INK_DIM = '#98a2b8';
const INK_FAINT = '#6b7488';
const STAR = '#9db4ff';

/** The wordmark's serif, and the UI sans, in the order the site asks for them. */
const SERIF = "Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif";
const SANS = "Inter, Segoe UI, Helvetica Neue, Arial, sans-serif";

/**
 * The four-pointed lodestar, the same concave-edged mark as the favicon, drawn
 * on a 32-unit grid and scaled by the caller.
 */
function mark(x, y, size) {
  const s = size / 32;
  return `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M16 3 Q17 13 29 16 Q17 19 16 29 Q15 19 3 16 Q15 13 16 3 Z" fill="${STAR}" />
    </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="wash" cx="50%" cy="0%" r="75%">
      <stop offset="0%" stop-color="${STAR}" stop-opacity="0.10" />
      <stop offset="60%" stop-color="${STAR}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="${VOID}" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#wash)" />

  ${mark(90, 96, 52)}

  <text x="164" y="146" font-family="${SERIF}" font-size="76" fill="${INK}" letter-spacing="1">Lodestar</text>

  <text x="90" y="300" font-family="${SERIF}" font-size="54" fill="${INK_DIM}">Space, explained in layers</text>
  <text x="90" y="366" font-family="${SERIF}" font-size="54" fill="${INK_DIM}">you choose to open.</text>

  <line x1="90" y1="470" x2="${WIDTH - 90}" y2="470" stroke="#232b3b" stroke-width="1" />

  <text x="90" y="520" font-family="${SANS}" font-size="30" fill="${INK_FAINT}" letter-spacing="1.5">Real physics · Real units · Cited sources</text>
</svg>`;

await mkdir(dirname(OUT), { recursive: true });
const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile(OUT, png);

const { width, height, size } = await sharp(png).metadata();
// eslint-disable-next-line no-console
console.log(`wrote ${OUT} — ${width}x${height}, ${(size / 1024).toFixed(1)} kB`);
