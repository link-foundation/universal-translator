// The decorator API: every replaceable stage of the translation pipeline
// (parser, readers, emitters) can be wrapped. A decorator is a function that
// receives the inner implementation of a stage and returns a wrapped one, so
// it can log calls, rewrite inputs or outputs, cache or fall back. Decorators
// of one stage compose in the order they are given: the last one wraps all
// the earlier ones, so it sees the input first and the output last.
//
// The Rust twin is rust/src/stages.rs.

export const stageNames = [
  'parse',
  'infer',
  'lift',
  'readMachine',
  'readNatural',
  'emit',
  'emitMachineCode',
  'writeNatural',
];

const asList = (decorators) =>
  Array.isArray(decorators) ? decorators : [decorators];

// Wrap one stage with decorators, the first listed innermost.
export function decorateStage(stage, inner, decorators) {
  return asList(decorators).reduce((current, decorator) => {
    if (typeof decorator !== 'function') {
      throw new TypeError(`A decorator of "${stage}" must be a function`);
    }
    const wrapped = decorator(current);
    if (typeof wrapped !== 'function') {
      throw new TypeError(`A decorator of "${stage}" must return a function`);
    }
    return wrapped;
  }, inner);
}

// The stages with all their decorators: `decorate` maps a stage name to a
// decorator or to a list of decorators.
export function decorateStages(stages, decorate = {}) {
  for (const stage of Object.keys(decorate)) {
    if (!stageNames.includes(stage)) {
      throw new Error(
        `Unknown stage "${stage}" (stages: ${stageNames.join(', ')})`
      );
    }
  }
  return Object.fromEntries(
    Object.entries(stages).map(([stage, inner]) => [
      stage,
      decorate[stage] ? decorateStage(stage, inner, decorate[stage]) : inner,
    ])
  );
}

// The decorators of two settings, the later ones after the earlier ones.
export function mergeDecorators(earlier = {}, later = {}) {
  const merged = { ...earlier };
  for (const [stage, decorators] of Object.entries(later)) {
    merged[stage] = [
      ...(earlier[stage] === undefined ? [] : asList(earlier[stage])),
      ...asList(decorators),
    ];
  }
  return merged;
}
