#!/usr/bin/env node
// Downloads the Hello World Collection (http://helloworldcollection.de),
// caches the raw page, extracts the programs of the languages the
// translator describes and measures which of them read into the meta
// language.
//
//   node scripts/hello-world-collection.mjs            # use the cached page
//   node scripts/hello-world-collection.mjs --fetch    # download it again
//
// The site is asked for /robots.txt first: a rule that disallows the page
// stops the download. The page is one HTML document with a section per
// language, each holding its program in a <pre> block.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTranslator } from '../js/src/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const dataFolder = join(
  root,
  'docs/case-studies/issue-14/data/hello-world-collection'
);
export const coverageFile = join(
  root,
  'docs/case-studies/issue-14/hello-world-coverage.lino'
);
export const pageFile = join(dataFolder, 'index.html');
export const programsFile = join(dataFolder, 'programs.json');
export const source = 'http://helloworldcollection.de/';
const agent = 'universal-translator-hello-world-collection';

// The sections of the collection that hold the program of a language id.
// A language the collection has no section for (lean, rocq) has none.
export const sections = {
  javascript: ['JavaScript'],
  typescript: ['TypeScript'],
  python: ['Python 3', 'Python 2'],
  ruby: ['Ruby'],
  lua: ['Lua'],
  php: ['PHP'],
  c: ['C (ANSI)'],
  cpp: ['C++', 'C++ (ISO)'],
  csharp: ['C♯'],
  java: ['Java'],
  go: ['Go'],
  rust: ['Rust'],
  kotlin: ['Kotlin'],
  swift: ['Swift'],
  perl: ['Perl'],
  dart: ['Dart'],
  scala: ['Scala'],
  julia: ['Julia'],
  r: ['R'],
  groovy: ['Groovy'],
  objc: ['Objective-C'],
  nim: ['Nim'],
  d: ['D'],
  pascal: ['Pascal'],
  fortran: ['Fortran', 'Fortran90'],
  ada: ['Ada'],
  vb: ['Visual Basic .NET'],
  bash: ['Unix Shell'],
  matlab: ['MATLAB'],
  zig: ['Zig'],
  lean: [],
  rocq: [],
  gml: ['GML'],
};

const named = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mu: 'μ',
  lambda: 'λ',
};

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body) => {
    if (body[0] === '#') {
      const code =
        body[1].toLowerCase() === 'x'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return named[body] ?? whole;
  });
}

// "Section name" -> its program text. A section starts at an anchor
// <a name="..."></a> and ends at the next one.
export function extractSections(html) {
  const result = new Map();
  const parts = html.split(/<a name="[^"]*"><\/a>/).slice(1);
  for (const part of parts) {
    const heading = /<h2>([^<]*)<\/h2>/.exec(part);
    const program = /<pre[^>]*>([\s\S]*?)<\/pre>/.exec(part);
    if (heading && program) {
      const text = decodeEntities(program[1].replace(/<[^>]*>/g, ''));
      result.set(decodeEntities(heading[1]), text.replace(/^\n+/, ''));
    }
  }
  return result;
}

// language id -> [{ section, program }] for the sections the table names.
export function extractPrograms(html) {
  const all = extractSections(html);
  const programs = {};
  for (const [id, names] of Object.entries(sections)) {
    programs[id] = names
      .filter((name) => all.has(name))
      .map((name) => ({ section: name, program: all.get(name) }));
  }
  return programs;
}

// Whether robots.txt lets automated clients read the page. A missing file
// (404) allows everything.
export function robotsAllow(robots) {
  let applies = false;
  for (const raw of robots.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const [field, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (/^user-agent$/i.test(field)) {
      applies = value === '*' || agent.includes(value.toLowerCase());
    } else if (applies && /^disallow$/i.test(field) && value === '/') {
      return false;
    }
  }
  return true;
}

async function download() {
  const robots = await fetch(`${source}robots.txt`, {
    headers: { 'user-agent': agent },
  });
  if (robots.ok && !robotsAllow(await robots.text())) {
    throw new Error('robots.txt disallows the Hello World Collection');
  }
  const response = await fetch(source, { headers: { 'user-agent': agent } });
  if (!response.ok) {
    throw new Error(`${source} answered ${response.status}`);
  }
  const html = await response.text();
  mkdirSync(dataFolder, { recursive: true });
  writeFileSync(pageFile, html);
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(
    join(dataFolder, 'README.md'),
    [
      '# The Hello World Collection',
      '',
      `Source: ${source} (one HTML page, a section per language).`,
      `Retrieved: ${date}, after /robots.txt allowed it (the site is served by`,
      'GitHub Pages and has no robots.txt).',
      '',
      '- `index.html` is the raw page, unchanged.',
      '- `programs.json` holds the programs extracted for the language ids of',
      '  `js/src/formal/languages.js`, by `scripts/hello-world-collection.mjs`.',
      '',
      'The programs are the work of the collection and its contributors; they',
      'are kept here only as test input.',
      '',
    ].join('\n')
  );
}

// Reads every program into the meta language: { id, section, error? }.
export function measure(programs, translator = createTranslator()) {
  const results = [];
  for (const [id, entries] of Object.entries(programs)) {
    for (const { section, program } of entries) {
      try {
        translator.toMeta(program, id);
        results.push({ id, section });
      } catch (error) {
        const reason = String(error.message).split('\n')[0];
        results.push({ id, section, reason });
      }
    }
  }
  return results;
}

const quote = (text) => `'${text.replaceAll("'", '’')}'`;

export function coverageText(programs, results) {
  const lines = [
    'hello-world-coverage:',
    "  source: 'http://helloworldcollection.de/'",
    "  note: 'Programs the translator reads into the meta language, and the programs it does not read with the reason'",
  ];
  const missing = Object.keys(sections).filter((id) => !programs[id].length);
  for (const id of missing) {
    lines.push(
      `  ${id}:`,
      '    status: absent',
      "    reason: 'The collection has no section for this language'"
    );
  }
  for (const { id, section, reason } of results) {
    const key = `${id}-${section
      .toLowerCase()
      .replaceAll('+', 'p')
      .replaceAll('♯', 'sharp')
      .replace(/[^a-z0-9]+/g, '-')}`;
    lines.push(
      `  ${key.replace(/-$/, '')}:`,
      `    language: ${id}`,
      `    section: ${quote(section)}`,
      `    status: ${reason ? 'failed' : 'read'}`
    );
    if (reason) {
      lines.push(`    reason: ${quote(reason)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  if (process.argv.includes('--fetch') || !existsSync(pageFile)) {
    await download();
    console.log(`Downloaded ${source} to ${pageFile}`);
  }
  const programs = extractPrograms(readFileSync(pageFile, 'utf8'));
  writeFileSync(programsFile, `${JSON.stringify(programs, null, 2)}\n`);
  const results = measure(programs);
  mkdirSync(dirname(coverageFile), { recursive: true });
  writeFileSync(coverageFile, coverageText(programs, results));
  const read = results.filter(({ reason }) => !reason).length;
  console.log(
    `${read} of ${results.length} programs read into the meta language`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
