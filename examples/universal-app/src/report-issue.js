import { formatRules } from '../../../js/src/translation/rules-notation.js';

// Only the translation the user is looking at is included. Browser location,
// account details and other ambient device information are not collected.
function code(text = '') {
  const longest = (text.match(/`+/gu) ?? []).reduce(
    (length, run) => Math.max(length, run.length),
    0
  );
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}\n${text}\n${fence}`;
}

export function issueReportUrl(repository, state, result) {
  const { source, from, to, rules, ...options } = state;
  const report = [
    '## Description\n\nPlease describe the expected translation.',
    `## Reproduce\n\nTranslate from ${from} to ${to} with these options:`,
    // Options are request settings; translation rules have their own section.
    ...Object.entries(options).map(
      ([key, value]) => `- ${key}: ${String(value)}`
    ),
    `## Source\n\n${code(source)}`,
    `## Actual result\n\n${code(result.output ?? result.error ?? '')}`,
    ...(result.detected
      ? [`Detected source language: ${result.detected}`]
      : []),
    ...(result.errors?.length
      ? [
          `## Errors\n\n${code(result.errors.map((error) => `Line ${error.line}: ${error.message}`).join('\n'))}`,
        ]
      : []),
    ...(rules ? [`## Rules\n\n${code(formatRules(rules))}`] : []),
  ].join('\n\n');
  const url = new URL(`${repository.replace(/\/$/u, '')}/issues/new`);
  url.searchParams.set('title', `Translation issue: ${from} → ${to}`);
  url.searchParams.set('body', report);
  return url.href;
}
