#!/usr/bin/env node

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { add, createTranslator, multiply } from '../js/src/index.js';

const COMMANDS = {
  add,
  multiply,
};

function usage() {
  return [
    'Usage: universal-translator <command> [arguments]',
    '',
    'Commands:',
    '  add       Add two numbers',
    '  multiply  Multiply two numbers',
    '  translate <from> <to> [file|-] [--mode <mode>] [--form <form>]',
    '  roundtrip <language> [file|-]  Reconstruct the original source',
    '  languages  List language identifiers',
    '',
    'Modes: context-dependent (default), literal, same-effect',
    'Omit the file or pass - to read standard input.',
    '',
    'Options:',
    '  --help     Show this help',
    '  --version  Show package version',
  ].join('\n');
}

function readVersion() {
  const packageUrl = new URL('../package.json', import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageUrl, 'utf8'));
  return packageJson.version;
}

function parseNumber(value, label) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a finite number`);
  }

  return parsed;
}

function readSource(file) {
  const input = readFileSync(file === '-' || file === undefined ? 0 : file);
  return new globalThis.TextDecoder('utf-8', {
    fatal: true,
    ignoreBOM: true,
  }).decode(input);
}

function translationArguments(args) {
  const options = {};
  let file;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--mode' || argument === '--form') {
      const key = argument.slice(2);
      const value = args[++index];
      if (!value || value.startsWith('-') || options[key] !== undefined) {
        throw new Error(`Expected a single value for ${argument}`);
      }
      options[key] = value;
    } else if (
      file === undefined &&
      (argument === '-' || !argument.startsWith('-'))
    ) {
      file = argument;
    } else {
      throw new Error(`Unexpected argument ${argument}`);
    }
  }
  return { file, options };
}

function runTranslation(command, args, read, write) {
  const translator = createTranslator();
  const [from, to, ...trailing] = args;
  if (command === 'languages' && args.length === 0) {
    write(
      translator
        .listLanguages()
        .map(({ id, label }) => `${id}\t${label}\n`)
        .join('')
    );
  } else if (command === 'roundtrip' && from && args.length <= 2) {
    write(translator.restore(translator.parse(read(to), from)));
  } else if (command === 'translate' && from && to) {
    const { file, options } = translationArguments(trailing);
    write(translator.translate(read(file), from, to, options));
  } else {
    throw new Error(usage());
  }
}

export function runCli(
  argv,
  {
    stderr = console.error,
    stdout = console.log,
    read = readSource,
    write = stdout,
  } = {}
) {
  const [command, left, right] = argv;

  if (!command || command === '--help' || command === '-h') {
    stdout(usage());
    return 0;
  }

  if (command === '--version' || command === '-v') {
    stdout(readVersion());
    return 0;
  }

  try {
    if (['translate', 'roundtrip', 'languages'].includes(command)) {
      runTranslation(command, argv.slice(1), read, write);
      return 0;
    }
    if (!Object.hasOwn(COMMANDS, command)) {
      stderr(`Unknown command: ${command}`);
      stderr(usage());
      return 1;
    }
    const operation = COMMANDS[command];
    const leftNumber = parseNumber(left, 'left');
    const rightNumber = parseNumber(right, 'right');
    stdout(String(operation(leftNumber, rightNumber)));
    return 0;
  } catch (error) {
    stderr(error.message);
    return 1;
  }
}

function isCliEntryPoint() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return (
      realpathSync(process.argv[1]) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isCliEntryPoint()) {
  process.exitCode = runCli(process.argv.slice(2), {
    write: (output) => process.stdout.write(output),
  });
}
