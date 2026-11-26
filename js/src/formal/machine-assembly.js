// Assembly dialects written from the stack machine code of lowering.js:
// x86-64 in GNU as (AT&T syntax, System V, libc printf) and AArch64 in GNU
// as (AAPCS64, libc printf). Both mirror the NASM writer in machine.js.

import {
  allFunctions,
  mapInstructions,
  mappedText,
  renderMachine,
  comments,
  createsArrays,
  printable,
  returnsByName,
  utf8,
} from './machine-shared.js';

// A string for ".asciz": printable ASCII stays readable, everything else is
// an octal escape.
export function gasText(text) {
  const body = utf8(text)
    .map((byte) => {
      if (byte === 0x22 || byte === 0x5c) {
        return `\\${String.fromCharCode(byte)}`;
      }
      return printable(byte)
        ? String.fromCharCode(byte)
        : `\\${byte.toString(8).padStart(3, '0')}`;
    })
    .join('');
  return `"${body}"`;
}

// The symbol of a stack slot and the label of a jump target.
export const slotSymbol = (item, slot) =>
  `${item.name}.${item.slotNames[slot]}`;
export const jumpLabel = (item, label) => `.L${item.name}_${label}`;

// The read-only data both dialects share: the printf formats and the texts.
function dataSection(texts) {
  return [
    '    .section .rodata',
    'integer_format: .asciz "%lld"',
    'text_format: .asciz "%s"',
    'newline_format: .asciz "\\n"',
    ...[...texts].map(([text, label]) => `${label}: .asciz ${gasText(text)}`),
  ];
}

// Names the text constants text_0, text_1 and so on.
function textLabels() {
  const texts = new Map();
  const label = (text) => {
    if (!texts.has(text)) {
      texts.set(text, `text_${texts.size}`);
    }
    return texts.get(text);
  };
  return { texts, label };
}

// Instructions are indented; labels and comments are not.
const indent = (line) =>
  /^[\w.]+:$/.test(line) || line.startsWith('#') || line.startsWith('//')
    ? line
    : `    ${line}`;

// ---------------------------------------------------------------------------
// x86-64 in GNU as, AT&T syntax.
// ---------------------------------------------------------------------------

const gasJumps = {
  equal: 'je',
  notEqual: 'jne',
  less: 'jl',
  lessOrEqual: 'jle',
  greater: 'jg',
  greaterOrEqual: 'jge',
};
const gasArithmetic = {
  add: ['addq %rcx, %rax'],
  subtract: ['subq %rcx, %rax'],
  multiply: ['imulq %rcx, %rax'],
  divide: ['cqto', 'idivq %rcx'],
  remainder: ['cqto', 'idivq %rcx', 'movq %rdx, %rax'],
};
const gasArguments = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'];

// Each function names its stack slots with symbols, such as
// "remainder.divisor", so the names cannot clash with labels or functions.
function gasFunction(item, texts) {
  const symbol = (slot) => `${slotSymbol(item, slot)}(%rbp)`;
  const frame = Math.ceil(item.slotCount / 2) * 16;
  if (item.parameterCount > gasArguments.length) {
    throw new Error(`"${item.name}" has more than six parameters`);
  }
  const body = [
    ...item.slotNames.map(
      (_, slot) => `.set ${slotSymbol(item, slot)}, ${-8 * (slot + 1)}`
    ),
    'pushq %rbp',
    'movq %rsp, %rbp',
  ];
  if (frame) {
    body.push(`subq $${frame}, %rsp`);
  }
  for (let index = 0; index < item.parameterCount; index += 1) {
    body.push(`movq %${gasArguments[index]}, ${symbol(index)}`);
  }
  const instructions = {
    comment: (text) => comments('#', [text]),
    push: (value) =>
      Math.abs(value) < 2 ** 31
        ? [`pushq $${value}`]
        : [`movabsq $${value}, %rax`, 'pushq %rax'],
    load: (slot) => [`pushq ${symbol(slot)}`],
    store: (slot) => ['popq %rax', `movq %rax, ${symbol(slot)}`],
    pop: () => ['addq $8, %rsp'],
    arithmetic: (operation) => [
      'popq %rcx',
      'popq %rax',
      ...gasArithmetic[operation],
      'pushq %rax',
    ],
    negate: () => ['negq (%rsp)'],
    label: (label) => [`${jumpLabel(item, label)}:`],
    jump: (label) => [`jmp ${jumpLabel(item, label)}`],
    'compare-jump': (relation, label) => [
      'popq %rcx',
      'popq %rax',
      'cmpq %rcx, %rax',
      `${gasJumps[relation]} ${jumpLabel(item, label)}`,
    ],
    call: (name, count) => [
      ...gasArguments
        .slice(0, count)
        .reverse()
        .map((register) => `popq %${register}`),
      `call ${name}`,
      ...(item.calls.get(name) ? ['pushq %rax'] : []),
    ],
    return: () => ['popq %rax', 'leave', 'ret'],
    'return-nothing': () =>
      item.name === 'main'
        ? ['xorl %eax, %eax', 'leave', 'ret']
        : ['leave', 'ret'],
    'print-integer': () => ['popq %rdi', 'call print_integer'],
    'print-text': (text) => [
      `leaq ${texts(text)}(%rip), %rdi`,
      'call print_text',
    ],
    'print-newline': () => ['call print_newline'],
    // An array is a pointer to its first element, with its length stored
    // in the eight bytes before it.
    'new-array': () => [
      'popq %rsi',
      'popq %rdi',
      'call new_array',
      'pushq %rax',
    ],
    dup: () => ['pushq (%rsp)'],
    'element-index': () => [],
    'load-element': () => ['popq %rcx', 'popq %rax', 'pushq (%rax,%rcx,8)'],
    'store-element': () => [
      'popq %rdx',
      'popq %rcx',
      'popq %rax',
      'movq %rdx, (%rax,%rcx,8)',
    ],
    'array-length': () => ['popq %rax', 'pushq -8(%rax)'],
  };
  for (const instruction of item.code) {
    const [operation, ...operands] = instruction;
    body.push(
      ...mapInstructions(instructions[operation](...operands), instruction)
    );
  }
  return [
    ...comments('#', item.comments),
    `.type ${item.name}, @function`,
    `${item.name}:`,
    ...body.map((line) => mappedText(indent(String(line)), line)),
    `.size ${item.name}, .-${item.name}`,
  ];
}

// new_array(length, fill): malloc room for the length and the elements,
// then fill them. The memory lives until the program ends.
const gasNewArray = [
  'new_array:',
  '    pushq %rbp',
  '    movq %rsp, %rbp',
  '    andq $-16, %rsp',
  '    pushq %rdi',
  '    pushq %rsi',
  '    leaq 8(,%rdi,8), %rdi',
  '    call malloc@PLT',
  '    popq %rsi',
  '    popq %rdi',
  '    movq %rdi, (%rax)',
  '    addq $8, %rax',
  '    xorl %ecx, %ecx',
  '.Lnew_array_fill:',
  '    cmpq %rdi, %rcx',
  '    jge .Lnew_array_done',
  '    movq %rsi, (%rax,%rcx,8)',
  '    incq %rcx',
  '    jmp .Lnew_array_fill',
  '.Lnew_array_done:',
  '    leave',
  '    ret',
  '',
];

export function writeGas(program) {
  const { texts, label } = textLabels();
  const calls = returnsByName(program);
  const functions = allFunctions(program).map((item) =>
    gasFunction({ ...item, calls }, label)
  );
  const helper = (name, load) => [
    `${name}:`,
    '    pushq %rbp',
    '    movq %rsp, %rbp',
    '    andq $-16, %rsp',
    ...load.map((line) => `    ${line}`),
    `    leaq ${name.slice(6)}_format(%rip), %rdi`,
    '    xorl %eax, %eax',
    '    call printf@PLT',
    '    leave',
    '    ret',
  ];
  return renderMachine(
    [
      ...comments('#', program.comments),
      ...(program.comments.length ? [''] : []),
      '    .globl main',
      ...dataSection(texts),
      '',
      '    .text',
      ...functions.flatMap((lines) => [...lines, '']),
      ...(createsArrays(program) ? gasNewArray : []),
      ...helper('print_integer', ['movq %rdi, %rsi']),
      '',
      ...helper('print_text', ['movq %rdi, %rsi']),
      '',
      ...helper('print_newline', []),
      '',
      '    .section .note.GNU-stack,"",@progbits',
      '',
    ],
    'gas'
  );
}

// ---------------------------------------------------------------------------
// AArch64 in GNU as. Every stack cell takes 16 bytes so the stack pointer
// stays aligned; the frame pointer x29 addresses the slots upwards.
// ---------------------------------------------------------------------------

const armConditions = {
  equal: 'eq',
  notEqual: 'ne',
  less: 'lt',
  lessOrEqual: 'le',
  greater: 'gt',
  greaterOrEqual: 'ge',
};
const armArithmetic = {
  add: ['add x0, x0, x1'],
  subtract: ['sub x0, x0, x1'],
  multiply: ['mul x0, x0, x1'],
  divide: ['sdiv x0, x0, x1'],
  remainder: ['sdiv x2, x0, x1', 'msub x0, x2, x1, x0'],
};
const armPush = 'str x0, [sp, #-16]!';
const armPop = (register) => `ldr ${register}, [sp], #16`;

function armFunction(item, texts) {
  const offset = (slot) => `[x29, #${slotSymbol(item, slot)}]`;
  const frame = Math.ceil(item.slotCount / 2) * 16;
  if (item.parameterCount > 8) {
    throw new Error(`"${item.name}" has more than eight parameters`);
  }
  const epilogue = [
    'mov sp, x29',
    `add sp, sp, #${frame}`,
    'ldp x29, x30, [sp], #16',
    'ret',
  ];
  const body = [
    ...item.slotNames.map(
      (_, slot) => `.set ${slotSymbol(item, slot)}, ${8 * slot}`
    ),
    'stp x29, x30, [sp, #-16]!',
    `sub sp, sp, #${frame}`,
    'mov x29, sp',
  ];
  for (let index = 0; index < item.parameterCount; index += 1) {
    body.push(`str x${index}, ${offset(index)}`);
  }
  const instructions = {
    comment: (text) => comments('//', [text]),
    push: (value) => [
      value >= -65536 && value <= 65535
        ? `mov x0, #${value}`
        : `ldr x0, =${value}`,
      armPush,
    ],
    load: (slot) => [`ldr x0, ${offset(slot)}`, armPush],
    store: (slot) => [armPop('x0'), `str x0, ${offset(slot)}`],
    pop: () => ['add sp, sp, #16'],
    arithmetic: (operation) => [
      armPop('x1'),
      armPop('x0'),
      ...armArithmetic[operation],
      armPush,
    ],
    negate: () => ['ldr x0, [sp]', 'neg x0, x0', 'str x0, [sp]'],
    label: (label) => [`${jumpLabel(item, label)}:`],
    jump: (label) => [`b ${jumpLabel(item, label)}`],
    'compare-jump': (relation, label) => [
      armPop('x1'),
      armPop('x0'),
      'cmp x0, x1',
      `b.${armConditions[relation]} ${jumpLabel(item, label)}`,
    ],
    call: (name, count) => [
      ...Array.from({ length: count }, (_, index) =>
        armPop(`x${count - 1 - index}`)
      ),
      `bl ${name}`,
      ...(item.calls.get(name) ? [armPush] : []),
    ],
    return: () => [armPop('x0'), ...epilogue],
    'return-nothing': () =>
      item.name === 'main' ? ['mov x0, #0', ...epilogue] : epilogue,
    'print-integer': () => [armPop('x0'), 'bl print_integer'],
    'print-text': (text) => [
      `adrp x0, ${texts(text)}`,
      `add x0, x0, :lo12:${texts(text)}`,
      'bl print_text',
    ],
    'print-newline': () => ['bl print_newline'],
    // An array is a pointer to its first element, with its length stored
    // in the eight bytes before it.
    'new-array': () => [armPop('x1'), armPop('x0'), 'bl new_array', armPush],
    dup: () => ['ldr x0, [sp]', armPush],
    'element-index': () => [],
    'load-element': () => [
      armPop('x1'),
      armPop('x0'),
      'ldr x0, [x0, x1, lsl #3]',
      armPush,
    ],
    'store-element': () => [
      armPop('x2'),
      armPop('x1'),
      armPop('x0'),
      'str x2, [x0, x1, lsl #3]',
    ],
    'array-length': () => [armPop('x0'), 'ldr x0, [x0, #-8]', armPush],
  };
  for (const instruction of item.code) {
    const [operation, ...operands] = instruction;
    body.push(
      ...mapInstructions(instructions[operation](...operands), instruction)
    );
  }
  return [
    ...comments('//', item.comments),
    `.type ${item.name}, %function`,
    `${item.name}:`,
    ...body.map((line) => mappedText(indent(String(line)), line)),
    `.size ${item.name}, .-${item.name}`,
  ];
}

const armNewArray = [
  'new_array:',
  '    stp x29, x30, [sp, #-32]!',
  '    mov x29, sp',
  '    stp x0, x1, [sp, #16]',
  '    lsl x0, x0, #3',
  '    add x0, x0, #8',
  '    bl malloc',
  '    ldp x1, x2, [sp, #16]',
  '    str x1, [x0]',
  '    add x0, x0, #8',
  '    mov x3, #0',
  '.Lnew_array_fill:',
  '    cmp x3, x1',
  '    b.ge .Lnew_array_done',
  '    str x2, [x0, x3, lsl #3]',
  '    add x3, x3, #1',
  '    b .Lnew_array_fill',
  '.Lnew_array_done:',
  '    ldp x29, x30, [sp], #32',
  '    ret',
  '',
];

export function writeArm64(program) {
  const { texts, label } = textLabels();
  const calls = returnsByName(program);
  const functions = allFunctions(program).map((item) =>
    armFunction({ ...item, calls }, label)
  );
  const helper = (name, load) => [
    `${name}:`,
    '    stp x29, x30, [sp, #-16]!',
    '    mov x29, sp',
    ...load.map((line) => `    ${line}`),
    `    adrp x0, ${name.slice(6)}_format`,
    `    add x0, x0, :lo12:${name.slice(6)}_format`,
    '    bl printf',
    '    ldp x29, x30, [sp], #16',
    '    ret',
  ];
  return renderMachine(
    [
      ...comments('//', program.comments),
      ...(program.comments.length ? [''] : []),
      '    .global main',
      ...dataSection(texts),
      '',
      '    .text',
      ...functions.flatMap((lines) => [...lines, '']),
      ...(createsArrays(program) ? armNewArray : []),
      ...helper('print_integer', ['mov x1, x0']),
      '',
      ...helper('print_text', ['mov x1, x0']),
      '',
      ...helper('print_newline', []),
      '',
      '    .section .note.GNU-stack,"",%progbits',
      '',
    ],
    'arm64'
  );
}
