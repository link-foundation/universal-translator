#!/usr/bin/env node
// Rosetta Code coverage: load every programming task, keep the
// solutions written in languages the translator reads, sort the tasks from
// the simplest meaning to the most complex and count, per task and per
// language, how many lines the translator reads and how many it misses.
//
//   node scripts/rosetta-code.mjs download   # tasks -> .cache/rosetta-code
//   node scripts/rosetta-code.mjs coverage   # cache -> report
//   node scripts/rosetta-code.mjs all        # both
//
// Options: --limit <n> (first n tasks only), --cache <dir>, --out <dir>,
// --max-lines <n> (longer solutions are counted as skipped), --verbose.
//
// The solutions are not stored in the repository (they belong to Rosetta
// Code under the GNU FDL); only the counts are. The download asks the
// MediaWiki API for 50 pages at a time and waits between requests.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URLSearchParams } from 'node:url';

const api = 'https://rosettacode.org/w/api.php';
const categories = [
  'Category:Programming_Tasks',
  'Category:Draft_Programming_Tasks',
];

// Rosetta Code section headers of the languages the translator reads.
export const headers = {
  javascript: ['JavaScript'],
  typescript: ['TypeScript'],
  python: ['Python'],
  ruby: ['Ruby'],
  lua: ['Lua'],
  php: ['PHP'],
  c: ['C'],
  cpp: ['C++'],
  csharp: ['C sharp', 'C#'],
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
  pascal: ['Pascal', 'Free Pascal'],
  fortran: ['Fortran'],
  ada: ['Ada'],
  vb: ['Visual Basic .NET'],
  bash: ['Bash', 'UNIX Shell'],
  matlab: ['MATLAB', 'Octave', 'MATLAB / Octave'],
  zig: ['Zig'],
  lean: ['Lean'],
  rocq: ['Rocq', 'Coq'],
};

const byHeader = new Map(
  Object.entries(headers).flatMap(([id, names]) =>
    names.map((name) => [name.toLowerCase(), id])
  )
);

const decode = (text) =>
  text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');

// The solutions of one task page: { language: [code, ...] }, in page order.
export function extractSolutions(wikitext) {
  const solutions = {};
  const sections = wikitext.split(/^==\s*\{\{header\|/mu).slice(1);
  for (const section of sections) {
    const name = /^([^}|]+)/u.exec(section)?.[1].trim().toLowerCase();
    const id = byHeader.get(name);
    if (!id) {
      continue;
    }
    const code = [
      ...section.matchAll(/<(syntaxhighlight|lang)\b[^>]*>([\s\S]*?)<\/\1>/giu),
    ]
      .map((match) => decode(match[2]).replace(/^\n+|\s+$/gu, ''))
      .filter((text) => text.trim())
      .map((text) => `${text}\n`);
    if (code.length) {
      (solutions[id] ??= []).push(...code);
    }
  }
  return solutions;
}

const writtenLines = (code) =>
  code.split('\n').filter((line) => line.trim()).length;

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

// A task's meaning is as simple as its usual solution is short: the median
// length of the first solution in every language, then the more languages
// solve it the more common (and simpler) it is, then by title.
export function sortBySimplicity(tasks) {
  return tasks
    .map((task) => {
      const lengths = Object.values(task.solutions).map((list) =>
        writtenLines(list[0])
      );
      return {
        ...task,
        size: lengths.length ? median(lengths) : Infinity,
      };
    })
    .sort(
      (a, b) =>
        a.size - b.size ||
        Object.keys(b.solutions).length - Object.keys(a.solutions).length ||
        a.title.localeCompare(b.title)
    );
}

// Read the first solution of every language partially.
export function taskCoverage(task, parsePartial, { maxLines = 400 } = {}) {
  const languages = {};
  for (const [id, list] of Object.entries(task.solutions)) {
    const code = list[0];
    const lines = writtenLines(code);
    if (lines > maxLines) {
      languages[id] = { lines, read: 0, skipped: true };
      continue;
    }
    try {
      const reading = parsePartial(code, id);
      languages[id] = {
        lines: reading.lines,
        read: reading.readLines,
        missing: reading.errors.length,
      };
    } catch (error) {
      languages[id] = {
        lines,
        read: 0,
        missing: 1,
        error: String(error.message).split('\n')[0],
      };
    }
  }
  const total = Object.values(languages).reduce(
    (sum, entry) => ({
      lines: sum.lines + entry.lines,
      read: sum.read + entry.read,
    }),
    { lines: 0, read: 0 }
  );
  return {
    title: task.title,
    size: task.size,
    lines: total.lines,
    read: total.read,
    missingLines: total.lines - total.read,
    coverage: total.lines ? total.read / total.lines : 0,
    languages,
  };
}

export function summarize(results) {
  const languages = {};
  for (const result of results) {
    for (const [id, entry] of Object.entries(result.languages)) {
      const sum = (languages[id] ??= {
        tasks: 0,
        complete: 0,
        lines: 0,
        read: 0,
        skipped: 0,
      });
      sum.tasks += 1;
      sum.lines += entry.lines;
      sum.read += entry.read;
      sum.complete += entry.read === entry.lines && !entry.skipped ? 1 : 0;
      sum.skipped += entry.skipped ? 1 : 0;
    }
  }
  const lines = results.reduce((sum, result) => sum + result.lines, 0);
  const read = results.reduce((sum, result) => sum + result.read, 0);
  return {
    tasks: results.length,
    completeTasks: results.filter(
      (result) => result.lines && result.read === result.lines
    ).length,
    lines,
    read,
    coverage: lines ? read / lines : 0,
    languages,
  };
}

export function markdownReport(summary, results, { top = 100 } = {}) {
  const percent = (value) => `${(100 * value).toFixed(1)}%`;
  const rows = Object.entries(summary.languages)
    .sort((a, b) => b[1].read / b[1].lines - a[1].read / a[1].lines)
    .map(
      ([id, sum]) =>
        `| ${id} | ${sum.tasks} | ${sum.complete} | ${sum.read} / ${sum.lines} | ${percent(sum.lines ? sum.read / sum.lines : 0)} | ${sum.skipped} |`
    );
  const tasks = results
    .slice(0, top)
    .map(
      (result, index) =>
        `| ${index + 1} | ${result.title} | ${result.size} | ${Object.keys(result.languages).length} | ${result.read} / ${result.lines} | ${result.missingLines} | ${percent(result.coverage)} |`
    );
  return [
    '# Rosetta Code coverage',
    '',
    'Generated by `node scripts/rosetta-code.mjs all`. Each task counts the',
    'first solution in every language the translator reads; a line counts',
    'as read when partial reading (`parsePartial`) covers it.',
    '',
    `- Tasks: ${summary.tasks}`,
    `- Tasks read completely in every language: ${summary.completeTasks}`,
    `- Lines read: ${summary.read} of ${summary.lines} (${percent(summary.coverage)})`,
    '',
    '## By language',
    '',
    '| Language | Tasks | Read completely | Lines read | Coverage | Skipped (too long) |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    `## The ${Math.min(top, results.length)} simplest tasks`,
    '',
    'Sorted by the median length of their solutions; see `coverage.json` for every task.',
    '',
    '| Rank | Task | Median lines | Languages | Lines read | Lines missing | Coverage |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: |',
    ...tasks,
    '',
  ].join('\n');
}

async function request(parameters, verbose) {
  const url = `${api}?${new URLSearchParams({ format: 'json', formatversion: '2', ...parameters })}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'universal-translator-coverage/1.0' },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt >= 5) {
        throw error;
      }
      if (verbose) {
        console.error(`retry ${attempt}: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

async function taskTitles(verbose) {
  const titles = new Set();
  for (const category of categories) {
    let next = {};
    do {
      const page = await request(
        {
          action: 'query',
          list: 'categorymembers',
          cmtitle: category,
          cmnamespace: '0',
          cmlimit: '500',
          ...next,
        },
        verbose
      );
      for (const member of page.query.categorymembers) {
        titles.add(member.title);
      }
      next = page.continue ?? null;
    } while (next);
  }
  return [...titles].sort();
}

async function download({ cache, limit, verbose }) {
  mkdirSync(cache, { recursive: true });
  const file = join(cache, 'solutions.json');
  const stored = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const titles = (await taskTitles(verbose)).slice(0, limit);
  console.error(`${titles.length} tasks, ${Object.keys(stored).length} cached`);
  const missing = titles.filter((title) => !stored[title]);
  // Pages are large, so a few titles per request keep each answer small.
  for (let index = 0; index < missing.length; index += 10) {
    const batch = missing.slice(index, index + 10);
    let next = {};
    do {
      const answer = await request(
        {
          action: 'query',
          prop: 'revisions',
          rvprop: 'content',
          rvslots: 'main',
          titles: batch.join('|'),
          ...next,
        },
        verbose
      );
      for (const page of answer.query.pages) {
        const content = page.revisions?.[0]?.slots?.main?.content;
        if (content !== undefined) {
          stored[page.title] = extractSolutions(content);
        }
      }
      next = answer.continue ?? null;
    } while (next);
    writeFileSync(file, JSON.stringify(stored));
    console.error(
      `${Math.min(index + 10, missing.length)} / ${missing.length}`
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return titles;
}

async function coverage({ cache, out, limit, maxLines, verbose }) {
  const { parsePartial } = await import('../js/src/index.js');
  const stored = JSON.parse(
    readFileSync(join(cache, 'solutions.json'), 'utf8')
  );
  const tasks = sortBySimplicity(
    Object.entries(stored)
      .map(([title, solutions]) => ({ title, solutions }))
      .filter((task) => Object.keys(task.solutions).length)
  ).slice(0, limit);
  const results = [];
  for (const [index, task] of tasks.entries()) {
    const started = Date.now();
    results.push(taskCoverage(task, parsePartial, { maxLines }));
    if (verbose) {
      console.error(
        `${index + 1}/${tasks.length} ${task.title} (${Date.now() - started} ms)`
      );
    }
  }
  const summary = summarize(results);
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, 'coverage.json'),
    `${JSON.stringify({ summary, tasks: results }, null, 1)}\n`
  );
  writeFileSync(join(out, 'README.md'), markdownReport(summary, results));
  console.error(
    `${summary.tasks} tasks: ${summary.read} of ${summary.lines} lines read`
  );
}

function options(argv) {
  const result = {
    cache: '.cache/rosetta-code',
    out: 'docs/case-studies/issue-8/rosetta-code',
    limit: undefined,
    maxLines: 400,
    verbose: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--verbose') {
      result.verbose = true;
    } else if (argument === '--limit') {
      result.limit = Number(argv[++index]);
    } else if (argument === '--max-lines') {
      result.maxLines = Number(argv[++index]);
    } else if (argument === '--cache') {
      result.cache = argv[++index];
    } else if (argument === '--out') {
      result.out = argv[++index];
    } else {
      throw new Error(`Unexpected argument ${argument}`);
    }
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  const settings = options(rest);
  if (command === 'download' || command === 'all') {
    await download(settings);
  }
  if (command === 'coverage' || command === 'all') {
    await coverage(settings);
  }
  if (!['download', 'coverage', 'all'].includes(command)) {
    console.error('Usage: node scripts/rosetta-code.mjs download|coverage|all');
    process.exit(1);
  }
}
