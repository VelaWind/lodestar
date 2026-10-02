// Narrower WebP copies of each figure, for `srcset`.
//
// The figures display at no more than 544 CSS px (the reading column), but the
// originals run to 1280 px and more, so a phone downloaded several times the
// pixels it could show. This writes `<name>-640.webp` and `<name>-1080.webp`
// beside each original in public/figures/, only where the original is wider
// than the variant, and leaves the originals untouched. RichText's figure
// builds its `srcset` from the same rule.
//
// Run with `node scripts/figure-variants.mjs` after adding a figure; the output
// is committed, so a build never depends on an image library.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

export const VARIANT_WIDTHS = [640, 1080];
const DIR = 'public/figures';
const VARIANT = /-(\d+)\.webp$/;

for (const file of readdirSync(DIR)) {
  if (!file.endsWith('.webp') || VARIANT.test(file)) continue;
  const source = join(DIR, file);
  const { width } = await sharp(source).metadata();
  for (const target of VARIANT_WIDTHS) {
    if (!width || width <= target) continue;
    const out = join(DIR, file.replace(/\.webp$/, `-${target}.webp`));
    await sharp(source).resize({ width: target }).webp({ quality: 82 }).toFile(out);
    console.log(`${out}  (${width} → ${target} px)`);
  }
}
