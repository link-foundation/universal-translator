import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { chunkFor } from '../../examples/universal-app/chunk-groups.js';

function chunkDependencies() {
  const root = resolve('js/src');
  const graph = new Map();
  for (const entry of readdirSync(root, { recursive: true })) {
    if (!entry.endsWith('.js')) {
      continue;
    }
    const file = resolve(root, entry);
    const group = chunkFor(file);
    const dependencies = graph.get(group) ?? new Set();
    graph.set(group, dependencies);
    const source = readFileSync(file, 'utf8');
    const imports = source.matchAll(
      /(?:\bfrom\s*|\bimport\s*\(\s*)['"](?<path>\.[^'"]+)['"]/gu
    );
    for (const imported of imports) {
      const target = chunkFor(resolve(dirname(file), imported.groups.path));
      if (target && target !== group) {
        dependencies.add(target);
      }
    }
  }
  return graph;
}

it('keeps translator production chunks free of dependency cycles', () => {
  const graph = chunkDependencies();
  function visit(group, parents) {
    assert.ok(!parents.includes(group), parents.concat(group).join(' -> '));
    for (const dependency of graph.get(group) ?? []) {
      visit(dependency, parents.concat(group));
    }
  }
  for (const group of graph.keys()) {
    visit(group, []);
  }
});
