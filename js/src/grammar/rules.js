// Rule layers. Each rule is a small, named function from tree to tree, so
// callers can reorder, remove, replace or decorate any of them.
//
// "understanding" rules turn a parsed source program into the language
// independent meta program; "meaning" rules run after type inference;
// "context" rules adapt the program to its target (for example comments).

import { block, node, rewrite, text } from './meta.js';
import { languageSyntax } from './languages.js';

// ---------------------------------------------------------------------------
// Understanding layer
// ---------------------------------------------------------------------------

const entryNames = new Set(['main', 'Main']);

function flattenClasses(items) {
  return items.flatMap((item) => (item.kind === 'Class' ? flattenClasses(item.items) : [item]));
}

function isCallTo(statement, functionName) {
  const expression = statement.kind === 'Evaluate' ? statement.expression : undefined;
  return expression?.kind === 'Call' && expression.callee === functionName && expression.arguments.length === 0;
}

function isPythonMainGuard(statement) {
  return statement.kind === 'If' && statement.condition.kind === 'Binary' && statement.condition.left.kind === 'Name' && statement.condition.left.name === '__name__';
}

// Collect functions, the entry point and file comments into a Program.
export function findEntryPoint(source) {
  const items = flattenClasses(source.items);
  const program = node('Program', { comments: [], imports: [], functions: [], main: block() });
  let pendingComments = [];
  let seenCode = false;
  let entryFunction;
  for (const item of items) {
    if (item.kind === 'Comment') {
      pendingComments.push(item);
      continue;
    }
    if (!seenCode) {
      program.comments.push(...pendingComments.map((comment) => comment.text));
      pendingComments = [];
    }
    seenCode = true;
    if (item.kind === 'Import') {
      program.imports.push(item.text);
      continue;
    }
    if (item.kind === 'Function') {
      const comments = pendingComments.map((comment) => comment.text);
      pendingComments = [];
      if (entryNames.has(item.name)) {
        entryFunction = { ...item, comments };
      } else {
        program.functions.push({ ...item, comments });
      }
      continue;
    }
    program.main.statements.push(...pendingComments, item);
    pendingComments = [];
  }
  program.main.statements.push(...pendingComments);
  if (entryFunction) {
    const leftovers = program.main.statements.filter((statement) => !isCallTo(statement, entryFunction.name) && !isPythonMainGuard(statement));
    program.main = block([...leftovers, ...entryFunction.body.statements]);
    program.mainComments = entryFunction.comments;
    // `return 0;` at the end of C's main is the default exit status.
    const last = program.main.statements.at(-1);
    if (last?.kind === 'Return' && last.value?.kind === 'Number' && last.value.value === 0) {
      program.main.statements.pop();
    }
  }
  if (!seenCode && pendingComments.length === 0 && !entryFunction) {
    program.main = block();
  }
  return program;
}

// The output procedures of each language, described as data.
const lineCalls = new Set([
  'console.log', 'print', 'puts', 'System.Console.WriteLine', 'Console.WriteLine',
  'System.out.println', 'fmt.Println', 'println', 'Console.Out.WriteLine',
]);
const textCalls = new Set(['System.Console.Write', 'Console.Write', 'System.out.print', 'fmt.Print', 'process.stdout.write', 'io.write']);
const formatCalls = { printf: 'percent', 'fmt.Printf': 'percent', 'println!': 'braces', 'print!': 'braces' };

function joinWithSpaces(values) {
  if (values.length === 1) return values[0];
  const parts = [];
  values.forEach((value, index) => {
    if (index > 0) parts.push(text(' '));
    parts.push(value);
  });
  return node('Interpolation', { parts });
}

function readFormat(format, values, style) {
  const pattern = style === 'percent' ? /%(?:l{0,2}d|i|s|c|v|t|%)/g : /\{\{|\}\}|\{\}/g;
  const parts = [];
  let last = 0;
  let index = 0;
  for (const match of format.matchAll(pattern)) {
    if (match.index > last) parts.push(text(format.slice(last, match.index)));
    if (match[0] === '%%') parts.push(text('%'));
    else if (match[0] === '{{') parts.push(text('{'));
    else if (match[0] === '}}') parts.push(text('}'));
    else parts.push(values[index++]);
    last = match.index + match[0].length;
  }
  if (last < format.length) parts.push(text(format.slice(last)));
  return parts;
}

function partsToValue(parts) {
  const merged = [];
  for (const part of parts) {
    if (part.kind === 'Text' && merged.at(-1)?.kind === 'Text') {
      merged[merged.length - 1] = text(merged.at(-1).value + part.value);
    } else if (!(part.kind === 'Text' && part.value === '')) {
      merged.push(part);
    }
  }
  if (merged.length === 0) return text('');
  if (merged.length === 1 && merged[0].kind === 'Text') return merged[0];
  return node('Interpolation', { parts: merged });
}

function withoutTrailingNewline(parts) {
  const last = parts.at(-1);
  if (last?.kind === 'Text' && last.value.endsWith('\n')) {
    return { parts: [...parts.slice(0, -1), text(last.value.slice(0, -1))], newline: true };
  }
  return { parts, newline: false };
}

function streamParts(expression) {
  if (expression.kind === 'Binary' && expression.operator === 'stream') {
    return [...streamParts(expression.left), expression.right];
  }
  return [expression];
}

function printFromCall(call) {
  const values = call.arguments.filter((value) => value.kind !== 'NamedArgument');
  const named = Object.fromEntries(call.arguments.filter((value) => value.kind === 'NamedArgument').map((value) => [value.name, value.value]));
  if (lineCalls.has(call.callee)) {
    const newline = !(named.end && named.end.kind === 'Text' && named.end.value === '');
    return node('Print', { value: values.length ? joinWithSpaces(values) : text(''), newline });
  }
  if (textCalls.has(call.callee) || call.callee === 'echo') {
    const flat = values.flatMap((value) => (value.kind === 'Interpolation' ? value.parts : [value]));
    const { parts, newline } = withoutTrailingNewline(flat);
    return node('Print', { value: partsToValue(parts), newline });
  }
  const style = formatCalls[call.callee];
  if (style && values[0]?.kind === 'Text') {
    const { parts, newline } = withoutTrailingNewline(readFormat(values[0].value, values.slice(1), style));
    return node('Print', { value: partsToValue(parts), newline: newline || call.callee === 'println!' });
  }
  return undefined;
}

// Replace each known output procedure with the Print concept.
export function recognizePrint(program) {
  return rewrite(program, (current) => {
    if (current.kind !== 'Evaluate') return current;
    const expression = current.expression;
    if (expression.kind === 'Call') return printFromCall(expression) ?? current;
    if (expression.kind === 'Binary' && expression.operator === 'stream') {
      const [stream, ...values] = streamParts(expression);
      if (stream.kind === 'Name' && /cout$/.test(stream.name)) {
        const endsLine = values.at(-1)?.kind === 'Name' && /endl$/.test(values.at(-1).name);
        const { parts, newline } = withoutTrailingNewline(endsLine ? [...values.slice(0, -1), text('\n')] : values);
        return node('Print', { value: partsToValue(parts), newline });
      }
    }
    return current;
  });
}

// Languages without declarations (Python, Ruby, PHP) declare a variable by
// assigning it for the first time.
export function declareOnFirstAssignment(program) {
  const declareIn = (body, known) => {
    const scope = new Set(known);
    const visitBlock = (current) => ({
      ...current,
      statements: current.statements.map((statement) => {
        if (statement.kind === 'Assignment' && statement.operator === '=' && !scope.has(statement.name)) {
          scope.add(statement.name);
          return node('Declaration', { name: statement.name, value: statement.value, mutable: true });
        }
        if (statement.kind === 'Declaration') scope.add(statement.name);
        if (statement.kind === 'If') return { ...statement, then: visitBlock(statement.then), otherwise: statement.otherwise && (statement.otherwise.kind === 'Block' ? visitBlock(statement.otherwise) : visitBlock(block([statement.otherwise])).statements[0]) };
        if (statement.kind === 'While') return { ...statement, body: visitBlock(statement.body) };
        if (statement.kind === 'CountingLoop') {
          scope.add(statement.variable);
          return { ...statement, body: visitBlock(statement.body) };
        }
        return statement;
      }),
    });
    return visitBlock(body);
  };
  return {
    ...program,
    functions: program.functions.map((item) => ({ ...item, body: declareIn(item.body, item.parameters.map((parameter) => parameter.name)) })),
    main: declareIn(program.main, []),
  };
}

// A variable is mutable exactly when the program assigns it again.
export function inferMutability(program) {
  const assigned = new Set();
  rewrite(program, (current) => {
    if (current.kind === 'Assignment') assigned.add(current.name);
    return current;
  });
  return rewrite(program, (current) => (current.kind === 'Declaration' ? { ...current, mutable: assigned.has(current.name) } : current));
}

export function dropSourceDetails(program) {
  return rewrite(program, (current) => {
    if (current.kind === 'Return' && current.implicit) {
      const { implicit: _implicit, ...rest } = current;
      return rest;
    }
    return current;
  });
}

export const understandingRules = [findEntryPoint, recognizePrint, declareOnFirstAssignment, inferMutability, dropSourceDetails];

// ---------------------------------------------------------------------------
// Meaning layer (after type inference)
// ---------------------------------------------------------------------------

// `"Total: " + total` is text concatenation, which the meta language keeps
// as one interpolation independent of the target's operator.
export function concatenationToInterpolation(program) {
  return rewrite(program, (current) => {
    if (current.kind === 'Binary' && current.operator === 'add' && current.type === 'text') {
      const parts = [current.left, current.right].flatMap((part) => (part.kind === 'Interpolation' ? part.parts : [part]));
      return { ...partsToValue(parts), type: 'text' };
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
  let result = comment.replace(new RegExp(`(\\bin )${escapeExpression(source.label)}(?![\\w#+])`, 'g'), `$1${target.label}`);
  for (const [term, sourceWord] of Object.entries(source.terms)) {
    const targetWord = target.terms[term];
    if (targetWord && sourceWord !== targetWord) {
      result = result.replace(new RegExp(`\\b${escapeExpression(sourceWord)}\\b`, 'g'), targetWord);
    }
  }
  return result;
}

export function adaptComments(program, { from, to, mode }) {
  if (mode === 'same-effect') {
    const stripped = rewrite(program, (current) => (current.kind === 'Comment' ? undefined : current));
    return { ...stripped, comments: [], mainComments: [], functions: stripped.functions.map((item) => ({ ...item, comments: [] })) };
  }
  if (mode === 'literal' || from === to) return program;
  const adapt = (value) => adaptCommentText(value, from, to);
  const adapted = rewrite(program, (current) => (current.kind === 'Comment' ? { ...current, text: adapt(current.text) } : current));
  return {
    ...adapted,
    comments: adapted.comments.map(adapt),
    mainComments: (adapted.mainComments ?? []).map(adapt),
    functions: adapted.functions.map((item) => ({ ...item, comments: (item.comments ?? []).map(adapt) })),
  };
}

// Rust, Kotlin and Swift parameters cannot be reassigned. When a function
// assigns a parameter, the target works on a mutable local copy instead.
export function copyReassignedParameters(program, { to }) {
  if (!languageSyntax(to).immutableParameters) return program;
  return {
    ...program,
    functions: program.functions.map((item) => {
      const assigned = new Set();
      rewrite(item.body, (current) => {
        if (current.kind === 'Assignment') assigned.add(current.name);
        return current;
      });
      const copies = item.parameters
        .filter((parameter) => assigned.has(parameter.name))
        .map((parameter) => node('Declaration', { name: parameter.name, type: parameter.type, value: { kind: 'Name', name: parameter.name, type: parameter.type }, mutable: true }));
      return copies.length ? { ...item, body: block([...copies, ...item.body.statements]) } : item;
    }),
  };
}

export const contextRules = [adaptComments, copyReassignedParameters];
