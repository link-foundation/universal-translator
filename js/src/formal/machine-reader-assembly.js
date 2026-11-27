// Read x86-64 (AT&T syntax) and AArch64 assembly in GNU as back into the
// stack machine code described in lowering.js. The readers match the
// instruction sequences that machine-assembly.js writes.

import { pushComment } from '../translation/source-origins.js';
import { linesOrigin } from './machine-source.js';

import { utf8 } from './machine-shared.js';
import {
  decodeBytes,
  exact,
  integer,
  leadingComments,
  program,
  readError,
  readInstructions,
  relationsByJump,
  resolveResults,
  sourceLines,
} from './machine-reader-shared.js';

const gasRelations = relationsByJump({
  equal: 'je',
  notEqual: 'jne',
  less: 'jl',
  lessOrEqual: 'jle',
  greater: 'jg',
  greaterOrEqual: 'jge',
});
const armRelations = relationsByJump({
  equal: 'eq',
  notEqual: 'ne',
  less: 'lt',
  lessOrEqual: 'le',
  greater: 'gt',
  greaterOrEqual: 'ge',
});
const gasArithmetic = [
  [['addq %rcx, %rax'], 'add'],
  [['subq %rcx, %rax'], 'subtract'],
  [['imulq %rcx, %rax'], 'multiply'],
  [['cqto', 'idivq %rcx', 'movq %rdx, %rax'], 'remainder'],
  [['cqto', 'idivq %rcx'], 'divide'],
];
const armArithmetic = [
  [['add x0, x0, x1'], 'add'],
  [['sub x0, x0, x1'], 'subtract'],
  [['mul x0, x0, x1'], 'multiply'],
  [['sdiv x2, x0, x1', 'msub x0, x2, x1, x0'], 'remainder'],
  [['sdiv x0, x0, x1'], 'divide'],
];
const gasArguments = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'];
const armPush = exact('str x0, [sp, #-16]!');
const armPop = (register) => exact(`ldr ${register}, [sp], #16`);
const armEpilogue = [
  exact('mov sp, x29'),
  /^add sp, sp, #\d+$/,
  exact('ldp x29, x30, [sp], #16'),
  exact('ret'),
];

// The bytes of a ".asciz" string, with its escapes undone.
function asciiz(literal) {
  const bytes = [];
  const characters = [...literal];
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    if (character !== '\\') {
      bytes.push(...utf8(character));
      continue;
    }
    const octal = characters.slice(index + 1, index + 4).join('');
    const digits = octal.match(/^[0-7]{1,3}/);
    if (digits) {
      bytes.push(parseInt(digits[0], 8));
      index += digits[0].length;
    } else {
      index += 1;
      bytes.push(
        ...utf8({ n: '\n', t: '\t' }[characters[index]] ?? characters[index])
      );
    }
  }
  return decodeBytes(bytes);
}

function assemblyTexts(lines) {
  const texts = new Map();
  for (const line of lines) {
    const match = line.match(/^(text_\d+): \.asciz "(.*)"$/);
    if (match) {
      texts.set(match[1], asciiz(match[2]));
    }
  }
  return texts;
}

// The functions of a file: ".type name, @function" (or %function), the label
// and the lines up to ".size name".
function assemblyFunctions(lines, prefix) {
  const items = [];
  let pending = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const header = line.match(/^\.type (\w+), [@%]function$/);
    if (line.startsWith(prefix)) {
      pushComment(
        pending,
        line.slice(prefix.length).replace(/^ /, ''),
        linesOrigin(lines, index)
      );
    } else if (header) {
      const end = lines.findIndex(
        (item, at) => at > index && item.startsWith(`.size ${header[1]},`)
      );
      items.push({
        name: header[1],
        comments: pending,
        body: lines.slice(index + 2, end),
      });
      pending = [];
      index = end;
    } else if (line) {
      pending = [];
    }
  }
  return items;
}

// The stack slots are the ".set name.slot, offset" lines at the top of a
// function, in slot order; a symbol is the function name, a dot and the slot.
function readSlots(name, body, target) {
  const slots = new Map();
  let index = 0;
  while (body[index]?.startsWith('.set ')) {
    const match = body[index].match(/^\.set ([\w.]+), -?\d+$/);
    if (!match || !match[1].startsWith(`${name}.`)) {
      throw readError(target, body[index], 'expected a stack slot');
    }
    slots.set(match[1], slots.size);
    index += 1;
  }
  return { slots, index };
}

function slotLookup(slots) {
  return (symbol) => {
    if (!slots.has(symbol)) {
      throw new Error(`Unknown stack slot "${symbol}"`);
    }
    return slots.get(symbol);
  };
}

function finishFunction(parts) {
  const { name, comments, slots, parameterCount, raw, target, marker } = parts;
  const code = resolveResults(raw, target, marker);
  return {
    name,
    parameterCount,
    slotNames: [...slots.keys()].map((symbol) => symbol.slice(name.length + 1)),
    returns: code.some(([operation]) => operation === 'return'),
    comments,
    code,
  };
}

// ---------------------------------------------------------------------------
// x86-64 in GNU as, AT&T syntax
// ---------------------------------------------------------------------------

function gasRules(name, texts, slot) {
  const label = `\\.L${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(\\w+)`;
  const callRule = (count) => [
    [
      ...gasArguments
        .slice(0, count)
        .reverse()
        .map((register) => exact(`popq %${register}`)),
      /^call (\w+)$/,
    ],
    (...matches) => {
      const callee = matches.at(-1)[1];
      if (callee.startsWith('print_')) {
        return count === 1 && callee === 'print_integer'
          ? [['print-integer']]
          : null;
      }
      return [['call', callee, count]];
    },
  ];
  const memory = /^pushq ([\w.]+)\(%rbp\)$/;
  return [
    [[/^# ?(.*)$/], ([, text]) => [['comment', text]]],
    [[/^pushq \$(-?\d+)$/], ([, value]) => [['push', integer(value)]]],
    [
      [/^movabsq \$(-?\d+), %rax$/, exact('pushq %rax')],
      ([, value]) => [['push', integer(value)]],
    ],
    [[memory], ([, symbol]) => [['load', slot(symbol)]]],
    [
      [exact('popq %rax'), /^movq %rax, ([\w.]+)\(%rbp\)$/],
      (_, [, symbol]) => [['store', slot(symbol)]],
    ],
    [[exact('popq %rax'), exact('leave'), exact('ret')], () => [['return']]],
    [
      [
        exact('popq %rsi'),
        exact('popq %rdi'),
        exact('call new_array'),
        exact('pushq %rax'),
      ],
      () => [['new-array']],
    ],
    [[exact('pushq (%rsp)')], () => [['dup']]],
    [
      [exact('popq %rcx'), exact('popq %rax'), exact('pushq (%rax,%rcx,8)')],
      () => [['element-index'], ['load-element']],
    ],
    [
      [
        exact('popq %rdx'),
        exact('popq %rcx'),
        exact('popq %rax'),
        exact('movq %rdx, (%rax,%rcx,8)'),
      ],
      () => [['store-element']],
    ],
    [[exact('popq %rax'), exact('pushq -8(%rax)')], () => [['array-length']]],
    [[exact('addq $8, %rsp')], () => [['pop']]],
    ...gasArithmetic.map(([lines, operation]) => [
      [
        exact('popq %rcx'),
        exact('popq %rax'),
        ...lines.map(exact),
        exact('pushq %rax'),
      ],
      () => [['arithmetic', operation]],
    ]),
    [
      [
        exact('popq %rcx'),
        exact('popq %rax'),
        exact('cmpq %rcx, %rax'),
        new RegExp(`^(j\\w+) ${label}$`),
      ],
      (_, __, ___, [, jump, target]) =>
        gasRelations[jump]
          ? [['compare-jump', gasRelations[jump], target]]
          : null,
    ],
    [[exact('negq (%rsp)')], () => [['negate']]],
    [[new RegExp(`^${label}:$`)], ([, target]) => [['label', target]]],
    [[new RegExp(`^jmp ${label}$`)], ([, target]) => [['jump', target]]],
    [
      [/^leaq (text_\d+)\(%rip\), %rdi$/, exact('call print_text')],
      ([, text]) => [['print-text', texts.get(text)]],
    ],
    [[exact('call print_newline')], () => [['print-newline']]],
    [
      [exact('xorl %eax, %eax'), exact('leave'), exact('ret')],
      () => [['return-nothing']],
    ],
    [[exact('leave'), exact('ret')], () => [['return-nothing']]],
    ...[6, 5, 4, 3, 2, 1, 0].map(callRule),
    [[exact('pushq %rax')], () => [['result']]],
  ];
}

function readGasFunction({ name, comments, body }, texts) {
  const { slots, index: first } = readSlots(name, body, 'gas');
  const slot = slotLookup(slots);
  let index = first;
  for (const line of ['pushq %rbp', 'movq %rsp, %rbp']) {
    if (body[index] !== line) {
      throw readError('gas', body[index] ?? '', `expected ${line}`);
    }
    index += 1;
  }
  if (/^subq \$\d+, %rsp$/.test(body[index])) {
    index += 1;
  }
  let parameterCount = 0;
  while (
    body[index]?.match(/^movq %(\w+), [\w.]+\(%rbp\)$/)?.[1] ===
    gasArguments[parameterCount]
  ) {
    parameterCount += 1;
    index += 1;
  }
  const raw = readInstructions(
    body.slice(index),
    gasRules(name, texts, slot),
    'gas'
  );
  return finishFunction({
    name,
    comments,
    slots,
    parameterCount,
    raw,
    target: 'gas',
    marker: 'pushq %rax',
  });
}

export function readGas(source) {
  const lines = sourceLines(source);
  const { comments, rest } = leadingComments(lines, '#', /^\.globl main$/);
  const texts = assemblyTexts(rest);
  return program(
    comments,
    assemblyFunctions(rest, '#').map((item) => readGasFunction(item, texts))
  );
}

// ---------------------------------------------------------------------------
// AArch64 in GNU as
// ---------------------------------------------------------------------------

function armRules(name, texts, slot) {
  const label = `\\.L${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(\\w+)`;
  const callRule = (count) => [
    [
      ...Array.from({ length: count }, (_, index) =>
        armPop(`x${count - 1 - index}`)
      ),
      /^bl (\w+)$/,
    ],
    (...matches) => {
      const callee = matches.at(-1)[1];
      if (callee.startsWith('print_')) {
        return count === 1 && callee === 'print_integer'
          ? [['print-integer']]
          : null;
      }
      return [['call', callee, count]];
    },
  ];
  return [
    [[/^\/\/ ?(.*)$/], ([, text]) => [['comment', text]]],
    [
      [/^(?:mov x0, #|ldr x0, =)(-?\d+)$/, armPush],
      ([, value]) => [['push', integer(value)]],
    ],
    [
      [/^ldr x0, \[x29, #([\w.]+)\]$/, armPush],
      ([, symbol]) => [['load', slot(symbol)]],
    ],
    [
      [armPop('x0'), /^str x0, \[x29, #([\w.]+)\]$/],
      (_, [, symbol]) => [['store', slot(symbol)]],
    ],
    [[armPop('x0'), ...armEpilogue], () => [['return']]],
    [[exact('mov x0, #0'), ...armEpilogue], () => [['return-nothing']]],
    [armEpilogue, () => [['return-nothing']]],
    [
      [armPop('x1'), armPop('x0'), exact('bl new_array'), armPush],
      () => [['new-array']],
    ],
    [[exact('ldr x0, [sp]'), armPush], () => [['dup']]],
    [
      [armPop('x1'), armPop('x0'), exact('ldr x0, [x0, x1, lsl #3]'), armPush],
      () => [['element-index'], ['load-element']],
    ],
    [
      [
        armPop('x2'),
        armPop('x1'),
        armPop('x0'),
        exact('str x2, [x0, x1, lsl #3]'),
      ],
      () => [['store-element']],
    ],
    [
      [armPop('x0'), exact('ldr x0, [x0, #-8]'), armPush],
      () => [['array-length']],
    ],
    [[exact('add sp, sp, #16')], () => [['pop']]],
    ...armArithmetic.map(([lines, operation]) => [
      [armPop('x1'), armPop('x0'), ...lines.map(exact), armPush],
      () => [['arithmetic', operation]],
    ]),
    [
      [
        armPop('x1'),
        armPop('x0'),
        exact('cmp x0, x1'),
        new RegExp(`^b\\.(\\w+) ${label}$`),
      ],
      (_, __, ___, [, condition, target]) =>
        armRelations[condition]
          ? [['compare-jump', armRelations[condition], target]]
          : null,
    ],
    [
      [exact('ldr x0, [sp]'), exact('neg x0, x0'), exact('str x0, [sp]')],
      () => [['negate']],
    ],
    [[new RegExp(`^${label}:$`)], ([, target]) => [['label', target]]],
    [[new RegExp(`^b ${label}$`)], ([, target]) => [['jump', target]]],
    [
      [
        /^adrp x0, (text_\d+)$/,
        /^add x0, x0, :lo12:text_\d+$/,
        exact('bl print_text'),
      ],
      ([, text]) => [['print-text', texts.get(text)]],
    ],
    [[exact('bl print_newline')], () => [['print-newline']]],
    ...[8, 7, 6, 5, 4, 3, 2, 1, 0].map(callRule),
    [[armPush], () => [['result']]],
  ];
}

function readArm64Function({ name, comments, body }, texts) {
  const { slots, index: first } = readSlots(name, body, 'arm64');
  const slot = slotLookup(slots);
  let index = first;
  for (const pattern of [
    exact('stp x29, x30, [sp, #-16]!'),
    /^sub sp, sp, #\d+$/,
    exact('mov x29, sp'),
  ]) {
    if (!pattern.test(body[index] ?? '')) {
      throw readError('arm64', body[index] ?? '', `expected ${pattern}`);
    }
    index += 1;
  }
  let parameterCount = 0;
  while (
    body[index]?.match(/^str x(\d+), \[x29, #[\w.]+\]$/)?.[1] ===
    String(parameterCount)
  ) {
    parameterCount += 1;
    index += 1;
  }
  const raw = readInstructions(
    body.slice(index),
    armRules(name, texts, slot),
    'arm64'
  );
  return finishFunction({
    name,
    comments,
    slots,
    parameterCount,
    raw,
    target: 'arm64',
    marker: 'str x0, [sp, #-16]!',
  });
}

export function readArm64(source) {
  const lines = sourceLines(source);
  const { comments, rest } = leadingComments(lines, '//', /^\.global main$/);
  const texts = assemblyTexts(rest);
  return program(
    comments,
    assemblyFunctions(rest, '//').map((item) => readArm64Function(item, texts))
  );
}
