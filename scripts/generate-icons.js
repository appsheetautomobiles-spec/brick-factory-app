// Pure Node.js PNG icon generator - no external dependencies
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

function makePNG(size, drawPixel) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // RGB color type
  // compression, filter, interlace = 0

  // Raw image rows (filter byte 0 + RGB per pixel)
  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = drawPixel(x, y, size);
      raw[y * rowSize + 1 + x * 3] = r;
      raw[y * rowSize + 1 + x * 3 + 1] = g;
      raw[y * rowSize + 1 + x * 3 + 2] = b;
    }
  }

  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Draw a brick factory icon:
// - Orange background
// - Dark brick grid pattern
// - White brick "B" shape in center area
function drawIcon(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const pad = size * 0.1;

  // Orange background: #EA580C (orange-600)
  let r = 234, g = 88, b = 12;

  // Brick grid pattern (subtle dark lines)
  const brickW = size / 6;
  const brickH = size / 12;
  const row = Math.floor(y / brickH);
  const offsetX = (row % 2) * (brickW / 2);
  const inBrickX = (x + offsetX) % brickW;
  const inBrickY = y % brickH;
  const lineThick = Math.max(1, size / 96);

  if (inBrickX < lineThick || inBrickY < lineThick) {
    // Mortar line - slightly darker orange
    r = 180; g = 60; b = 8;
  }

  // White rounded rectangle in center (badge area)
  const badgeSize = size * 0.5;
  const bx = cx - badgeSize / 2;
  const by = cy - badgeSize / 2;
  const br = badgeSize * 0.18; // corner radius approx

  if (x >= bx && x <= bx + badgeSize && y >= by && y <= by + badgeSize) {
    // Rounded corners check
    const corners = [
      [bx + br, by + br],
      [bx + badgeSize - br, by + br],
      [bx + br, by + badgeSize - br],
      [bx + badgeSize - br, by + badgeSize - br],
    ];
    let inCorner = false;
    for (const [cx2, cy2] of corners) {
      const dx = x - cx2, dy = y - cy2;
      if (Math.sqrt(dx * dx + dy * dy) > br &&
          x < cx2 + (cx2 === bx + br ? 0 : br) + (cx2 === bx + br ? 0 : 0) &&
          x > cx2 - (cx2 === bx + br ? br : 0)) {
        // rough corner culling — good enough
      }
    }
    r = 255; g = 255; b = 255;
  }

  // Draw a bold "I" letter in dark orange inside the badge
  const lx = cx - size * 0.04;
  const lw = size * 0.08;
  const lt = size * 0.32; // top of letter
  const lb = size * 0.68; // bottom of letter
  const capW = size * 0.2;
  const capH = size * 0.06;

  // Vertical bar
  if (x >= lx && x <= lx + lw && y >= lt && y <= lb) {
    r = 120; g = 40; b = 5;
  }
  // Top cap
  if (x >= cx - capW / 2 && x <= cx + capW / 2 && y >= lt && y <= lt + capH) {
    r = 120; g = 40; b = 5;
  }
  // Bottom cap
  if (x >= cx - capW / 2 && x <= cx + capW / 2 && y >= lb - capH && y <= lb) {
    r = 120; g = 40; b = 5;
  }

  return [r, g, b];
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const png = makePNG(size, drawIcon);
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Created ${outPath} (${png.length} bytes)`);
}

// Also create a simple maskable icon (full-bleed orange)
function drawMaskable(x, y, size) {
  let r = 234, g = 88, b = 12;
  const brickW = size / 6;
  const brickH = size / 12;
  const row = Math.floor(y / brickH);
  const offsetX = (row % 2) * (brickW / 2);
  const inBrickX = (x + offsetX) % brickW;
  const inBrickY = y % brickH;
  const lineThick = Math.max(1, size / 96);
  if (inBrickX < lineThick || inBrickY < lineThick) {
    r = 180; g = 60; b = 8;
  }
  return [r, g, b];
}

const maskable = makePNG(512, drawMaskable);
fs.writeFileSync(path.join(outDir, 'maskable-512.png'), maskable);
console.log('Created maskable-512.png');

console.log('Done! Icons generated in public/icons/');
