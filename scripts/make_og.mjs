// The Open Graph / link-preview image for the sales pages, from the vector brand.
//   node scripts/make_og.mjs      -> public/og-gossoko.png (1200x630)
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const W = 1200, H = 630;

const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="a" cx="0.82" cy="-0.1" r="0.9"><stop offset="0" stop-color="#FF7A00" stop-opacity=".30"/><stop offset="1" stop-color="#FF7A00" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="0.1" cy="1" r="0.8"><stop offset="0" stop-color="#8e4a1c" stop-opacity=".35"/><stop offset="1" stop-color="#8e4a1c" stop-opacity="0"/></radialGradient>
    <linearGradient id="r" x1="0" x2="1"><stop offset="0" stop-color="#FF7A00" stop-opacity="0"/><stop offset=".5" stop-color="#FF7A00" stop-opacity=".8"/><stop offset="1" stop-color="#FF7A00" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#0a0908"/>
  <rect width="100%" height="100%" fill="url(#a)"/>
  <rect width="100%" height="100%" fill="url(#b)"/>
  <rect x="410" y="372" width="700" height="3" fill="url(#r)"/>
  <text x="440" y="440" font-family="Arial Black, Archivo Black, Helvetica, sans-serif" font-weight="900" font-size="38" fill="#fff3e4">FIND THE BEST TRADIE FEED</text>
  <text x="440" y="490" font-family="Arial Black, Archivo Black, Helvetica, sans-serif" font-weight="900" font-size="38" fill="#FF8A1A">NEAR THE SITE.</text>
  <text x="440" y="548" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#cdb79e">Smoko, brekkie and lunch spots · South-East Queensland</text>
</svg>`);

const pin = await sharp(root('src/assets/brand/gossoko-pin.svg'), { density: 300 }).resize({ height: 440 }).png().toBuffer();
const word = await sharp(root('src/assets/brand/gossoko-wordmark.svg'), { density: 200 }).resize({ width: 700 }).png().toBuffer();

await sharp(bg)
  .composite([
    { input: pin, left: 90, top: 96 },
    { input: word, left: 410, top: 150 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(root('public/og-gossoko.png'));
console.log('wrote public/og-gossoko.png');
