import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';

import { createTranslator } from '../../src/index.js';

const translator = createTranslator();
const effects = JSON.parse(
  readFileSync(new URL('effects.json', import.meta.url), 'utf8')
);
const environment = {
  ...process.env,
  DOTNET_CLI_TELEMETRY_OPTOUT: '1',
  DOTNET_NOLOGO: '1',
  GOTOOLCHAIN: 'local',
  LC_ALL: 'C',
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
    execute: (directory) =>
      run(directory, command, ...argumentsBeforeFilename, filename),
  };
}

function compiled(filename, compiler, ...flags) {
  return {
    filename,
    tools: [compiler],
    execute(directory) {
      run(directory, compiler, ...flags, filename, '-o', 'program');
      return run(directory, './program');
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
    execute(directory) {
      run(directory, 'scalac', 'Main.scala');
      return run(directory, 'scala', '-classpath', '.', 'Main');
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

function expectedOutput(effect) {
  if (effect.task === 'hello') {
    return `${effect.message}\n`;
  }
  if (effect.task === 'greatest-common-divisor') {
    let { left, right } = effect;
    while (right !== 0) {
      [left, right] = [right, left % right];
    }
    return `${left}\n`;
  }
  return Array.from({ length: effect.limit }, (_, index) => {
    const number = index + 1;
    const fizz = number % 3 === 0 ? 'Fizz' : '';
    const buzz = number % 5 === 0 ? 'Buzz' : '';
    return `${fizz + buzz || number}\n`;
  }).join('');
}

function check(runner, source, expected, description) {
  const directory = mkdtempSync(join(tmpdir(), 'translator-native-'));
  try {
    writeFileSync(join(directory, runner.filename), source);
    writeFileSync(join(directory, 'fixture'), source);
    const output = runner.execute(directory);
    if (output !== expected) {
      throw new Error(
        `${description} expected ${JSON.stringify(expected)}, received ${JSON.stringify(output)}`
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const requireAll = process.argv.includes('--require-all');
const requested = process.argv
  .slice(2)
  .filter((argument) => argument !== '--require-all');
const missing = [];
let checked = 0;
for (const { id, forms } of translator.listLanguages()) {
  if (requested.length && !requested.includes(id)) {
    continue;
  }
  const runner = runners[id];
  const unavailable = runner
    ? runner.tools.filter((tool) => !tools(tool))
    : ['unregistered test runner'];
  if (unavailable.length) {
    missing.push(`${id} (${unavailable.join(', ')})`);
    continue;
  }
  for (const effect of effects.filter((effect) =>
    forms.some((form) => form.task === effect.task)
  )) {
    const source = translator.materialize(
      translator.expression('javascript', effect)
    );
    const result = translator.translate(source, 'javascript', id, {
      mode: 'same-effect',
    });
    check(runner, result, expectedOutput(effect), `${id} ${effect.task}`);
    checked += 1;
  }
  console.log(`PASS ${id}`);
}
if (
  !requested.length ||
  requested.includes('c') ||
  requested.includes('csharp')
) {
  const source = readFileSync(new URL('hello.c', import.meta.url), 'utf8');
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
