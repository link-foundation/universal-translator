#!/usr/bin/env node

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

import { makeConfig } from 'lino-arguments';

import {
  add,
  checkText,
  createProgramTranslator,
  createSourceSyntaxCodec,
  createTranslationServer,
  createTranslator,
  multiply,
  readSourceDocument,
  writeSourceDocument,
} from '../js/src/index.js';

const COMMANDS = {
  add,
  multiply,
};

const GRAMMAR_ENGINE =
  'Set UNIVERSAL_TRANSLATOR_META_LANGUAGE to the Meta Language 1.0 module file';
const GRAMMAR_COMMANDS = ['encode-cst', 'decode-cst', 'translate-program'];
const TRANSLATION_COMMANDS = ['translate', 'meta', 'languages', 'check-words'];
const SOURCE_COMMANDS = [
  'encode-source',
  'decode-source',
  ...GRAMMAR_COMMANDS,
  ...TRANSLATION_COMMANDS,
];

function usage() {
  return [
    'Usage: universal-translator <command> [arguments]',
    '',
    'Commands:',
    '  add       Add two numbers',
    '  multiply  Multiply two numbers',
    '  translate <from> <to> [file|-] [--mode <mode>] [--trace] [--common-library] [--fragment]  Translate through the meta language',
    '            --common-library prints through common-library/ calls',
    '            --fragment translates statements or functions on their own',
    '  translate-program <from|cst> <to> [file|-]  Translate a checked JavaScript or Rust program',
    '  meta <language> [file|-]  Print the typed meta program as JSON',
    '  encode-source <language> [file|-]  Write a Links Notation source document',
    '  decode-source [file|-]  Restore source from a Links Notation document',
    '  encode-cst <language> [file|-]  Parse source into a Meta Language CST',
    '  decode-cst [file|-]  Restore source from a Meta Language CST',
    '  languages  List language identifiers (programming, then controlled natural)',
    '  check-words <natural> [file|-]  Check text against the rules of a controlled language',
    '  serve [--port <port>] [--host <host>]  Serve GET /languages and POST /translate as JSON',
    '            PORT, HOST or a .lenv file set the defaults (8080, 0.0.0.0)',
    '',
    'A language may be a controlled natural language (english, russian,',
    'english-asd-ste100, minimal-english, ...): translate reads and writes',
    'its sentences like any programming language.',
    '',
    'Modes: context-dependent (default), literal, same-effect',
    'Omit the file or pass - to read standard input.',
    `${GRAMMAR_ENGINE} for the grammar commands.`,
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
    if (argument === '--trace') {
      options.trace = true;
    } else if (argument === '--common-library') {
      options.commonLibrary = true;
    } else if (argument === '--fragment') {
      options.fragment = true;
    } else if (argument === '--mode') {
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

function languageList(translator) {
  const lines = [
    ...translator.languages().map(({ id, label }) => `${id}\t${label}`),
    ...translator
      .naturalLanguages()
      .map(({ id, label }) => `${id}\t${label} (natural)`),
  ];
  return lines.map((line) => `${line}\n`).join('');
}

function checkWords(text, language) {
  const problems = checkText(text, language);
  if (problems.length) {
    throw new Error(problems.join('\n'));
  }
  return `The text keeps the rules of ${language}\n`;
}

function runTranslation(command, args, read, write, stderr) {
  const [from, to, ...trailing] = args;
  const { file, options } =
    command === 'translate' ? translationArguments(trailing) : {};
  const translator = createTranslator(
    // --trace reports every pipeline stage as JSON, so a translation can
    // be followed rule layer by rule layer.
    options?.trace
      ? { trace: (stage, tree) => stderr(`[${stage}] ${JSON.stringify(tree)}`) }
      : {}
  );
  if (command === 'languages' && args.length === 0) {
    write(languageList(translator));
  } else if (command === 'check-words' && from && args.length <= 2) {
    write(checkWords(read(to), from));
  } else if (command === 'meta' && from && args.length <= 2) {
    write(`${JSON.stringify(translator.toMeta(read(to), from), null, 2)}\n`);
  } else if (command === 'translate' && from && to) {
    // --fragment translates a single statement, function definitions or a
    // whole program into the same kind of fragment.
    const translation = options.fragment
      ? translator.translateFragment
      : translator.translate;
    write(
      translation(read(file), from, to, {
        mode: options.mode,
        commonLibrary: options.commonLibrary,
      })
    );
  } else {
    throw new Error(usage());
  }
}

// The server is configured like the other link-foundation tools: an
// option wins over the PORT and HOST variables, which win over a .lenv file.
export function serveConfiguration(
  args,
  { env = process.env, cwd = process.cwd() } = {}
) {
  const { port, host } = makeConfig({
    argv: ['node', 'universal-translator', ...args],
    env: { values: { ...env }, autoMap: true },
    cwd,
    yargs: ({ yargs }) =>
      yargs
        .exitProcess(false)
        .help(false)
        .version(false)
        .strict()
        .fail((message, error) => {
          throw error ?? new Error(message);
        })
        .option('port', { type: 'number', default: 8080 })
        .option('host', { type: 'string', default: '0.0.0.0' }),
  });
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('The port must be an integer from 0 to 65535');
  }
  return { port, host };
}

function startServer({ port, host }, stdout) {
  const server = createTranslationServer();
  server.listen(port, host, () => {
    stdout(`Listening on http://${host}:${server.address().port}`);
  });
  return server;
}

function runGrammarCommand(command, args, read, write, grammarEngine) {
  if (!grammarEngine) {
    throw new Error(GRAMMAR_ENGINE);
  }
  const [from, to, file] = args;
  const codec = createSourceSyntaxCodec(grammarEngine.LinkNetwork);
  if (command === 'encode-cst' && from && args.length <= 2) {
    write(codec.write(from, read(to)));
  } else if (command === 'decode-cst' && args.length <= 1) {
    write(codec.read(read(from)).source);
  } else if (
    command === 'translate-program' &&
    from &&
    to &&
    args.length <= 3
  ) {
    const input = read(file);
    const document =
      from === 'cst' ? codec.read(input) : { language: from, source: input };
    write(createProgramTranslator(grammarEngine).translate(document, to));
  } else {
    throw new Error(usage());
  }
}

function runSourceCommand(
  command,
  args,
  { read, write, stderr, grammarEngine }
) {
  const [language, file] = args;
  if (command === 'encode-source' && language && args.length <= 2) {
    write(`${writeSourceDocument(language, read(file))}\n`);
  } else if (command === 'decode-source' && args.length <= 1) {
    write(readSourceDocument(read(language)).source);
  } else if (GRAMMAR_COMMANDS.includes(command)) {
    runGrammarCommand(command, args, read, write, grammarEngine);
  } else if (TRANSLATION_COMMANDS.includes(command)) {
    runTranslation(command, args, read, write, stderr);
  } else {
    throw new Error(usage());
  }
}

function runArithmetic(command, left, right, { stdout, stderr }) {
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
}

export function runCli(
  argv,
  {
    stderr = console.error,
    stdout = console.log,
    read = readSource,
    write = stdout,
    grammarEngine,
    serve = startServer,
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
    if (command === 'serve') {
      serve(serveConfiguration(argv.slice(1)), stdout);
      return 0;
    }
    if (SOURCE_COMMANDS.includes(command)) {
      runSourceCommand(command, argv.slice(1), {
        read,
        write,
        stderr,
        grammarEngine,
      });
      return 0;
    }
    return runArithmetic(command, left, right, { stdout, stderr });
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
  try {
    const moduleFile = process.env.UNIVERSAL_TRANSLATOR_META_LANGUAGE;
    const grammarEngine =
      moduleFile && (await import(pathToFileURL(moduleFile).href));
    process.exitCode = runCli(process.argv.slice(2), {
      grammarEngine,
      write: (output) => process.stdout.write(output),
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
