// Machine targets: x86-64 assembly (NASM, System V, libc printf), CIL
// (ILAsm for .NET) and JVM bytecode (Jasmin); the GNU as, ARM64, LLVM IR and
// WebAssembly text writers live in modules of their own. Each writer spells
// the stack machine code from lowering.js; the descriptions below are read
// by the context rules (comment adaptation, naming) like any language
// description.

import { lowerProgram } from './lowering.js';
import { writeArm64, writeGas } from './machine-assembly.js';
import { writeLlvm } from './machine-llvm.js';
import {
  comments,
  createsArrays,
  mapInstructions,
  mappedText,
  renderMachine,
} from './machine-shared.js';
import { writeWat } from './machine-wasm.js';

// Jasmin reads these words as instructions or keywords, so a variable named
// like one (swap, pop, new) is written with a trailing underscore, which the
// reader removes again.
const jasminWords = new Set(
  `
  aaload aastore abstract aconst_null aload aload_0 aload_1 aload_2 aload_3
  anewarray annotation areturn arraylength astore astore_0 astore_1 astore_2
  astore_3 athrow baload bastore bipush breakpoint caload castore checkcast
  d2f d2i d2l dadd daload dastore dcmpg dcmpl dconst_0 dconst_1 ddiv default
  dload dload_0 dload_1 dload_2 dload_3 dmul dneg drem dreturn dstore
  dstore_0 dstore_1 dstore_2 dstore_3 dsub dup dup2 dup2_x1 dup2_x2 dup_x1
  dup_x2 enum f2d f2i f2l fadd faload fastore fcmpg fcmpl fconst_0 fconst_1
  fconst_2 fdiv final fload fload_0 fload_1 fload_2 fload_3 fmul fneg frem
  freturn from fstore fstore_0 fstore_1 fstore_2 fstore_3 fsub getfield
  getstatic goto goto_w i2b i2c i2d i2f i2l i2s iadd iaload iand iastore
  iconst_0 iconst_1 iconst_2 iconst_3 iconst_4 iconst_5 iconst_m1 idiv
  if_acmpeq if_acmpne if_icmpeq if_icmpge if_icmpgt if_icmple if_icmplt
  if_icmpne ifeq ifge ifgt ifle iflt ifne ifnonnull ifnull iinc iload iload_0
  iload_1 iload_2 iload_3 imul ineg instanceof int2byte int2char int2short
  interface invokedynamic invokeinterface invokenonvirtual invokespecial
  invokestatic invokevirtual ior irem ireturn is ishl ishr istore istore_0
  istore_1 istore_2 istore_3 isub iushr ixor jsr jsr_w l2d l2f l2i ladd
  laload land lastore lcmp lconst_0 lconst_1 ldc ldc2_w ldc_w ldiv lload
  lload_0 lload_1 lload_2 lload_3 lmul lneg lookupswitch lor lrem lreturn
  lshl lshr lstore lstore_0 lstore_1 lstore_2 lstore_3 lsub lushr lxor method
  monitorenter monitorexit multianewarray native new newarray nop pop pop2
  private public putfield putstatic ret ret_w return saload sastore sipush
  static strictfp swap synchronized tableswitch to using volatile wide
`
    .trim()
    .split(/\s+/)
);

export const jasminName = (name) => (jasminWords.has(name) ? `${name}_` : name);

export const jasminVariable = (name) =>
  name.endsWith('_') && jasminWords.has(name.slice(0, -1))
    ? name.slice(0, -1)
    : name;

export const machineTargets = {
  nasm: {
    label: 'x86-64 assembly (NASM)',
    machine: true,
    naming: 'snake',
    lineComment: ';',
    quotes: ['"', "'", '`'],
    terms: { call: 'call instruction', routine: 'procedure' },
  },
  gas: {
    label: 'x86-64 assembly (GNU as, AT&T)',
    machine: true,
    naming: 'snake',
    lineComment: '#',
    blockComment: ['/*', '*/'],
    terms: { call: 'call instruction', routine: 'function' },
  },
  arm64: {
    label: 'ARM64 assembly',
    machine: true,
    naming: 'snake',
    lineComment: '//',
    blockComment: ['/*', '*/'],
    terms: { call: 'branch instruction', routine: 'function' },
  },
  cil: {
    label: 'CIL',
    machine: true,
    naming: { function: 'pascal', variable: 'camel' },
    lineComment: '//',
    blockComment: ['/*', '*/'],
    quotes: ['"', "'"],
    terms: { call: 'method call', routine: 'method' },
  },
  jvm: {
    label: 'JVM bytecode',
    machine: true,
    naming: 'camel',
    lineComment: ';',
    terms: { call: 'method call', routine: 'method' },
  },
  llvm: {
    label: 'LLVM IR',
    machine: true,
    naming: 'snake',
    lineComment: ';',
    terms: { call: 'call instruction', routine: 'function' },
  },
  wat: {
    label: 'WebAssembly text',
    machine: true,
    naming: 'snake',
    lineComment: ';;',
    blockComment: ['(;', ';)'],
    terms: { call: 'call instruction', routine: 'function' },
  },
};

export const machineTargetIds = Object.keys(machineTargets);

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
    // An array is a pointer to its first element, with its length stored
    // in the eight bytes before it.
    'new-array': () => ['pop rsi', 'pop rdi', 'call new_array', 'push rax'],
    dup: () => ['push qword [rsp]'],
    'element-index': () => [],
    'load-element': () => ['pop rcx', 'pop rax', 'push qword [rax + rcx * 8]'],
    'store-element': () => [
      'pop rdx',
      'pop rcx',
      'pop rax',
      'mov [rax + rcx * 8], rdx',
    ],
    'array-length': () => ['pop rax', 'push qword [rax - 8]'],
  };
  for (const instruction of item.code) {
    const [operation, ...operands] = instruction;
    body.push(
      ...mapInstructions(instructions[operation](...operands), instruction)
    );
  }
  body.push('%pop');
  return [
    ...lines,
    ...body.map((line) =>
      mappedText(
        line.startsWith('.') || line.startsWith(';')
          ? String(line)
          : `    ${line}`,
        line
      )
    ),
  ];
}

// new_array(length, fill): malloc room for the length and the elements,
// then fill them. The memory lives until the program ends.
const nasmNewArray = [
  'new_array:',
  '    push rbp',
  '    mov rbp, rsp',
  '    and rsp, -16',
  '    push rdi',
  '    push rsi',
  '    lea rdi, [rdi * 8 + 8]',
  '    call malloc wrt ..plt',
  '    pop rsi',
  '    pop rdi',
  '    mov [rax], rdi',
  '    add rax, 8',
  '    xor ecx, ecx',
  '.fill:',
  '    cmp rcx, rdi',
  '    jge .done',
  '    mov [rax + rcx * 8], rsi',
  '    inc rcx',
  '    jmp .fill',
  '.done:',
  '    leave',
  '    ret',
  '',
];

function writeNasm(program) {
  const arrays = createsArrays(program);
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
  return renderMachine(
    [
      ...comments(';', program.comments),
      ...(program.comments.length ? [''] : []),
      'default rel',
      'extern printf',
      ...(arrays ? ['extern malloc'] : []),
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
      ...(arrays ? nasmNewArray : []),
      ...helper('print_integer', 'integer_format', ['mov rsi, rdi']),
      '',
      ...helper('print_text', 'text_format', ['mov rsi, rdi']),
      '',
      ...helper('print_newline', 'newline_format', []),
      '',
      'section .note.GNU-stack noalloc noexec nowrite progbits',
      '',
    ],
    'nasm'
  );
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
  const local = (slotName, slot) =>
    `${item.slotTypes?.[slot] === 'array' ? 'int64[]' : 'int64'} ${slotName}`;
  const locals = item.slotNames.map(local).slice(item.parameterCount);
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
    'new-array': () => [`call int64[] Program::${cilNewArray}(int64, int64)`],
    dup: () => ['dup'],
    'element-index': () => ['conv.ovf.i'],
    'load-element': () => ['ldelem.i8'],
    'store-element': () => ['stelem.i8'],
    'array-length': () => ['ldlen', 'conv.i8'],
  };
  const body = [
    ...(isMain ? ['.entrypoint'] : []),
    `.maxstack ${Math.max(item.maxDepth, 1)}`,
    ...(locals.length ? [`.locals init (${locals.join(', ')})`] : []),
  ];
  for (const instruction of item.code) {
    const [operation, ...operands] = instruction;
    body.push(...mapInstructions(write[operation](...operands), instruction));
  }
  return [
    ...comments('//', item.comments, '    '),
    `    .method public static ${item.returns ? 'int64' : 'void'} ${name}(${parameters}) cil managed`,
    '    {',
    ...body.map((line) =>
      mappedText(
        /^\w+:$/.test(line) ? `      ${line}` : `        ${line}`,
        line
      )
    ),
    '    }',
  ];
}

const frameworkKey = '(B0 3F 5F 7F 11 D5 0A 3A)';

// NewArray(length, fill): a new array filled by Array.Fill.
const cilNewArray = 'NewArray';
const cilNewArrayMethod = [
  '',
  `    .method private static int64[] ${cilNewArray}(int64 length, int64 fill) cil managed`,
  '    {',
  '        .maxstack 3',
  '        ldarg 0',
  '        conv.ovf.i',
  '        newarr [System.Runtime]System.Int64',
  '        dup',
  '        ldarg 1',
  '        call void [System.Runtime]System.Array::Fill<int64>(!!0[], !!0)',
  '        ret',
  '    }',
];

function writeCil(program) {
  const signatures = new Map(
    program.functions.map((item) => [
      item.name,
      `${item.returns ? 'int64' : 'void'} Program::${item.name}(${Array.from({ length: item.parameterCount }, () => 'int64').join(', ')})`,
    ])
  );
  return renderMachine(
    [
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
      ...(createsArrays(program) ? cilNewArrayMethod : []),
      '}',
      '',
    ],
    'cil'
  );
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
  // Arrays are references, loaded with aload; integers are longs.
  const isArray = (index) => item.slotTypes?.[index] === 'array';
  const prefix = (index) => (isArray(index) ? 'a' : 'l');
  const write = {
    comment: (text) => comments(';', [text]),
    push: (value) => [`ldc2_w ${value}`],
    load: (index) => [`${prefix(index)}load ${slot(index)}`],
    store: (index) => [`${prefix(index)}store ${slot(index)}`],
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
    'new-array': () => ['invokestatic Program/newArray(JJ)[J'],
    dup: () => ['dup'],
    'element-index': () => ['l2i'],
    'load-element': () => ['laload'],
    'store-element': () => ['lastore'],
    'array-length': () => ['arraylength', 'i2l'],
  };
  const body = [
    `.limit stack ${2 * item.maxDepth + 3}`,
    `.limit locals ${base + 2 * item.slotCount}`,
    ...item.slotNames.map(
      (slotName, index) =>
        `.var ${slot(index)} is ${jasminName(slotName)} ${isArray(index) ? '[J' : 'J'}`
    ),
  ];
  for (const instruction of item.code) {
    const [operation, ...operands] = instruction;
    body.push(...mapInstructions(write[operation](...operands), instruction));
  }
  return [
    ...comments(';', item.comments),
    `.method public static ${isMain ? 'main([Ljava/lang/String;)V' : descriptors.get(item.name)}`,
    ...body.map((line) =>
      mappedText(/^\w+:$/.test(line) ? String(line) : `    ${line}`, line)
    ),
    '.end method',
  ];
}

// newArray(length, fill): a new array filled by Arrays.fill.
const jvmNewArrayMethod = [
  '.method private static newArray(JJ)[J',
  '    .limit stack 5',
  '    .limit locals 4',
  '    lload 0',
  '    l2i',
  '    newarray long',
  '    dup',
  '    lload 2',
  '    invokestatic java/util/Arrays/fill([JJ)V',
  '    areturn',
  '.end method',
  '',
];

function writeJvm(program) {
  const descriptors = new Map(
    program.functions.map((item) => [
      item.name,
      `${item.name}(${'J'.repeat(item.parameterCount)})${item.returns ? 'J' : 'V'}`,
    ])
  );
  return renderMachine(
    [
      ...comments(';', program.comments),
      ...(program.comments.length ? [''] : []),
      '.class public Program',
      '.super java/lang/Object',
      '',
      ...[...program.functions, program.main].flatMap((item) => [
        ...jvmMethod(item, descriptors),
        '',
      ]),
      ...(createsArrays(program) ? jvmNewArrayMethod : []),
    ],
    'jvm'
  );
}

const writers = {
  nasm: writeNasm,
  gas: writeGas,
  arm64: writeArm64,
  cil: writeCil,
  jvm: writeJvm,
  llvm: writeLlvm,
  wat: writeWat,
};

// Lower an adapted meta program and write it for a machine target.
export function emitMachine(program, target) {
  return writers[target](lowerProgram(program));
}
