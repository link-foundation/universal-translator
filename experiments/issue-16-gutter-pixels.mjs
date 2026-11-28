import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PNG } = require('../node_modules/playwright-core/lib/utilsBundle.js');
const [file, ...coordinates] = process.argv.slice(2);
const [x, y, width, height] = coordinates.map(Number);
assert.ok(file && coordinates.length === 4, 'Pass a PNG and x y width height');
assert.ok(
  coordinates.every((value) => /^\d+$/u.test(value)) && width && height
);
const image = PNG.sync.read(readFileSync(file));
assert.ok(x + width <= image.width && y + height <= image.height);

const counts = new Map();
for (let row = y; row < y + height; row++) {
  for (let column = x; column < x + width; column++) {
    const offset = (row * image.width + column) * 4;
    const color = image.data.subarray(offset, offset + 4).toString('hex');
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
}
console.log(
  JSON.stringify({ x, y, width, height, colors: Object.fromEntries(counts) })
);
