import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';

import { createTranslator } from '../src/index.js';
import { parseLinks } from '../src/meta/links.js';
import {
  coverageFile,
  coverageText,
  decodeEntities,
  extractPrograms,
  measure,
  pageFile,
  programsFile,
  robotsAllow,
  sections,
} from '../../scripts/hello-world-collection.mjs';

const translator = createTranslator();
const programs = JSON.parse(readFileSync(programsFile, 'utf8'));
const entries = Object.entries(programs).flatMap(([id, list]) =>
  list.map(({ section, program }) => ({ id, section, program }))
);

// "key: field: value" entries of the coverage file as plain objects.
const coverage = () => {
  const [document] = parseLinks(readFileSync(coverageFile, 'utf8'));
  return document.values.map(({ id, values }) => ({
    id,
    ...Object.fromEntries(
      values.map((field) => [field.id, field.values.map((v) => v.id).join(' ')])
    ),
  }));
};

describe('the Hello World Collection', () => {
  it('extracts from the cached page what programs.json holds', () => {
    const html = readFileSync(pageFile, 'utf8');
    expect(extractPrograms(html)).toEqual(programs);
  });

  it('has a program for every language id but the ones it lacks', () => {
    const lacking = Object.keys(programs).filter((id) => !programs[id].length);
    expect(lacking).toEqual(['lean', 'rocq']);
    expect(Object.keys(sections).length).toBe(Object.keys(programs).length);
    for (const { id, program } of entries) {
      expect(program.trim().length).toBeGreaterThan(0);
      expect(
        translator.languages().some((language) => language.id === id)
      ).toBe(true);
    }
  });

  it('reads every program that the coverage file does not list as failed', () => {
    const failed = new Map(
      coverage()
        .filter((entry) => entry.status === 'failed')
        .map((entry) => [`${entry.language}/${entry.section}`, entry])
    );
    for (const { id, section, program } of entries) {
      const expected = failed.get(`${id}/${section}`);
      if (expected) {
        expect(() => translator.toMeta(program, id)).toThrow();
      } else {
        const meta = translator.toMeta(program, id);
        expect(meta.kind).toBe('Program');
        expect(
          meta.main.statements.length + meta.functions.length
        ).toBeGreaterThan(0);
      }
    }
  });

  it('lists each failing program with its reason, as measured', () => {
    const results = measure(programs, translator);
    expect(readFileSync(coverageFile, 'utf8')).toBe(
      coverageText(programs, results)
    );
    for (const entry of coverage().filter(
      ({ status }) => status === 'failed'
    )) {
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });

  it('decodes the entities of the page', () => {
    expect(decodeEntities('a&nbsp;&lt;b&gt; &amp; &#9839; &#x41;')).toBe(
      'a <b> & ♯ A'
    );
  });

  it('follows robots.txt', () => {
    expect(robotsAllow('User-agent: *\nDisallow: /private\n')).toBe(true);
    expect(robotsAllow('User-agent: *\nDisallow: /\n')).toBe(false);
    expect(robotsAllow('User-agent: other\nDisallow: /\n')).toBe(true);
    expect(robotsAllow('')).toBe(true);
  });
});
