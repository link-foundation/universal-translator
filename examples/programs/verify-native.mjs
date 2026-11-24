#!/usr/bin/env node
// Translate every program in this folder into every grammar language, run
// the original and each translation with the native toolchain, and compare
// standard output. Languages whose toolchain is missing are reported as
// skipped, never as passed.
//
//   node examples/programs/verify-native.mjs [language ...]

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGrammarTranslator } from '../../js/src/grammar/translator.js';

const folder = dirname(fileURLToPath(import.meta.url));
const translator = createGrammarTranslator();

export const extensions = {
  javascript: '.js', typescript: '.ts', python: '.py', ruby: '.rb', lua: '.lua',
  php: '.php', c: '.c', cpp: '.cpp', csharp: '.cs', java: '.java', go: '.go',
  rust: '.rs', kotlin: '.kt', swift: '.swift',
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 120000, ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout || result.error}`);
  }
  return result.stdout;
};

function available(command) {
  return spawnSync('sh', ['-c', `command -v ${command}`]).status === 0;
}

// How to run a single source file in each language.
const runners = {
  javascript: { tool: 'node', run: (file) => run('node', [file]) },
  typescript: { tool: 'deno', run: (file) => run('deno', ['run', '--quiet', file]) },
  python: { tool: 'python3', run: (file) => run('python3', [file]) },
  ruby: { tool: 'ruby', run: (file) => run('ruby', [file]) },
  lua: { tool: 'lua', run: (file) => run('lua', [file]) },
  php: { tool: 'php', run: (file) => run('php', [file]) },
  c: { tool: 'gcc', run: (file) => (run('gcc', ['-std=c11', '-Wall', '-Werror', '-o', `${file}.out`, file]), run(`${file}.out`, [])) },
  cpp: { tool: 'g++', run: (file) => (run('g++', ['-std=c++17', '-Wall', '-Werror', '-o', `${file}.out`, file]), run(`${file}.out`, [])) },
  go: { tool: 'go', run: (file) => run('go', ['run', file]) },
  rust: { tool: 'rustc', run: (file) => (run('rustc', ['-A', 'non_snake_case', '-o', `${file}.out`, file]), run(`${file}.out`, [])) },
  java: { tool: 'java', run: (file) => run('java', [file]) },
  kotlin: { tool: 'kotlinc', run: (file) => (run('kotlinc', [file, '-include-runtime', '-d', `${file}.jar`], { stdio: 'pipe' }), run('java', ['-jar', `${file}.jar`])) },
  swift: { tool: 'swiftc', run: (file) => (run('swiftc', ['-o', `${file}.out`, file]), run(`${file}.out`, [])) },
  csharp: {
    tool: 'dotnet',
    run: (file) => {
      const project = join(dirname(file), 'project');
      mkdirSync(project, { recursive: true });
      writeFileSync(join(project, 'Program.csproj'), '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><ImplicitUsings>disable</ImplicitUsings></PropertyGroup></Project>');
      writeFileSync(join(project, 'Program.cs'), readFileSync(file, 'utf8'));
      return run('dotnet', ['run', '--project', project]);
    },
  },
};

export function programFiles() {
  return readdirSync(folder)
    .filter((file) => Object.values(extensions).includes(extname(file)) && file !== 'verify-native.mjs')
    .map((file) => ({ file, task: basename(file, extname(file)), language: Object.keys(extensions).find((id) => extensions[id] === extname(file)) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(extensions);
  const sources = programFiles().filter(({ language }) => language === 'javascript');
  const work = mkdtempSync(join(tmpdir(), 'grammar-native-'));
  let failures = 0;
  for (const { file, task } of sources) {
    const expected = runners.javascript.run(join(folder, file));
    for (const target of targets) {
      const runner = runners[target];
      if (!available(runner.tool)) {
        console.log(`SKIP ${task} -> ${target}: ${runner.tool} is not installed`);
        continue;
      }
      const directory = join(work, `${task}-${target}`);
      mkdirSync(directory, { recursive: true });
      const output = join(directory, target === 'java' ? 'Main.java' : `program${extensions[target]}`);
      try {
        writeFileSync(output, translator.translate(readFileSync(join(folder, file), 'utf8'), 'javascript', target));
        const actual = runner.run(output);
        if (actual !== expected) throw new Error(`output differs:\n${actual}`);
        console.log(`PASS ${task} -> ${target}`);
      } catch (error) {
        failures += 1;
        console.log(`FAIL ${task} -> ${target}: ${error.message}`);
      }
    }
  }
  void execFileSync;
  process.exitCode = failures ? 1 : 0;
}
