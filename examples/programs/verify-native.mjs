#!/usr/bin/env node
// Translate every program in this folder into every grammar language, run
// the original and each translation with the native toolchain, and compare
// standard output. Languages whose toolchain is missing are reported as
// skipped, never as passed.
//
//   node examples/programs/verify-native.mjs [--require-all]
//     [--common-library] [language ...]
//
// --require-all turns a missing toolchain into a failure. --common-library
// translates with the common library route and copies the library file from
// common-library/ next to each program. LUA names the Lua
// interpreter when it is not called lua, OBJC_CC and OBJC_FLAGS the
// Objective-C compiler when it is not gcc, DC the D compiler when it is not
// gdc. The checks run in parallel worker
// processes, one per CPU unless --jobs=N says otherwise; each worker takes
// every Nth check (--shard=K/N).

import { spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGrammarTranslator } from '../../js/src/grammar/translator.js';

const folder = dirname(fileURLToPath(import.meta.url));
const translator = createGrammarTranslator();

// The common library implementation of each language.
export const libraryFiles = {
  javascript: 'common-library.mjs',
  typescript: 'common-library.ts',
  python: 'common_library.py',
  ruby: 'common_library.rb',
  lua: 'common_library.lua',
  php: 'common_library.php',
  c: 'common_library.h',
  cpp: 'common_library.hpp',
  csharp: 'CommonLibrary.cs',
  java: 'CommonLibrary.java',
  go: 'common_library.go',
  rust: 'common_library.rs',
  kotlin: 'CommonLibrary.kt',
  swift: 'CommonLibrary.swift',
  perl: 'common_library.pl',
  dart: 'common_library.dart',
  scala: 'CommonLibrary.scala',
  julia: 'common_library.jl',
  r: 'common_library.R',
  groovy: 'CommonLibrary.groovy',
  objc: 'CommonLibrary.h',
  nim: 'common_library.nim',
  d: 'common_library.d',
  pascal: 'CommonLibrary.pas',
  fortran: 'common_library.f90',
  // A package specification and its body.
  ada: ['common_library.ads', 'common_library.adb'],
  vb: 'CommonLibrary.vb',
  bash: 'common_library.sh',
  matlab: 'common_library.m',
  zig: 'common_library.zig',
};
const libraryFolder = join(folder, '..', '..', 'common-library');

export const extensions = {
  javascript: '.js',
  typescript: '.ts',
  python: '.py',
  ruby: '.rb',
  lua: '.lua',
  php: '.php',
  c: '.c',
  cpp: '.cpp',
  csharp: '.cs',
  java: '.java',
  go: '.go',
  rust: '.rs',
  kotlin: '.kt',
  swift: '.swift',
  perl: '.pl',
  dart: '.dart',
  scala: '.scala',
  julia: '.jl',
  r: '.R',
  groovy: '.groovy',
  objc: '.m',
  nim: '.nim',
  d: '.d',
  pascal: '.pas',
  fortran: '.f90',
  ada: '.adb',
  vb: '.vb',
  bash: '.sh',
  // .m is Objective-C's; Octave runs a script with any extension.
  matlab: '.matlab',
  zig: '.zig',
  nasm: '.asm',
  cil: '.il',
  jvm: '.j',
};

// Machine targets need an assembler. ILASM names the ilasm executable and
// JASMIN_CLASSPATH the Jasmin jar (with java_cup) when they are not on PATH.
const ilasm = process.env.ILASM || 'ilasm';
// Without JASMIN_CLASSPATH the jasmin command (Debian jasmin-sable) is used.
const jasmin = process.env.JASMIN_CLASSPATH;
const lua = process.env.LUA || 'lua';
const d = process.env.DC || 'gdc';
const nim = process.env.NIM || 'nim';
const objc = process.env.OBJC_CC || 'gcc';
const octave = process.env.OCTAVE || 'octave';
const zig = process.env.ZIG || 'zig';
const objcFlags = (process.env.OBJC_FLAGS ?? '').split(' ').filter(Boolean);

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 120000,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout || result.error}`
    );
  }
  return result.stdout;
};

function available(command) {
  if (command === 'jasmin' && jasmin) {
    return available('java');
  }
  return spawnSync('sh', ['-c', `command -v "${command}"`]).status === 0;
}

const dotnetFramework = () =>
  `net${run('dotnet', ['--version']).split('.')[0]}.0`;

// A .NET project around one C# or Visual Basic file and the library.
function dotnet(file, library) {
  const project = join(dirname(file), 'project');
  const extension = extname(file);
  mkdirSync(project, { recursive: true });
  const framework = dotnetFramework();
  writeFileSync(
    join(project, `Program${extension}proj`),
    `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>${framework}</TargetFramework><ImplicitUsings>disable</ImplicitUsings></PropertyGroup></Project>`
  );
  writeFileSync(
    join(project, `Program${extension}`),
    readFileSync(file, 'utf8')
  );
  for (const path of library) {
    copyFileSync(path, join(project, basename(path)));
  }
  return run('dotnet', ['run', '--project', project]);
}

// How to run a single source file in each language.
const runners = {
  javascript: { tool: 'node', run: (file) => run('node', [file]) },
  typescript: {
    tool: 'deno',
    run: (file) => run('deno', ['run', '--quiet', file]),
  },
  python: { tool: 'python3', run: (file) => run('python3', [file]) },
  ruby: { tool: 'ruby', run: (file) => run('ruby', [file]) },
  // Lua's require searches LUA_PATH, so the program's folder is added.
  lua: {
    tool: lua,
    run: (file) =>
      run(lua, [file], {
        env: { ...process.env, LUA_PATH: `${dirname(file)}/?.lua;;` },
      }),
  },
  php: { tool: 'php', run: (file) => run('php', [file]) },
  c: {
    tool: 'gcc',
    run: (file) => (
      run('gcc', ['-std=c11', '-Wall', '-Werror', '-o', `${file}.out`, file]),
      run(`${file}.out`, [])
    ),
  },
  cpp: {
    tool: 'g++',
    run: (file) => (
      run('g++', ['-std=c++17', '-Wall', '-Werror', '-o', `${file}.out`, file]),
      run(`${file}.out`, [])
    ),
  },
  go: {
    tool: 'go',
    run: (file, library) => run('go', ['run', file, ...library]),
  },
  rust: {
    tool: 'rustc',
    run: (file) => (
      run('rustc', ['-o', `${file}.out`, file]),
      run(`${file}.out`, [])
    ),
  },
  java: {
    tool: 'java',
    run: (file, library) =>
      library.length === 0
        ? run('java', [file])
        : (run('javac', ['-d', dirname(file), file, ...library]),
          run('java', ['-cp', dirname(file), 'Main'])),
  },
  kotlin: {
    tool: 'kotlinc',
    run: (file, library) => (
      run(
        'kotlinc',
        [file, ...library, '-include-runtime', '-d', `${file}.jar`],
        {
          stdio: 'pipe',
        }
      ),
      run('java', ['-jar', `${file}.jar`])
    ),
  },
  swift: {
    tool: 'swiftc',
    run: (file, library) => (
      run('swiftc', ['-o', `${file}.out`, file, ...library]),
      run(`${file}.out`, [])
    ),
  },
  // Perl and R find the library relative to the working folder.
  perl: {
    tool: 'perl',
    run: (file) => run('perl', [file], { cwd: dirname(file) }),
  },
  dart: { tool: 'dart', run: (file) => run('dart', ['run', file]) },
  // Both the Scala 2 runner and Scala 3's command line run a single file.
  scala: {
    tool: 'scala',
    run: (file, library) =>
      library.length === 0
        ? run('scala', [file])
        : (run('scalac', ['-d', dirname(file), file, ...library]),
          run('scala', ['-classpath', dirname(file), 'Main'])),
  },
  julia: {
    tool: 'julia',
    run: (file) => run('julia', ['--startup-file=no', file]),
  },
  r: {
    tool: 'Rscript',
    run: (file) => run('Rscript', [file], { cwd: dirname(file) }),
  },
  groovy: {
    tool: 'groovy',
    run: (file) => run('groovy', ['-cp', dirname(file), file]),
  },
  // GCC's Objective-C front end (gobjc) brings the GNU runtime headers.
  // OBJC_CC and OBJC_FLAGS choose another compiler, such as clang with
  // -fobjc-runtime=gcc and the runtime headers on its include path.
  objc: {
    tool: objc,
    run: (file) => (
      run(objc, [
        ...objcFlags,
        '-x',
        'objective-c',
        // GCC compiles Objective-C as C89 unless told otherwise, which
        // rejects declarations in for-loop headers.
        '-std=gnu11',
        '-Wall',
        '-Werror',
        '-o',
        `${file}.out`,
        file,
      ]),
      run(`${file}.out`, [])
    ),
  },
  // DC names another D compiler with GDC's options, such as LDC's ldc2
  // (which takes -w and -of= instead).
  // Nim finds the copied common library beside the program.
  nim: {
    tool: nim,
    run: (file) =>
      run(
        nim,
        [
          'c',
          '-r',
          '--hints:off',
          '--warningAsError:User:on',
          `--nimcache:${dirname(file)}/nimcache`,
          file,
        ],
        {
          cwd: dirname(file),
        }
      ),
  },
  d: {
    tool: d,
    run: (file, library) => (
      run(d, [
        ...(d.endsWith('ldc2')
          ? ['-w', `-of=${file}.out`]
          : ['-Wall', '-Werror', '-o', `${file}.out`]),
        file,
        ...library,
      ]),
      run(`${file}.out`, [])
    ),
  },
  // Free Pascal finds the CommonLibrary unit beside the program.
  pascal: {
    tool: 'fpc',
    run: (file) => (
      run('fpc', ['-v0', '-Sew', `-o${file}.out`, file], {
        cwd: dirname(file),
      }),
      run(`${file}.out`, [])
    ),
  },
  // The common library module is compiled before the program that uses it.
  fortran: {
    tool: 'gfortran',
    run: (file, library) => (
      run(
        'gfortran',
        [
          '-std=f2018',
          '-Wall',
          '-Werror',
          '-o',
          `${file}.out`,
          ...library,
          file,
        ],
        { cwd: dirname(file) }
      ),
      run(`${file}.out`, [])
    ),
  },
  // GNAT finds the Common_Library package beside the main procedure, which
  // must be in main.adb.
  ada: {
    tool: 'gnatmake',
    run: (file) => (
      run(
        'gnatmake',
        ['-q', '-gnat2022', '-gnatwa', '-gnatwe', '-o', `${file}.out`, file],
        { cwd: dirname(file) }
      ),
      run(`${file}.out`, [])
    ),
  },
  csharp: { tool: 'dotnet', run: (file, library) => dotnet(file, library) },
  vb: { tool: 'dotnet', run: (file, library) => dotnet(file, library) },
  bash: { tool: 'bash', run: (file) => run('bash', [file]) },
  // OCTAVE names the Octave interpreter when it is not on PATH; the common
  // library is sourced from the working folder.
  matlab: {
    tool: octave,
    run: (file) =>
      run(octave, ['--no-gui', '--quiet', '--norc', file], {
        cwd: dirname(file),
      }),
  },
  // ZIG names the Zig compiler when it is not on PATH. Each run keeps its
  // compiler cache in its own folder; @import finds the common library
  // beside the program.
  zig: {
    tool: zig,
    run: (file) => {
      const cache = join(dirname(file), 'zig-cache');
      return run(zig, [
        'run',
        file,
        '--cache-dir',
        cache,
        '--global-cache-dir',
        cache,
      ]);
    },
  },
  nasm: {
    tool: 'nasm',
    run: (file) => (
      run('nasm', ['-f', 'elf64', '-o', `${file}.o`, file]),
      run('gcc', ['-o', `${file}.out`, `${file}.o`]),
      run(`${file}.out`, [])
    ),
  },
  cil: {
    tool: ilasm,
    run: (file) => {
      const assembly = join(dirname(file), 'Program.dll');
      run(ilasm, ['-dll', '-quiet', `-output=${assembly}`, file]);
      const version = run('dotnet', ['--list-runtimes'])
        .split('\n')
        .filter((line) => line.startsWith('Microsoft.NETCore.App '))
        .at(-1)
        .split(' ')[1];
      writeFileSync(
        join(dirname(file), 'Program.runtimeconfig.json'),
        JSON.stringify({
          runtimeOptions: {
            tfm: dotnetFramework(),
            framework: { name: 'Microsoft.NETCore.App', version },
          },
        })
      );
      return run('dotnet', [assembly]);
    },
  },
  jvm: {
    tool: 'jasmin',
    run: (file) => (
      jasmin
        ? run('java', ['-cp', jasmin, 'jasmin.Main', '-d', dirname(file), file])
        : run('jasmin', ['-d', dirname(file), file]),
      run('java', ['-cp', dirname(file), 'Program'])
    ),
  },
};

const languageOf = (file) =>
  Object.keys(extensions).find((id) => extensions[id] === extname(file));

// The JavaScript programs plus idiomatic versions hand-written in other
// languages (hand-written/). Each one is a translation source.
export function programFiles() {
  const listed = (directory) =>
    readdirSync(join(folder, directory))
      .filter((file) => languageOf(file) && !file.endsWith('.mjs'))
      .map((file) => ({
        path: join(folder, directory, file),
        file: join(directory, file),
        task: basename(file, extname(file)),
        language: languageOf(file),
      }));
  return [...listed('.'), ...listed('hand-written')];
}

// Run the checks in `jobs` worker processes and stream their output.
function runShards(jobs) {
  const script = fileURLToPath(import.meta.url);
  const options = process.argv.slice(2);
  let failed = false;
  let pending = jobs;
  for (let shard = 0; shard < jobs; shard += 1) {
    const child = spawn(
      process.execPath,
      [script, ...options, `--shard=${shard}/${jobs}`],
      { stdio: ['ignore', 'inherit', 'inherit'] }
    );
    child.on('exit', (code) => {
      failed ||= code !== 0;
      pending -= 1;
      if (pending === 0) {
        process.exitCode = failed ? 1 : 0;
      }
    });
  }
}

const optionValue = (options, name) =>
  options.find((option) => option.startsWith(`--${name}=`))?.split('=')[1];

if (
  process.argv[1] === fileURLToPath(import.meta.url) &&
  !optionValue(process.argv.slice(2), 'shard')
) {
  const jobs =
    Number(optionValue(process.argv.slice(2), 'jobs')) ||
    availableParallelism();
  runShards(jobs);
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = process.argv.slice(2);
  const [shard, shards] = optionValue(options, 'shard').split('/').map(Number);
  let index = -1;
  const requireAll = options.includes('--require-all');
  const commonLibrary = options.includes('--common-library');
  const chosen = options.filter((option) => !option.startsWith('--'));
  const targets = (chosen.length ? chosen : Object.keys(extensions)).filter(
    (target) => !commonLibrary || libraryFiles[target]
  );
  const work = mkdtempSync(join(tmpdir(), 'grammar-native-'));
  let failures = 0;
  for (const { path, file, task, language } of programFiles()) {
    // The expected output is the output of the JavaScript program for the task.
    const expected = runners.javascript.run(join(folder, `${task}.js`));
    for (const target of targets) {
      index += 1;
      if (index % shards !== shard) {
        continue;
      }
      const runner = runners[target];
      const label = `${file} -> ${target}`;
      if (!available(runner.tool)) {
        console.log(`SKIP ${label}: ${runner.tool} is not installed`);
        failures += requireAll ? 1 : 0;
        continue;
      }
      const directory = join(work, `${task}-${language}-${target}`);
      mkdirSync(directory, { recursive: true });
      // Swift allows top-level code only in main.swift when several
      // files are compiled together.
      const output = join(
        directory,
        { java: 'Main.java', swift: 'main.swift', ada: 'main.adb' }[target] ??
          `program${extensions[target]}`
      );
      const library = [];
      if (commonLibrary) {
        for (const name of [libraryFiles[target]].flat()) {
          const copy = join(directory, name);
          copyFileSync(join(libraryFolder, name), copy);
          library.push(copy);
        }
      }
      try {
        writeFileSync(
          output,
          translator.translate(readFileSync(path, 'utf8'), language, target, {
            commonLibrary,
          })
        );
        // Header and module libraries are found by the compiler itself.
        const sources = ['c', 'cpp', 'objc', 'rust', 'pascal', 'ada'].includes(
          target
        )
          ? []
          : library;
        const actual = runner.run(output, sources);
        if (actual !== expected) {
          throw new Error(`output differs:\n${actual}`);
        }
        console.log(`PASS ${label}`);
      } catch (error) {
        failures += 1;
        console.log(`FAIL ${label}: ${error.message}`);
      }
    }
  }
  process.exitCode = failures ? 1 : 0;
}
