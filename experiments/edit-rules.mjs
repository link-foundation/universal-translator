// One-off source edit for the rule layers: the six new languages.
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'js/src/formal/rules.js';
let source = readFileSync(path, 'utf8');
const replace = (from, to) => {
  if (!source.includes(from)) {
    throw new Error(`missing: ${from.slice(0, 70)}`);
  }
  source = source.replace(from, to);
};

replace(
  `import { neutralName, renameDeclared, spellName } from './names.js';`,
  `import {
  nameWords,
  neutralName,
  renameDeclared,
  spellName,
} from './names.js';`
);

// Output procedures: a language may describe its own, which then take
// precedence over the shared tables (Julia's print does not end the line).
replace(
  `function printFromCall(call) {
  const values`,
  `function printFromCall(call, syntax) {
  const own = syntax.printCalls;
  const isLine = own?.line.includes(call.callee) ?? lineCalls.has(call.callee);
  const isText =
    own?.text.includes(call.callee) ??
    (textCalls.has(call.callee) || call.callee === 'echo');
  const values`
);
replace(
  `  if (lineCalls.has(call.callee)) {
    const newline`,
  `  if (isLine) {
    const newline`
);
replace(
  `  if (textCalls.has(call.callee) || call.callee === 'echo') {`,
  `  if (isText) {`
);
replace(
  `export function recognizePrint(program) {
  return rewrite(program, (current) => {`,
  `export function recognizePrint(program, { from } = {}) {
  const syntax = from ? languageSyntax(from) : {};
  return rewrite(program, (current) => {`
);
replace(
  `      return printFromCall(expression) ?? current;`,
  `      return printFromCall(expression, syntax) ?? current;`
);

// R's paste0(a, b) joins text like PHP's ".".
replace(
  `export function concatenationOperator(program) {
  return rewrite(program, (current) => {
    if (current.kind !== 'Binary' || current.operator !== 'concatenate') {
      return current;
    }
    return partsToValue(
      [current.left, current.right].flatMap((part) =>`,
  `export function concatenationOperator(program, { from } = {}) {
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
      joined.flatMap((part) =>`
);

// Scala copies a reassigned parameter from a renamed one.
replace(
  `      const names = new Set(item.parameters.map((parameter) => parameter.name));
      while (
        statements[0]?.kind === 'Declaration' &&
        names.has(statements[0].name) &&
        statements[0].value?.kind === 'Name' &&
        statements[0].value.name === statements[0].name
      ) {
        statements.shift();
      }
      return { ...item, body: { ...item.body, statements } };`,
  `      let parameters = item.parameters;
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
      };`
);
replace(
  `// JavaScript spells integer division \`Math.trunc(a / b)\` and PHP spells it
// \`intdiv(a, b)\`. Both mean the meta operator "divide".
export function integerDivisionCalls(program) {
  return rewrite(program, (current) => {
    if (current.kind !== 'Call') {
      return current;
    }
    const [first, second] = current.arguments;
    if (
      current.callee === 'Math.trunc' &&
      current.arguments.length === 1 &&
      first.kind === 'Binary' &&
      first.operator === 'divide'
    ) {
      return first;
    }
    if (current.callee === 'intdiv' && current.arguments.length === 2) {
      return node('Binary', { operator: 'divide', left: first, right: second });
    }
    return current;
  });
}`,
  `// The neutral name of the parameter that a copy named \`name\` is made from.
const copyName = (name) => ['initial', ...nameWords(name)].join('-');

// Languages without an integer division operator call a library procedure:
// JavaScript writes \`Math.trunc(a / b)\`, Perl \`int(a / b)\`, PHP
// \`intdiv(a, b)\`, Julia \`div(a, b)\` and Groovy \`a.intdiv(b)\`. Each means
// the meta operator "divide". The language description names its spelling.
const integerDivisionSpellings = [
  { wrapper: 'Math.trunc' },
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
    first.operator === 'divide'
  ) {
    return first;
  }
  if (call.callee === callee && call.arguments.length === 2) {
    return divide(first, second);
  }
  if (method && call.callee === \`.\${method}\` && call.arguments.length === 2) {
    return divide(first, second);
  }
  // a.intdiv(b) with a named receiver reads as the callee "a.intdiv".
  if (
    method &&
    call.callee.endsWith(\`.\${method}\`) &&
    call.arguments.length === 1
  ) {
    return divide(
      { kind: 'Name', name: call.callee.slice(0, -method.length - 1) },
      first
    );
  }
  return undefined;
}

export function integerDivisionCalls(program, { from } = {}) {
  const own = from && languageSyntax(from).integerDivision;
  const spellings = own
    ? [own, ...integerDivisionSpellings]
    : integerDivisionSpellings;
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
}`
);

// Copies of reassigned parameters.
replace(
  `export function copyReassignedParameters(program, { to }) {
  if (!languageSyntax(to).immutableParameters) {
    return program;
  }`,
  `// Scala cannot declare a local with the name of a parameter, so there the
// parameter itself is renamed: \`def f(initialFirst: Long)\` with
// \`var first: Long = initialFirst\`.
export function copyReassignedParameters(program, { to }) {
  const immutable = languageSyntax(to).immutableParameters;
  if (!immutable) {
    return program;
  }`
);
replace(
  `      const copies = item.parameters
        .filter((parameter) => assigned.has(parameter.name))
        .map((parameter) =>
          node('Declaration', {
            name: parameter.name,
            type: parameter.type,
            value: { kind: 'Name', name: parameter.name, type: parameter.type },
            mutable: true,
          })
        );
      return copies.length
        ? { ...item, body: block([...copies, ...item.body.statements]) }
        : item;`,
  `      const source = (parameter) =>
        assigned.has(parameter.name) && immutable === 'renamed'
          ? copyName(parameter.name)
          : parameter.name;
      const copies = item.parameters
        .filter((parameter) => assigned.has(parameter.name))
        .map((parameter) =>
          node('Declaration', {
            name: parameter.name,
            type: parameter.type,
            value: { kind: 'Name', name: source(parameter), type: parameter.type },
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
        : item;`
);
writeFileSync(path, source);
