// Rasterise one SVG to PNG at a given width, transparent background.
//   node scripts/rasterize_svg.mjs <in.svg> <out.png> <width>
// Used by scripts/make_icons.py (sharp ships with devDependencies).
import sharp from 'sharp';

const [, , input, output, widthArg] = process.argv;
const width = Number(widthArg);
if (!input || !output || !Number.isFinite(width) || width <= 0) {
  console.error('usage: rasterize_svg.mjs <in.svg> <out.png> <width>');
  process.exit(2);
}

await sharp(input, { density: 360 })
  .resize({ width: Math.round(width) })
  .png()
  .toFile(output);
