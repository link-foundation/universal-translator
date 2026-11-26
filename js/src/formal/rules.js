// Rule layers. Each rule is a small, named function from tree to tree, so
// callers can reorder, remove, replace or decorate any of them.
//
// "understanding" rules turn a parsed source program into the language
// independent meta program; "meaning" rules run after type inference;
// "context" rules adapt the program to its target (for example comments).

import {
  recognizeCommonLibrary,
  spellCommonLibrary,
} from './common-library.js';
import { block, layout, node, rewrite, text, walk } from '../meta/tree.js';
import { countingLoops } from './lifting.js';
import { raiseTruthFunctions } from '../meta/truth.js';
import { languageSyntax, namingConvention } from './languages.js';
import { splitVersion, versionsOf } from './versions.js';
import { slashOperator } from './numbers.js';
import {
  asciiName,
  avoidReserved,
  nameWords,
  neutralName,
  renameDeclared,
  spellName,
} from './names.js';
import {
  expandArrayFills,
  raiseArrayFills,
  recognizeArrays,
} from './arrays.js';
import { expandForEach, raiseForEach } from './for-each.js';

// ---------------------------------------------------------------------------
// Understanding layer
// ---------------------------------------------------------------------------

const entryNames = new Set(['main', 'Main']);

function flattenClasses(items) {
  return items.flatMap((item) =>
    item.kind === 'Class' ? flattenClasses(item.items) : [item]
  );
}

// "Program.square" for every function of a class of the program.
function classFunctionNames(items, owner) {
  return items.flatMap((item) => {
    if (item.kind === 'Class') {
      return classFunctionNames(item.items, item.name);
    }
    return owner && item.kind === 'Function' ? [`${owner}.${item.name}`] : [];
  });
}

// `Program.square(3)` calls a function of the program. The classes are
// flattened, so the call names the plain function.
function unqualifyClassCalls(program, items) {
  const qualified = new Set(classFunctionNames(items));
  if (!qualified.size) {
    return program;
  }
  return rewrite(program, (current) =>
    current.kind === 'Call' && qualified.has(current.callee)
      ? { ...current, callee: current.callee.split('.').at(-1) }
      : current
  );
}

function isCallTo(statement, functionName) {
  const expression =
    statement.kind === 'Evaluate' ? statement.expression : undefined;
  return (
    expression?.kind === 'Call' &&
    expression.callee === functionName &&
    expression.arguments.length === 0
  );
}

function isPythonMainGuard(statement) {
  return (
    statement.kind === 'If' &&
    statement.condition.kind === 'Binary' &&
    statement.condition.left.kind === 'Name' &&
    statement.condition.left.name === '__name__'
  );
}

// Sort top-level items into file comments, imports, functions and
// statements. Comments directly above a function belong to that function.
function collectItems(items) {
  const program = node('Program', {
    comments: [],
    imports: [],
    functions: [],
    main: block(),
  });
  let pending = [];
  const texts = (trivia) =>
    trivia.filter(({ kind }) => kind === 'Comment').map(({ text }) => text);
  for (const item of items) {
    if (item.kind === 'Comment' || item.kind === 'Blank') {
      pending.push(item);
      continue;
    }
    const isFirstCode =
      program.imports.length +
        program.functions.length +
        program.main.statements.length ===
      0;
    if (isFirstCode) {
      // Comments before the last empty line describe the file; the ones
      // after it (all of them without an empty line) describe the first item.
      const split = pending.findLastIndex(({ kind }) => kind === 'Blank');
      program.comments.push(...texts(pending.slice(0, Math.max(split, 0))));
      pending = pending.slice(split + 1);
    }
    // An empty line after a function is kept only where the source has one.
    const previous = program.functions.at(-1);
    if (previous && previous.blankAfter === undefined) {
      previous.blankAfter = pending.some(({ kind }) => kind === 'Blank');
    }
    if (item.kind === 'Import') {
      // An import keeps no comments: the ones above it describe the file.
      program.comments.push(...texts(pending));
      program.imports.push(item.text);
    } else if (item.kind === 'Function') {
      program.functions.push({
        ...item,
        comments: texts(pending),
      });
    } else {
      program.main.statements.push(...pending, item);
    }
    pending = [];
  }
  program.main.statements.push(...pending);
  program.main = block(layout(program.main.statements));
  return program;
}

const isExitSuccess = (statement) =>
  statement?.kind === 'Return' &&
  statement.value?.kind === 'Number' &&
  statement.value.value === 0;

// Collect functions, the entry point and file comments into a Program. The
// body of `main` becomes the program's main block.
export function findEntryPoint(source, { from } = {}) {
  const program = unqualifyClassCalls(
    collectItems(flattenClasses(source.items)),
    source.items
  );
  const own = from && languageSyntax(from).mainName;
  const entry = program.functions.find(
    (item) => entryNames.has(item.name) || item.name === own
  );
  if (!entry) {
    return program;
  }
  const leftovers = program.main.statements.filter(
    (statement) =>
      !isCallTo(statement, entry.name) && !isPythonMainGuard(statement)
  );
  const statements = [...leftovers, ...entry.body.statements];
  // `return 0;` at the end of C's main is the default exit status.
  if (isExitSuccess(statements.at(-1))) {
    statements.pop();
  }
  return {
    ...program,
    functions: program.functions.filter((item) => item !== entry),
    main: block(statements),
    mainComments: entry.comments,
  };
}

// The output procedures of each language, described as data.
const lineCalls = new Set([
  'console.log',
  'print',
  'puts',
  'System.Console.WriteLine',
  'Console.WriteLine',
  'System.out.println',
  'fmt.Println',
  'println',
  'Console.Out.WriteLine',
]);
const textCalls = new Set([
  'System.Console.Write',
  'Console.Write',
  'System.out.print',
  'fmt.Print',
  'process.stdout.write',
  'sys.stdout.write',
  'io.write',
]);
const formatCalls = {
  printf: 'percent',
  'fmt.Printf': 'percent',
  'println!': 'braces',
  'print!': 'braces',
};

function joinWithSpaces(values, separator = text(' ')) {
  if (values.length === 1) {
    return values[0];
  }
  const parts = [];
  values.forEach((value, index) => {
    if (index > 0) {
      parts.push(separator);
    }
    parts.push(value);
  });
  return node('Interpolation', { parts });
}

function readFormat(format, values, style) {
  const pattern =
    style === 'percent'
      ? /%(?:l{0,2}d|i|s|c|v|t|%|(?:\.\d+)?l?[fgeG])/g
      : /\{\{|\}\}|\{\}/g;
  const parts = [];
  let last = 0;
  let index = 0;
  for (const match of format.matchAll(pattern)) {
    if (match.index > last) {
      parts.push(text(format.slice(last, match.index)));
    }
    if (match[0] === '%%') {
      parts.push(text('%'));
    } else if (match[0] === '{{') {
      parts.push(text('{'));
    } else if (match[0] === '}}') {
      parts.push(text('}'));
    } else {
      parts.push(values[index++]);
    }
    last = match.index + match[0].length;
  }
  if (last < format.length) {
    parts.push(text(format.slice(last)));
  }
  return parts;
}

export function partsToValue(parts) {
  const merged = [];
  for (const part of parts) {
    if (part.kind === 'Text' && merged.at(-1)?.kind === 'Text') {
      merged[merged.length - 1] = text(merged.at(-1).value + part.value);
    } else if (!(part.kind === 'Text' && part.value === '')) {
      merged.push(part);
    }
  }
  if (merged.length === 0) {
    return text('');
  }
  // A format with a single placeholder prints just that value.
  if (merged.length === 1) {
    return merged[0];
  }
  return node('Interpolation', { parts: merged });
}

function withoutTrailingNewline(parts) {
  const last = parts.at(-1);
  if (last?.kind === 'Text' && last.value.endsWith('\n')) {
    return {
      parts: [...parts.slice(0, -1), text(last.value.slice(0, -1))],
      newline: true,
    };
  }
  return { parts, newline: false };
}

function streamParts(expression) {
  if (expression.kind === 'Binary' && expression.operator === 'stream') {
    return [...streamParts(expression.left), expression.right];
  }
  return [expression];
}

const knownPrint = (callee) =>
  lineCalls.has(callee) ||
  textCalls.has(callee) ||
  Object.hasOwn(formatCalls, callee) ||
  callee === 'echo';

// Which kind of output procedure a call names: 'line' when it ends the line,
// 'text' when the text carries its own line ends.
function printKind(callee, { printCalls: own, print: renamed }) {
  // A version of one's own may give the line output another name.
  if (renamed?.line === callee && !knownPrint(callee)) {
    return 'line';
  }
  if (own) {
    return own.line.includes(callee)
      ? 'line'
      : own.text.includes(callee)
        ? 'text'
        : undefined;
  }
  if (lineCalls.has(callee)) {
    return 'line';
  }
  return textCalls.has(callee) || callee === 'echo' ? 'text' : undefined;
}

// Python's print(..., sep=, end=) and Swift's print(..., separator:,
// terminator:): an empty end keeps the line open ("" reads as an empty
// interpolation where quotes interpolate), and any other end is printed
// after the values, so `end="!"` is not lost.
function printLine(values, named) {
  const separator = named.sep ?? named.separator;
  const joined = values.length ? joinWithSpaces(values, separator) : text('');
  const end = named.end ?? named.terminator;
  if (end === undefined) {
    return node('Print', { value: joined, newline: true });
  }
  const empty =
    (end.kind === 'Text' && end.value === '') ||
    (end.kind === 'Interpolation' && end.parts.length === 0);
  if (empty) {
    return node('Print', { value: joined, newline: false });
  }
  const flat = [joined, end].flatMap((value) =>
    value.kind === 'Interpolation' ? value.parts : [value]
  );
  const { parts, newline } = withoutTrailingNewline(flat);
  return node('Print', { value: partsToValue(parts), newline });
}

function printFromCall(call, syntax) {
  const kind = printKind(call.callee, syntax);
  const values = call.arguments.filter(
    (value) => value.kind !== 'NamedArgument'
  );
  const named = Object.fromEntries(
    call.arguments
      .filter((value) => value.kind === 'NamedArgument')
      .map((value) => [value.name, value.value])
  );
  // D's writeln prints its arguments one after another, without spaces.
  if (kind === 'line' && syntax.printCalls?.adjacent) {
    const flat = values.flatMap((value) =>
      value.kind === 'Interpolation' ? value.parts : [value]
    );
    return node('Print', { value: partsToValue(flat), newline: true });
  }
  if (kind === 'line') {
    return printLine(values, named);
  }
  if (kind === 'text') {
    const flat = values.flatMap((value) =>
      value.kind === 'Interpolation' ? value.parts : [value]
    );
    const { parts, newline } = withoutTrailingNewline(flat);
    return node('Print', { value: partsToValue(parts), newline });
  }
  const style = Object.hasOwn(formatCalls, call.callee)
    ? formatCalls[call.callee]
    : undefined;
  if (style && values[0]?.kind === 'Text') {
    const { parts, newline } = withoutTrailingNewline(
      readFormat(values[0].value, values.slice(1), style)
    );
    return node('Print', {
      value: partsToValue(parts),
      newline: newline || call.callee === 'println!',
    });
  }
  return undefined;
}

// Replace each known output procedure with the Print concept.
export function recognizePrint(program, { from } = {}) {
  const syntax = from ? languageSyntax(from) : {};
  return rewrite(program, (current) => {
    if (current.kind !== 'Evaluate') {
      return current;
    }
    const expression = current.expression;
    if (expression.kind === 'Call') {
      return printFromCall(expression, syntax) ?? current;
    }
    if (expression.kind === 'Binary' && expression.operator === 'stream') {
      const [stream, ...values] = streamParts(expression);
      if (stream.kind === 'Name' && /cout$/.test(stream.name)) {
        const endsLine =
          values.at(-1)?.kind === 'Name' && /endl$/.test(values.at(-1).name);
        const { parts, newline } = withoutTrailingNewline(
          endsLine ? [...values.slice(0, -1), text('\n')] : values
        );
        return node('Print', { value: partsToValue(parts), newline });
      }
    }
    return current;
  });
}

// `str(total)` printed or joined to a text converts only what printing and
// interpolation already convert, so the conversion is dropped there.
export function dropTextConversions(program, { from } = {}) {
  const conversions = from ? languageSyntax(from).textConversions : undefined;
  if (!conversions) {
    return program;
  }
  const isConversion = (value) =>
    value.kind === 'Call' &&
    conversions.includes(value.callee) &&
    value.arguments.length === 1;
  const unwrap = (value) => (isConversion(value) ? value.arguments[0] : value);
  // `str(n) + str(n)` joins two texts: it is the interpolation of n and n,
  // not the sum n + n.
  const joined = (current) =>
    node('Interpolation', {
      parts: [current.left, current.right].flatMap((value) =>
        value.kind === 'Interpolation' ? value.parts : [unwrap(value)]
      ),
    });
  const isText = (value) =>
    ['Text', 'Interpolation'].includes(value.kind) ||
    (value.kind === 'Binary' &&
      value.operator === 'add' &&
      (isText(value.left) || isText(value.right)));
  return rewrite(program, (current) => {
    if (current.kind === 'Print') {
      return { ...current, value: unwrap(current.value) };
    }
    if (current.kind === 'Interpolation') {
      return { ...current, parts: current.parts.map(unwrap) };
    }
    if (
      current.kind === 'Binary' &&
      current.operator === 'add' &&
      (isConversion(current.left) || isConversion(current.right))
    ) {
      return joined(current);
    }
    if (
      current.kind === 'Binary' &&
      current.operator === 'add' &&
      (isText(current.left) || isText(current.right))
    ) {
      return {
        ...current,
        left: unwrap(current.left),
        right: unwrap(current.right),
      };
    }
    return current;
  });
}

// Add the names a tree reads to a set.
function addReadNames(tree, names) {
  walk(tree, (current) => {
    if (current.kind === 'Name') {
      names.add(current.name);
    }
  });
}

// Languages without declarations (Python, Ruby, PHP) declare a variable by
// assigning it for the first time. A variable read before its first
// assignment (`x = x + 1`, or `if x > 0` above `x = 0`) is not declared
// there: it comes from outside, as in a statement translated on its own.
export function declareOnFirstAssignment(program) {
  const declareIn = (body, known) => {
    const scope = new Set(known);
    const read = new Set();
    const visitBlock = (current) => ({
      ...current,
      statements: current.statements.map(visitStatement),
    });
    const visitStatement = (statement) => {
      if (statement.kind === 'If') {
        addReadNames(statement.condition, read);
        return {
          ...statement,
          then: visitBlock(statement.then),
          otherwise:
            statement.otherwise &&
            (statement.otherwise.kind === 'Block'
              ? visitBlock(statement.otherwise)
              : visitStatement(statement.otherwise)),
        };
      }
      if (statement.kind === 'While') {
        addReadNames(statement.condition, read);
        return { ...statement, body: visitBlock(statement.body) };
      }
      if (statement.kind === 'CountingLoop') {
        addReadNames([statement.start, statement.end], read);
        scope.add(statement.variable);
        return { ...statement, body: visitBlock(statement.body) };
      }
      if (statement.kind === 'ForEach') {
        addReadNames(statement.array, read);
        scope.add(statement.variable);
        return { ...statement, body: visitBlock(statement.body) };
      }
      // The value is read before the variable is assigned.
      addReadNames(statement, read);
      if (
        statement.kind === 'Assignment' &&
        statement.operator === '=' &&
        !scope.has(statement.name) &&
        !read.has(statement.name)
      ) {
        scope.add(statement.name);
        // A Python hint (`total: int = 0`) gives the declared type.
        return node('Declaration', {
          name: statement.name,
          ...(statement.type ? { type: statement.type } : {}),
          value: statement.value,
          mutable: true,
        });
      }
      if (statement.kind === 'Declaration') {
        scope.add(statement.name);
      }
      return statement;
    };
    return visitBlock(body);
  };
  return {
    ...program,
    functions: program.functions.map((item) => ({
      ...item,
      body: declareIn(
        item.body,
        item.parameters.map((parameter) => parameter.name)
      ),
    })),
    main: declareIn(program.main, []),
  };
}

// A variable is mutable exactly when the program assigns it again. An array
// whose elements the program assigns is marked too: Rust, Swift and Nim
// declare it like a mutable variable.
export function inferMutability(program) {
  const assigned = new Set();
  const stored = new Set();
  rewrite(program, (current) => {
    if (current.kind === 'Assignment') {
      assigned.add(current.name);
    }
    if (current.kind === 'IndexAssignment') {
      stored.add(current.name);
    }
    return current;
  });
  return rewrite(program, (current) => {
    if (current.kind !== 'Declaration') {
      return current;
    }
    const marked = { ...current, mutable: assigned.has(current.name) };
    delete marked.elementsAssigned;
    if (stored.has(current.name)) {
      marked.elementsAssigned = true;
    }
    return marked;
  });
}

export function dropSourceDetails(program) {
  return rewrite(program, (current) => {
    if (current.kind === 'Return' && current.implicit) {
      const rest = { ...current };
      delete rest.implicit;
      return rest;
    }
    return current;
  });
}

const compoundMeanings = {
  '+=': 'add',
  '-=': 'subtract',
  '*=': 'multiply',
  '/=': 'divide',
  '%=': 'remainder',
};

// `x += v` means `x = x + v`; the meta language keeps only the plain form.
// `/=` divides like the language's `/`.
export function expandCompoundAssignment(program, { from } = {}) {
  const meanings = {
    ...compoundMeanings,
    '/=': from ? slashOperator(languageSyntax(from)) : 'divide',
  };
  return rewrite(program, (current) => {
    if (current.kind !== 'Assignment' || current.operator === '=') {
      return current;
    }
    const operator = meanings[current.operator];
    if (!operator) {
      throw new Error(`Unknown assignment operator "${current.operator}"`);
    }
    return node('Assignment', {
      name: current.name,
      operator: '=',
      value: node('Binary', {
        operator,
        left: { kind: 'Name', name: current.name },
        right: current.value,
      }),
    });
  });
}

// PHP's "." operator joins text: the same concept as an interpolation.
export function concatenationOperator(program, { from } = {}) {
  const call = from && languageSyntax(from).concatenateCall;
  return rewrite(program, (current) => {
    const joined =
      current.kind === 'Binary' && current.operator === 'concatenate'
        ? [current.left, current.right]
        : current.kind === 'Call' && current.callee === call
          ? current.arguments
          : undefined;
    if (!joined) {
      return current;
    }
    return partsToValue(
      joined.flatMap((part) =>
        part.kind === 'Interpolation' ? part.parts : [part]
      )
    );
  });
}

// `let mut first = first;` at the start of a Rust, Kotlin or Swift function
// only exists because parameters are immutable there. It is a detail of the
// source language (see copyReassignedParameters), not part of the meaning.
export function dropParameterCopies(program) {
  return {
    ...program,
    functions: program.functions.map((item) => {
      const statements = [...item.body.statements];
      let parameters = item.parameters;
      const copiedParameter = (statement) =>
        statement?.kind === 'Declaration' &&
        statement.value?.kind === 'Name' &&
        parameters.find(
          ({ name }) =>
            name === statement.value.name &&
            (name === statement.name ||
              copyName(statement.name) === neutralName(name))
        );
      for (
        let parameter = copiedParameter(statements[0]);
        parameter;
        parameter = copiedParameter(statements[0])
      ) {
        const copy = statements.shift().name;
        parameters = parameters.map((current) =>
          current === parameter ? { ...current, name: copy } : current
        );
      }
      return {
        ...item,
        parameters,
        body: { ...item.body, statements },
      };
    }),
  };
}

// The neutral name of the parameter that a copy named `name` is made from.
const copyName = (name) => ['initial', ...nameWords(name)].join('-');

// Languages without an integer division operator call a library procedure:
// JavaScript writes `Math.trunc(a / b)`, Perl `int(a / b)`, PHP
// `intdiv(a, b)`, Julia `div(a, b)` and Groovy `a.intdiv(b)`. Each means
// the meta operator "divide". The language description names its spelling.
const integerDivisionSpellings = [
  { wrapper: 'Math.trunc' },
  { wrapper: '~~' },
  { wrapper: 'int' },
  { call: 'intdiv' },
];

function integerDivision(call, { wrapper, call: callee, method }) {
  const [first, second] = call.arguments;
  const divide = (left, right) =>
    node('Binary', { operator: 'divide', left, right });
  if (
    call.callee === wrapper &&
    call.arguments.length === 1 &&
    first.kind === 'Binary' &&
    ['divide', 'realDivide'].includes(first.operator)
  ) {
    return { ...first, operator: 'divide' };
  }
  if (call.callee === callee && call.arguments.length === 2) {
    return divide(first, second);
  }
  if (method && call.callee === `.${method}` && call.arguments.length === 2) {
    return divide(first, second);
  }
  // a.intdiv(b) with a named receiver reads as the callee "a.intdiv".
  if (
    method &&
    call.callee.endsWith(`.${method}`) &&
    call.arguments.length === 1
  ) {
    return divide(
      { kind: 'Name', name: call.callee.slice(0, -method.length - 1) },
      first
    );
  }
  return undefined;
}

// The spellings of the language a program is read from, in every version
// of it: Lua 5.1 writes `math.floor(a / b)` for Lua 5.3's `a // b`.
function ownIntegerDivisions(from) {
  if (!from) {
    return [];
  }
  const { id } = splitVersion(from);
  return [
    languageSyntax(id),
    ...versionsOf(id).map(({ version }) => languageSyntax(`${id}@${version}`)),
  ]
    .map(({ integerDivision }) => integerDivision)
    .filter(Boolean);
}

export function integerDivisionCalls(program, { from } = {}) {
  const spellings = [...ownIntegerDivisions(from), ...integerDivisionSpellings];
  return rewrite(program, (current) => {
    if (current.kind !== 'Call') {
      return current;
    }
    for (const spelling of spellings) {
      const divided = integerDivision(current, spelling);
      if (divided) {
        return divided;
      }
    }
    return current;
  });
}

// `greatest_common_divisor` and `greatestCommonDivisor` are one name.
export function neutralNames(program) {
  return renameDeclared(program, neutralName);
}

// `i = a; while (i < b) { ...; i += 1 }` is the counting loop `for i in a..b`
// written at a lower level, as languages without a counting loop over a
// computed range (R, for example) spell it. Raising it lets every language
// write its own counting loop again.
export function raiseCountingLoops(program) {
  return rewrite(program, (current) =>
    current.kind === 'Block'
      ? { ...current, statements: countingLoops(current.statements) }
      : current
  );
}

// Perl writes true and false as 1 and 0.
export function raiseTruthValues(program, context = {}) {
  const words = context.from && languageSyntax(context.from).words;
  return words?.true === '1' ? raiseTruthFunctions(program) : program;
}

// The statement an indentation language writes into an empty block
// (Python's `pass`, Nim's `discard`) does nothing, so it is no statement of
// the meta language. Without this rule `pass` read back as a variable.
export function dropEmptyStatements(program, { from } = {}) {
  const syntax = from ? languageSyntax(from) : undefined;
  if (syntax?.blocks !== 'indentation') {
    return program;
  }
  const empty = syntax.emptyStatement ?? 'pass';
  return rewrite(program, (current) =>
    current.kind === 'Evaluate' &&
    current.expression?.kind === 'Name' &&
    current.expression.name === empty
      ? undefined
      : current
  );
}

export const understandingRules = [
  findEntryPoint,
  concatenationOperator,
  integerDivisionCalls,
  recognizeArrays,
  recognizeCommonLibrary,
  recognizePrint,
  dropTextConversions,
  dropEmptyStatements,
  expandCompoundAssignment,
  dropParameterCopies,
  declareOnFirstAssignment,
  raiseCountingLoops,
  raiseArrayFills,
  raiseForEach,
  raiseTruthValues,
  inferMutability,
  dropSourceDetails,
  neutralNames,
];

// ---------------------------------------------------------------------------
// Meaning layer (after type inference)
// ---------------------------------------------------------------------------

// `"Total: " + total` is text concatenation, which the meta language keeps
// as one interpolation independent of the target's operator.
export function concatenationToInterpolation(program) {
  return rewrite(program, (current) => {
    if (
      current.kind === 'Binary' &&
      current.operator === 'add' &&
      current.type === 'text'
    ) {
      const parts = [current.left, current.right].flatMap((part) =>
        part.kind === 'Interpolation' ? part.parts : [part]
      );
      const value = partsToValue(parts);
      // `"" + year` is the text of `year`: the name keeps its own type.
      return ['Text', 'Interpolation'].includes(value.kind)
        ? { ...value, type: 'text' }
        : node('Interpolation', { parts: [value], type: 'text' });
    }
    return current;
  });
}

export const meaningRules = [concatenationToInterpolation];

// ---------------------------------------------------------------------------
// Context layer: adapt comments to the target language.
// ---------------------------------------------------------------------------

function escapeExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function adaptCommentText(comment, from, to) {
  const source = languageSyntax(from);
  const target = languageSyntax(to);
  let result = comment.replace(
    new RegExp(`(\\bin )${escapeExpression(source.label)}(?![\\w#+])`, 'g'),
    `$1${target.label}`
  );
  for (const [term, sourceWord] of Object.entries(source.terms)) {
    const targetWord = target.terms[term];
    if (targetWord && sourceWord !== targetWord) {
      result = result.replace(
        new RegExp(`\\b${escapeExpression(sourceWord)}\\b`, 'g'),
        targetWord
      );
    }
  }
  return result;
}

export function adaptComments(program, { from, to, mode }) {
  if (mode === 'same-effect') {
    const stripped = rewrite(program, (current) =>
      current.kind === 'Comment' ? undefined : current
    );
    return {
      ...stripped,
      comments: [],
      mainComments: [],
      functions: stripped.functions.map((item) => ({ ...item, comments: [] })),
    };
  }
  if (mode === 'literal' || from === to) {
    return program;
  }
  return mapComments(program, (value) => adaptCommentText(value, from, to));
}

// Apply a change to the text of every comment in the program.
export function mapComments(program, change) {
  const adapted = rewrite(program, (current) =>
    current.kind === 'Comment'
      ? { ...current, text: change(current.text) }
      : current
  );
  return {
    ...adapted,
    comments: (adapted.comments ?? []).map(change),
    mainComments: (adapted.mainComments ?? []).map(change),
    functions: adapted.functions.map((item) => ({
      ...item,
      comments: (item.comments ?? []).map(change),
    })),
  };
}

// A rule that replaces glossary phrases in comments, longest phrase first.
// Use it as a layer to change comment language without changing the code,
// for example from Russian to English.
export function commentGlossary(phrases) {
  const ordered = [...phrases].sort(
    (left, right) => right.source.length - left.source.length
  );
  return (program) =>
    mapComments(program, (text) =>
      ordered.reduce(
        (current, { source, target }) => current.split(source).join(target),
        text
      )
    );
}

// Rust, Kotlin and Swift parameters cannot be reassigned. When a function
// assigns a parameter, the target works on a mutable local copy instead.
// Scala cannot declare a local with the name of a parameter, so there the
// parameter itself is renamed: `def f(initialFirst: Long)` with
// `var first: Long = initialFirst`.
export function copyReassignedParameters(program, { to }) {
  const immutable = languageSyntax(to).immutableParameters;
  if (!immutable) {
    return program;
  }
  return {
    ...program,
    functions: program.functions.map((item) => {
      const assigned = new Set();
      rewrite(item.body, (current) => {
        if (current.kind === 'Assignment') {
          assigned.add(current.name);
        }
        return current;
      });
      const source = (parameter) =>
        assigned.has(parameter.name) && immutable === 'renamed'
          ? copyName(parameter.name)
          : parameter.name;
      const copies = item.parameters
        .filter((parameter) => assigned.has(parameter.name))
        .map((parameter) =>
          node('Declaration', {
            name: parameter.name,
            type: parameter.type,
            value: {
              kind: 'Name',
              name: source(parameter),
              type: parameter.type,
            },
            mutable: true,
          })
        );
      return copies.length
        ? {
            ...item,
            parameters: item.parameters.map((parameter) => ({
              ...parameter,
              name: source(parameter),
            })),
            body: block([...copies, ...item.body.statements]),
          }
        : item;
    }),
  };
}

// Spell every declared name in the target's naming convention.
export function spellNames(program, { to }) {
  const syntax = languageSyntax(to);
  return renameDeclared(program, (identifier, role) =>
    avoidReserved(
      asciiName(
        spellName(identifier, namingConvention(syntax, role)),
        to,
        syntax
      ),
      to
    )
  );
}

export const contextRules = [
  adaptComments,
  copyReassignedParameters,
  expandArrayFills,
  expandForEach,
  spellNames,
  spellCommonLibrary,
];
