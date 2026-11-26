// Partial reading and translation.
//
// A text often holds a part the grammar does not cover yet: one statement
// with an unknown library call, a sentence outside the controlled
// language, a construct the meta language lacks. All-or-nothing
// translation throws the whole text away for that one part. Partial
// translation keeps everything it can read and marks the rest.
//
// The text is cut into parts along its own layout, so the method needs no
// grammar of its own and works for every language:
//
// 1. A part starts at a line and may end before any later line that is
//    indented no deeper than its first line, unless that line only closes
//    or continues the part (`}`, `end`, `else`, ...).
// 2. The shortest such part that reads as a fragment is taken, then
//    extended while the longer part still reads, so an `if` keeps its
//    `else` and neighbouring statements stay together (they share
//    declarations).
// 3. A part that does not read at all is reported with the reason. When
//    it has an indented body (a function or loop whose header the grammar
//    does not know), the header and its closing lines are reported, and the
//    body is read the same way, so its statements still count and translate.
// 4. Between two natural languages a part outside the controlled templates
//    is prose: it is translated freely (`translateProse`), not
//    marked, and is listed in `prose`.

import { sourceSyntax } from './source-syntax.js';
import { captureEmission, emittedMap, recordMapping } from './emission-map.js';
import { languageSyntax } from '../formal/languages.js';
import { splitVersion } from '../formal/versions.js';
import { isNaturalLanguage } from '../natural/catalog.js';

const closers =
  /^\s*(?:[}\])]|end\b|fi\b|done\b|esac\b|else\b|elif\b|elsif\b|elseif\b|until\b|loop\b|wend\b|next\b|catch\b|finally\b|except\b|rescue\b|ensure\b|then\b|begin\b|do\b)/iu;

// How many shortest candidates are tried before a part is given up. Each
// try reads the part, so the limit keeps a long unreadable text linear.
const maxTries = 8;

const indentOf = (line) =>
  /^\s*/u.exec(line)[0].replaceAll('\t', '    ').length;
const blank = (line) => !line.trim();

function dedented(lines) {
  const written = lines.filter((line) => !blank(line));
  const common = Math.min(...written.map(indentOf));
  return `${lines
    .map((line) =>
      blank(line)
        ? ''
        : line.replace(/^\s*/u, (space) =>
            ' '.repeat(
              Math.max(0, space.replaceAll('\t', '    ').length - common)
            )
          )
    )
    .join('\n')}\n`;
}

const firstLine = (message) => String(message).split('\n')[0];

// Errors count lines from the start of the part; count them from the start
// of the whole text instead.
const shiftLines = (message, offset) =>
  firstLine(message).replace(
    /\b(line )(\d+)/gu,
    (_, word, line) => `${word}${Number(line) + offset}`
  );

// Where a part that starts at line `start` may end (exclusive indexes).
function boundaries(lines, start, end) {
  const indent = indentOf(lines[start]);
  const result = [];
  for (let next = start + 1; next <= end; next++) {
    if (next === end) {
      result.push(end);
    } else if (
      !blank(lines[next]) &&
      indentOf(lines[next]) <= indent &&
      !closers.test(lines[next])
    ) {
      // The part ends after its last written line.
      let last = next;
      while (last > start + 1 && blank(lines[last - 1])) {
        last -= 1;
      }
      result.push(last);
    }
  }
  return [...new Set(result)];
}

// The lines a failed part's header opens: those indented deeper than it.
function bodyEnd(lines, start, end) {
  const indent = indentOf(lines[start]);
  let last = start + 1;
  for (let line = start + 1; line < end; line++) {
    if (!blank(lines[line])) {
      if (indentOf(lines[line]) <= indent) {
        break;
      }
      last = line + 1;
    }
  }
  return last;
}

// The parts that could not be read or written, with their reasons.
const errorsOf = (parts) =>
  parts
    .filter((part) => part.status === 'failed')
    .map(({ line, endLine, message, source }) => ({
      line,
      endLine,
      message,
      source,
    }));

// How many written lines the read parts hold.
const linesRead = (lines, parts) =>
  parts
    .filter((part) => part.status === 'read')
    .reduce(
      (sum, part) =>
        sum +
        lines.slice(part.start, part.end).filter((line) => !blank(line)).length,
      0
    );

// The notes of a part left untranslated: the reason, then its source lines.
function untranslated(part) {
  const lines =
    part.endLine > part.line
      ? `lines ${part.line}-${part.endLine}`
      : `line ${part.line}`;
  return [
    `untranslated (${lines}): ${part.message}`,
    ...part.source.replace(/\n$/u, '').split('\n'),
  ];
}

// The parts translated freely, as prose: their first and last lines.
const freeParts = (parts) =>
  parts
    .filter((part) => part.status === 'free')
    .map(({ line, endLine }) => ({ line, endLine }));

// A custom prose translator may join or split sentences. The complete part
// owns its written output, so its region remains many-to-many in that case.
function proseMap(source, target) {
  const targetLines = target.split('\n');
  return source
    .split('\n')
    .flatMap((line, from) =>
      blank(line)
        ? []
        : targetLines.flatMap((line, to) => (blank(line) ? [] : [[from, to]]))
    );
}

function assemblePieces(source, to, parts, pieces) {
  const syntax = isNaturalLanguage(to) ? {} : languageSyntax(to);
  const language = splitVersion(to).id;
  const lineMap = [];
  let targetLine = 0;
  for (const [index, piece] of pieces.entries()) {
    const part = parts[index];
    const lines =
      part.status === 'free'
        ? proseMap(part.source, piece.result)
        : emittedMap(
            piece.emissions,
            part.source,
            piece.result,
            language,
            syntax
          );
    lineMap.push(
      ...lines.map(([from, to]) => [from + part.start, to + targetLine])
    );
    targetLine += piece.result.split('\n').length - 1;
  }
  const text = pieces.map(({ result }) => result).join('');
  recordMapping(source, text, language, lineMap);
  return { text, lineMap };
}

export function createPartialTranslator({
  parseFragment,
  translateFragment,
  writeNotes,
  translateProse = () => undefined,
}) {
  const read = (lines, from, offset) => {
    try {
      return { ok: true, kind: parseFragment(dedented(lines), from).kind };
    } catch (error) {
      return { ok: false, message: shiftLines(error.message, offset) };
    }
  };

  function segments(lines, from, start, end) {
    const parts = [];
    let line = start;
    while (line < end) {
      if (blank(lines[line])) {
        line += 1;
        continue;
      }
      const candidates = boundaries(lines, line, end);
      let found;
      let firstFailure;
      for (const candidate of candidates.slice(0, maxTries)) {
        const result = read(lines.slice(line, candidate), from, line);
        if (result.ok) {
          found = { end: candidate, kind: result.kind };
          break;
        }
        firstFailure ??= result.message;
      }
      if (found) {
        // Extend while the longer part still reads.
        for (const candidate of candidates.filter((at) => at > found.end)) {
          const result = read(lines.slice(line, candidate), from, line);
          if (!result.ok) {
            break;
          }
          found = { end: candidate, kind: result.kind };
        }
        parts.push({
          start: line,
          end: found.end,
          status: 'read',
          kind: found.kind,
        });
        line = found.end;
        continue;
      }
      const partEnd = candidates[0];
      const inner = bodyEnd(lines, line, partEnd);
      if (inner - line > 1 && partEnd - line > 1) {
        parts.push({
          start: line,
          end: line + 1,
          status: 'failed',
          message: firstFailure,
        });
        parts.push(...segments(lines, from, line + 1, inner));
        if (lines.slice(inner, partEnd).some((text) => !blank(text))) {
          parts.push({
            start: inner,
            end: partEnd,
            status: 'failed',
            message: `closes the part that starts on line ${line + 1}`,
          });
        }
      } else {
        parts.push({
          start: line,
          end: partEnd,
          status: 'failed',
          message: firstFailure,
        });
      }
      line = partEnd;
    }
    return parts;
  }

  // Read as much of a text as the grammar covers.
  function parsePartial(source, from) {
    const lines = source
      .replaceAll('\r\n', '\n')
      .replace(/\n+$/u, '')
      .split('\n');
    const written = lines.filter((line) => !blank(line)).length;
    let parts;
    try {
      const { kind } = parseFragment(source, from);
      parts = [{ start: 0, end: lines.length, status: 'read', kind }];
    } catch (error) {
      parts = segments(lines, from, 0, lines.length);
      if (!parts.length && written) {
        throw error;
      }
    }
    const readLines = linesRead(lines, parts);
    const located = parts.map((part) => ({
      ...part,
      line: part.start + 1,
      endLine: part.end,
      source: dedented(lines.slice(part.start, part.end)),
    }));
    return {
      complete: located.every((part) => part.status === 'read'),
      parts: located,
      lines: written,
      readLines,
      coverage: written ? readLines / written : 1,
      errors: errorsOf(located),
      syntax: sourceSyntax(source, from, undefined, located),
    };
  }

  // Translate what can be read; every other part becomes a comment in the
  // target that holds the reason and the original text.
  function translatePartial(source, from, to, options = {}) {
    const reading = parsePartial(source, from);
    const pieces = reading.parts.map((part) =>
      captureEmission(() => {
        if (part.status === 'read') {
          try {
            return translateFragment(part.source, from, to, options);
          } catch (error) {
            // A part may read but not be writable in the target.
            part.status = 'failed';
            part.message = shiftLines(error.message, part.start);
          }
        }
        const prose = translateProse(part.source, from, to, options);
        if (prose !== undefined) {
          part.status = 'free';
          return prose;
        }
        return writeNotes(untranslated(part), to, part.source);
      })
    );
    const mapped = assemblePieces(source, to, reading.parts, pieces);
    const errors = errorsOf(reading.parts);
    return {
      ...mapped,
      complete: errors.length === 0,
      errors,
      lines: reading.lines,
      readLines: reading.readLines,
      coverage: reading.coverage,
      prose: freeParts(reading.parts),
    };
  }

  return { parsePartial, translatePartial };
}
