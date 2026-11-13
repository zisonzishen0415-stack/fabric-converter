// 生成 tools/app.ico（Nord 配色的计算器图标）
// 用法：node tools/icon.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const S = 1024, OUT = 256, SS = S / OUT;   // 先画 1024 再降采样，得到平滑边缘

// Nord
const n0 = [0x2e, 0x34, 0x40], n2 = [0x43, 0x4c, 0x5e], n3 = [0x4c, 0x56, 0x6a];
const n4 = [0xd8, 0xde, 0xe9], n8 = [0x88, 0xc0, 0xd0], n10 = [0x5e, 0x81, 0xac];

const buf = new Float32Array(S * S * 4);   // RGBA，0..255

function blend(x, y, c, a) {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  buf[i]     = buf[i]     * (1 - a) + c[0] * a;
  buf[i + 1] = buf[i + 1] * (1 - a) + c[1] * a;
  buf[i + 2] = buf[i + 2] * (1 - a) + c[2] * a;
  buf[i + 3] = buf[i + 3] * (1 - a) + 255 * a;
}
function roundRect(x0, y0, w, h, r, c) {
  const cx = x0 + w / 2, cy = y0 + h / 2;
  for (let y = Math.floor(y0); y < Math.ceil(y0 + h); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x++) {
      const dx = Math.max(Math.abs(x + 0.5 - cx) - (w / 2 - r), 0);
      const dy = Math.max(Math.abs(y + 0.5 - cy) - (h / 2 - r), 0);
      if (dx * dx + dy * dy <= r * r) blend(x, y, c, 1);
    }
  }
}

// 机身
roundRect(40, 40, 944, 944, 190, n2);
// 机身描边（比机身深一档，做出实体感）
roundRect(40, 40, 944, 944, 190, n3);
roundRect(64, 64, 896, 896, 168, n2);
// 屏幕
roundRect(112, 112, 800, 300, 56, n0);
// 屏幕里的数字（两根 Frost 色的数位条）
roundRect(600, 168, 250, 56, 24, n8);
roundRect(600, 300, 250, 56, 24, n8);
roundRect(300, 168, 250, 56, 24, n10);
// 键盘 3×3
const keyW = 200, keyH = 150, gapX = 60, gapY = 40, kx = 112, ky = 470;
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) {
    const accent = row === 2 && col === 2;
    roundRect(kx + col * (keyW + gapX), ky + row * (keyH + gapY), keyW, keyH, 44,
      accent ? n8 : n4);
  }
}

// 降采样
const w = OUT, h = OUT, px = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = ((y * SS + sy) * S + (x * SS + sx)) * 4;
        const al = buf[i + 3] / 255;
        r += buf[i] * al; g += buf[i + 1] * al; b += buf[i + 2] * al; a += al;
      }
    }
    const n = SS * SS, o = (y * w + x) * 4;
    const al = a / n;
    px[o]     = al > 0 ? Math.round(r / a) : 0;
    px[o + 1] = al > 0 ? Math.round(g / a) : 0;
    px[o + 2] = al > 0 ? Math.round(b / a) : 0;
    px[o + 3] = Math.round(al * 255);
  }
}

// --- 最小 PNG 编码器 ---
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const raw = Buffer.alloc((w * 4 + 1) * h);
for (let y = 0; y < h; y++) {
  raw[y * (w * 4 + 1)] = 0;                                   // filter: none
  px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8bit RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]);

// --- ICO 包装（单张 256×256 PNG）---
const dir = Buffer.alloc(6);
dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(1, 4);
const ent = Buffer.alloc(16);
ent[0] = 0; ent[1] = 0; ent[2] = 0; ent[3] = 0;                 // 0 = 256
ent.writeUInt16LE(1, 4);                                       // planes
ent.writeUInt16LE(32, 6);                                      // bpp
ent.writeUInt32LE(png.length, 8);
ent.writeUInt32LE(22, 12);

mkdirSync(resolve(HERE), { recursive: true });
writeFileSync(resolve(HERE, 'app.ico'), Buffer.concat([dir, ent, png]));
writeFileSync(resolve(HERE, 'app-preview.png'), png);
console.log('wrote tools/app.ico (' + (png.length + 22) + ' bytes)');
