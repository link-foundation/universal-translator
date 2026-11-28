// Read WebAssembly text (WAT) back into the stack machine code described in
// lowering.js. WebAssembly is a stack machine too, so most instructions map
// one to one. What the writer adds around the code is undone first: the
// blocks that end at the labels, the dispatch loop with its br_table, and the
// "$.stack.N" locals that carry the stack across a jump.

import { pushComment } from '../translation/source-origins.js';

import {
  decodeBytes,
  integer,
  leadingComments,
  program,
  readError,
  readInstructions,
  relationsByJump,
  sourceLines,
} from './machine-reader-shared.js';
import { includeLine, linesOrigin } from './machine-source.js';

const watRelations = relationsByJump({
  equal: 'i64.eq',
  notEqual: 'i64.ne',
  less: 'i64.lt_s',
  lessOrEqual: 'i64.le_s',
  greater: 'i64.gt_s',
  greaterOrEqual: 'i64.ge_s',
});
const watArithmetic = {
  'i64.add': 'add',
  'i64.sub': 'subtract',
  'i64.mul': 'multiply',
  'i64.div_s': 'divide',
  'i64.rem_s': 'remainder',
};
const relationPattern = /^(i64\.(?:eq|ne|lt_s|le_s|gt_s|ge_s))$/;
const header =
  /^\(func \$(\S+?)(?: \(export "main"\))?((?: \(param \$\S+ i64\))*)( \(result i64\))?$/;

// The bytes of a string literal with hexadecimal escapes.
function watString(literal) {
  const body = literal.slice(1, -1);
  const bytes = [];
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] === '\\') {
      bytes.push(parseInt(body.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(body.charCodeAt(index));
    }
  }
  return decodeBytes(bytes);
}

// The texts of the data segments by offset and length.
function watTexts(lines) {
  const texts = new Map();
  for (const line of lines) {
    const match = line.match(/^\(data \(i32\.const (\d+)\) (".*")\)$/);
    if (match) {
      const text = watString(match[2]);
      const length = new globalThis.TextEncoder().encode(text).length;
      texts.set(`${match[1]}:${length}`, text);
    }
  }
  return texts;
}

// What the writer wraps around the instructions is not part of the stack
// machine code: blocks, the dispatch loop and its table, the unreachable
// after the last return, and the locals that save the stack at a jump.
function stripFrame(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    if (/^local\.set \$\.stack\.\d+$/.test(lines[index])) {
      includeLine(lines, index - 1, index);
    } else if (/^local\.get \$\.stack\.\d+$/.test(lines[index])) {
      includeLine(lines, index + 1, index);
    }
  }
  let labels = [];
  const kept = lines.filter((line, index) => {
    const table = line.match(/^br_table (.*)$/);
    if (table) {
      labels = table[1]
        .split(' ')
        .slice(1, -1)
        .map((target) => target.slice(1));
    }
    const frame =
      /^(?:block|loop) \$\S+$/.test(line) ||
      /^end ;; (?:start|dispatch)$/.test(line) ||
      line === 'unreachable' ||
      line.startsWith('br_table ') ||
      lines[index + 1]?.startsWith('br_table ') ||
      /^local\.(?:set|get) \$\.stack\.\d+$/.test(line);
    return !frame;
  });
  return { labels, lines: kept };
}

function watRules(texts, slotOf, labels, returns, counts) {
  const jumpTarget = (number) => {
    const label = labels[Number(number) - 1];
    if (!label) {
      throw new Error(`Unknown jump target ${number}`);
    }
    return label;
  };
  const slot = (name) => {
    const index = slotOf(name);
    return index === undefined ? null : [['load', index]];
  };
  const backward = [
    /^i32\.const (\d+)$/,
    /^local\.set \$\.pc$/,
    /^br \$dispatch$/,
  ];
  const compareJumps = [false, true].flatMap((kept) => {
    const condition = kept
      ? [/^local\.set \$\.cond$/, /^local\.get \$\.cond$/]
      : [];
    return [
      [
        [relationPattern, ...condition, /^br_if \$(\S+)$/],
        (...matches) => [
          ['compare-jump', watRelations[matches[0][1]], matches.at(-1)[1]],
        ],
      ],
      [
        [relationPattern, ...condition, /^if$/, ...backward, /^end$/],
        (...matches) => [
          [
            'compare-jump',
            watRelations[matches[0][1]],
            jumpTarget(matches.at(-4)[1]),
          ],
        ],
      ],
    ];
  });
  return [
    [[/^;; ?(.*)$/], ([, text]) => [['comment', text]]],
    [
      [/^i64\.const -1$/, /^i64\.xor$/, /^i64\.const 1$/, /^i64\.add$/],
      () => [['negate']],
    ],
    [
      [/^i64\.const 8$/, /^i64\.sub$/, /^i32\.wrap_i64$/, /^i64\.load$/],
      () => [['array-length']],
    ],
    [[/^i64\.const 3$/, /^i64\.shl$/], () => [['element-index']]],
    [
      [/^i64\.add$/, /^i32\.wrap_i64$/, /^i64\.load$/],
      () => [['load-element']],
    ],
    [
      [
        /^local\.set \$\.value$/,
        /^i64\.add$/,
        /^i32\.wrap_i64$/,
        /^local\.get \$\.value$/,
        /^i64\.store$/,
      ],
      () => [['store-element']],
    ],
    [[/^local\.tee \$\.dup$/, /^local\.get \$\.dup$/], () => [['dup']]],
    [[/^i64\.const (-?\d+)$/], ([, value]) => [['push', integer(value)]]],
    [[/^local\.get \$(\S+)$/], ([, name]) => slot(name)],
    [
      [/^local\.set \$(\S+)$/],
      ([, name]) => {
        const index = slotOf(name);
        return index === undefined ? null : [['store', index]];
      },
    ],
    [[/^drop$/], () => [['pop']]],
    [
      [/^(i64\.(?:add|sub|mul|div_s|rem_s))$/],
      ([, operation]) => [['arithmetic', watArithmetic[operation]]],
    ],
    ...compareJumps,
    [[...backward], (...matches) => [['jump', jumpTarget(matches[0][1])]]],
    [[/^br \$(\S+)$/], ([, label]) => [['jump', label]]],
    [[/^end ;; (\S+)$/], ([, label]) => [['label', label]]],
    [[/^return$/], () => [[returns ? 'return' : 'return-nothing']]],
    [[/^call \$new_array$/], () => [['new-array']]],
    [[/^call \$print_integer$/], () => [['print-integer']]],
    [[/^call \$print_newline$/], () => [['print-newline']]],
    [
      [/^i32\.const (\d+)$/, /^i32\.const (\d+)$/, /^call \$print_text$/],
      ([, offset], [, length]) => [
        ['print-text', texts.get(`${offset}:${length}`) ?? ''],
      ],
    ],
    [[/^call \$(\S+)$/], ([, name]) => [['call', name, counts.get(name) ?? 0]]],
  ];
}

function readWatFunction(match, comments, lines, texts, counts) {
  const [, name, parameterList, result] = match;
  const parameters = [...parameterList.matchAll(/\(param \$(\S+) i64\)/g)].map(
    (item) => item[1]
  );
  const locals = [];
  const body = lines.filter((line) => {
    const local = line.match(/^\(local \$(\S+) i64\)$/);
    if (local) {
      if (!local[1].startsWith('.')) {
        locals.push(local[1]);
      }
      return false;
    }
    return !/^\(local \$\.pc i32\)$|^\(local \$\.cond i32\)$/.test(line);
  });
  const slotNames = [...parameters, ...locals];
  const { labels, lines: instructions } = stripFrame(body);
  const slotOf = (slotName) => {
    const index = slotNames.indexOf(slotName);
    return index < 0 ? undefined : index;
  };
  const code = readInstructions(
    instructions,
    watRules(texts, slotOf, labels, Boolean(result), counts),
    'wat'
  );
  return {
    name,
    parameterCount: parameters.length,
    slotNames,
    returns: Boolean(result),
    comments,
    code,
  };
}

export function readWat(source) {
  const lines = sourceLines(source);
  const { comments, rest } = leadingComments(lines, ';;', /^\(module$/);
  const texts = watTexts(rest);
  const counts = new Map();
  for (const line of rest) {
    const match = line.match(header);
    if (match) {
      counts.set(match[1], [...match[2].matchAll(/\(param /g)].length);
    }
  }
  const items = [];
  let pending = [];
  for (let index = 0; index < rest.length; index += 1) {
    const line = rest[index];
    const match = line.match(header);
    if (line.startsWith(';;')) {
      pushComment(pending, line.replace(/^;; ?/, ''), linesOrigin(rest, index));
    } else if (match && match[1] !== 'new_array') {
      const end = rest.indexOf(')', index);
      items.push(
        readWatFunction(
          match,
          pending,
          rest.slice(index + 1, end),
          texts,
          counts
        )
      );
      pending = [];
      index = end;
    } else if (line) {
      pending = [];
    }
  }
  if (!items.some((item) => item.name === 'main')) {
    throw readError('wat', '', 'no main function');
  }
  return program(comments, items);
}
