import { describe, expect, it } from 'test-anywhere';

import { parsePartial } from '../../js/src/index.js';
import {
  extractSolutions,
  markdownReport,
  sortBySimplicity,
  summarize,
  taskCoverage,
} from '../../scripts/rosetta-code.mjs';

const page = `{{task}}Print a greeting.
=={{header|Python}}==
<syntaxhighlight lang="python">print("hi")
</syntaxhighlight>
==={{header|Python 2}}===
=={{header|JavaScript}}==
<syntaxhighlight lang="javascript">console.log(1 &lt; 2);
with (x) {}
</syntaxhighlight>
=={{header|11l}}==
<syntaxhighlight lang="11l">print('hi')</syntaxhighlight>
`;

describe('Rosetta Code coverage (issue #8)', () => {
  it('keeps the solutions of the languages it reads', () => {
    const solutions = extractSolutions(page);
    expect(Object.keys(solutions)).toEqual(['python', 'javascript']);
    expect(solutions.python[0]).toBe('print("hi")\n');
    expect(solutions.javascript[0]).toContain('1 < 2');
  });

  it('sorts tasks from the simplest and counts missing lines', () => {
    const tasks = sortBySimplicity([
      { title: 'Long', solutions: { python: ['a = 1\nb = 2\nprint(a)\n'] } },
      { title: 'Greeting', solutions: extractSolutions(page) },
    ]);
    expect(tasks.map(({ title }) => title)).toEqual(['Greeting', 'Long']);
    const results = tasks.map((task) => taskCoverage(task, parsePartial));
    expect(results[0].languages.python.read).toBe(1);
    expect(results[0].missingLines > 0).toBe(true);
    const summary = summarize(results);
    expect(summary.tasks).toBe(2);
    expect(summary.languages.python.tasks).toBe(2);
    expect(markdownReport(summary, results)).toContain('| 1 | Greeting |');
  });
});
