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
// interpreter when it is not called lua.

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
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
  csharp: {
    tool: 'dotnet',
    run: (file, library) => {
      const project = join(dirname(file), 'project');
      mkdirSync(project, { recursive: true });
      const framework = dotnetFramework();
      writeFileSync(
        join(project, 'Program.csproj'),
        `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>${framework}</TargetFramework><ImplicitUsings>disable</ImplicitUsings></PropertyGroup></Project>`
      );
      writeFileSync(join(project, 'Program.cs'), readFileSync(file, 'utf8'));
      for (const path of library) {
        copyFileSync(path, join(project, basename(path)));
      }
      return run('dotnet', ['run', '--project', project]);
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = process.argv.slice(2);
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
        { java: 'Main.java', swift: 'main.swift' }[target] ??
          `program${extensions[target]}`
      );
      const library = [];
      if (commonLibrary) {
        const copy = join(directory, libraryFiles[target]);
        copyFileSync(join(libraryFolder, libraryFiles[target]), copy);
        library.push(copy);
      }
      try {
        writeFileSync(
          output,
          translator.translate(readFileSync(path, 'utf8'), language, target, {
            commonLibrary,
          })
        );
        // Header and module libraries are found by the compiler itself.
        const sources = ['c', 'cpp', 'rust'].includes(target) ? [] : library;
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
