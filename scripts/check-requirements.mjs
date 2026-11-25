#!/usr/bin/env node
// Requirements gate for issue 1 (test driven): every requirement listed in
// docs/case-studies/issue-1/requirements.lino must be "done" with all its
// evidence present and its check passing, or "blocked" with a stated
// reason. Anything else (for example "pending") fails CI, so the work cannot
// be called finished while a requirement is still open.
//
//   node scripts/check-requirements.mjs          # check and print a table
//   node scripts/check-requirements.mjs --strict # blocked items fail too

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLinks } from '../js/src/meta/links.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const caseStudy = join(root, 'docs/case-studies/issue-1');

// Read "name: field: values" entries into plain objects.
export function readEntries(file) {
  const [document] = parseLinks(readFileSync(file, 'utf8'));
  return document.values.map(({ id, values }) => ({
    id,
    ...Object.fromEntries(
      values.map((field) => [
        field.id,
        field.values.map((value) => value.id).join(' '),
      ])
    ),
  }));
}

const files = (path) => readdirSync(join(root, path));

async function load() {
  const { grammarLanguageIds } = await import('../js/src/formal/languages.js');
  const { machineTargetIds } = await import('../js/src/formal/machine.js');
  const natural = await import('../js/src/natural/catalog.js');
  const { semanticPrimes, checkDescription } =
    await import('../js/src/natural/rules.js');
  const tasks = files('examples/programs')
    .filter((file) => file.endsWith('.js'))
    .map((file) => file.slice(0, -3));
  const naturalIds = natural.naturalLanguageIds();
  return {
    grammarLanguageIds,
    machineTargetIds,
    naturalIds,
    baseNatural: naturalIds.filter((id) => !natural.naturalLanguage(id).base),
    semanticPrimes,
    checkDescription,
    tasks,
  };
}

// Language ids the Rust implementation describes (id: "...") in its grammar.
function rustLanguageIds() {
  const ids = new Set();
  const walk = (path) => {
    for (const entry of readdirSync(join(root, path), {
      withFileTypes: true,
    })) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(child);
      } else if (entry.name.endsWith('.rs')) {
        const source = readFileSync(join(root, child), 'utf8');
        for (const [, id] of source.matchAll(/\bid: "([a-z]+)"/g)) {
          ids.add(id);
        }
      }
    }
  };
  walk('rust/src/formal');
  return ids;
}

// undefined when the file names every word, otherwise what is missing.
function mentionsAll(path, words) {
  if (!existsSync(join(root, path))) {
    return `no ${path}`;
  }
  const source = readFileSync(join(root, path), 'utf8');
  const missing = words.filter((word) => !source.includes(word));
  return missing.length ? `${path} lacks ${missing.join(', ')}` : undefined;
}

const translatedCount = (task) =>
  files(`examples/programs/translated/${task}`).length;

const naturalTextsComplete = ({ tasks, naturalIds }) =>
  tasks.every((task) =>
    naturalIds.every((id) =>
      existsSync(
        join(root, `examples/programs/natural/${task}/${task}.${id}.txt`)
      )
    )
  );

const standards = [
  'english-asd-ste100',
  'english-ace',
  'english-gellish',
  'english-sbvr',
  'english-plain-language',
  'minimal-english',
  'minimal-polish',
  'minimal-french',
  'minimal-arabic',
  'minimal-bengali',
  'minimal-chinese',
  'minimal-dutch',
  'minimal-german',
  'minimal-gujarati',
  'minimal-hausa',
  'minimal-hindi',
  'minimal-indonesian',
  'minimal-italian',
  'minimal-japanese',
  'minimal-korean',
  'minimal-marathi',
  'minimal-persian',
  'minimal-portuguese',
  'minimal-punjabi',
  'minimal-russian',
  'minimal-spanish',
  'minimal-swahili',
  'minimal-tagalog',
  'minimal-tamil',
  'minimal-telugu',
  'minimal-thai',
  'minimal-turkish',
  'minimal-ukrainian',
  'minimal-urdu',
  'minimal-vietnamese',
  'english-e-prime',
  'english-basic-english',
  'english-special-english',
  'english-globish',
  'english-british',
];

// Each check returns undefined when it passes, or what is missing.
const checks = {
  'thirty-programming-languages': ({ grammarLanguageIds }) =>
    grammarLanguageIds.length >= 30
      ? undefined
      : `${grammarLanguageIds.length} programming languages (need 30)`,
  'hello-world-everywhere': (data) =>
    checks['every-task-everywhere'](data, ['hello-world']),
  'every-task-everywhere': (
    { grammarLanguageIds, machineTargetIds, tasks },
    only = tasks
  ) => {
    const need = grammarLanguageIds.length + machineTargetIds.length;
    const short = only.filter((task) => translatedCount(task) < need);
    return short.length
      ? `missing translations of ${short.join(', ')}`
      : undefined;
  },
  'machine-code': ({ machineTargetIds }) =>
    ['nasm', 'cil', 'jvm'].every((id) => machineTargetIds.includes(id))
      ? undefined
      : `machine targets: ${machineTargetIds.join(', ')}`,
  'thirty-natural-languages': ({ baseNatural }) =>
    baseNatural.length >= 30
      ? undefined
      : `${baseNatural.length} natural languages (need 30)`,
  'controlled-english-and-russian': ({ naturalIds }) =>
    ['english', 'russian'].every((id) => naturalIds.includes(id))
      ? undefined
      : 'English or Russian is missing',
  // Every natural language has a word for each prime (issue 6: semantic
  // primes as a dictionary modifier for every human language).
  'semantic-primes': ({ semanticPrimes, baseNatural }) => {
    if (semanticPrimes().length !== 65) {
      return `${semanticPrimes().length} semantic primes (need 65)`;
    }
    const short = baseNatural.filter((id) =>
      semanticPrimes().some(({ exponents }) => !exponents[id]?.length)
    );
    return short.length
      ? `no prime exponents in ${short.join(', ')}`
      : undefined;
  },
  'controlled-standards': ({ naturalIds, checkDescription }) => {
    const missing = standards.filter((id) => !naturalIds.includes(id));
    const broken = naturalIds.filter((id) => checkDescription(id).length);
    if (missing.length || broken.length) {
      return `missing ${missing.join(', ')}; breaking their rules: ${broken.join(', ')}`;
    }
    return undefined;
  },
  'parse-natural-algorithms': (data) =>
    naturalTextsComplete(data) ? undefined : 'natural texts are missing',
  'natural-to-formal': (data) => checks['parse-natural-algorithms'](data),
  'formal-to-natural': (data) => checks['parse-natural-algorithms'](data),
  'javascript-and-rust': ({ grammarLanguageIds }) => {
    if (
      !['rust/src/natural/mod.rs', 'rust/tests/natural.rs'].every((path) =>
        existsSync(join(root, path))
      )
    ) {
      return 'the Rust natural language layer is missing';
    }
    const rust = rustLanguageIds();
    const missing = grammarLanguageIds.filter((id) => !rust.has(id));
    return missing.length
      ? `the Rust implementation lacks ${missing.join(', ')}`
      : undefined;
  },
  'rosetta-algorithm-types': ({ tasks }) => {
    const problems = readEntries(join(caseStudy, 'rosetta-coverage.lino'))
      .filter(
        ({ status, tasks: covered = '', reason }) =>
          !(
            (status === 'covered' &&
              covered.split(' ').every((task) => tasks.includes(task))) ||
            (status === 'blocked' && reason)
          )
      )
      .map(({ id }) => id);
    return problems.length ? `unclear: ${problems.join(', ')}` : undefined;
  },
  'lean-and-rocq': ({ grammarLanguageIds }) => {
    const missing = ['lean', 'rocq'].filter(
      (id) => !grammarLanguageIds.includes(id)
    );
    return missing.length ? `no ${missing.join(' or ')}` : undefined;
  },
  fragments: () =>
    mentionsAll('js/src/index.js', ['translateFragment', 'parseFragment']) ??
    mentionsAll('rust/src/lib.rs', ['translate_fragment']) ??
    mentionsAll('bin/universal-translator.js', ['--fragment']),
  'web-demo': () =>
    mentionsAll('examples/universal-app/src/App.js', [
      'translateFragment',
      'languages',
    ]) ?? mentionsAll('.github/workflows/example-app.yml', ['playwright']),
  'cli-library-api-docker': () =>
    mentionsAll('js/src/index.js', ['createTranslationServer']) ??
    mentionsAll('bin/universal-translator.js', ['serve']) ??
    mentionsAll('Dockerfile', ['universal-translator']) ??
    mentionsAll('.github/workflows/release.yml', [
      'docker/build-push-action',
      'docker run',
    ]),
  'best-practices': () => {
    const review = 'docs/case-studies/issue-1/best-practices.md';
    const missing = mentionsAll(review, [
      'associative-tech-stack.md',
      'code-architecture-principles',
      'CI-CD-BEST-PRACTICES.md',
    ]);
    if (missing) {
      return missing;
    }
    // Every file the review cites as evidence must exist.
    const cited = [
      ...readFileSync(join(root, review), 'utf8').matchAll(
        /`((?:js|rust|scripts|examples|docs|data|\.github)\/[^`*\s]+)`/g
      ),
    ].map(([, path]) => path);
    const absent = cited.filter((path) => !existsSync(join(root, path)));
    return absent.length ? `cites missing ${absent.join(', ')}` : undefined;
  },
  // The Node.js test job fails when line, branch or function coverage of the
  // library and the CLI drops below 90%.
  'test-coverage': () => {
    const { scripts } = JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8')
    );
    const script = scripts['test:coverage'] ?? '';
    const low = ['lines', 'branches', 'functions'].filter(
      (kind) =>
        !(
          Number(
            script.match(new RegExp(`--test-coverage-${kind}=(\\d+)`))?.[1]
          ) >= 90
        )
    );
    if (low.length) {
      return `test:coverage needs ${low.join(', ')} thresholds of 90% or more`;
    }
    return mentionsAll('.github/workflows/release.yml', [
      'npm run test:coverage',
    ]);
  },
  'source-layout': () => {
    const layers = ['meta', 'formal', 'natural'];
    const missing = ['js/src', 'rust/src'].flatMap((base) =>
      layers
        .map((layer) => `${base}/${layer}`)
        .filter((path) => !existsSync(join(root, path)))
    );
    if (missing.length) {
      return `missing ${missing.join(', ')}`;
    }
    // The meta language is the centre: it depends on no language family,
    // and natural languages do not depend on formal ones.
    const inward = [
      ['js/src/meta', /from '\.\.\/(formal|natural)\//],
      ['rust/src/meta', /crate::(formal|natural)\b/],
      ['js/src/natural', /from '\.\.\/formal\//],
      ['rust/src/natural', /crate::formal\b/],
    ].flatMap(([path, outward]) =>
      files(path).filter((file) =>
        outward.test(readFileSync(join(root, path, file), 'utf8'))
      )
    );
    return inward.length
      ? `depend on an outer layer: ${inward.join(', ')}`
      : undefined;
  },
  'requirements-gate': () =>
    readFileSync(join(root, '.github/workflows/release.yml'), 'utf8').includes(
      'node scripts/check-requirements.mjs'
    )
      ? undefined
      : 'CI does not run this gate',
};

export async function checkRequirements({ strict = false } = {}) {
  const data = await load();
  return readEntries(join(caseStudy, 'requirements.lino')).map(
    (requirement) => {
      const problems = [];
      const evidence = (requirement.evidence ?? '').split(' ').filter(Boolean);
      for (const path of evidence) {
        if (!existsSync(join(root, path))) {
          problems.push(`no ${path}`);
        }
      }
      const check = requirement.check && checks[requirement.check];
      if (requirement.check && !check) {
        problems.push(`unknown check ${requirement.check}`);
      }
      const failure = check?.(data);
      if (failure) {
        problems.push(failure);
      }
      if (requirement.status === 'blocked') {
        if (!requirement.reason) {
          problems.push('blocked without a reason');
        } else if (strict) {
          problems.push(`blocked: ${requirement.reason}`);
        }
      } else if (requirement.status !== 'done') {
        problems.push(`status is "${requirement.status}"`);
      }
      return { ...requirement, problems };
    }
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const results = await checkRequirements({
    strict: process.argv.includes('--strict'),
  });
  for (const { id, status, problems, reason } of results) {
    const mark = problems.length ? 'FAIL' : status.toUpperCase();
    console.log(`${mark.padEnd(7)} ${id}`);
    problems.forEach((problem) => console.log(`        ${problem}`));
    if (status === 'blocked' && !problems.length) {
      console.log(`        ${reason}`);
    }
  }
  const failed = results.filter(({ problems }) => problems.length);
  console.log(
    failed.length
      ? `${failed.length} requirement(s) not met`
      : 'Every requirement is done or reported as blocked'
  );
  process.exitCode = failed.length ? 1 : 0;
}
