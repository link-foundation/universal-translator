import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';

import {
  createTranslator,
  languageProfiles,
  writeEffect,
} from '../../js/src/index.js';

import {
  exampleEffects,
  expectedOutput,
  fixture,
  localizedGreetings,
  nativeArguments,
  nativeProgram,
} from './fixtures.mjs';

const translator = createTranslator();
// Browser alerts run in the pinned corpus check with a real browser host.
const effects = exampleEffects().filter(
  ({ task }) => !['browser-alert', 'browser-write'].includes(task)
);
const localized = localizedGreetings().filter(({ message }) =>
  ["S'mae byd!", 'こんにちは、 世界！', 'ជំរាបសួរ ពិភពលោក'].includes(message)
);
const commonLibraries = {
  'main.mjs': '../../js/src/common-library.mjs',
  'main.rs': '../../rust/src/common_library.rs',
};
const ackermannBoundaries = Array.from({ length: 4 }, (_, right) => ({
  task: 'ackermann-value',
  left: 3,
  right,
}));
const fizzBuzzBoundaries = [
  { task: 'fizz-buzz-function', limit: 1 },
  { task: 'fizz-buzz-function', limit: 1000 },
  { task: 'fizz-buzz-joined', limit: 1, separator: 32 },
  { task: 'fizz-buzz-joined', limit: 1000, separator: 10 },
];
const boundaryEffects = {
  rust: [...ackermannBoundaries, ...fizzBuzzBoundaries],
  javascript: [...ackermannBoundaries, ...fizzBuzzBoundaries],
  cobol: [
    { task: 'hello', message: '' },
    { task: 'hello', message: ` ${'Hello'.repeat(18)} !?  ` },
  ],
  'nasm-x86-64': [
    { task: 'greatest-common-divisor', left: 0, right: 0 },
    { task: 'greatest-common-divisor', left: 0, right: 2147483647 },
    { task: 'fizz-buzz', limit: 1000 },
  ],
};
const environment = {
  ...process.env,
  DOTNET_CLI_TELEMETRY_OPTOUT: '1',
  DOTNET_NOLOGO: '1',
  GOTOOLCHAIN: 'local',
  LC_ALL: 'C.UTF-8',
};
const tools = (command) =>
  spawnSync('sh', ['-c', 'command -v "$1"', 'sh', command]).status === 0;

function run(directory, command, ...args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    cwd: directory,
    env: environment,
    timeout: 45000,
  });
}

function interpreted(filename, command, ...argumentsBeforeFilename) {
  return {
    filename,
    tools: [command],
    execute: (directory, _form, invocations) =>
      invocations
        .map((args) =>
          run(directory, command, ...argumentsBeforeFilename, filename, ...args)
        )
        .join(''),
  };
}

function compiled(filename, compiler, ...flags) {
  return {
    filename,
    tools: [compiler],
    execute(directory, _form, invocations) {
      run(directory, compiler, ...flags, filename, '-o', 'program');
      return invocations
        .map((args) => run(directory, './program', ...args))
        .join('');
    },
  };
}

function dotnet(filename, language) {
  return {
    filename,
    tools: ['dotnet'],
    execute(directory) {
      run(
        directory,
        'dotnet',
        'new',
        'console',
        '--language',
        language,
        '--name',
        'Check',
        '--no-restore',
        '--output',
        '.',
        '--force'
      );
      writeFileSync(
        join(directory, filename),
        readFileSync(join(directory, 'fixture'))
      );
      run(directory, 'dotnet', 'build', '--nologo', '-v:q', '-o', 'out');
      return run(directory, 'dotnet', 'out/Check.dll');
    },
  };
}

const runners = {
  javascript: interpreted('main.mjs', 'node'),
  typescript: interpreted('main.ts', 'node'),
  python: interpreted('main.py', 'python3'),
  ruby: interpreted('main.rb', 'ruby'),
  php: interpreted('main.php', 'php'),
  shell: interpreted('main.sh', 'sh'),
  perl: interpreted('main.pl', 'perl'),
  lua: interpreted('main.lua', 'lua5.4'),
  r: interpreted('main.R', 'Rscript', '--vanilla'),
  tcl: interpreted('main.tcl', 'tclsh'),
  awk: interpreted('main.awk', 'awk', '-f'),
  powershell: interpreted(
    'main.ps1',
    'pwsh',
    '-NoProfile',
    '-NonInteractive',
    '-File'
  ),
  go: interpreted('main.go', 'go', 'run'),
  java: interpreted('Main.java', 'java'),
  swift: interpreted('main.swift', 'swift'),
  ocaml: interpreted('main.ml', 'ocaml'),
  dart: interpreted('main.dart', 'dart'),
  c: compiled('main.c', 'cc', '-std=c11'),
  cpp: compiled('main.cpp', 'c++', '-std=c++17'),
  rust: compiled('main.rs', 'rustc', '--edition=2021'),
  fortran: compiled('main.f90', 'gfortran'),
  'llvm-ir': compiled('main.ll', 'clang', '-Wno-override-module'),
  csharp: dotnet('Program.cs', 'C#'),
  vbnet: dotnet('Program.vb', 'VB'),
  sqlite: {
    filename: 'main.sql',
    tools: ['sqlite3'],
    execute: (directory) =>
      run(directory, 'sqlite3', '-batch', ':memory:', '.read main.sql'),
  },
  pascal: {
    filename: 'main.pas',
    tools: ['fpc'],
    execute(directory) {
      run(directory, 'fpc', '-oprogram', 'main.pas');
      return run(directory, './program');
    },
  },
  kotlin: {
    filename: 'Main.kt',
    tools: ['kotlinc', 'java'],
    execute(directory) {
      run(
        directory,
        'kotlinc',
        'Main.kt',
        '-include-runtime',
        '-d',
        'check.jar'
      );
      return run(directory, 'java', '-jar', 'check.jar');
    },
  },
  scala: {
    filename: 'Main.scala',
    tools: ['scalac', 'scala'],
    execute(directory, form) {
      run(directory, 'scalac', 'Main.scala');
      const entryPoint = form === 'collection' ? 'HelloWorld' : 'Main';
      return run(directory, 'scala', '-classpath', '.', entryPoint);
    },
  },
  'objective-c': {
    filename: 'main.m',
    tools: ['gcc', 'gnustep-config'],
    execute(directory) {
      const flags = (option) =>
        run(directory, 'gnustep-config', option).trim().split(/\s+/);
      run(
        directory,
        'gcc',
        '-std=gnu11',
        ...flags('--objc-flags'),
        'main.m',
        '-o',
        'program',
        ...flags('--base-libs')
      );
      return run(directory, './program');
    },
  },
  'nasm-x86-64': {
    filename: 'main.asm',
    tools: ['nasm', 'ld'],
    execute(directory) {
      run(directory, 'nasm', '-felf64', 'main.asm', '-o', 'main.o');
      run(directory, 'ld', 'main.o', '-o', 'program');
      return run(directory, './program');
    },
  },
  'gas-aarch64': {
    filename: 'main.s',
    tools: ['clang', 'ld.lld', 'qemu-aarch64'],
    execute(directory) {
      run(
        directory,
        'clang',
        '--target=aarch64-linux-gnu',
        '-c',
        'main.s',
        '-o',
        'main.o'
      );
      run(directory, 'ld.lld', 'main.o', '-o', 'program');
      return run(directory, 'qemu-aarch64', './program');
    },
  },
  cil: {
    filename: 'main.il',
    tools: ['ilasm', 'mono'],
    execute(directory) {
      run(directory, 'ilasm', '/output:program.exe', 'main.il');
      return run(directory, 'mono', 'program.exe');
    },
  },
  'jvm-jasmin': {
    filename: 'main.j',
    tools: ['jasmin', 'java'],
    execute(directory) {
      run(directory, 'jasmin', 'main.j');
      return run(directory, 'java', '-cp', '.', 'Main');
    },
  },
};

const extendedRunners = {
  octave: interpreted('main.m', 'octave-cli', '--quiet', '--no-init-file'),
  julia: interpreted('main.jl', 'julia', '--startup-file=no'),
  cobol: compiled('main.cob', 'cobc', '-x', '-free'),
  ada: compiled('main.adb', 'gnatmake', '-q'),
  prolog: interpreted('main.pl', 'swipl', '-q', '-s'),
  d: {
    filename: 'main.d',
    tools: ['ldc2'],
    execute(directory) {
      run(directory, 'ldc2', 'main.d', '-of=program');
      return run(directory, './program');
    },
  },
  'common-lisp': interpreted('main.lisp', 'sbcl', '--script'),
  haskell: interpreted('Main.hs', 'runghc'),
  xslt: {
    filename: 'main.xsl',
    tools: ['xsltproc'],
    execute(directory) {
      writeFileSync(join(directory, 'input.xml'), '<input/>\n');
      return run(
        directory,
        'xsltproc',
        '--maxdepth',
        '5000',
        'main.xsl',
        'input.xml'
      );
    },
  },
  clojure: interpreted('main.clj', 'clojure'),
  'standard-ml': interpreted('main.sml', 'poly', '--script'),
  erlang: interpreted('main.erl', 'escript'),
  elixir: interpreted('main.exs', 'elixir'),
  fsharp: interpreted('main.fsx', 'dotnet', 'fsi', '--quiet', '--exec'),
  groovy: interpreted('Main.groovy', 'groovy'),
  raku: interpreted('main.raku', 'raku'),
  scheme: interpreted('main.scm', 'guile', '--no-auto-compile', '-s'),
  nim: interpreted(
    'main.nim',
    'nim',
    'c',
    '--hints:off',
    '--warnings:off',
    '-r'
  ),
  haxe: {
    filename: 'Main.hx',
    tools: ['haxe'],
    execute: (directory) =>
      run(directory, 'haxe', '--interp', '--main', 'Main'),
  },
  crystal: interpreted('main.cr', 'crystal', 'run'),
  racket: interpreted('main.rkt', 'racket'),
  fish: interpreted('main.fish', 'fish', '--no-config'),
};

function check(
  runner,
  source,
  expected,
  description,
  form = 'standard',
  effect
) {
  const directory = mkdtempSync(join(tmpdir(), 'translator-native-'));
  try {
    writeFileSync(join(directory, runner.filename), source);
    writeFileSync(join(directory, 'fixture'), source);
    const library = form === 'common' && commonLibraries[runner.filename];
    if (library) {
      copyFileSync(
        new URL(library, import.meta.url),
        join(directory, library.split('/').at(-1))
      );
    }
    const output = runner.execute(directory, form, nativeArguments(effect));
    if (output !== expected) {
      throw new Error(
        `${description} expected ${expected.length} bytes but received ${output.length} bytes:\n${output}`
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const requireAll = process.argv.includes('--require-all');
const args = process.argv.slice(2);
const group = args
  .find((argument) => argument.startsWith('--group='))
  ?.slice(8);
const requested = args.filter((argument) => !argument.startsWith('--'));
const allRunners = { ...runners, ...extendedRunners };
const groups = { baseline: runners, extended: extendedRunners };
if (group && !Object.hasOwn(groups, group)) {
  throw new Error(`Unknown native test group ${group}`);
}
const selected = group ? groups[group] : allRunners;
for (const id of requested) {
  if (!Object.hasOwn(selected, id)) {
    throw new Error(`Unknown native test profile ${id}`);
  }
}
const missing = [];
let checked = 0;
const sourceForms = {
  hello: 'collection',
  'empty-program': 'rosetta',
  'greatest-common-divisor': 'rosetta',
  'fizz-buzz': 'rosetta',
  'fizz-buzz-lowercase': 'rosetta',
  'fizz-buzz-quoted': 'rosetta',
  'fizz-buzz-lowercase-blank-line': 'rosetta',
};
const profiles = languageProfiles().filter(
  ({ kind }) => kind === 'programming' || kind === 'instruction'
);
for (const id of Object.keys(allRunners)) {
  if (!profiles.some((profile) => profile.id === id)) {
    throw new Error(`Native test runner ${id} has no executable profile`);
  }
}
for (const { id, forms, unicodeGreeting } of profiles) {
  if (!Object.hasOwn(allRunners, id)) {
    throw new Error(`Executable profile ${id} has no native test runner`);
  }
  if (!Object.hasOwn(selected, id)) {
    continue;
  }
  if (requested.length && !requested.includes(id)) {
    continue;
  }
  const runner = selected[id];
  const unavailable = runner.tools.filter((tool) => !tools(tool));
  if (unavailable.length) {
    missing.push(`${id} (${unavailable.join(', ')})`);
    continue;
  }
  for (const effect of [...effects, ...(boundaryEffects[id] ?? [])].filter(
    (effect) => forms.some((form) => form.task === effect.task)
  )) {
    const source = translator.materialize(
      translator.expression('javascript', effect)
    );
    const result = translator.translate(source, 'javascript', id, {
      mode: 'same-effect',
    });
    const observe = (code) => nativeProgram(code, id, effect);
    check(
      runner,
      observe(result),
      expectedOutput(effect),
      `${id} ${effect.task}`,
      'standard',
      effect
    );
    checked += 1;
    if (
      (id === 'javascript' || id === 'rust') &&
      forms.some(({ task, name }) => task === effect.task && name === 'common')
    ) {
      const opposite = id === 'javascript' ? 'rust' : 'javascript';
      const options = { mode: 'same-effect' };
      const native = translator.materialize(
        translator.expression(opposite, effect)
      );
      const meta = translator.translate(native, opposite, 'meta', options);
      const common = translator.translate(meta, 'meta', id, {
        ...options,
        form: 'common',
      });
      check(
        runner,
        observe(common),
        expectedOutput(effect),
        `${id} common ${effect.task}`,
        'common',
        effect
      );
      const reverse = translator.translate(common, id, 'meta', options);
      if (
        reverse !== meta ||
        translator.translate(reverse, 'meta', opposite, options) !== native
      ) {
        throw new Error(
          `Effect or standard form changed through ${id} common ${effect.task}`
        );
      }
      checked += 1;
    }
    const form =
      effect.task === 'hello' && (id === 'javascript' || id === 'rust')
        ? 'rosetta'
        : sourceForms[effect.task];
    if (
      forms.some((entry) => entry.task === effect.task && entry.name === form)
    ) {
      const originalForm = translator.translate(source, 'javascript', id, {
        mode: 'same-effect',
        form,
      });
      check(
        runner,
        originalForm,
        expectedOutput(effect),
        `${id} ${form} ${effect.task}`,
        form,
        effect
      );
      checked += 1;
    }
  }
  if (unicodeGreeting) {
    for (const effect of localized) {
      const source = translator.translate(writeEffect(effect), 'meta', id, {
        mode: 'same-effect',
      });
      check(runner, source, expectedOutput(effect), `${id} localized greeting`);
      checked += 1;
    }
  }
  console.log(`PASS ${id}`);
}
if (group !== 'extended') {
  const source = fixture('hello.c');
  for (const id of ['c', 'csharp'].filter(
    (id) => !requested.length || requested.includes(id)
  )) {
    const runner = runners[id];
    if (runner.tools.every(tools)) {
      const code = translator.translate(source, 'c', id, { form: 'common' });
      check(
        runner,
        code,
        expectedOutput(effects[0]),
        `${id} common print library`
      );
      checked += 1;
    }
  }
}
console.log(
  `${checked} programs checked. Missing tools for ${missing.length} profiles.`
);
if (missing.length) {
  console.log(missing.join('\n'));
}
if ((requireAll && missing.length) || checked === 0) {
  process.exitCode = 1;
}
