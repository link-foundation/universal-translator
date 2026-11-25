// Verbose output for finding out what the demo does, off by default: open
// the page with "?debug" (or set localStorage "universal-translator.debug"
// to "1") and every translation, detection, highlighting, skin and editor
// step is written to the console with its timing.

const enabled = (() => {
  try {
    return (
      new URLSearchParams(globalThis.location?.search ?? '').has('debug') ||
      globalThis.localStorage?.getItem('universal-translator.debug') === '1'
    );
  } catch {
    return false;
  }
})();

export const debugging = () => enabled;

export function debug(topic, ...details) {
  if (enabled) {
    console.debug(`[universal-translator:${topic}]`, ...details);
  }
}

// The result of `run`, with how long it took when debugging.
export function timed(topic, label, run) {
  if (!enabled) {
    return run();
  }
  const start = globalThis.performance?.now() ?? Date.now();
  const result = run();
  const took = (globalThis.performance?.now() ?? Date.now()) - start;
  debug(topic, label, `${took.toFixed(1)} ms`, result);
  return result;
}
