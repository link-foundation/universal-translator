#!/usr/bin/env node
// Translate every program in this folder into every grammar language, run
// the original and each translation with the native toolchain, and compare
// standard output. Languages whose toolchain is missing are reported as
// skipped, never as passed.
//
//   node examples/programs/verify-native.mjs [language ...]

import { spawnSync } from 'node:child_process';
import {
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
};

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
  return spawnSync('sh', ['-c', `command -v ${command}`]).status === 0;
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
  lua: { tool: 'lua', run: (file) => run('lua', [file]) },
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
  go: { tool: 'go', run: (file) => run('go', ['run', file]) },
  rust: {
    tool: 'rustc',
    run: (file) => (
      run('rustc', ['-o', `${file}.out`, file]),
      run(`${file}.out`, [])
    ),
  },
  java: { tool: 'java', run: (file) => run('java', [file]) },
  kotlin: {
    tool: 'kotlinc',
    run: (file) => (
      run('kotlinc', [file, '-include-runtime', '-d', `${file}.jar`], {
        stdio: 'pipe',
      }),
      run('java', ['-jar', `${file}.jar`])
    ),
  },
  swift: {
    tool: 'swiftc',
    run: (file) => (
      run('swiftc', ['-o', `${file}.out`, file]),
      run(`${file}.out`, [])
    ),
  },
  csharp: {
    tool: 'dotnet',
    run: (file) => {
      const project = join(dirname(file), 'project');
      mkdirSync(project, { recursive: true });
      const framework = `net${run('dotnet', ['--version']).split('.')[0]}.0`;
      writeFileSync(
        join(project, 'Program.csproj'),
        `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>${framework}</TargetFramework><ImplicitUsings>disable</ImplicitUsings></PropertyGroup></Project>`
      );
      writeFileSync(join(project, 'Program.cs'), readFileSync(file, 'utf8'));
      return run('dotnet', ['run', '--project', project]);
    },
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
  const targets = process.argv.slice(2).length
    ? process.argv.slice(2)
    : Object.keys(extensions);
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
        continue;
      }
      const directory = join(work, `${task}-${language}-${target}`);
      mkdirSync(directory, { recursive: true });
      const output = join(
        directory,
        target === 'java' ? 'Main.java' : `program${extensions[target]}`
      );
      try {
        writeFileSync(
          output,
          translator.translate(readFileSync(path, 'utf8'), language, target)
        );
        const actual = runner.run(output);
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
