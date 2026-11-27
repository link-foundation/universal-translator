// Controlled natural language text -> meta program.
//
// The reader accepts every template a language lists (the first one is the
// one the writer uses; later ones are accepted alternatives). A sentence is
// matched against templates token by token; a slot takes any span of tokens
// that parses as what the slot holds (an expression, a name or a list of
// names), and literal words only match outside parentheses.

import { add, block, name, node, number, walk } from '../meta/tree.js';
import { raiseForEach } from '../meta/for-each.js';
import { naturalLanguage } from './catalog.js';
import { tokenize } from './tokens.js';
import { levelIndex, levels, operatorOfTemplate } from './levels.js';
import { questionAspects, questionKey, answerKey } from '../meta/questions.js';
import { notePattern, sentenceLines } from './lines.js';
import { queryKeys, queryNode } from '../meta/queries.js';
import { collectionKeys, collectionNode } from '../meta/collection-phrases.js';
import { normalize, slotCase } from './agreement.js';
import { attachComments, withOrigin } from '../translation/source-origins.js';

const nameSlots = new Set(['name', 'variable', 'callee']);
// Slots the writer fills with a primary expression (parenthesized unless
// it is one already).
const primarySlots = new Set(['index', 'array', 'length', 'fill']);
const arrayKeys = ['array', 'new-array', 'element', 'length'];

// Depth of parentheses before each token, so literals only match at depth 0.
function depths(tokens) {
  let depth = 0;
  return tokens.map((token) => {
    if (token.type === 'close') {
      depth -= 1;
    }
    const current = depth;
    if (token.type === 'open') {
      depth += 1;
    }
    return current;
  });
}

const sameLiteral = (template, token) =>
  template.type === token.type &&
  (template.type === 'word'
    ? template.folded === token.folded
    : template.type !== 'text' || template.value === token.value);

export class SentenceReader {
  constructor(language) {
    this.language = language;
  }

  // Neutral name of a written name token, or undefined.
  readName(token) {
    if (token?.type !== 'word' || this.language.reserved.has(token.folded)) {
      return undefined;
    }
    if (!/^[\p{L}_]/u.test(token.value)) {
      return undefined;
    }
    const written = token.value.endsWith('_')
      ? token.value.slice(0, -1)
      : token.value;
    return written
      .split(this.language.nameJoiner)
      .map((part) => {
        const folded = part.toLowerCase();
        return this.language.reverseLexicon.get(folded) ?? folded;
      })
      .join('-');
  }

  // Match `template` against tokens[start, end). Returns the slot values or
  // undefined. `slot(nameOfSlot, from, to)` parses a slot span.
  match(template, tokens, start, end, slot, levels0 = depths(tokens)) {
    const captured = {};
    const step = (templateIndex, position) => {
      if (templateIndex === template.length) {
        return position === end;
      }
      const current = template[templateIndex];
      if (current.type !== 'slot') {
        if (
          position < end &&
          levels0[position] === levels0[start] &&
          sameLiteral(current, tokens[position])
        ) {
          return step(templateIndex + 1, position + 1);
        }
        return false;
      }
      // A slot spans at least one token; try the longest span first so
      // left-associative operators split at their rightmost occurrence.
      const last = templateIndex === template.length - 1;
      for (let stop = last ? end : end - 1; stop > position; stop -= 1) {
        if (levels0[stop] !== levels0[start] && stop !== end) {
          continue;
        }
        const value = slot(current.value, position, stop);
        if (value !== undefined) {
          captured[current.value] = value;
          if (step(templateIndex + 1, stop)) {
            return true;
          }
        }
      }
      return false;
    };
    return step(0, start) ? captured : undefined;
  }

  // ---- expressions ----

  expression(tokens, start, end, level = 0) {
    this.memo ??= new Map();
    const key = `${start}:${end}:${level}`;
    if (!this.memo.has(key)) {
      this.memo.set(key, null);
      this.memo.set(
        key,
        this.parseExpression(tokens, start, end, level) ?? null
      );
    }
    return this.memo.get(key) ?? undefined;
  }

  parseExpression(tokens, start, end, level) {
    if (start >= end) {
      return undefined;
    }
    const current = levels[level];
    if (current.name === 'primary') {
      return this.primary(tokens, start, end);
    }
    for (const key of current.templates) {
      for (const template of this.language.compiled[key]) {
        const result = this.operator(key, template, tokens, start, end, level);
        if (result) {
          return result;
        }
      }
    }
    return this.expression(tokens, start, end, level + 1);
  }

  operator(key, template, tokens, start, end, level) {
    const { associativity } = levels[level];
    const slotLevel = (slot) => {
      if (associativity === 'prefix') {
        return level;
      }
      return slot === 'left' && associativity === 'left' ? level : level + 1;
    };
    const slots = this.match(template, tokens, start, end, (slot, from, to) =>
      this.slotExpression(tokens, from, to, slotLevel(slot), key, slot)
    );
    if (!slots) {
      return undefined;
    }
    if (key === 'join') {
      const parts = [slots.left, slots.right].flatMap((part) =>
        part.kind === 'Interpolation' && part !== slots.right
          ? part.parts
          : [part]
      );
      return node('Interpolation', { parts });
    }
    if (associativity === 'prefix') {
      return node('Unary', {
        operator: operatorOfTemplate[key],
        operand: slots.operand,
      });
    }
    return node('Binary', {
      operator: operatorOfTemplate[key],
      left: slots.left,
      right: slots.right,
    });
  }

  arguments(tokens, start, end) {
    const levelsOfTokens = depths(tokens);
    const values = [];
    let from = start;
    for (let index = start; index <= end; index += 1) {
      const boundary =
        index === end ||
        (tokens[index].type === 'separator' &&
          levelsOfTokens[index] === levelsOfTokens[start]);
      if (boundary) {
        const value = this.expression(tokens, from, index, 0);
        if (!value) {
          return undefined;
        }
        values.push(value);
        from = index + 1;
      }
    }
    return values;
  }

  primary(tokens, start, end) {
    const first = tokens[start];
    if (end - start === 1) {
      return this.atom(first);
    }
    if (first.type === 'open' && tokens[end - 1].type === 'close') {
      const inner = depths(tokens);
      const closesFirst = tokens
        .slice(start + 1, end - 1)
        .some((_, offset) => inner[start + 1 + offset] === inner[start]);
      if (!closesFirst) {
        return this.expression(tokens, start + 1, end - 1, 0);
      }
    }
    for (const key of ['call', 'call-without-arguments']) {
      for (const template of this.language.compiled[key]) {
        const slots = this.match(
          template,
          tokens,
          start,
          end,
          (slot, from, to) => {
            if (slot === 'callee') {
              return to - from === 1 ? this.readName(tokens[from]) : undefined;
            }
            return this.arguments(tokens, from, to);
          }
        );
        if (slots) {
          return node('Call', {
            callee: slots.callee,
            arguments: slots.arguments ?? [],
          });
        }
      }
    }
    const structuredKeys = [
      ...collectionKeys,
      ...arrayKeys,
      ...queryKeys.filter((key) => key.startsWith('answer-')),
    ];
    for (const key of structuredKeys) {
      for (const template of this.language.compiled[key]) {
        const slots = this.match(
          template,
          tokens,
          start,
          end,
          (slot, from, to) => this.slot(tokens, slot, from, to, key)
        );
        if (slots) {
          return structuredNode(key, slots);
        }
      }
    }
    for (const aspect of questionAspects) {
      for (const template of this.language.compiled[answerKey(aspect)]) {
        const slots = this.match(
          template,
          tokens,
          start,
          end,
          (_slot, from, to) => this.expression(tokens, from, to, 0)
        );
        if (slots) {
          return node('Question', { aspect, subject: slots.subject });
        }
      }
    }
    return undefined;
  }

  atom(token) {
    switch (token.type) {
      case 'number':
        return token.real
          ? { ...number(token.value), type: 'real' }
          : number(token.value);
      case 'text':
        return node('Text', { value: token.value });
      case 'word': {
        if (token.folded === this.language.true.toLowerCase()) {
          return node('Boolean', { value: true });
        }
        if (token.folded === this.language.false.toLowerCase()) {
          return node('Boolean', { value: false });
        }
        const neutral = this.readName(token);
        return neutral === undefined ? undefined : name(neutral);
      }
      default:
        return undefined;
    }
  }

  // ---- sentences ----

  slotExpression(tokens, from, to, level, key, slot) {
    const expression = this.expression(tokens, from, to, level);
    const grammaticalCase = slotCase(this.language, key, slot);
    if (
      !grammaticalCase ||
      (expression && !['Name', 'Boolean'].includes(expression.kind))
    ) {
      return expression;
    }
    const normalized = normalize(
      tokens.slice(from, to),
      this.language,
      grammaticalCase
    );
    return new SentenceReader(this.language).expression(
      normalized,
      0,
      normalized.length,
      level
    );
  }

  names(tokens, start, end) {
    const result = [];
    const andWords = (this.language.listAnd ?? '').split(' ').filter(Boolean);
    let index = start;
    while (index < end) {
      const neutral = this.readName(tokens[index]);
      if (neutral === undefined) {
        return undefined;
      }
      result.push(neutral);
      index += 1;
      if (index === end) {
        break;
      }
      if (tokens[index].type === 'separator') {
        index += 1;
      } else if (
        andWords.length &&
        andWords.every(
          (word, offset) => tokens[index + offset]?.folded === word
        )
      ) {
        index += andWords.length;
      } else {
        return undefined;
      }
      if (index === end) {
        return undefined;
      }
    }
    return result;
  }

  slot(tokens, slot, from, to, key) {
    if (nameSlots.has(slot)) {
      return to - from === 1 ? this.readName(tokens[from]) : undefined;
    }
    if (slot === 'parameters') {
      return this.names(tokens, from, to);
    }
    if (slot === 'elements') {
      return this.arguments(tokens, from, to);
    }
    if (primarySlots.has(slot)) {
      return this.expression(tokens, from, to, levelIndex.primary);
    }
    return this.slotExpression(tokens, from, to, 0, key, slot);
  }

  // The first template among `keys` that matches the whole sentence.
  sentence(text, keys) {
    const tokens = tokenize(text, this.language);
    this.memo = new Map();
    for (const key of keys) {
      for (const template of this.language.compiled[key]) {
        const slots = this.match(
          template,
          tokens,
          0,
          tokens.length,
          (slot, from, to) => this.slot(tokens, slot, from, to, key)
        );
        if (slots) {
          return { key, slots };
        }
      }
    }
    return undefined;
  }
}

// A new array of no elements is the empty array literal.
function structuredNode(key, slots) {
  if (collectionKeys.includes(key)) {
    return collectionNode(key, slots);
  }
  return queryKeys.includes(key)
    ? queryNode(key, slots)
    : arrayNode(key, slots);
}

function arrayNode(key, slots) {
  switch (key) {
    case 'array':
      return node('ArrayLiteral', { elements: slots.elements });
    case 'new-array':
      return slots.length.kind === 'Number' && slots.length.value === 0
        ? node('ArrayLiteral', { elements: [] })
        : node('NewArray', { length: slots.length, fill: slots.fill });
    case 'element':
      return node('Index', { array: slots.array, index: slots.index });
    default:
      return node('Length', { array: slots.array });
  }
}

const statementKeys = [
  ...queryKeys.filter((key) => key.startsWith('question-')),
  ...questionAspects.map(questionKey),
  'documentation',
  'print-line',
  'print',
  'set-element',
  'declare',
  'assign',
  'increase',
  'decrease',
  'return-value',
  'return',
  'nothing',
  'evaluate',
];
const blockKeys = ['else-if', 'else', 'if', 'while', 'for', 'for-each'];
const functionKeys = ['function', 'function-without-parameters'];

function questionStatement(key, slots) {
  if (queryKeys.includes(key)) {
    return node('Evaluate', { expression: queryNode(key, slots) });
  }
  if (key.startsWith('question-')) {
    return node('Evaluate', {
      expression: node('Question', {
        aspect: key.slice(9),
        subject: slots.subject,
      }),
    });
  }
  return undefined;
}

function statementFromSentence({ key, slots }) {
  const question = questionStatement(key, slots);
  if (question) {
    return question;
  }
  switch (key) {
    case 'documentation':
      if (slots.value.kind !== 'Text') {
        throw new Error('Documentation must be a text value');
      }
      return node('Documentation', { value: slots.value });
    case 'print-line':
    case 'print':
      return node('Print', {
        value: slots.value,
        newline: key === 'print-line',
      });
    case 'declare':
      return node('Declaration', {
        name: slots.name,
        value: slots.value,
        mutable: true,
      });
    case 'assign':
      return node('Assignment', {
        name: slots.name,
        operator: '=',
        value: slots.value,
      });
    case 'increase':
    case 'decrease':
      return node('Assignment', {
        name: slots.name,
        operator: '=',
        value: node('Binary', {
          operator: key === 'increase' ? 'add' : 'subtract',
          left: name(slots.name),
          right: slots.value,
        }),
      });
    case 'set-element':
      return node('IndexAssignment', {
        name: slots.name,
        index: slots.index,
        value: slots.value,
      });
    case 'return-value':
      return node('Return', { value: slots.value });
    case 'return':
      return node('Return', {});
    case 'evaluate':
      return node('Evaluate', { expression: slots.expression });
    default:
      return undefined;
  }
}

// A heading written without its end mark ("While n is less than 3, do
// this") still opens a block when the lines after it are indented deeper.
function markHeadings(lines) {
  lines.forEach((line, position) => {
    if (line.unmarked) {
      const next = lines.slice(position + 1).find((other) => !other.blank);
      line.opensBlock = next !== undefined && next.depth > line.depth;
    }
  });
  return lines;
}

// One line of text: depth, the sentence without its end mark, and whether it
// opens a block.
function readLines(source, language) {
  const lines = sentenceLines(source, language).map(({ raw, index }) => {
    const content = raw.trimEnd();
    const indentation = content.length - content.trimStart().length;
    const text = content.trim();
    const note = notePattern(language).exec(text);
    if (note) {
      return { index, depth: indentation / 2, note: note[1] };
    }
    const opensBlock = text.endsWith(language.blockEnd);
    const endMark = opensBlock
      ? language.blockEnd
      : text.endsWith('?')
        ? '?'
        : language.sentenceEnd;
    const sentence = text.endsWith(endMark)
      ? text.slice(0, -endMark.length).trim()
      : text;
    return {
      index,
      depth: indentation / 2,
      text: sentence,
      opensBlock,
      unmarked: Boolean(text) && !text.endsWith(endMark),
      blank: !text,
    };
  });
  return markHeadings(lines);
}

class ProgramReader {
  constructor(language) {
    this.language = language;
    this.sentences = new SentenceReader(language);
  }

  fail(line, message) {
    throw new Error(
      `${this.language.label}, line ${line.index + 1}: ${message}: "${line.text}"`
    );
  }

  // Statements at `depth` starting at this.position.
  block(depth) {
    const statements = [];
    while (this.position < this.lines.length) {
      const line = this.lines[this.position];
      if (line.blank) {
        if (depth > 0) {
          this.position += 1;
          continue;
        }
        break;
      }
      if (line.depth < depth) {
        break;
      }
      if (line.depth > depth) {
        this.fail(line, 'Unexpected indentation');
      }
      this.position += 1;
      if (line.note !== undefined) {
        statements.push(
          withOrigin(node('Comment', { text: line.note }), {
            source: this.source,
            lines: [line.index],
          })
        );
        continue;
      }
      const statement = this.statement(line, depth, statements);
      if (statement) {
        statements.push(
          withOrigin(statement, { source: this.source, lines: [line.index] })
        );
      }
    }
    return block(statements);
  }

  statement(line, depth, statements) {
    if (!line.opensBlock) {
      const sentence = this.sentences.sentence(line.text, statementKeys);
      if (!sentence) {
        this.fail(line, 'No sentence template matches');
      }
      return sentence.key === 'nothing'
        ? undefined
        : statementFromSentence(sentence);
    }
    const sentence = this.sentences.sentence(line.text, blockKeys);
    if (!sentence) {
      this.fail(line, 'No block template matches');
    }
    const body = this.block(depth + 1);
    const { key, slots } = sentence;
    if (key === 'if') {
      return node('If', { condition: slots.condition, then: body });
    }
    if (key === 'while') {
      return node('While', { condition: slots.condition, body });
    }
    if (key === 'for-each') {
      return node('ForEach', {
        variable: slots.variable,
        array: slots.array,
        body,
      });
    }
    if (key === 'for') {
      return node('CountingLoop', {
        variable: slots.variable,
        start: slots.start,
        end: add(slots.last, number(1)),
        body,
      });
    }
    // "Otherwise" continues the innermost open conditional before it.
    let open = statements.at(-1);
    if (open?.kind !== 'If') {
      this.fail(line, 'Otherwise without a condition before it');
    }
    while (open.otherwise?.kind === 'If') {
      open = open.otherwise;
    }
    if (open.otherwise) {
      this.fail(line, 'A condition has two otherwise branches');
    }
    open.otherwise = withOrigin(
      key === 'else-if'
        ? node('If', { condition: slots.condition, then: body })
        : body,
      { source: this.source, lines: [line.index] }
    );
    return undefined;
  }

  read(source) {
    this.source = source;
    this.lines = readLines(source, this.language);
    this.position = 0;
    const program = node('Program', {
      comments: [],
      imports: [],
      functions: [],
      main: block([]),
    });
    let first = true;
    while (this.position < this.lines.length) {
      if (this.lines[this.position].blank) {
        this.position += 1;
        continue;
      }
      const paragraph = this.paragraph();
      if (first && paragraph.notesOnly) {
        attachComments(program, 'comments', paragraph.notes);
      } else if (paragraph.function) {
        program.functions.push(paragraph.function);
      } else {
        program.main.statements.push(...paragraph.statements);
      }
      first = false;
    }
    walk(program, (current) => {
      if (current.kind === 'Documentation') {
        throw new Error('Documentation must begin a function definition');
      }
    });
    return program;
  }

  paragraph() {
    const notes = [];
    while (this.lines[this.position]?.note !== undefined) {
      const line = this.lines[this.position];
      notes.push(
        withOrigin(node('Comment', { text: line.note }), {
          source: this.source,
          lines: [line.index],
        })
      );
      this.position += 1;
    }
    const line = this.lines[this.position];
    if (!line || line.blank) {
      return {
        notesOnly: true,
        notes,
        statements: notes,
      };
    }
    const heading =
      line.opensBlock && this.sentences.sentence(line.text, functionKeys);
    if (heading && line.depth === 0) {
      this.position += 1;
      const body = this.block(1);
      const documented = body.statements[0]?.kind === 'Documentation';
      const documentation = documented
        ? body.statements.shift().value
        : undefined;
      return {
        function: attachComments(
          withOrigin(
            node('Function', {
              name: heading.slots.name,
              parameters: (heading.slots.parameters ?? []).map((parameter) => ({
                name: parameter,
              })),
              body,
              ...(documentation ? { documentation } : {}),
            }),
            { source: this.source, lines: [line.index] }
          ),
          'comments',
          notes
        ),
      };
    }
    const statements = this.block(0).statements;
    return {
      statements: [...notes, ...statements],
    };
  }
}

// A language without a for-each sentence writes the counting loop over an
// index; it is read back as the loop over the elements it stands for.
export function readNatural(source, id, language = naturalLanguage(id)) {
  // An isolated expression is a valid fragment too. Use the same grammar
  // as sentence slots and require the entire fragment to be consumed.
  if (!source.trim().includes('\n')) {
    const tokens = tokenize(source.trim(), language);
    const expression =
      tokens.length === 1 &&
      new SentenceReader(language).expression(tokens, 0, tokens.length);
    if (
      expression &&
      (expression.kind !== 'Name' || /^\p{L}/u.test(source.trim()))
    ) {
      return node('Program', {
        comments: [],
        imports: [],
        functions: [],
        main: block([
          withOrigin(node('Evaluate', { expression }), {
            source,
            lines: [
              source.slice(0, source.indexOf(source.trim())).split('\n')
                .length - 1,
            ],
          }),
        ]),
      });
    }
  }
  return raiseForEach(new ProgramReader(language).read(source));
}
