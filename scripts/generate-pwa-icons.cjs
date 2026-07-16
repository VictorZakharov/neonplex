const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'src', 'pwa', 'icons');
const SAMPLE_GRID = 3;

const ICONS = [
  { name: 'icon-32.png', size: 32, maskable: false },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
];

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (buffer) => {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
};

const encodePng = (size, pixels) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    scanlines[rowStart] = 0;
    pixels.copy(scanlines, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));

const distanceToSegment = (x, y, x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const projection = clamp(((x - x1) * dx + (y - y1) * dy) / lengthSquared);
  return Math.hypot(x - (x1 + projection * dx), y - (y1 + projection * dy));
};

const sampleColor = (x, y, maskable) => {
  const radius = Math.hypot(x, y);
  const edgeShade = clamp(1 - radius * 0.48);
  const gridX = Math.abs((((x + 1) * 8) % 1) - 0.5);
  const gridY = Math.abs((((y + 1) * 8) % 1) - 0.5);
  const grid = Math.max(gridX > 0.485 ? 1 : 0, gridY > 0.485 ? 1 : 0) * clamp(1 - radius);
  let red = 2 + 3 * edgeShade + grid * 2;
  let green = 8 + 9 * edgeShade + grid * 8;
  let blue = 15 + 16 * edgeShade + grid * 11;

  const markScale = maskable ? 0.76 : 0.9;
  const mx = x / markScale;
  const my = y / markScale;
  const diamondDistance = Math.abs(Math.abs(mx) + Math.abs(my) - 0.67);
  const diamondGlow = Math.exp(-diamondDistance * 25) * clamp(1 - radius * 0.25);
  const diamondLine = clamp(1 - diamondDistance / 0.018);
  const diamondFill = Math.abs(mx) + Math.abs(my) < 0.65 ? 1 : 0;
  red += diamondGlow * 8 + diamondFill * 3;
  green += diamondGlow * 55 + diamondLine * 105 + diamondFill * 10;
  blue += diamondGlow * 80 + diamondLine * 145 + diamondFill * 15;

  const strokes = [
    [-0.31, -0.19, -0.12, 0],
    [-0.19, -0.22, 0.13, 0.1],
    [-0.03, -0.12, 0.25, 0.16],
  ];
  let strokeDistance = Number.POSITIVE_INFINITY;
  for (const stroke of strokes) {
    strokeDistance = Math.min(strokeDistance, distanceToSegment(mx, my, ...stroke));
  }
  const strokeGlow = Math.exp(-strokeDistance * 28);
  const strokeCore = clamp(1 - strokeDistance / 0.035);
  red += strokeGlow * 24 + strokeCore * 45;
  green += strokeGlow * 125 + strokeCore * 120;
  blue += strokeGlow * 165 + strokeCore * 90;

  const cornerGlow = Math.exp(-Math.hypot(x + 0.45, y + 0.5) * 4.2);
  green += cornerGlow * 14;
  blue += cornerGlow * 28;
  return [
    Math.round(clamp(red, 0, 255)),
    Math.round(clamp(green, 0, 255)),
    Math.round(clamp(blue, 0, 255)),
    255,
  ];
};

const renderIcon = (size, maskable) => {
  const pixels = Buffer.alloc(size * size * 4);
  const sampleCount = SAMPLE_GRID * SAMPLE_GRID;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const channels = [0, 0, 0, 0];
      for (let sampleY = 0; sampleY < SAMPLE_GRID; sampleY += 1) {
        for (let sampleX = 0; sampleX < SAMPLE_GRID; sampleX += 1) {
          const nx = ((x + (sampleX + 0.5) / SAMPLE_GRID) / size) * 2 - 1;
          const ny = ((y + (sampleY + 0.5) / SAMPLE_GRID) / size) * 2 - 1;
          const sample = sampleColor(nx, ny, maskable);
          for (let channel = 0; channel < 4; channel += 1) channels[channel] += sample[channel];
        }
      }
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        pixels[offset + channel] = Math.round(channels[channel] / sampleCount);
      }
    }
  }
  return encodePng(size, pixels);
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
for (const icon of ICONS) {
  fs.writeFileSync(path.join(OUTPUT_DIR, icon.name), renderIcon(icon.size, icon.maskable));
}
