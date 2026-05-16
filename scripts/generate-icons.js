// Pure Node.js PNG icon generator — brick wall design, no external deps
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
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit depth per channel
  ihdr[9] = 2; // RGB color type

  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter byte: None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = drawPixel(x, y, size);
      raw[y * rowSize + 1 + x * 3]     = r;
      raw[y * rowSize + 1 + x * 3 + 1] = g;
      raw[y * rowSize + 1 + x * 3 + 2] = b;
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Brick wall pixel renderer
// - Staggered rows (classic running-bond pattern)
// - Cream mortar joints
// - 3-D bevel: highlight top-left, shadow bottom-right
// - Subtle per-brick tint so adjacent bricks look distinct
function drawBrickWall(x, y, size) {
  const mortar = Math.max(2, Math.round(size * 0.019)); // ~10 px at 512
  const brickW = Math.round((size - 5 * mortar) / 4);  // 4 bricks across
  const brickH = Math.round(brickW * 0.44);             // classic 2.25:1 ratio
  const rowH   = brickH + mortar;
  const bevel  = Math.max(1, Math.round(size * 0.007)); // ~3-4 px at 512

  const row    = Math.floor(y / rowH);
  const inRowY = y - row * rowH;

  // Horizontal mortar joint — warm cream #FFF5E6
  if (inRowY >= brickH) return [255, 245, 230];

  // Running-bond stagger: odd rows shift right by half a cell
  const halfStep = Math.round((brickW + mortar) / 2);
  const offset   = row % 2 === 0 ? 0 : halfStep;
  const cellW    = brickW + mortar;
  const inColX   = ((x + offset) % cellW + cellW) % cellW;

  // Vertical mortar joint
  if (inColX >= brickW) return [255, 245, 230];

  // Bevel highlights/shadows for 3-D look
  if (inRowY < bevel || inColX < bevel)                    return [251, 146, 60]; // #FB923C highlight
  if (inRowY >= brickH - bevel || inColX >= brickW - bevel) return [154,  52, 18]; // #9A3412 shadow

  // Subtle per-brick tint: vary the red channel by ±10 so bricks look handmade
  const col   = Math.floor((x + offset) / cellW);
  const shift = ((row * 3 + col * 7) % 5) - 2; // range −2..+2
  return [
    Math.min(255, Math.max(0, 224 + shift * 5)), // R: ~204..244
    Math.min(255, Math.max(0,  72 + shift * 2)), // G
    10,                                           // B
  ];
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const png  = makePNG(size, drawBrickWall);
  const dest = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(dest, png);
  console.log(`icon-${size}.png  (${png.length} bytes)`);
}

// Maskable icon: same brick pattern full-bleed (Android safe zone = inner 80%)
const maskable = makePNG(512, drawBrickWall);
fs.writeFileSync(path.join(outDir, 'maskable-512.png'), maskable);
console.log('maskable-512.png  (full-bleed)');
console.log('\nDone — icons written to public/icons/');
