// Meta program -> controlled natural language text.
//
// Every sentence is the first template the language lists for the statement,
// with its slots filled. Expressions are written at a precedence level and
// get parentheses only where the reader would otherwise group them
// differently.

import { naturalLanguage } from './catalog.js';
import { questionAspects, questionKey, answerKey } from '../meta/questions.js';
import { queryKey } from '../meta/queries.js';
import { collectionPhrase } from '../meta/collection-phrases.js';
import {
  binaryTemplates,
  levelIndex,
  levelOfTemplate,
  levels,
  unaryTemplates,
} from './levels.js';
import { lowerForEach } from '../meta/for-each.js';
import { layout, subtract, number } from '../meta/tree.js';
import { agree, slotCase } from './agreement.js';
import { foldWord } from './tokens.js';
import {
  mappedComments,
  mappedEmitter,
  mappedLine,
  renderLines,
} from '../translation/emission-map.js';

const indentUnit = '  ';

// Neutral name ("move-disks") -> the language's spelling of it.
export function writeName(neutral, language) {
  const words = neutral
    .split('-')
    .map((word) => language.lexicon[word] ?? word);
  const spelled = words.join(language.nameJoiner);
  return language.reserved.has(spelled.toLowerCase()) ? `${spelled}_` : spelled;
}

const word = (value) => ({ type: 'word', value });

// Fill the first template of `key` with token lists.
function fill(language, key, slots) {
  const template = language.compiled[key]?.[0];
  if (!template) {
    throw new Error(`${language.id} has no "${key}" template`);
  }
  return template.flatMap((token) => {
    if (token.type !== 'slot') {
      return [token];
    }
    const value = slots[token.value];
    if (!value) {
      throw new Error(
        `Template "${key}" of ${language.id} uses {${token.value}}`
      );
    }
    return agree(value, language, slotCase(language, key, token.value));
  });
}

function list(language, items) {
  if (items.length < 2 || !language.listAnd) {
    return items.flatMap((item, index) =>
      index
        ? [{ type: 'separator', value: language.listSeparator }, ...item]
        : item
    );
  }
  const head = items
    .slice(0, -1)
    .flatMap((item, index) =>
      index
        ? [{ type: 'separator', value: language.listSeparator }, ...item]
        : item
    );
  return [...head, ...language.listAnd.split(' ').map(word), ...items.at(-1)];
}

const parenthesize = (tokens) => [
  { type: 'open', value: '(' },
  ...tokens,
  { type: 'close', value: ')' },
];

function levelOf(expression) {
  switch (expression.kind) {
    case 'Interpolation':
      return levelIndex.join;
    case 'Binary':
      return levelOfTemplate[binaryTemplates[expression.operator]];
    case 'Unary':
      return levelOfTemplate[unaryTemplates[expression.operator]];
    default:
      return levelIndex.primary;
  }
}

function binarySlots(expression, language, level) {
  const { associativity } = levels[level];
  const leftLevel = associativity === 'left' ? level : level + 1;
  return {
    left: writeExpression(expression.left, language, leftLevel),
    right: writeExpression(expression.right, language, level + 1),
  };
}

// Tokens of an expression written where only a primary fits (an index, an
// array or the length and fill of a new array).
const operand = (expression, language) =>
  writeExpression(expression, language, levelIndex.primary);

// Expressions separated by the list separator, as call arguments are.
function separated(expressions, language) {
  const separator = { type: 'separator', value: language.listSeparator };
  return expressions.flatMap((expression, index) => {
    const tokens = writeExpression(expression, language, 0);
    let depth = 0;
    const hasOwnSeparator = tokens.some(({ type }) => {
      if (type === 'open') {
        depth += 1;
      }
      if (type === 'close') {
        depth -= 1;
      }
      return type === 'separator' && depth === 0;
    });
    return [
      ...(index ? [separator] : []),
      ...(hasOwnSeparator ? parenthesize(tokens) : tokens),
    ];
  });
}

function matchesReflectionFrame(tokens, language) {
  const matches = (literal, token) =>
    literal.type === token.type &&
    (literal.type === 'word'
      ? literal.folded === foldWord(token.value)
      : literal.value === token.value);
  return questionAspects.some((aspect) =>
    language.compiled[answerKey(aspect)].some((phrase) => {
      const subject = phrase.findIndex(
        ({ type, value }) => type === 'slot' && value === 'subject'
      );
      return (
        subject !== -1 &&
        tokens.length >= phrase.length &&
        phrase
          .slice(0, subject)
          .every((literal, index) => matches(literal, tokens[index])) &&
        phrase
          .slice(subject + 1)
          .every((literal, index, suffix) =>
            matches(literal, tokens[tokens.length - suffix.length + index])
          )
      );
    })
  );
}

function writeCall(expression, language) {
  const callee = writeName(expression.callee, language);
  const key = expression.arguments.length ? 'call' : 'call-without-arguments';
  const slots = {
    callee: [word(callee)],
    arguments: separated(expression.arguments, language),
  };
  const tokens = fill(language, key, slots);
  // A contextual reflection phrase takes priority over a bare callee spelling.
  if (!callee.endsWith('_') && matchesReflectionFrame(tokens, language)) {
    return fill(language, key, { ...slots, callee: [word(`${callee}_`)] });
  }
  return tokens;
}

function collectionExpression(expression, language) {
  const phrase = collectionPhrase(expression);
  if (phrase) {
    return fill(
      language,
      phrase.key,
      Object.fromEntries(
        Object.entries(phrase.slots).map(([key, value]) => [
          key,
          parenthesize(writeExpression(value, language, 0)),
        ])
      )
    );
  }
  throw new Error(`Cannot write a ${expression.kind} expression in words`);
}

function primary(expression, language) {
  switch (expression.kind) {
    case 'Query':
      return fill(
        language,
        queryKey(expression.eager),
        querySlots(expression, language)
      );
    case 'Question':
      return fill(language, answerKey(expression.aspect), {
        subject: operand(expression.subject, language),
      });
    case 'Number':
      return [{ type: 'number', value: expression.value }];
    case 'Text':
      return [{ type: 'text', value: expression.value }];
    case 'Boolean':
      return [
        {
          ...word(expression.value ? language.true : language.false),
          reference: true,
        },
      ];
    case 'Name':
      return [
        { ...word(writeName(expression.name, language)), reference: true },
      ];
    case 'Call':
      return writeCall(expression, language);
    // An empty array is a new array of no zeros: no template lists nothing.
    case 'ArrayLiteral':
      return expression.elements.length
        ? fill(language, 'array', {
            elements: separated(expression.elements, language),
          })
        : fill(language, 'new-array', {
            length: [{ type: 'number', value: 0 }],
            fill: [{ type: 'number', value: 0 }],
          });
    case 'NewArray':
      return fill(language, 'new-array', {
        length: operand(expression.length, language),
        fill: operand(expression.fill, language),
      });
    case 'Index':
      return fill(language, 'element', {
        index: operand(expression.index, language),
        array: operand(expression.array, language),
      });
    case 'Length':
      return fill(language, 'length', {
        array: operand(expression.array, language),
      });
    default:
      return collectionExpression(expression, language);
  }
}

function querySlots(expression, language) {
  return {
    variable: [word(writeName(expression.variable, language))],
    ...Object.fromEntries(
      ['source', 'condition', 'projection'].map((key) => [
        key,
        operand(expression[key], language),
      ])
    ),
  };
}

// Tokens of an expression that must bind at least as tightly as `minimum`.
export function writeExpression(expression, language, minimum = 0) {
  const level = levelOf(expression);
  let tokens;
  if (expression.kind === 'Interpolation') {
    tokens = expression.parts
      .map((part) => writeExpression(part, language, level + 1))
      .reduce((left, right) => fill(language, 'join', { left, right }));
  } else if (expression.kind === 'Binary') {
    tokens = fill(
      language,
      binaryTemplates[expression.operator],
      binarySlots(expression, language, level)
    );
  } else if (expression.kind === 'Unary') {
    tokens = fill(language, unaryTemplates[expression.operator], {
      operand: writeExpression(expression.operand, language, level),
    });
  } else {
    tokens = primary(expression, language);
  }
  return level < minimum ? parenthesize(tokens) : tokens;
}

// Tokens -> text. Spaces go between tokens, except next to parentheses and
// before separators.
export function renderTokens(tokens, language) {
  const [opening, closing] = language.quotes;
  let output = '';
  let previous;
  for (const token of tokens) {
    const text =
      token.type === 'text'
        ? `${opening}${token.value.split(closing).join(closing + closing)}${closing}`
        : String(token.value);
    const glued =
      !previous ||
      previous.type === 'open' ||
      token.type === 'close' ||
      token.type === 'separator';
    output += glued ? text : ` ${text}`;
    previous = token;
  }
  return output;
}

function capitalize(sentence) {
  return sentence.charAt(0).toLocaleUpperCase() + sentence.slice(1);
}

class Writer {
  constructor(language) {
    this.language = language;
    this.lines = [];
  }

  sentence(depth, key, slots, opensBlock = false) {
    const { language } = this;
    const text = renderTokens(fill(language, key, slots), language);
    const end = opensBlock
      ? language.blockEnd
      : key.startsWith('question-')
        ? '?'
        : language.sentenceEnd;
    this.lines.push(
      mappedLine(this, `${indentUnit.repeat(depth)}${capitalize(text)}${end}`)
    );
  }

  // A comment of several lines becomes one note per line.
  note(depth, text) {
    for (const part of text.split('\n')) {
      const line = this.language.note.replace('{text}', part.trim());
      this.lines.push(mappedLine(this, `${indentUnit.repeat(depth)}${line}`));
    }
  }

  expression(value, level = 0) {
    return writeExpression(value, this.language, level);
  }

  block(block, depth) {
    const statements = block?.statements ?? [];
    if (!statements.length) {
      this.sentence(depth, 'nothing', {});
    }
    layout(statements).forEach((statement) => this.statement(statement, depth));
  }

  conditional(statement, depth, key = 'if') {
    this.sentence(
      depth,
      key,
      { condition: this.expression(statement.condition) },
      true
    );
    this.block(statement.then, depth + 1);
    const { otherwise } = statement;
    if (otherwise?.kind === 'If') {
      this.conditional(otherwise, depth, 'else-if');
    } else if (otherwise) {
      this.sentence(depth, 'else', {}, true);
      this.block(otherwise, depth + 1);
    }
  }

  statement(statement, depth) {
    switch (statement.kind) {
      case 'Comment':
        return this.note(depth, statement.text);
      case 'Blank':
        // Concrete syntax: empty lines between sentences stay.
        return this.lines.at(-1) === ''
          ? undefined
          : this.lines.push(...Array(statement.lines).fill(''));
      case 'Declaration':
      case 'Assignment':
      case 'IndexAssignment':
        return this.binding(statement, depth);
      case 'Print':
        return this.printing(statement, depth);
      case 'Return':
        return this.giveBack(statement, depth);
      case 'Evaluate':
        return this.evaluation(statement.expression, depth);
      case 'If':
        return this.conditional(statement, depth);
      case 'While':
      case 'CountingLoop':
      case 'ForEach':
        return this.loop(statement, depth);
      case 'Block':
        return this.block(statement, depth);
      default:
        throw new Error(`Cannot write a ${statement.kind} statement in words`);
    }
  }

  evaluation(expression, depth) {
    if (expression.kind === 'Query') {
      return this.sentence(
        depth,
        queryKey(expression.eager, true),
        querySlots(expression, this.language)
      );
    }
    if (expression.kind === 'Question') {
      return this.sentence(depth, questionKey(expression.aspect), {
        subject: this.expression(expression.subject),
      });
    }
    return this.sentence(depth, 'evaluate', {
      expression: this.expression(expression),
    });
  }

  printing(statement, depth) {
    const key = statement.newline ? 'print-line' : 'print';
    return this.sentence(depth, key, {
      value: this.expression(statement.value),
    });
  }

  // A sentence that gives a name or an element a value.
  binding(statement, depth) {
    const { language } = this;
    const name = (value) => [word(writeName(value, language))];
    switch (statement.kind) {
      case 'Declaration':
        return this.sentence(depth, 'declare', {
          name: name(statement.name),
          value: this.expression(statement.value),
        });
      case 'Assignment':
        if (statement.operator && statement.operator !== '=') {
          throw new Error(
            `Unexpanded compound assignment ${statement.operator}`
          );
        }
        return this.sentence(depth, 'assign', {
          name: name(statement.name),
          value: this.expression(statement.value),
        });
      case 'IndexAssignment':
        return this.sentence(depth, 'set-element', {
          name: name(statement.name),
          index: this.expression(statement.index, levelIndex.primary),
          value: this.expression(statement.value),
        });
    }
  }

  giveBack(statement, depth) {
    return statement.value
      ? this.sentence(depth, 'return-value', {
          value: this.expression(statement.value),
        })
      : this.sentence(depth, 'return', {});
  }

  loop(statement, depth) {
    if (statement.kind === 'While') {
      this.sentence(
        depth,
        'while',
        { condition: this.expression(statement.condition) },
        true
      );
    } else if (statement.kind === 'ForEach') {
      this.sentence(
        depth,
        'for-each',
        {
          variable: [word(writeName(statement.variable, this.language))],
          array: this.expression(statement.array, levelIndex.primary),
        },
        true
      );
    } else {
      // Natural languages count up to the last value, not past it.
      this.sentence(
        depth,
        'for',
        {
          variable: [word(writeName(statement.variable, this.language))],
          start: this.expression(statement.start),
          last: this.expression(subtract(statement.end, number(1))),
        },
        true
      );
    }
    return this.block(statement.body, depth + 1);
  }

  function(item) {
    const { language } = this;
    this.notes(item);
    const name = [word(writeName(item.name, language))];
    if (item.parameters.length) {
      const parameters = list(
        language,
        item.parameters.map((parameter) => [
          word(writeName(parameter.name, language)),
        ])
      );
      this.sentence(0, 'function', { name, parameters }, true);
    } else {
      this.sentence(0, 'function-without-parameters', { name }, true);
    }
    if (item.documentation) {
      this.sentence(1, 'documentation', {
        value: this.expression(item.documentation),
      });
    }
    this.block(item.body, 1);
  }

  notes(owner, key = 'comments') {
    mappedComments(this, owner[key] ?? [], (text) => this.note(0, text));
  }

  program(program) {
    this.notes(program);
    for (const item of program.functions) {
      if (this.lines.length) {
        this.lines.push('');
      }
      this.function(item);
    }
    const main = program.main?.statements ?? [];
    if (main.length || program.mainComments?.length) {
      if (this.lines.length) {
        this.lines.push('');
      }
      this.notes(program, 'mainComments');
      layout(main).forEach((statement) => this.statement(statement, 0));
    }
    return renderLines(this, this.lines);
  }
}

export function writeNatural(program, id) {
  const language = naturalLanguage(id);
  const sentence = language.compiled['for-each'].length > 0;
  return mappedEmitter(new Writer(language)).program(
    lowerForEach(program, () => sentence)
  );
}
