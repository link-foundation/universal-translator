// Machine targets: x86-64 assembly (NASM, System V, libc printf), CIL
// (ILAsm for .NET) and JVM bytecode (Jasmin). Each writer spells the stack
// machine code from lowering.js; the descriptions below are read by the
// context rules (comment adaptation, naming) like any language description.

import { lowerProgram } from './lowering.js';

export const machineTargets = {
  nasm: {
    label: 'x86-64 assembly',
    machine: true,
    naming: 'snake',
    lineComment: ';',
    terms: { call: 'call instruction', routine: 'procedure' },
  },
  cil: {
    label: 'CIL',
    machine: true,
    naming: { function: 'pascal', variable: 'camel' },
    lineComment: '//',
    terms: { call: 'method call', routine: 'method' },
  },
  jvm: {
    label: 'JVM bytecode',
    machine: true,
    naming: 'camel',
    lineComment: ';',
    terms: { call: 'method call', routine: 'method' },
  },
};

export const machineTargetIds = Object.keys(machineTargets);

const comments = (prefix, texts, indent = '') =>
  texts.flatMap((text) =>
    text.split('\n').map((line) => `${indent}${prefix} ${line}`.trimEnd())
  );

// Printable ASCII runs stay readable; other bytes are written as numbers.
function nasmText(text) {
  const parts = [];
  for (const byte of new globalThis.TextEncoder().encode(text)) {
    const printable = byte >= 0x20 && byte < 0x7f && byte !== 0x22;
    const last = parts.at(-1);
    if (printable && typeof last === 'string') {
      parts[parts.length - 1] = last + String.fromCharCode(byte);
    } else {
      parts.push(printable ? String.fromCharCode(byte) : byte);
    }
  }
  return parts
    .map((part) => (typeof part === 'string' ? `"${part}"` : part))
    .join(', ');
}

// ---------------------------------------------------------------------------
// x86-64 NASM, Linux System V calling convention.
// ---------------------------------------------------------------------------

const nasmJumps = {
  equal: 'je',
  notEqual: 'jne',
  less: 'jl',
  lessOrEqual: 'jle',
  greater: 'jg',
  greaterOrEqual: 'jge',
};
const nasmArithmetic = {
  add: ['add rax, rcx'],
  subtract: ['sub rax, rcx'],
  multiply: ['imul rax, rcx'],
  divide: ['cqo', 'idiv rcx'],
  remainder: ['cqo', 'idiv rcx', 'mov rax, rdx'],
};
const argumentRegisters = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'];

// Each procedure names its stack slots with context-local macros, such as
// "%$remainder", so the names cannot clash with labels or procedures.
function nasmProcedure(item, texts) {
  const offset = (slot) => `%$${item.slotNames[slot]}`;
  const frame = Math.ceil(item.slotCount / 2) * 16;
  const lines = [...comments(';', item.comments), `${item.name}:`];
  const body = [
    `%push ${item.name}`,
    ...item.slotNames.map(
      (slotName, slot) =>
        `%define %$${slotName} qword [rbp - ${8 * (slot + 1)}]`
    ),
    'push rbp',
    'mov rbp, rsp',
  ];
  if (frame) {
    body.push(`sub rsp, ${frame}`);
  }
  if (item.parameterCount > argumentRegisters.length) {
    throw new Error(`"${item.name}" has more than six parameters`);
  }
  for (let index = 0; index < item.parameterCount; index += 1) {
    body.push(`mov ${offset(index)}, ${argumentRegisters[index]}`);
  }
  const instructions = {
    comment: (text) => comments(';', [text]),
    push: (value) =>
      Math.abs(value) < 2 ** 31
        ? [`push ${value}`]
        : [`mov rax, ${value}`, 'push rax'],
    load: (slot) => [`push ${offset(slot)}`],
    store: (slot) => ['pop rax', `mov ${offset(slot)}, rax`],
    pop: () => ['add rsp, 8'],
    arithmetic: (operation) => [
      'pop rcx',
      'pop rax',
      ...nasmArithmetic[operation],
      'push rax',
    ],
    negate: () => ['neg qword [rsp]'],
    label: (name) => [`.${name}:`],
    jump: (name) => [`jmp .${name}`],
    'compare-jump': (relation, name) => [
      'pop rcx',
      'pop rax',
      'cmp rax, rcx',
      `${nasmJumps[relation]} .${name}`,
    ],
    call: (name, count) => [
      ...argumentRegisters
        .slice(0, count)
        .reverse()
        .map((register) => `pop ${register}`),
      `call ${name}`,
      ...(item.calls.get(name) ? ['push rax'] : []),
    ],
    return: () => ['pop rax', 'leave', 'ret'],
    'return-nothing': () =>
      item.name === 'main'
        ? ['xor eax, eax', 'leave', 'ret']
        : ['leave', 'ret'],
    'print-integer': () => ['pop rdi', 'call print_integer'],
    'print-text': (text) => [`lea rdi, [${texts(text)}]`, 'call print_text'],
    'print-newline': () => ['call print_newline'],
  };
  for (const [operation, ...operands] of item.code) {
    body.push(...instructions[operation](...operands));
  }
  body.push('%pop');
  return [
    ...lines,
    ...body.map((line) =>
      line.startsWith('.') || line.startsWith(';') ? line : `    ${line}`
    ),
  ];
}

function writeNasm(program) {
  const texts = new Map();
  const textLabel = (text) => {
    if (!texts.has(text)) {
      texts.set(text, `text_${texts.size}`);
    }
    return texts.get(text);
  };
  const returns = new Map(
    program.functions.map((item) => [item.name, item.returns])
  );
  const procedures = [...program.functions, program.main].map((item) =>
    nasmProcedure({ ...item, calls: returns }, textLabel)
  );
  const helper = (name, format, load) => [
    `${name}:`,
    '    push rbp',
    '    mov rbp, rsp',
    '    and rsp, -16',
    ...load.map((line) => `    ${line}`),
    `    lea rdi, [${format}]`,
    '    xor eax, eax',
    '    call printf wrt ..plt',
    '    leave',
    '    ret',
  ];
  return [
    ...comments(';', program.comments),
    ...(program.comments.length ? [''] : []),
    'default rel',
    'extern printf',
    'global main',
    '',
    'section .data',
    'integer_format: db "%lld", 0',
    'text_format: db "%s", 0',
    'newline_format: db 10, 0',
    ...[...texts].map(([text, label]) => `${label}: db ${nasmText(text)}, 0`),
    '',
    'section .text',
    ...procedures.flatMap((lines) => [...lines, '']),
    ...helper('print_integer', 'integer_format', ['mov rsi, rdi']),
    '',
    ...helper('print_text', 'text_format', ['mov rsi, rdi']),
    '',
    ...helper('print_newline', 'newline_format', []),
    '',
    'section .note.GNU-stack noalloc noexec nowrite progbits',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// CIL as ILAsm source for .NET.
// ---------------------------------------------------------------------------

const cilJumps = {
  equal: 'beq',
  notEqual: 'bne.un',
  less: 'blt',
  lessOrEqual: 'ble',
  greater: 'bgt',
  greaterOrEqual: 'bge',
};
const cilArithmetic = {
  add: 'add',
  subtract: 'sub',
  multiply: 'mul',
  divide: 'div',
  remainder: 'rem',
};

function cilText(text) {
  if (/^[\x20-\x7e]*$/.test(text)) {
    return `"${text.replace(/["\\]/g, '\\$&')}"`;
  }
  const bytes = [];
  for (const unit of text) {
    for (let index = 0; index < unit.length; index += 1) {
      const code = unit.charCodeAt(index);
      bytes.push(code & 0xff, code >> 8);
    }
  }
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0'));
  return `bytearray (${hex.join(' ')})`;
}

function cilMethod(item, signatures, entryName) {
  const isMain = item.name === 'main';
  const name = isMain ? entryName : item.name;
  const parameters = item.slotNames
    .slice(0, item.parameterCount)
    .map((slotName) => `int64 ${slotName}`)
    .join(', ');
  const locals = item.slotNames.slice(item.parameterCount);
  const access = (slot, argument, local) =>
    slot < item.parameterCount
      ? `${argument} ${slot}`
      : `${local} ${slot - item.parameterCount}`;
  const write = {
    comment: (text) => comments('//', [text]),
    push: (value) => [`ldc.i8 ${value}`],
    load: (slot) => [access(slot, 'ldarg', 'ldloc')],
    store: (slot) => [access(slot, 'starg', 'stloc')],
    pop: () => ['pop'],
    arithmetic: (operation) => [cilArithmetic[operation]],
    negate: () => ['neg'],
    label: (label) => [`${label}:`],
    jump: (label) => [`br ${label}`],
    'compare-jump': (relation, label) => [`${cilJumps[relation]} ${label}`],
    call: (callee) => [`call ${signatures.get(callee)}`],
    return: () => ['ret'],
    'return-nothing': () => ['ret'],
    'print-integer': () => [
      'call void [System.Console]System.Console::Write(int64)',
    ],
    'print-text': (text) => [
      `ldstr ${cilText(text)}`,
      'call void [System.Console]System.Console::Write(string)',
    ],
    'print-newline': () => [
      'call void [System.Console]System.Console::WriteLine()',
    ],
  };
  const body = [
    ...(isMain ? ['.entrypoint'] : []),
    `.maxstack ${Math.max(item.maxDepth, 1)}`,
    ...(locals.length
      ? [
          `.locals init (${locals.map((slotName) => `int64 ${slotName}`).join(', ')})`,
        ]
      : []),
  ];
  for (const [operation, ...operands] of item.code) {
    body.push(...write[operation](...operands));
  }
  return [
    ...comments('//', item.comments, '    '),
    `    .method public static ${item.returns ? 'int64' : 'void'} ${name}(${parameters}) cil managed`,
    '    {',
    ...body.map((line) =>
      /^\w+:$/.test(line) ? `      ${line}` : `        ${line}`
    ),
    '    }',
  ];
}

const frameworkKey = '(B0 3F 5F 7F 11 D5 0A 3A)';

function writeCil(program) {
  const signatures = new Map(
    program.functions.map((item) => [
      item.name,
      `${item.returns ? 'int64' : 'void'} Program::${item.name}(${Array.from({ length: item.parameterCount }, () => 'int64').join(', ')})`,
    ])
  );
  return [
    ...comments('//', program.comments),
    ...(program.comments.length ? [''] : []),
    `.assembly extern System.Runtime { .publickeytoken = ${frameworkKey} .ver 4:0:0:0 }`,
    `.assembly extern System.Console { .publickeytoken = ${frameworkKey} .ver 4:0:0:0 }`,
    '.assembly Program { }',
    '',
    '.class public abstract sealed auto ansi Program',
    '  extends [System.Runtime]System.Object',
    '{',
    ...[...program.functions, program.main].flatMap((item, index) => [
      ...(index ? [''] : []),
      ...cilMethod(item, signatures, 'Main'),
    ]),
    '}',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// JVM bytecode as Jasmin source. Longs take two local slots.
// ---------------------------------------------------------------------------

const jvmJumps = {
  equal: 'ifeq',
  notEqual: 'ifne',
  less: 'iflt',
  lessOrEqual: 'ifle',
  greater: 'ifgt',
  greaterOrEqual: 'ifge',
};
const jvmArithmetic = {
  add: 'ladd',
  subtract: 'lsub',
  multiply: 'lmul',
  divide: 'ldiv',
  remainder: 'lrem',
};
const printStream = 'java/lang/System/out Ljava/io/PrintStream;';

function jvmText(text) {
  return `"${[...text]
    .map((character) => {
      const code = character.codePointAt(0);
      if (character === '"' || character === '\\') {
        return `\\${character}`;
      }
      if (code >= 0x20 && code < 0x7f) {
        return character;
      }
      return [...character]
        .map((unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`)
        .join('');
    })
    .join('')}"`;
}

function jvmMethod(item, descriptors) {
  const isMain = item.name === 'main';
  const base = isMain ? 1 : 0;
  const slot = (index) => base + 2 * index;
  const write = {
    comment: (text) => comments(';', [text]),
    push: (value) => [`ldc2_w ${value}`],
    load: (index) => [`lload ${slot(index)}`],
    store: (index) => [`lstore ${slot(index)}`],
    pop: () => ['pop2'],
    arithmetic: (operation) => [jvmArithmetic[operation]],
    negate: () => ['lneg'],
    label: (label) => [`${label}:`],
    jump: (label) => [`goto ${label}`],
    'compare-jump': (relation, label) => [
      'lcmp',
      `${jvmJumps[relation]} ${label}`,
    ],
    call: (callee) => [`invokestatic Program/${descriptors.get(callee)}`],
    return: () => ['lreturn'],
    'return-nothing': () => ['return'],
    'print-integer': () => [
      `getstatic ${printStream}`,
      'dup_x2',
      'pop',
      'invokevirtual java/io/PrintStream/print(J)V',
    ],
    'print-text': (text) => [
      `getstatic ${printStream}`,
      `ldc ${jvmText(text)}`,
      'invokevirtual java/io/PrintStream/print(Ljava/lang/String;)V',
    ],
    'print-newline': () => [
      `getstatic ${printStream}`,
      'invokevirtual java/io/PrintStream/println()V',
    ],
  };
  const body = [
    `.limit stack ${2 * item.maxDepth + 3}`,
    `.limit locals ${base + 2 * item.slotCount}`,
    ...item.slotNames.map(
      (slotName, index) => `.var ${slot(index)} is ${slotName} J`
    ),
  ];
  for (const [operation, ...operands] of item.code) {
    body.push(...write[operation](...operands));
  }
  return [
    ...comments(';', item.comments),
    `.method public static ${isMain ? 'main([Ljava/lang/String;)V' : descriptors.get(item.name)}`,
    ...body.map((line) => (/^\w+:$/.test(line) ? line : `    ${line}`)),
    '.end method',
  ];
}

function writeJvm(program) {
  const descriptors = new Map(
    program.functions.map((item) => [
      item.name,
      `${item.name}(${'J'.repeat(item.parameterCount)})${item.returns ? 'J' : 'V'}`,
    ])
  );
  return [
    ...comments(';', program.comments),
    ...(program.comments.length ? [''] : []),
    '.class public Program',
    '.super java/lang/Object',
    '',
    ...[...program.functions, program.main].flatMap((item) => [
      ...jvmMethod(item, descriptors),
      '',
    ]),
  ].join('\n');
}

const writers = { nasm: writeNasm, cil: writeCil, jvm: writeJvm };

// Lower an adapted meta program and write it for a machine target.
export function emitMachine(program, target) {
  return writers[target](lowerProgram(program));
}
