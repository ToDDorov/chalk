// Draws the app icons (a chalk-yellow "C" on the dark app background) as PNGs.
// Run with: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BG = [0x11, 0x13, 0x15];
const FG = [0xe8, 0xc5, 0x47];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc(body), body.length + 4);
  return out;
};

// 1 inside the "C", 0 outside. Coordinates are -0.5..0.5 from the centre.
// The ring stays inside the middle 80%, the safe zone for maskable icons.
const inside = (x, y) => {
  const r = Math.hypot(x, y);
  if (r < 0.17 || r > 0.29) return 0;
  return x > 0 && Math.abs(y) < x * 0.75 ? 0 : 1; // opening on the right
};

const png = (size) => {
  const SS = 4; // supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let py = 0; py < size; py++) {
    const row = py * (size * 3 + 1);
    for (let px = 0; px < size; px++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++)
          hit += inside((px + (sx + 0.5) / SS) / size - 0.5, (py + (sy + 0.5) / SS) / size - 0.5);
      const a = hit / (SS * SS);
      for (let c = 0; c < 3; c++) raw[row + 1 + px * 3 + c] = Math.round(BG[c] + (FG[c] - BG[c]) * a);
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

mkdirSync('public', { recursive: true });
for (const size of [192, 512]) writeFileSync(`public/icon-${size}.png`, png(size));
writeFileSync('public/apple-touch-icon.png', png(180));
console.log('icons written to public/');
