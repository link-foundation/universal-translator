// Fragments: a whole program, one or more function definitions, or one or
// more statements, read and written on their own.
//
// A fragment must be complete: a function ends with its closing, a block
// statement with its end, and a single line statement is a whole statement.
//
// Reading needs no grammar of its own. The source language writes its own
// program shape around a marker (a main block holding a marker comment, or
// a final function announced by a marker comment), the fragment replaces
// the marker, and the whole text is parsed like any program. Writing works
// the same way backwards: the target writes a program whose statements or
// functions lie between two marker comments, and the text between the
// markers is the fragment.

import { block, laterCalls, node, number, sameMeaning } from '../meta/tree.js';
import { inferTypes } from '../meta/types.js';
import { emitProgram } from '../formal/emitter.js';
import { declaredVariables } from '../formal/dialects/shared.js';
import { languageSyntax } from '../formal/languages.js';
import { machineTargetIds } from '../formal/machine.js';
import { isNaturalLanguage } from '../natural/catalog.js';
import { remapOrigins } from './source-origins.js';

export const fragmentKinds = ['program', 'functions', 'statements'];

const marker = 'universal-translator-fragment';
const startMarker = `${marker}-start`;
const endMarker = `${marker}-end`;

const comment = (text) => node('Comment', { text });

const program = ({ functions = [], statements = [], comments = [] } = {}) =>
  node('Program', {
    comments,
    imports: [],
    functions,
    main: block(statements),
  });

// A function that closes the wrapper: the fragment's functions stand before
// it, and the marker comment above it shows where they go.
const closingFunction = (comments) =>
  inferTypes(
    program({
      functions: [
        node('Function', {
          name: 'fragmentEnd',
          parameters: [],
          returnType: 'integer',
          body: block([node('Return', { value: number(0) })]),
          comments,
        }),
      ],
    })
  ).functions[0];

const leadingSpace = (line) => /^\s*/.exec(line)[0];

// Lines without their common indentation and without blank lines around.
function dedent(lines) {
  const trimmed = [...lines];
  while (trimmed.length && !trimmed[0].trim()) {
    trimmed.shift();
  }
  while (trimmed.length && !trimmed.at(-1).trim()) {
    trimmed.pop();
  }
  const written = trimmed.filter((line) => line.trim());
  const common = Math.min(...written.map((line) => leadingSpace(line).length));
  return trimmed.map((line) => (line.trim() ? line.slice(common) : ''));
}

const sourceLines = (source) =>
  source.replaceAll('\r\n', '\n').replace(/\n+$/, '').split('\n');

const markerLine = (lines, text) =>
  lines.findIndex((line) => line.includes(text));

// A variable that the declarations wrapper declares, to find where the
// language writes its declarations.
const markerVariable = 'fragmentVariable';

// The source language's program around a marker, and where the fragment
// goes: statements replace the marker line, functions stand above it. The
// declarations wrapper also declares a variable; where the language writes
// declarations apart from the statements (Pascal, Fortran, Ada), the
// fragment's declarations go below that declaration.
const wrappers = new Map();
function wrapper(from, kind) {
  const key = `${from} ${kind}`;
  if (!wrappers.has(key)) {
    const shapes = {
      statements: () => program({ statements: [comment(marker)] }),
      declarations: () =>
        inferTypes(
          program({
            statements: [
              node('Declaration', {
                name: markerVariable,
                value: number(0),
                mutable: true,
              }),
              comment(marker),
            ],
          })
        ),
      functions: () => program({ functions: [closingFunction([marker])] }),
    };
    const lines = sourceLines(emitProgram(shapes[kind](), from));
    const at = markerLine(lines, marker);
    const declared = lines
      .slice(0, at)
      .flatMap((line, index) => (line.includes(markerVariable) ? [index] : []));
    wrappers.set(key, {
      lines,
      at,
      // The line that declares the variable apart from its first value.
      declaration: declared.length > 1 ? declared[0] : -1,
    });
  }
  return wrappers.get(key);
}

const indented = (lines, indent) =>
  lines.map((line) =>
    line.text ? { ...line, text: `${indent}${line.text}` } : line
  );

// The wrapped fragment and, for each of its lines, the fragment line it
// comes from. Undefined when the kind does not apply to the language or the
// fragment.
function wrap(source, from, kind) {
  const { lines, at, declaration } = wrapper(from, kind);
  const all = sourceLines(source);
  const leading = all.findIndex((line) => line.trim());
  const fragment = (source.trim() ? dedent(all) : []).map((text, index) => ({
    text,
    origin: leading + index + 1,
  }));
  const own = (part) => part.map((text) => ({ text }));
  const indent = (index) => leadingSpace(lines[index]);
  let parts;
  if (kind === 'declarations') {
    // The declarations end at the first blank line of the fragment.
    const blank = fragment.length
      ? fragment.findIndex((line) => !line.text)
      : 0;
    if (declaration < 0 || blank < 0) {
      return undefined;
    }
    const body = fragment.findIndex(
      (line, index) => index > blank && line.text
    );
    parts = [
      ...own(lines.slice(0, declaration + 1)),
      ...indented(fragment.slice(0, blank), indent(declaration)),
      ...own(lines.slice(declaration + 1, at)),
      ...indented(body < 0 ? [] : fragment.slice(body), indent(at)),
      ...own(lines.slice(at + 1)),
    ];
  } else {
    parts = [
      ...own(lines.slice(0, at)),
      ...indented(fragment, indent(at)),
      ...own(lines.slice(kind === 'statements' ? at + 1 : at)),
    ];
  }
  return {
    text: `${parts.map((line) => line.text).join('\n')}\n`,
    origins: parts.map((line) => line.origin),
  };
}

// The fragment line of each line of the fragment read as it is.
const ownOrigins = (source) =>
  sourceLines(source).map((line, index) => index + 1);

// A syntax error reported at its line in the fragment. An error past the
// last line of the fragment lies in the closing of the wrapper: the
// fragment ended before something it opened was closed.
function fragmentLine(error, origins, count) {
  const match = /^(.*) \(line (\d+)\)$/s.exec(error.message);
  if (!match) {
    return { message: error.message, line: 0 };
  }
  const at = Number(match[2]) - 1;
  const last = origins.findLastIndex((origin) => origin !== undefined);
  if (at > last) {
    return {
      message: `it ends before its closing (line ${count})`,
      line: count + 1,
    };
  }
  const line =
    origins.slice(0, at + 1).findLast((origin) => origin !== undefined) ?? 1;
  return { message: `${match[1]} (line ${line})`, line };
}

// An identifier as a whole word, or with the underscore that Fortran adds
// to a name it reserves.
const holdsName = (line, identifier) =>
  new RegExp(`(^|[^A-Za-z0-9_$])${identifier}_?([^A-Za-z0-9_$]|$)`).test(line);

// Languages that declare every variable before the first statement (Pascal,
// Fortran, Ada) write the declarations of a statements fragment above it:
// the lines that the statements add to the empty program and that name a
// declared variable, with a one word heading above them (Pascal's var).
function declarationLines(lines, emptyLines, declared) {
  const empty = new Set(emptyLines);
  const added = (line) => line.trim() && !empty.has(line);
  const chosen = lines.map(
    (line) =>
      added(line) && declared.some((identifier) => holdsName(line, identifier))
  );
  return lines.filter(
    (line, index) =>
      chosen[index] ||
      (added(line) && /^\s*[A-Za-z0-9_]+$/.test(line) && chosen[index + 1])
  );
}

const notComplete = (message) =>
  new Error(`The fragment is not complete: ${message}`);

// What a whole program read from the source holds.
function programKind(meta) {
  const hasFunctions = meta.functions.length > 0;
  const hasStatements = meta.main.statements.some(
    (statement) => statement.kind !== 'Comment'
  );
  // A main function or procedure makes the source a program even when it
  // is empty.
  if (meta.mainComments !== undefined || (hasFunctions && hasStatements)) {
    return 'program';
  }
  if (hasFunctions) {
    return 'functions';
  }
  return hasStatements ? 'statements' : undefined;
}

// The fragment of a wrapped program, or a reason why the wrapper changed
// shape (the fragment closed a block it did not open).
function unwrap(meta, empty, kind) {
  if (kind !== 'functions') {
    if (
      meta.functions.length !== empty.functions.length ||
      !sameMeaning(meta.functions, empty.functions)
    ) {
      return { problem: 'it closes the block around it' };
    }
    const statements = [
      ...meta.comments.map(comment),
      ...meta.main.statements.slice(empty.main.statements.length),
    ];
    return statements.some((statement) => statement.kind !== 'Comment')
      ? { fragment: program({ statements }) }
      : { problem: 'it holds no statement' };
  }
  const closing = meta.functions.at(-1);
  if (
    meta.functions.length <= empty.functions.length ||
    !sameMeaning(closing, empty.functions.at(-1)) ||
    !sameMeaning(meta.main, empty.main)
  ) {
    return { problem: 'it holds no complete function definition' };
  }
  return {
    fragment: program({
      functions: meta.functions.slice(0, -1),
      comments: meta.comments,
    }),
  };
}

// The lines before the start marker of the same program without its
// statements.
function emptyLines(shape, to, emit) {
  const lines = sourceLines(
    emit({ ...shape, main: block([comment(startMarker)]) }, to)
  );
  return lines.slice(0, markerLine(lines, startMarker));
}

// The adapted fragment written in the target, between marker comments.
function writeBetweenMarkers(adapted, kind, to, emit) {
  const comments = (adapted.comments ?? []).map(comment);
  const shape =
    kind === 'statements'
      ? {
          ...adapted,
          comments: [],
          mainComments: [],
          functions: [],
          main: block([
            comment(startMarker),
            ...comments,
            ...adapted.main.statements,
            comment(endMarker),
          ]),
        }
      : {
          ...adapted,
          comments: [],
          mainComments: [],
          main: block(),
          functions: [
            ...adapted.functions.map((item, index) =>
              index === 0
                ? {
                    ...item,
                    comments: [
                      startMarker,
                      ...(adapted.comments ?? []),
                      ...(item.comments ?? []),
                    ],
                  }
                : item
            ),
            closingFunction([endMarker]),
          ],
        };
  const lines = sourceLines(emit(shape, to));
  const start = markerLine(lines, startMarker);
  const end = markerLine(lines, endMarker);
  if (start < 0 || end < start) {
    throw new Error(`${to} cannot write ${kind} on their own`);
  }
  const inner = lines.slice(start + 1, end);
  if (kind === 'statements') {
    const declarations = declarationLines(
      lines.slice(0, start),
      emptyLines(shape, to, emit),
      [...declaredVariables(adapted.main).keys()]
    );
    const parts = declarations.length
      ? [...dedent(declarations), '', ...dedent(inner)]
      : dedent(inner);
    return `${parts.join('\n')}\n`;
  }
  // Languages that read from top to bottom announce a function called
  // before its definition; the announcements belong to the fragment.
  const announced = laterCalls(adapted.functions).map((item) => item.name);
  const announcements = lines
    .slice(0, start)
    .filter((line) =>
      announced.some((identifier) => holdsName(line, identifier))
    );
  const parts = announcements.length
    ? [...dedent(announcements), '', ...dedent(inner)]
    : dedent(inner);
  return `${parts.join('\n')}\n`;
}

export function createFragmentTranslator({ toMeta, adapt, write, emit }) {
  const emptyWrappers = new Map();
  function emptyWrapper(from, kind) {
    const key = `${from} ${kind}`;
    if (!emptyWrappers.has(key)) {
      emptyWrappers.set(key, toMeta(wrap('', from, kind).text, from));
    }
    return emptyWrappers.get(key);
  }

  // Read a fragment into { kind, program }: the source as a whole program
  // first, then as function definitions, then as statements.
  function parseFragment(source, from) {
    if (!source.trim()) {
      throw new Error('The fragment is empty');
    }
    if (isNaturalLanguage(from) || machineTargetIds.includes(from)) {
      // Words are read sentence by sentence and need no wrapper; machine
      // code is read as whole programs only.
      const meta = toMeta(source, from);
      const kind = machineTargetIds.includes(from)
        ? 'program'
        : programKind(meta);
      if (!kind) {
        throw new Error('The fragment holds no statement or function');
      }
      return { kind, program: meta };
    }
    languageSyntax(from);
    const count = sourceLines(source).findLastIndex((line) => line.trim()) + 1;
    const failures = [];
    try {
      const meta = toMeta(source, from);
      const kind = programKind(meta);
      if (kind) {
        return { kind, program: meta };
      }
      failures.push({ message: 'it holds no statement or function', line: 0 });
    } catch (error) {
      failures.push(fragmentLine(error, ownOrigins(source), count));
    }
    // Statements with their declarations above them (Pascal's var block)
    // are read last; plain statements are the most general reading, so
    // their failure comes last.
    let statementsFailure;
    for (const kind of ['functions', 'statements', 'declarations']) {
      const wrapped = wrap(source, from, kind);
      if (!wrapped) {
        continue;
      }
      let failure;
      try {
        const result = unwrap(
          toMeta(wrapped.text, from),
          emptyWrapper(from, kind),
          kind
        );
        if (result.fragment) {
          return {
            kind: kind === 'functions' ? kind : 'statements',
            program: remapOrigins(result.fragment, source, wrapped.origins),
          };
        }
        failure = { message: result.problem, line: 0 };
      } catch (error) {
        failure = fragmentLine(error, wrapped.origins, count);
      }
      if (kind === 'statements') {
        statementsFailure = failure;
      } else {
        failures.push(failure);
      }
    }
    failures.push(statementsFailure);
    // The reading that went furthest into the fragment explains best what
    // is missing; on a tie the last reading (statements) is the most
    // general one.
    const furthest = failures.reduce((best, failure) =>
      failure.line >= best.line ? failure : best
    );
    throw notComplete(furthest.message);
  }

  // Translate a fragment into the same kind of fragment in the target.
  function translateFragment(source, from, to, options = {}) {
    const { kind, program: meta } = parseFragment(source, from);
    const adapted = adapt(meta, to, { ...options, from });
    if (kind === 'program' || isNaturalLanguage(to)) {
      return write(adapted, to);
    }
    if (machineTargetIds.includes(to)) {
      throw new Error(
        `Machine targets hold whole programs only, not ${kind} on their own (${to})`
      );
    }
    return writeBetweenMarkers(adapted, kind, to, emit);
  }

  // Comments that stand on their own as statements of the target (notes in
  // a natural language). Partial translation marks what it cannot
  // translate with them. The texts are kept as written (literal mode).
  function writeNotes(texts, to) {
    const meta = program({
      statements: texts.map((text) =>
        // A comment must not close a block comment early.
        comment(text.replaceAll('*/', '* /'))
      ),
    });
    const adapted = adapt(meta, to, { from: to, mode: 'literal' });
    if (isNaturalLanguage(to) || machineTargetIds.includes(to)) {
      return write(adapted, to);
    }
    return writeBetweenMarkers(adapted, 'statements', to, emit);
  }

  return { parseFragment, translateFragment, writeNotes };
}
