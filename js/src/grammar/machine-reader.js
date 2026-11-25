// Read x86-64 assembly (NASM), CIL (ILAsm) and JVM bytecode (Jasmin) back
// into the stack machine code described in lowering.js. Each reader matches
// the instruction sequences that machine.js writes, so any program the
// translator lowered (or a hand-written program in the same style) can be
// lifted into the meta language again.
//
// A reader returns { comments, functions, main }. Every function has
// { name, parameterCount, slotNames, returns, comments, code }.

const relationsByJump = (table) =>
  Object.fromEntries(Object.entries(table).map(([key, value]) => [value, key]));

const nasmRelations = relationsByJump({
  equal: 'je',
  notEqual: 'jne',
  less: 'jl',
  lessOrEqual: 'jle',
  greater: 'jg',
  greaterOrEqual: 'jge',
});
const cilRelations = relationsByJump({
  equal: 'beq',
  notEqual: 'bne.un',
  less: 'blt',
  lessOrEqual: 'ble',
  greater: 'bgt',
  greaterOrEqual: 'bge',
});
const jvmRelations = relationsByJump({
  equal: 'ifeq',
  notEqual: 'ifne',
  less: 'iflt',
  lessOrEqual: 'ifle',
  greater: 'ifgt',
  greaterOrEqual: 'ifge',
});
const cilArithmetic = {
  add: 'add',
  sub: 'subtract',
  mul: 'multiply',
  div: 'divide',
  rem: 'remainder',
};
const jvmArithmetic = {
  ladd: 'add',
  lsub: 'subtract',
  lmul: 'multiply',
  ldiv: 'divide',
  lrem: 'remainder',
};
const nasmArithmetic = [
  [['add rax, rcx'], 'add'],
  [['sub rax, rcx'], 'subtract'],
  [['imul rax, rcx'], 'multiply'],
  [['cqo', 'idiv rcx', 'mov rax, rdx'], 'remainder'],
  [['cqo', 'idiv rcx'], 'divide'],
];
const argumentRegisters = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'];

function readError(target, line, message) {
  return new Error(`Cannot read ${target} line "${line}": ${message}`);
}

// Read instructions with a list of rules. A rule is [patterns, build]: the
// patterns match consecutive lines, and build turns the matches into
// instructions. The first rule that matches wins, so longer sequences come
// first.
function readInstructions(lines, rules, target) {
  const code = [];
  let index = 0;
  while (index < lines.length) {
    let matched = false;
    for (const [patterns, build] of rules) {
      const matches = patterns.map((pattern, offset) =>
        lines[index + offset]?.match(pattern)
      );
      if (matches.every(Boolean)) {
        const built = build(...matches);
        if (built) {
          code.push(...built);
          index += patterns.length;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      throw readError(target, lines[index], 'unknown instruction');
    }
  }
  return code;
}

// Split a file into the program comments (before the first line that
// starts the program) and the rest.
function leadingComments(lines, prefix, start) {
  const first = lines.findIndex((line) => start.test(line));
  const comments = lines
    .slice(0, Math.max(first, 0))
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).replace(/^ /, ''));
  return { comments, rest: lines.slice(first) };
}

const integer = (text) => {
  const value = Number(text);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`The integer ${text} is outside the supported range`);
  }
  return value;
};

// Functions after reading: "main" is the entry point.
function program(comments, items) {
  const main = items.find((item) => item.name === 'main');
  if (!main) {
    throw new Error('The machine program has no entry point');
  }
  return {
    comments,
    functions: items.filter((item) => item !== main),
    main,
  };
}

// ---------------------------------------------------------------------------
// x86-64 NASM
// ---------------------------------------------------------------------------

function nasmTexts(lines) {
  const texts = new Map();
  for (const line of lines) {
    const match = line.match(/^(text_\d+): db (.*), 0$/);
    if (!match) {
      continue;
    }
    const bytes = [];
    for (const part of match[2].match(/"[^"]*"|\d+/g)) {
      if (part.startsWith('"')) {
        bytes.push(...[...part.slice(1, -1)].map((c) => c.charCodeAt(0)));
      } else {
        bytes.push(Number(part));
      }
    }
    texts.set(
      match[1],
      new globalThis.TextDecoder().decode(Uint8Array.from(bytes))
    );
  }
  return texts;
}

function nasmRules(texts, slots) {
  const slot = (name) => {
    if (!slots.has(name)) {
      throw new Error(`Unknown stack slot "${name}"`);
    }
    return slots.get(name);
  };
  const callRule = (count) => [
    [
      ...argumentRegisters
        .slice(0, count)
        .reverse()
        .map((register) => new RegExp(`^pop ${register}$`)),
      /^call (\w+)$/,
    ],
    (...matches) => {
      const name = matches.at(-1)[1];
      if (name.startsWith('print_')) {
        return count === 1 && name === 'print_integer'
          ? [['print-integer']]
          : null;
      }
      return [['call', name, count]];
    },
  ];
  return [
    [[/^; ?(.*)$/], ([, text]) => [['comment', text]]],
    [[/^push (-?\d+)$/], ([, value]) => [['push', integer(value)]]],
    [
      [/^mov rax, (-?\d+)$/, /^push rax$/],
      ([, value]) => [['push', integer(value)]],
    ],
    [[/^push %\$(\w+)$/], ([, name]) => [['load', slot(name)]]],
    [
      [/^pop rax$/, /^mov %\$(\w+), rax$/],
      (_, [, name]) => [['store', slot(name)]],
    ],
    [[/^pop rax$/, /^leave$/, /^ret$/], () => [['return']]],
    // Arrays: new_array(length, fill) and the elements after the address.
    [
      [/^pop rsi$/, /^pop rdi$/, /^call new_array$/, /^push rax$/],
      () => [['new-array']],
    ],
    [[/^push qword \[rsp\]$/], () => [['dup']]],
    [
      [/^pop rcx$/, /^pop rax$/, /^push qword \[rax \+ rcx \* 8\]$/],
      () => [['element-index'], ['load-element']],
    ],
    [
      [/^pop rdx$/, /^pop rcx$/, /^pop rax$/, /^mov \[rax \+ rcx \* 8\], rdx$/],
      () => [['store-element']],
    ],
    [[/^pop rax$/, /^push qword \[rax - 8\]$/], () => [['array-length']]],
    [[/^add rsp, 8$/], () => [['pop']]],
    ...nasmArithmetic.map(([lines, operation]) => [
      [
        /^pop rcx$/,
        /^pop rax$/,
        ...lines.map((line) => new RegExp(`^${line}$`)),
        /^push rax$/,
      ],
      () => [['arithmetic', operation]],
    ]),
    [
      [/^pop rcx$/, /^pop rax$/, /^cmp rax, rcx$/, /^(j\w+) \.(\w+)$/],
      (_, __, ___, [, jump, label]) =>
        nasmRelations[jump]
          ? [['compare-jump', nasmRelations[jump], label]]
          : null,
    ],
    [[/^neg qword \[rsp\]$/], () => [['negate']]],
    [[/^\.(\w+):$/], ([, label]) => [['label', label]]],
    [[/^jmp \.(\w+)$/], ([, label]) => [['jump', label]]],
    [
      [/^lea rdi, \[(text_\d+)\]$/, /^call print_text$/],
      ([, label]) => [['print-text', texts.get(label)]],
    ],
    [[/^call print_newline$/], () => [['print-newline']]],
    [[/^xor eax, eax$/, /^leave$/, /^ret$/], () => [['return-nothing']]],
    [[/^leave$/, /^ret$/], () => [['return-nothing']]],
    ...[6, 5, 4, 3, 2, 1, 0].map(callRule),
    [
      [/^push rax$/],
      () =>
        // "call f" followed by "push rax" keeps the result of f.
        [['result']],
    ],
  ];
}

function readNasmProcedure(name, comments, lines, texts) {
  const slots = new Map();
  let index = 0;
  const expect = (pattern) => {
    const match = lines[index]?.match(pattern);
    if (!match) {
      throw readError('nasm', lines[index] ?? '', `expected ${pattern}`);
    }
    index += 1;
    return match;
  };
  expect(/^%push \w+$/);
  while (lines[index]?.startsWith('%define')) {
    const [, slotName] = expect(/^%define %\$(\w+) qword \[rbp - \d+\]$/);
    slots.set(slotName, slots.size);
  }
  expect(/^push rbp$/);
  expect(/^mov rbp, rsp$/);
  if (/^sub rsp, \d+$/.test(lines[index])) {
    index += 1;
  }
  let parameterCount = 0;
  while (
    lines[index]?.match(/^mov %\$\w+, (\w+)$/)?.[1] ===
    argumentRegisters[parameterCount]
  ) {
    parameterCount += 1;
    index += 1;
  }
  const end = lines.lastIndexOf('%pop');
  const raw = readInstructions(
    lines.slice(index, end),
    nasmRules(texts, slots),
    'nasm'
  );
  // "call f; push rax" is a call whose result stays on the stack. A call
  // without "push rax" is a call to a procedure that returns nothing.
  const code = [];
  for (const instruction of raw) {
    if (instruction[0] === 'result') {
      const last = code.at(-1);
      if (last?.[0] !== 'call') {
        throw readError('nasm', 'push rax', 'not after a call');
      }
      continue;
    }
    code.push(instruction);
  }
  return {
    name,
    parameterCount,
    slotNames: [...slots.keys()],
    returns: code.some(([operation]) => operation === 'return'),
    comments,
    code,
  };
}

export function readNasm(source) {
  const lines = source.split('\n').map((line) => line.trim());
  const { comments, rest } = leadingComments(lines, ';', /^default rel$/);
  const texts = nasmTexts(rest);
  const text = rest.slice(rest.indexOf('section .text') + 1);
  const items = [];
  let pending = [];
  for (let index = 0; index < text.length; index += 1) {
    const line = text[index];
    const label = line.match(/^(\w+):$/);
    if (line.startsWith(';')) {
      pending.push(line.replace(/^; ?/, ''));
    } else if (label && text[index + 1]?.startsWith('%push')) {
      const end = text.indexOf('%pop', index);
      items.push(
        readNasmProcedure(
          label[1],
          pending,
          text.slice(index + 1, end + 1),
          texts
        )
      );
      pending = [];
      index = end;
    } else if (line) {
      pending = [];
    }
  }
  return program(comments, items);
}

// ---------------------------------------------------------------------------
// CIL (ILAsm)
// ---------------------------------------------------------------------------

function cilString(literal) {
  const bytes = literal.match(/^bytearray \(([0-9a-f ]*)\)$/);
  if (bytes) {
    const values = bytes[1].split(' ').map((byte) => parseInt(byte, 16));
    let result = '';
    for (let index = 0; index < values.length; index += 2) {
      result += String.fromCharCode(values[index] | (values[index + 1] << 8));
    }
    return result;
  }
  return literal.slice(1, -1).replace(/\\(["\\])/g, '$1');
}

function cilRules(parameterCount) {
  const access = (kind, index) =>
    kind.endsWith('arg') ? Number(index) : parameterCount + Number(index);
  const console = 'call void \\[System\\.Console\\]System\\.Console::';
  return [
    [[/^\/\/ ?(.*)$/], ([, text]) => [['comment', text]]],
    [[/^ldc\.i8 (-?\d+)$/], ([, value]) => [['push', integer(value)]]],
    [
      [/^(ldarg|ldloc) (\d+)$/],
      ([, kind, index]) => [['load', access(kind, index)]],
    ],
    [
      [/^(starg|stloc) (\d+)$/],
      ([, kind, index]) => [['store', access(kind, index)]],
    ],
    [[/^pop$/], () => [['pop']]],
    [[/^dup$/], () => [['dup']]],
    [[/^conv\.ovf\.i$/], () => [['element-index']]],
    [[/^ldelem\.i8$/], () => [['load-element']]],
    [[/^stelem\.i8$/], () => [['store-element']]],
    [[/^ldlen$/, /^conv\.i8$/], () => [['array-length']]],
    [
      [/^call int64\[\] Program::NewArray\(int64, int64\)$/],
      () => [['new-array']],
    ],
    [
      [/^(add|sub|mul|div|rem)$/],
      ([, operation]) => [['arithmetic', cilArithmetic[operation]]],
    ],
    [[/^neg$/], () => [['negate']]],
    [[/^(\w+):$/], ([, label]) => [['label', label]]],
    [[/^br (\w+)$/], ([, label]) => [['jump', label]]],
    [
      [/^(beq|bne\.un|blt|ble|bgt|bge) (\w+)$/],
      ([, jump, label]) => [['compare-jump', cilRelations[jump], label]],
    ],
    [[new RegExp(`^${console}Write\\(int64\\)$`)], () => [['print-integer']]],
    [
      [/^ldstr (.*)$/, new RegExp(`^${console}Write\\(string\\)$`)],
      ([, literal]) => [['print-text', cilString(literal)]],
    ],
    [[new RegExp(`^${console}WriteLine\\(\\)$`)], () => [['print-newline']]],
    [
      [/^call (?:int64|void) Program::(\w+)\(([^)]*)\)$/],
      ([, callee, parameters]) => [
        ['call', callee, parameters ? parameters.split(',').length : 0],
      ],
    ],
    [[/^ret$/], () => [['ret']]],
  ];
}

export function readCil(source) {
  const lines = source.split('\n').map((line) => line.trim());
  const { comments, rest } = leadingComments(lines, '//', /^\.assembly/);
  const items = [];
  let pending = [];
  for (let index = 0; index < rest.length; index += 1) {
    const line = rest[index];
    const header = line.match(
      /^\.method public static (int64|void) (\w+)\(([^)]*)\) cil managed$/
    );
    if (line.startsWith('//')) {
      pending.push(line.replace(/^\/\/ ?/, ''));
      continue;
    }
    if (!header) {
      pending = [];
      continue;
    }
    const [, returnType, methodName, parameterList] = header;
    const parameters = parameterList
      ? parameterList.split(',').map((item) => item.trim().split(' ')[1])
      : [];
    const end = rest.indexOf('}', index);
    const body = rest
      .slice(index + 2, end)
      .filter((item) => !/^\.(entrypoint|maxstack)/.test(item));
    const locals = [];
    if (body[0]?.startsWith('.locals')) {
      const list = body.shift().match(/^\.locals init \((.*)\)$/)[1];
      locals.push(...list.split(',').map((item) => item.trim().split(' ')[1]));
    }
    const returns = returnType === 'int64';
    const code = readInstructions(body, cilRules(parameters.length), 'cil').map(
      (instruction) =>
        instruction[0] === 'ret'
          ? [returns ? 'return' : 'return-nothing']
          : instruction
    );
    items.push({
      name: methodName === 'Main' ? 'main' : methodName,
      parameterCount: parameters.length,
      slotNames: [...parameters, ...locals],
      returns,
      comments: pending,
      code,
    });
    pending = [];
    index = end;
  }
  return program(comments, items);
}

// ---------------------------------------------------------------------------
// JVM bytecode (Jasmin)
// ---------------------------------------------------------------------------

function jvmString(literal) {
  return literal
    .slice(1, -1)
    .replace(/\\u([0-9a-f]{4})|\\(["\\])/g, (_, code, escaped) =>
      code ? String.fromCharCode(parseInt(code, 16)) : escaped
    );
}

function jvmRules(slotOf) {
  const out = /^getstatic java\/lang\/System\/out Ljava\/io\/PrintStream;$/;
  return [
    [[/^; ?(.*)$/], ([, text]) => [['comment', text]]],
    [[/^ldc2_w (-?\d+)$/], ([, value]) => [['push', integer(value)]]],
    [[/^[la]load (\d+)$/], ([, index]) => [['load', slotOf(index)]]],
    [[/^[la]store (\d+)$/], ([, index]) => [['store', slotOf(index)]]],
    [[/^dup$/], () => [['dup']]],
    [[/^l2i$/], () => [['element-index']]],
    [[/^laload$/], () => [['load-element']]],
    [[/^lastore$/], () => [['store-element']]],
    [[/^arraylength$/, /^i2l$/], () => [['array-length']]],
    [[/^invokestatic Program\/newArray\(JJ\)\[J$/], () => [['new-array']]],
    [[/^pop2$/], () => [['pop']]],
    [
      [/^(ladd|lsub|lmul|ldiv|lrem)$/],
      ([, operation]) => [['arithmetic', jvmArithmetic[operation]]],
    ],
    [[/^lneg$/], () => [['negate']]],
    [[/^(\w+):$/], ([, label]) => [['label', label]]],
    [[/^goto (\w+)$/], ([, label]) => [['jump', label]]],
    [
      [/^lcmp$/, /^(if\w+) (\w+)$/],
      (_, [, jump, label]) => [['compare-jump', jvmRelations[jump], label]],
    ],
    [
      [/^invokestatic Program\/(\w+)\((J*)\)[JV]$/],
      ([, callee, parameters]) => [['call', callee, parameters.length]],
    ],
    [[/^lreturn$/], () => [['return']]],
    [[/^return$/], () => [['return-nothing']]],
    [
      [
        out,
        /^dup_x2$/,
        /^pop$/,
        /^invokevirtual java\/io\/PrintStream\/print\(J\)V$/,
      ],
      () => [['print-integer']],
    ],
    [
      [
        out,
        /^ldc (".*")$/,
        /^invokevirtual java\/io\/PrintStream\/print\(Ljava\/lang\/String;\)V$/,
      ],
      (_, [, literal]) => [['print-text', jvmString(literal)]],
    ],
    [
      [out, /^invokevirtual java\/io\/PrintStream\/println\(\)V$/],
      () => [['print-newline']],
    ],
  ];
}

export function readJvm(source) {
  const lines = source.split('\n').map((line) => line.trim());
  const { comments, rest } = leadingComments(lines, ';', /^\.class/);
  const items = [];
  let pending = [];
  for (let index = 0; index < rest.length; index += 1) {
    const line = rest[index];
    const header = line.match(
      /^\.method public static (\w+)\(([^)]*)\)([JV])$/
    );
    if (line.startsWith(';')) {
      pending.push(line.replace(/^; ?/, ''));
      continue;
    }
    if (!header) {
      pending = [];
      continue;
    }
    const [, methodName, descriptor, result] = header;
    const isMain = methodName === 'main';
    const base = isMain ? 1 : 0;
    const end = rest.indexOf('.end method', index);
    const body = rest
      .slice(index + 1, end)
      .filter((item) => !/^\.limit/.test(item));
    const slotNames = [];
    while (body[0]?.startsWith('.var')) {
      const [, number, slotName] = body
        .shift()
        .match(/^\.var (\d+) is (\w+) \[?J$/);
      slotNames[(Number(number) - base) / 2] = slotName;
    }
    const slotOf = (number) => (Number(number) - base) / 2;
    items.push({
      name: methodName,
      parameterCount: isMain ? 0 : descriptor.length,
      slotNames,
      returns: result === 'J',
      comments: pending,
      code: readInstructions(body, jvmRules(slotOf), 'jvm'),
    });
    pending = [];
    index = end;
  }
  return program(comments, items);
}

export const machineReaders = { nasm: readNasm, cil: readCil, jvm: readJvm };
