import assert from 'node:assert/strict';
import { URL, URLSearchParams } from 'node:url';

import { formatRecord } from '../src/translation/links.js';

const studies = [
  [
    'en-2019',
    ['white person', 'person with white skin', 'person painted white'],
  ],
  [
    'ru-2019',
    [
      'белый человек',
      'человек с белой кожей',
      'выкрашенный в белый цвет человек',
    ],
  ],
];

const yearStart = 2018;
const yearEnd = 2019;
const endpoint = 'https://books.google.com/ngrams/json';

const results = await Promise.all(
  studies.map(async ([corpus, phrases]) => {
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      content: phrases.join(','),
      year_start: yearStart,
      year_end: yearEnd,
      corpus,
      smoothing: 0,
    });
    const response = await fetch(url);
    assert.ok(response.ok, `Google Books Ngram query failed for ${corpus}`);
    const series = new Map(
      (await response.json()).map(({ ngram, timeseries }) => [
        ngram,
        timeseries,
      ])
    );

    return phrases.map((phrase) => {
      const values = series.get(phrase);
      if (values) {
        assert.equal(values.length, yearEnd - yearStart + 1, phrase);
        assert.ok(
          values.every(
            (value) => Number.isFinite(value) && value >= 0 && value <= 1
          ),
          phrase
        );
      }
      return formatRecord('phrase-frequency', {
        corpus,
        phrase,
        'frequency-2018': values?.[0] ?? 'not-reported',
        'frequency-2019': values?.[1] ?? 'not-reported',
      });
    });
  })
);

console.log(results.flat().join('\n'));
