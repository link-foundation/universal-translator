#!/usr/bin/env node

import { readFileSync, readSync, realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

import { makeConfig } from 'lino-arguments';

import {
  add,
  checkEquivalence,
  checkText,
  createProgramTranslator,
  createSourceSyntaxCodec,
  createTranslationServer,
  createTranslator,
  formatMeta,
  multiply,
  nestGrammars,
  readRules,
  readSourceDocument,
  writeSourceDocument,
} from '../js/src/index.js';
import { linoValue } from '../js/src/translation/rules-notation.js';

const COMMANDS = {
  add,
  multiply,
};

const GRAMMAR_ENGINE =
  'Set UNIVERSAL_TRANSLATOR_META_LANGUAGE to the Meta Language 1.0 module file';
const GRAMMAR_COMMANDS = ['encode-cst', 'decode-cst', 'translate-program'];
const TRANSLATION_COMMANDS = [
  'translate',
  'meta',
  'languages',
  'check-words',
  'coverage',
  'detect',
];
const SOURCE_COMMANDS = [
  'encode-source',
  'decode-source',
  'check-equivalence',
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
    '  translate <from> <to> [file|-] [--mode <mode>] [--trace] [--common-library] [--fragment] [--layout source|target] [--braces same-line|next-line] [--indent <n|tab>]  Translate through the meta language',
    '            --common-library prints through common-library/ calls',
    '            --fragment translates statements or functions on their own',
    '            --comment-language <natural> translates the comments too (only them when <from> is <to>)',
    '            --comment-from <natural> names the language of the comments (detected otherwise)',
    '            --identifier-language <natural> translates the declared names too (only them, in place, when <from> is <to>)',
    '            --identifier-from <natural> names the language of the declared names (detected otherwise)',
    '            --layout source|target keeps the spaces and blank lines of the source',
    '            (source, the default) or writes the layout of the target',
    '            --braces same-line|next-line puts the brace that opens a block on',
    '            the line of its statement or on a line of its own',
    '            --indent <n|tab> indents each block by n spaces or by a tab',
    '            <to> may name a version: python@2',
    '            Parts that cannot be translated become comments and are listed',
    '            on standard error; --all-or-nothing fails instead',
    '            The source language may be "auto" to detect it',
    '            --rules <file.lino> adds source, templates, names and output rules',
    '            (indented Links Notation; JSON files are read too)',
    '  translate-program <from|cst> <to> [file|-]  Translate a checked JavaScript or Rust program',
    '  meta <language> [file|-] [--json] [--shallow]  Print the typed meta program as indented Links Notation',
    '            --json prints it as JSON instead',
    '            comments and strings are read with the grammars they are written in',
    '            (prose, quoted code); --shallow leaves them as plain text',
    '  coverage <language> [file|-] [--json]  Print which parts of a text can be read',
    '            as indented Links Notation; --json prints JSON',
    '  detect [file|-] [--json]  Print the most likely languages of a text, one per line',
    '            as Links Notation; --json prints JSON',
    '  check-equivalence <from> <to> <source|-> [target]  Check that two programs mean the same',
    '            both are read into the meta language and compared by meaning (comments,',
    '            layout, imports and types an untyped language cannot spell are left out);',
    '            without a target the translation of the source is checked. It fails with',
    '            the first difference when they differ',
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

// Standard input read to its end. A pipe may be non-blocking, so a read
// can fail with EAGAIN before the writer has written: wait a little and
// read again (readFileSync(0) gives up there).
export function readStandardInput(read = readSync) {
  const chunks = [];
  const buffer = Buffer.alloc(1 << 16);
  const pause = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    let count;
    try {
      count = read(0, buffer, 0, buffer.length, null);
    } catch (error) {
      if (error.code === 'EAGAIN') {
        Atomics.wait(pause, 0, 0, 10);
        continue;
      }
      if (error.code === 'EOF') {
        break;
      }
      throw error;
    }
    if (count === 0) {
      break;
    }
    chunks.push(Buffer.from(buffer.subarray(0, count)));
  }
  return Buffer.concat(chunks);
}

function readSource(file) {
  const input =
    file === '-' || file === undefined
      ? readStandardInput()
      : readFileSync(file);
  return new globalThis.TextDecoder('utf-8', {
    fatal: true,
    ignoreBOM: true,
  }).decode(input);
}

// Options with a value, and the translation option each one sets.
const valueOptions = {
  '--mode': 'mode',
  '--comment-language': 'commentLanguage',
  '--comment-from': 'commentFrom',
  '--identifier-language': 'identifierLanguage',
  '--identifier-from': 'identifierFrom',
  '--layout': 'layout',
  '--braces': 'braces',
  '--indent': 'indent',
};

// Options without a value, and the translation option each one turns on.
const flagOptions = {
  '--trace': 'trace',
  '--common-library': 'commonLibrary',
  '--fragment': 'fragment',
  '--all-or-nothing': 'allOrNothing',
};

function translationArguments(args) {
  const options = {};
  let file;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (flagOptions[argument]) {
      options[flagOptions[argument]] = true;
    } else if (argument === '--rules') {
      const value = args[++index];
      if (!value || options.rules !== undefined) {
        throw new Error('Expected a single rules file for --rules');
      }
      options.rules = readRules(readFileSync(value, 'utf8'));
    } else if (valueOptions[argument]) {
      const key = valueOptions[argument];
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

// --fragment translates a single statement, function definitions or a
// whole program into the same kind of fragment. By default every part that
// can be translated is, and the others are marked and listed on standard
// error; --all-or-nothing throws at the first part it cannot read.
function translateCommand(
  translator,
  { from, to, file, options },
  read,
  write,
  stderr
) {
  const source = read(file);
  const language =
    from === 'auto' ? translator.detectLanguage(source)[0]?.id : from;
  if (!language) {
    throw new Error('The language of the text could not be detected');
  }
  if (from === 'auto') {
    stderr(`Detected language: ${language}`);
  }
  const settings = {
    mode: options.mode,
    commonLibrary: options.commonLibrary,
    fragment: options.fragment,
    commentLanguage: options.commentLanguage,
    commentFrom: options.commentFrom,
    identifierLanguage: options.identifierLanguage,
    identifierFrom: options.identifierFrom,
    layout: options.layout,
    braces: options.braces,
    indent: options.indent,
  };
  if (options.allOrNothing) {
    const translation = options.fragment
      ? translator.translateFragment
      : translator.translate;
    write(translation(source, language, to, settings));
    return;
  }
  const result = translator.translatePartial(source, language, to, settings);
  write(result.text);
  if (!result.complete) {
    stderr(
      `Translated ${result.readLines} of ${result.lines} lines; ${result.errors.length} part(s) could not be translated:`
    );
    for (const { line, endLine, message } of result.errors) {
      stderr(
        `  ${endLine > line ? `lines ${line}-${endLine}` : `line ${line}`}: ${message}`
      );
    }
  }
}

// A record as one line of links: (field value) (field value) ...
const linoLinks = (record) =>
  Object.entries(record)
    .map(([field, value]) => `(${field} ${linoValue(value)})`)
    .join(' ');

// A report as indented Links Notation: every field is unique, so it is
// "name: value"; a list gets one record per line under its name, and an
// empty list writes nothing.
function linoReport(report) {
  const lines = [];
  for (const [field, value] of Object.entries(report)) {
    if (!Array.isArray(value)) {
      lines.push(`${field}: ${linoValue(value)}`);
    } else if (value.length) {
      lines.push(`${field}:`, ...value.map((item) => `  ${linoLinks(item)}`));
    }
  }
  return lines.length ? `${lines.join('\n')}\n` : '';
}

const jsonReport = (value) => `${JSON.stringify(value, null, 2)}\n`;

// What `coverage` prints: the summary and where each part starts and ends.
function coverageReport({ parts, ...summary }, { json }) {
  const located = parts.map((part) => {
    const rest = { ...part };
    delete rest.source;
    return rest;
  });
  const report = { ...summary, parts: located };
  return json ? jsonReport(report) : linoReport(report);
}

// What `detect` prints: the likeliest languages first, one per line.
const detectionReport = (detections, { json }) =>
  json
    ? jsonReport(detections)
    : detections.map((detection) => `${linoLinks(detection)}\n`).join('');

// The commands that read a text in a language: what each one writes.
const textCommands = {
  'check-words': (translator, text, from) => checkWords(text, from),
  meta: (translator, text, from, { json, shallow }) => {
    const meta = translator.toMeta(text, from);
    const shown = shallow ? meta : nestGrammars(meta, from, translator);
    return json ? jsonReport(shown) : formatMeta(shown);
  },
  coverage: (translator, text, from, { json }) =>
    coverageReport(translator.parsePartial(text, from), { json }),
};

// `check-equivalence`: the report when both programs mean the same, the
// first difference as the error otherwise.
function equivalenceCommand(args, read) {
  const [from, to, file, targetFile] = args;
  if (args.length < 3 || args.length > 4) {
    throw new Error(usage());
  }
  const checked = checkEquivalence(createTranslator(), {
    source: read(file),
    from,
    to,
    ...(targetFile === undefined ? {} : { target: read(targetFile) }),
  });
  if (!checked.equivalent) {
    throw new Error(
      `The ${from} and ${to} programs are not equivalent: ${checked.difference}`
    );
  }
  return `The ${from} and ${to} programs are equivalent\n`;
}

// --trace reports every pipeline stage as JSON, so a translation can be
// followed rule layer by rule layer.
const translatorFor = ({ trace, rules = {} }, stderr) =>
  createTranslator({
    ...(trace
      ? { trace: (stage, tree) => stderr(`[${stage}] ${JSON.stringify(tree)}`) }
      : {}),
    rules,
  });

function runTranslation(command, allArgs, read, write, stderr) {
  // Only the reports take --json; every other command reads it as a file
  // name.
  const json =
    ['meta', 'coverage', 'detect'].includes(command) &&
    allArgs.includes('--json');
  const shallow = command === 'meta' && allArgs.includes('--shallow');
  const args = allArgs.filter(
    (arg) => !(json && arg === '--json') && !(shallow && arg === '--shallow')
  );
  const [from, to, ...trailing] = args;
  const { file, options = {} } =
    command === 'translate' ? translationArguments(trailing) : {};
  const translator = translatorFor(options, stderr);
  const textCommand = textCommands[command];
  if (command === 'languages' && args.length === 0) {
    write(languageList(translator));
  } else if (textCommand && from && args.length <= 2) {
    write(textCommand(translator, read(to), from, { json, shallow }));
  } else if (command === 'detect' && args.length <= 1) {
    write(detectionReport(translator.detectLanguage(read(from)), { json }));
  } else if (command === 'translate' && from && to) {
    translateCommand(
      translator,
      { from, to, file, options },
      read,
      write,
      stderr
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
  } else if (command === 'check-equivalence') {
    write(equivalenceCommand(args, read));
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
  // A reader that stops early (`| head`) closes the pipe: stop quietly, as
  // other command line tools do.
  process.stdout.on('error', (error) => {
    if (error.code === 'EPIPE') {
      process.exit(process.exitCode ?? 0);
    }
    throw error;
  });
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
