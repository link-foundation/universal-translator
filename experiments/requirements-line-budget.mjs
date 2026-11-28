#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const [file, ...extra] = process.argv.slice(2);
if (!file || extra.length) {
  console.error('Usage: node experiments/requirements-line-budget.mjs FILE');
  process.exit(2);
}

try {
  const source = readFileSync(file, 'utf8');
  const lines =
    source.split('\n').length - Number(source.endsWith('\n') || !source);
  console.log(`${lines} physical lines (maximum 1500)`);
  process.exitCode = Number(lines > 1500);
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
