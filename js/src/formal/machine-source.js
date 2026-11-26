// Reader filtering and procedure slices retain original line positions.
// Entries remain ordinary strings; provenance is private to the collection.
import { combineOrigins } from '../translation/source-origins.js';

const records = new WeakMap();

class SourceLines extends Array {
  static get [Symbol.species]() {
    return Array;
  }

  slice(...args) {
    const result = super.slice(...args);
    const record = records.get(this);
    return tracked(result, record.source, record.positions.slice(...args));
  }

  filter(keep, receiver) {
    const record = records.get(this);
    const positions = [];
    const result = super.filter((value, index) => {
      if (!keep.call(receiver, value, index, this)) {
        return false;
      }
      positions.push(record.positions[index]);
      return true;
    });
    return tracked(result, record.source, positions);
  }

  map(change, receiver) {
    const result = super.map((value, index) =>
      change.call(receiver, value, index, this)
    );
    const record = records.get(this);
    return tracked(result, record.source, record.positions.slice());
  }

  shift() {
    records.get(this).positions.shift();
    return super.shift();
  }
}

function tracked(text, source, positions) {
  const lines = new SourceLines();
  for (const line of text) {
    lines.push(line);
  }
  records.set(lines, { source, positions });
  return lines;
}

export function sourceLines(source) {
  const lines = source.split('\n').map((line) => line.trim());
  return tracked(
    lines,
    source,
    lines.map((_, index) => index)
  );
}

export function linesOrigin(lines, start, length = 1) {
  const record = records.get(lines);
  return (
    record &&
    combineOrigins(
      record.positions
        .slice(start, start + length)
        .flat()
        .map((line) => ({ source: record.source, lines: [line] }))
    )
  );
}

// A stack spill is omitted from the lifted instruction stream, but its line
// still belongs to the value saved immediately before, or restored after it.
export function includeLine(lines, index, omitted) {
  const record = records.get(lines);
  if (record && index >= 0 && index < lines.length) {
    record.positions[index] = [
      record.positions[index],
      record.positions[omitted],
    ].flat();
  }
}
