// One-off source edit for the emitter: the six new languages.
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'js/src/formal/emitter.js';
let source = readFileSync(path, 'utf8');
const replace = (from, to) => {
  if (!source.includes(from)) {
    throw new Error(`missing: ${from.slice(0, 70)}`);
  }
  source = source.replace(from, to);
};

replace(
  `import { add, number } from './meta.js';`,
  `import { add, block, name, node, number } from './meta.js';`
);
replace(
  `  'kotlin',
  'php',
]);`,
  `  'kotlin',
  'php',
  'perl',
  'dart',
  'scala',
  'r',
  'groovy',
]);
const withoutTerminator = new Set([
  'python',
  'ruby',
  'lua',
  'go',
  'kotlin',
  'swift',
  'scala',
  'julia',
  'r',
  'groovy',
]);`
);
replace(
  `    return ['python', 'ruby', 'lua', 'go', 'kotlin', 'swift'].includes(
      this.syntax.id
    )
      ? ''
      : ';';`,
  `    return withoutTerminator.has(this.syntax.id) ? '' : ';';`
);
replace(
  `    if (['php', 'kotlin'].includes(this.syntax.id)) {
      result = result.replace(/\\$/g, '\\\\$');
    }`,
  `    // Characters that would start an embedded variable, such as $ in PHP.
    for (const sigil of this.syntax.escapeSigils ?? []) {
      result = result.replaceAll(sigil, \`\\\\\${sigil}\`);
    }`
);
replace(
  `    if (format === 'braces') {`,
  `    if (format === 'dollar') {
      result = result.replace(/\\$/g, '$$$$');
    }
    if (format === 'braces') {`
);
replace(
  `      case 'Number':
        return expression.value < 0 && parent > 6
          ? \`(\${expression.value})\`
          : String(expression.value);`,
  `      case 'Number': {
        // R needs a suffix to keep integers integral: 1L.
        const written = \`\${expression.value}\${Number.isInteger(expression.value) ? (this.syntax.numberSuffix ?? '') : ''}\`;
        return expression.value < 0 && parent > 6 ? \`(\${written})\` : written;
      }`
);
replace(
  `    const level = precedence[expression.operator];
    const left = this.expression(expression.left, level);
    const right = this.expression(expression.right, level + 1);
    let result;
    if (expression.operator === 'divide') {
      const integer = this.syntax.operators.integerDivide;
      if (integer) {
        result = \`\${left} \${integer} \${right}\`;
      } else if (
        this.syntax.id === 'javascript' ||
        this.syntax.id === 'typescript'
      ) {
        return \`Math.trunc(\${this.expression(expression.left)} / \${this.expression(expression.right)})\`;
      } else if (this.syntax.id === 'php') {
        return \`intdiv(\${this.expression(expression.left)}, \${this.expression(expression.right)})\`;
      } else {
        result = \`\${left} / \${right}\`;
      }
    } else {`,
  `    const level = precedence[expression.operator];
    // R's %% and %/% bind tighter than * and /, so their operands that are
    // themselves operations keep parentheses.
    const tight =
      this.syntax.id === 'r' &&
      ['divide', 'remainder'].includes(expression.operator);
    const left = this.expression(expression.left, tight ? 7 : level);
    const right = this.expression(expression.right, tight ? 7 : level + 1);
    let result;
    if (expression.operator === 'divide') {
      const integer = this.syntax.operators.integerDivide;
      const spelling = this.syntax.integerDivision;
      const whole = (part) => this.expression(part);
      if (integer) {
        result = \`\${left} \${integer} \${right}\`;
      } else if (spelling?.wrapper) {
        return \`\${spelling.wrapper}(\${whole(expression.left)} / \${whole(expression.right)})\`;
      } else if (spelling?.call) {
        return \`\${spelling.call}(\${whole(expression.left)}, \${whole(expression.right)})\`;
      } else if (spelling?.method) {
        return \`\${this.expression(expression.left, 8)}.\${spelling.method}(\${whole(expression.right)})\`;
      } else {
        result = \`\${left} / \${right}\`;
      }
    } else {`
);
replace(
  `      case 'kotlin':
        return render('\${', '}');
      case 'php':
        // PHP interpolates only variables, so computed parts are concatenated.
        return parts`,
  `      case 'kotlin':
      case 'dart':
      case 'groovy':
        return render('\${', '}');
      case 'scala':
        return \`s\${render('\${', '}', { format: 'dollar' })}\`;
      case 'julia':
        return render('$(', ')');
      case 'r':
        return \`paste0(\${parts.map((part) => this.expression(part)).join(', ')})\`;
      case 'php':
      case 'perl':
        // PHP and Perl interpolate only variables, so computed parts are
        // concatenated.
        return parts`
);
replace(
  `  interpolationOrText(parts) {
    const merged = parts.reduce((result, part) => {
      if (part.kind === 'Text' && result.at(-1)?.kind === 'Text') {
        return [
          ...result.slice(0, -1),
          { kind: 'Text', value: result.at(-1).value + part.value },
        ];
      }
      return [...result, part];
    }, []);
    return merged.length === 1`,
  `  interpolationOrText(parts) {
    const merged = mergeTexts(parts);
    return merged.length === 1`
);
replace(
  `  condition(expression) {`,
  `  returnStatement({ value }) {
    const end = this.terminator();
    if (!value) {
      return \`return\${end}\`;
    }
    // R's return is a function.
    return this.syntax.id === 'r'
      ? \`return(\${this.expression(value)})\`
      : \`return \${this.expression(value)}\${end}\`;
  }

  condition(expression) {`
);
replace(
  `        return this.line(
          statement.value
            ? \`return \${this.expression(statement.value)}\${end}\`
            : \`return\${end}\`
        );`,
  `        return this.line(this.returnStatement(statement));`
);
replace(
  `    if (
      compound &&
      this.syntax.id !== 'lua' &&`,
  `    if (
      compound &&
      this.syntax.compoundAssignment !== false &&`
);
replace(
  `    return \`\${target} = \${this.expression(value)}\${this.terminator()}\`;`,
  `    return \`\${target} \${this.syntax.assignment ?? '='} \${this.expression(value)}\${this.terminator()}\`;`
);
replace(
  `    if (this.syntax.blocks === 'braces') {
      return \`} else if \${condition} {\`;
    }`,
  `    if (this.syntax.blocks === 'braces') {
      return \`} \${this.syntax.bracedElseIf ?? 'else if'} \${condition} {\`;
    }`
);
replace(
  `  countingLoop({ variable: identifier, start, end, body }) {
    const from = this.expression(start);`,
  `  countingLoop(loop) {
    const { variable: identifier, start, end, body } = loop;
    if (this.syntax.id === 'r' && !isLiteralRange(start, end)) {
      return this.countingWhile(loop);
    }
    const from = this.expression(start);
    const last = this.expression(add(end, number(-1)), 5);`
);
replace(
  `      swift: \`for \${identifier} in \${from}..<\${to}\`,
    };`,
  `      swift: \`for \${identifier} in \${from}..<\${to}\`,
      perl: \`for my \${target} (\${from} .. \${last})\`,
      dart: \`for (var \${identifier} = \${from}; \${identifier} < \${to}; \${identifier}++)\`,
      scala: \`for (\${identifier} <- \${from} until \${to})\`,
      julia: \`for \${identifier} in \${from}:\${last}\`,
      r: \`for (\${identifier} in \${from}:\${last})\`,
      groovy: \`for (\${identifier} in \${from}..<\${to})\`,
    };`
);
replace(
  `  // ---- functions and program ----`,
  `  // R's a:b counts down when b < a, so a range that may be empty becomes
  // a while loop.
  countingWhile({ variable: identifier, start, end, body }) {
    const counter = name(identifier);
    this.statement(
      node('Declaration', { name: identifier, value: start, mutable: true })
    );
    this.whileStatement({
      condition: node('Binary', { operator: 'less', left: counter, right: end }),
      body: block([
        ...body.statements,
        node('Assignment', {
          name: identifier,
          operator: '=',
          value: add(counter, number(1)),
        }),
      ]),
    });
  }

  // ---- functions and program ----`
);
replace(
  `    this.openBlock(this.signature(item));
    this.body(item.body);`,
  `    this.openBlock(this.signature(item));
    // Perl receives its arguments in @_.
    if (this.syntax.parameters === 'unpacked' && item.parameters.length) {
      const names = item.parameters.map(({ name: id }) => this.variable(id));
      this.line(\`my (\${names.join(', ')}) = @_;\`);
    }
    this.body(item.body);`
);
replace(
  `      java: 'public static void main(String[] args)',
    }[this.syntax.id];`,
  `      java: 'public static void main(String[] args)',
      dart: 'void main()',
      scala: 'def main(args: Array[String]): Unit =',
      julia: 'function main()',
    }[this.syntax.id];`
);
replace(
  `      this.openBlock(
        this.syntax.id === 'csharp' ? 'class Program' : 'class Main'
      );`,
  `      this.openBlock(
        this.syntax.container ??
          (this.syntax.id === 'csharp' ? 'class Program' : 'class Main')
      );`
);
replace(
  `      this.openBlock(header);
      this.body(program.main);
      this.closeBlock();
    } else {`,
  `      this.openBlock(header);
      this.body(program.main);
      this.closeBlock();
      if (this.syntax.callMain) {
        this.line();
        this.line(this.syntax.callMain);
      }
    } else {`
);
replace(
  `    if (this.syntax.id === 'go') {
      lines.push('package main', '');
    }`,
  `    if (this.syntax.id === 'go') {
      lines.push('package main', '');
    }
    lines.push(...(this.syntax.prelude ?? []));
    if (this.uses.has('dart:io')) {
      lines.push("import 'dart:io';");
    }`
);
replace(
  `const compoundOperators = {`,
  `function mergeTexts(parts) {
  return parts.reduce((result, part) => {
    if (part.kind === 'Text' && result.at(-1)?.kind === 'Text') {
      return [
        ...result.slice(0, -1),
        { kind: 'Text', value: result.at(-1).value + part.value },
      ];
    }
    return [...result, part];
  }, []);
}

const isLiteralRange = (start, end) =>
  start.kind === 'Number' && end.kind === 'Number' && start.value < end.value;

const compoundOperators = {`
);
replace(
  `  swift: (emitter, { newline, single }) =>
    newline ? \`print(\${single()})\` : \`print(\${single()}, terminator: "")\`,
};`,
  `  swift: (emitter, { newline, single }) =>
    newline ? \`print(\${single()})\` : \`print(\${single()}, terminator: "")\`,
  perl: (emitter, { lineParts }) =>
    \`print \${emitter.interpolationOrText(lineParts)};\`,
  dart: (emitter, { newline, single }) => {
    if (newline) {
      return \`print(\${single()});\`;
    }
    emitter.uses.add('dart:io');
    return \`stdout.write(\${single()});\`;
  },
  julia: (emitter, { newline, single }) =>
    \`\${newline ? 'println' : 'print'}(\${single()})\`,
  r: (emitter, { lineParts }) =>
    \`cat(\${mergeTexts(lineParts)
      .map((part) => emitter.expression(part))
      .join(', ')}, sep = "")\`,
};`
);
replace(
  `printers.typescript = printers.javascript;`,
  `printers.typescript = printers.javascript;
printers.scala = printers.kotlin;
printers.groovy = printers.kotlin;`
);
replace(
  `  swift: (emitter, { name, mutable, initial }) =>
    \`\${mutable ? 'var' : 'let'} \${name} = \${initial}\`,
  typedPrefix: (emitter, { name, type, initial }) =>
    \`\${emitter.type(type)} \${name} = \${initial};\`,
};`,
  `  swift: (emitter, { name, mutable, initial }) =>
    \`\${mutable ? 'var' : 'let'} \${name} = \${initial}\`,
  perl: (emitter, { name, initial }) => \`my $\${name} = \${initial};\`,
  dart: (emitter, { name, mutable, initial }) =>
    \`\${mutable ? 'var' : 'final'} \${name} = \${initial};\`,
  scala: (emitter, { name, type, mutable, initial }) =>
    \`\${mutable ? 'var' : 'val'} \${name}: \${emitter.type(type)} = \${initial}\`,
  r: (emitter, { name, initial }) => \`\${name} <- \${initial}\`,
  typedPrefix: (emitter, { name, type, initial }) =>
    \`\${emitter.type(type)} \${name} = \${initial}\${emitter.terminator()}\`,
};`
);
replace(
  `declarers.ruby = declarers.python;`,
  `declarers.ruby = declarers.python;
declarers.julia = declarers.python;`
);
replace(
  `  typedPrefix: ({ name, typed, returns }) =>
    \`\${returns} \${name}(\${typed((id, type) => \`\${type} \${id}\`)})\`,
};
signatures.ruby = signatures.python;`,
  `  perl: ({ name }) => \`sub \${name}\`,
  scala: ({ name, typed, returns }) =>
    \`def \${name}(\${typed((id, type) => \`\${id}: \${type}\`)}): \${returns} =\`,
  julia: ({ name, names }) => \`function \${name}(\${names})\`,
  r: ({ name, names }) => \`\${name} <- function(\${names})\`,
  typedPrefix: ({ name, typed, returns }) =>
    \`\${returns} \${name}(\${typed((id, type) => \`\${type} \${id}\`)})\`,
};
signatures.ruby = signatures.python;`
);
writeFileSync(path, source);
