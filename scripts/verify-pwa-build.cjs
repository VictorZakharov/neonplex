const fs = require('node:fs');
const path = require('node:path');

const DIST = path.resolve(__dirname, '..', 'dist');

const fail = (message) => {
  throw new Error(`PWA build verification failed: ${message}`);
};

const requireFile = (relativePath) => {
  const absolutePath = path.join(DIST, relativePath);
  if (!fs.existsSync(absolutePath)) fail(`missing ${relativePath}`);
  return absolutePath;
};

const readPngSize = (relativePath) => {
  const contents = fs.readFileSync(requireFile(relativePath));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!contents.subarray(0, 8).equals(signature)) fail(`${relativePath} is not a PNG`);
  return [contents.readUInt32BE(16), contents.readUInt32BE(20)];
};

const assertPngSize = (relativePath, expectedSize) => {
  const [width, height] = readPngSize(relativePath);
  if (width !== expectedSize || height !== expectedSize) {
    fail(`${relativePath} has unexpected dimensions ${width}x${height}`);
  }
};

const manifest = JSON.parse(fs.readFileSync(requireFile('manifest.webmanifest'), 'utf8'));
for (const field of ['id', 'start_url', 'scope']) {
  if (manifest[field] !== './') fail(`manifest ${field} must remain relative`);
}
if (manifest.display !== 'standalone') fail('manifest must launch in standalone display mode');
if (manifest.name !== 'Neonplex' || manifest.short_name !== 'Neonplex') {
  fail('manifest must preserve the Neonplex install identity');
}
if (manifest.prefer_related_applications !== false) {
  fail('manifest must prefer this web app instead of a related native app');
}
if (manifest.theme_color !== '#050912' || manifest.background_color !== '#02050b') {
  fail('manifest colors must match the application shell');
}

const expectedIcons = new Map([
  ['./icons/icon-192.png', { purpose: 'any', size: 192, sizes: '192x192' }],
  ['./icons/icon-512.png', { purpose: 'any', size: 512, sizes: '512x512' }],
  ['./icons/icon-maskable-512.png', { purpose: 'maskable', size: 512, sizes: '512x512' }],
]);
for (const icon of manifest.icons ?? []) {
  const expected = expectedIcons.get(icon.src);
  if (expected === undefined) continue;
  if (
    icon.type !== 'image/png' ||
    icon.sizes !== expected.sizes ||
    icon.purpose !== expected.purpose
  ) {
    fail(`${icon.src} has invalid manifest metadata`);
  }
  assertPngSize(icon.src.slice(2), expected.size);
  expectedIcons.delete(icon.src);
}
if (expectedIcons.size > 0) fail(`manifest is missing ${[...expectedIcons.keys()].join(', ')}`);

const html = fs.readFileSync(requireFile('index.html'), 'utf8');
for (const reference of [
  './manifest.webmanifest',
  './icons/icon-32.png',
  './icons/apple-touch-icon.png',
]) {
  if (!html.includes(reference)) fail(`index.html does not reference ${reference}`);
}

const serviceWorker = fs.readFileSync(requireFile('service-worker.js'), 'utf8');
const precachedAssets = fs
  .readdirSync(DIST, { recursive: true })
  .filter((entry) => typeof entry === 'string')
  .map((entry) => entry.replaceAll('\\', '/'))
  .filter(
    (entry) =>
      !entry.endsWith('.map') &&
      entry !== 'service-worker.js' &&
      fs.statSync(path.join(DIST, entry)).isFile(),
  );
for (const asset of precachedAssets) {
  if (!serviceWorker.includes(asset)) fail(`service worker does not precache ${asset}`);
}
const sourceMaps = fs
  .readdirSync(DIST, { recursive: true })
  .filter((entry) => typeof entry === 'string' && entry.endsWith('.map'))
  .map((entry) => entry.replaceAll('\\', '/'));
for (const sourceMap of sourceMaps) {
  if (serviceWorker.includes(`url:"${sourceMap}"`)) {
    fail(`service worker must not precache ${sourceMap}`);
  }
}

assertPngSize('icons/icon-32.png', 32);
assertPngSize('icons/apple-touch-icon.png', 180);
console.log(`Verified installable PWA shell with ${precachedAssets.length} precached assets.`);
