import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { extensions } from '../examples/programs/verify-native.mjs';
import {
  createSourceSyntaxCodec,
  writeSourceDocument,
} from '../js/src/index.js';
import { linkFields, parseLinks, references } from '../js/src/meta/links.js';

const [modulePath, executable = 'target/debug/universal-translator'] =
  process.argv.slice(2);
assert.ok(modulePath, 'Pass the Meta Language 1.0 JavaScript module path');
const grammarEngine = await import(pathToFileURL(resolve(modulePath)));
const { LinkNetwork, LinkType } = grammarEngine;
const codec = createSourceSyntaxCodec(LinkNetwork);

function run(program, arguments_, options) {
  const result = spawnSync(program, arguments_, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    ...options,
  });
  assert.ifError(result.error);
  return result;
}

function success(result) {
  assert.equal(result.status, 0, result.stderr || result.signal);
  return result.stdout;
}

const rustCli = (arguments_, input) =>
  run(resolve(executable), arguments_, { input });
const rust = (arguments_, input) => success(rustCli(arguments_, input));
const jsCli = (arguments_, input) =>
  run(process.execPath, ['bin/universal-translator.js', ...arguments_], {
    input,
    env: {
      ...process.env,
      UNIVERSAL_TRANSLATOR_META_LANGUAGE: resolve(modulePath),
    },
  });

const hello = (ext) =>
  readFileSync(
    new URL(`../examples/translation/hello.${ext}`, import.meta.url),
    'utf8'
  );
const samples = [
  [
    'JavaScript',
    '\ufeff// 🐍\r\nconst greeting = "Hello";',
    'lexical_declaration',
  ],
  ['Rust', '  fn main() { /* 🦀 */ }\n\r\n', 'function_item'],
  ['Python', 'def greet():\r\n    return "Hello"\r\n', 'function_definition'],
  ['C', hello('c'), 'function_definition'],
  ['C#', hello('cs'), 'class_declaration'],
  ['sql-sqlite', '  SELECT 1; -- comment\n', 'statement'],
  ['rust', '', 'source_file'],
];
for (const [language, source, term] of samples) {
  const javascriptNotation = codec.write(language, source);
  const rustNotation = rust(['encode-cst', language], source);
  for (const notation of [javascriptNotation, rustNotation]) {
    const network = LinkNetwork.fromLino(notation);
    assert.ok(
      network.links().some((link) => {
        const metadata = link.metadata();
        return metadata.linkType === LinkType.Syntax && metadata.term === term;
      }),
      `${language} CST lacks ${term}`
    );
    assert.deepEqual(codec.read(notation), { language, source });
    assert.equal(rust(['decode-cst'], notation), source);
  }
}
assert.throws(() => codec.write('Nonexistent grammar', 'text'), /provenance/);
assert.throws(() => codec.read(writeSourceDocument('Rust', 'fn main() {}')));
console.log(
  `Both implementations encoded and restored ${samples.length} grammar CST specimens`
);

const rankedPrograms = new URL(
  '../data/translation/ranked-grammar-programs.lino',
  import.meta.url
);
const ranked = linkFields(parseLinks(readFileSync(rankedPrograms, 'utf8')));
assert.equal(ranked.size, 27);
for (const [language, lines] of ranked) {
  const source = `${references(lines).join('\n')}\n`;
  const tree = codec.parse(language, source);
  assert.ok(tree.verifyFullMatch().isClean(), language);
  assert.deepEqual(codec.read(tree.toLino()), { language, source });
}
console.log(
  `The tagged JavaScript engine round-tripped ${ranked.size} ranked grammar specimens`
);

// Run a JavaScript or Rust program and return its standard output.
function runProgram(language, source) {
  if (language === 'javascript') {
    return success(
      run(process.execPath, ['--input-type=module'], { input: source })
    );
  }
  const directory = mkdtempSync(join(tmpdir(), 'syntax-exchange-'));
  writeFileSync(join(directory, 'main.rs'), source);
  success(
    run('rustc', ['-o', join(directory, 'main'), join(directory, 'main.rs')])
  );
  return success(run(join(directory, 'main'), []));
}

const programs = [
  {
    from: 'javascript',
    to: 'rust',
    source: 'const answer = 6 * 7;\nconsole.log(answer);\n',
    stdout: '42\n',
  },
  {
    from: 'rust',
    to: 'javascript',
    source: 'fn main() { let answer: i32 = 7 * 6; println!("{}", answer); }\n',
    stdout: '42\n',
  },
];

for (const { from, to, source, stdout } of programs) {
  const fromRust = rust(['encode-cst', from], source);
  const fromJs = success(jsCli(['encode-cst', from], source));
  assert.equal(success(jsCli(['decode-cst'], fromRust)), source);
  assert.equal(rust(['decode-cst'], fromJs), source);
  const targets = new Set();
  for (const [cli, notation] of [
    [jsCli, fromRust],
    [rustCli, fromJs],
  ]) {
    const translated = success(cli(['translate-program', 'cst', to], notation));
    targets.add(translated);
  }
  assert.equal(targets.size, 1, `Both CLIs agree from ${from} to ${to}`);
  assert.equal(runProgram(to, [...targets][0]), stdout);
}
for (const cli of [jsCli, rustCli]) {
  for (const [source, diagnostic] of [
    ['const = ;', /syntax errors/],
    ['class Example {}', /Unsupported JavaScript program:/],
  ]) {
    const result = cli(['translate-program', 'javascript', 'rust'], source);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, diagnostic);
  }
}
console.log(
  'Both implementations compiled and ran checked JavaScript and Rust translations from exchanged CSTs'
);

// Both command lines describe the same programming languages, write the
// shared golden files byte for byte and read them back alike.
const programmingLanguages = (output) =>
  output
    .trim()
    .split('\n')
    .map((line) => line.split('\t'))
    .filter(([, label]) => !label.endsWith('(natural)'))
    .map(([id]) => id);
const languageIds = programmingLanguages(rust(['languages']));
assert.deepEqual(
  programmingLanguages(success(jsCli(['languages']))),
  languageIds
);
// At least the 40 languages; a language added later needs no edit here.
assert.ok(languageIds.length >= 40, `${languageIds.length} languages`);
const programsFolder = new URL('../examples/programs/', import.meta.url);
const goldenTasks = ['hello-world', 'mutual-recursion'];
for (const task of goldenTasks) {
  const sourcePath = fileURLToPath(new URL(`${task}.js`, programsFolder));
  for (const language of languageIds) {
    const goldenPath = fileURLToPath(
      new URL(
        `translated/${task}/${task}${extensions[language]}`,
        programsFolder
      )
    );
    const golden = readFileSync(goldenPath, 'utf8');
    // The committed translations are written in the layout of each target.
    for (const cli of [jsCli, rustCli]) {
      const written = cli([
        'translate',
        'javascript',
        language,
        sourcePath,
        '--layout',
        'target',
      ]);
      assert.equal(success(written), golden, `${task} in ${language}`);
    }
    const [fromJs, fromRust] = [jsCli, rustCli].map((cli) =>
      success(cli(['translate', language, 'javascript', goldenPath]))
    );
    assert.equal(fromRust, fromJs, `${task} read from ${language}`);
  }
}
console.log(
  `Both implementations wrote and read back ${goldenTasks.length} golden programs in ${languageIds.length} languages`
);
