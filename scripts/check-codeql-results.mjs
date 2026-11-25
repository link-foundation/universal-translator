#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Quote newlines and escape modern and legacy workflow command delimiters.
const quote = (value) =>
  JSON.stringify(String(value))
    .replaceAll('::', '\\u003a\\u003a')
    .replaceAll('##[', '##\\u005b');

function reportsIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory()
      ? reportsIn(file)
      : entry.isFile() && /\.sarif(?:\.json)?$/.test(entry.name)
        ? [file]
        : [];
  });
}

function describeNotification(notification) {
  const descriptor =
    notification?.descriptor?.id ??
    notification?.associatedRule?.id ??
    'unknown diagnostic';
  const locations = Array.isArray(notification?.locations)
    ? notification.locations
        .map((location) => {
          const physical = location?.physicalLocation;
          return `${physical?.artifactLocation?.uri ?? 'unknown location'}:${physical?.region?.startLine ?? '?'}`;
        })
        .join(', ')
    : '';
  return `${descriptor} ${locations}`;
}

function validNotification(notification, message, level) {
  return (
    notification &&
    !Array.isArray(notification) &&
    typeof notification === 'object' &&
    typeof message === 'string' &&
    ['error', 'warning', 'note', 'none'].includes(level)
  );
}

function invocationDiagnostics(invocation, file, runIndex) {
  const failures = [];
  for (const key of [
    'toolExecutionNotifications',
    'toolConfigurationNotifications',
  ]) {
    const notifications = invocation[key];
    if (notifications === undefined) {
      continue;
    }
    if (!Array.isArray(notifications)) {
      failures.push(`${file} run ${runIndex}: malformed ${key}`);
      continue;
    }
    for (const notification of notifications) {
      const level = notification?.level ?? 'warning';
      const message =
        notification?.message?.text ?? notification?.message?.markdown;
      if (!validNotification(notification, message, level)) {
        failures.push(`${file} run ${runIndex}: malformed ${key} notification`);
      } else if (level === 'error' || level === 'warning') {
        failures.push(
          `${file} run ${runIndex}: ${key} ${describeNotification(notification)} [${level}] ${message}`
        );
      }
    }
  }
  return failures;
}

export const DEFAULT_ACCEPTED_FILE = '.github/codeql/accepted-findings.json';
const ACCEPTED_KEYS = ['ruleId', 'path', 'primaryLocationLineHash'];

// A finding the maintainers reviewed and dismissed on GitHub stays in every
// SARIF report, because dismissal is stored by code scanning, not in the
// code. Each accepted entry names one finding exactly (rule, file and the
// line-content hash), the dismissed alert and the reason, so editing that
// line or adding a second finding fails the gate again.
export function loadAcceptedFindings(file) {
  if (!file || !existsSync(file)) {
    return [];
  }
  const entries = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(entries)) {
    throw new Error(`${file}: expected a JSON array of accepted findings`);
  }
  const seen = new Set();
  return entries.map((entry, index) => {
    const fields = [...ACCEPTED_KEYS, 'alert', 'reason'];
    if (
      !entry ||
      typeof entry !== 'object' ||
      fields.some(
        (key) => typeof entry[key] !== 'string' || !entry[key].trim()
      ) ||
      !/^https:\/\/github\.com\/[^/]+\/[^/]+\/security\/code-scanning\/\d+$/.test(
        entry.alert
      )
    ) {
      throw new Error(
        `${file} entry ${index}: needs non-empty ${fields.join(', ')} and a code-scanning alert URL`
      );
    }
    const key = findingKey(entry);
    if (seen.has(key)) {
      throw new Error(`${file} entry ${index}: duplicate accepted finding`);
    }
    seen.add(key);
    return { ...entry, key };
  });
}

function findingKey({ ruleId, path, primaryLocationLineHash }) {
  return JSON.stringify([ruleId, path, primaryLocationLineHash]);
}

function resultKey(finding) {
  return findingKey({
    ruleId: finding?.ruleId,
    path: finding?.locations?.[0]?.physicalLocation?.artifactLocation?.uri,
    primaryLocationLineHash:
      finding?.partialFingerprints?.primaryLocationLineHash,
  });
}

function runRules(run) {
  return new Set(
    [run.tool.driver, ...(run.tool.extensions ?? [])].flatMap((component) =>
      Array.isArray(component?.rules)
        ? component.rules.map((rule) => rule?.id)
        : []
    )
  );
}

function checkRun(run, index, file, accepted = [], state = undefined) {
  if (
    typeof run?.tool?.driver?.name !== 'string' ||
    !run.tool.driver.name.trim() ||
    !Array.isArray(run.results) ||
    (run.invocations !== undefined &&
      (!Array.isArray(run.invocations) ||
        run.invocations.some(
          (invocation) => invocation?.executionSuccessful !== true
        )))
  ) {
    throw new Error(
      `Invalid results/tool or unsuccessful invocation in run ${index}`
    );
  }
  return [
    ...(run.invocations ?? []).flatMap((invocation) =>
      invocationDiagnostics(invocation, file, index)
    ),
    ...checkFindings(run, index, file, accepted, state),
  ];
}

function checkFindings(run, index, file, accepted, state) {
  const rules = runRules(run);
  for (const entry of accepted) {
    if (rules.has(entry.ruleId)) {
      state?.checked.add(entry.key);
    }
  }
  return run.results.flatMap((finding) => {
    const entry = accepted.find(({ key }) => key === resultKey(finding));
    if (entry) {
      state?.matched.add(entry.key);
      state?.notes.push(
        `${file} run ${index}: accepted ${entry.ruleId} in ${entry.path} (${entry.alert}): ${entry.reason}`
      );
      return [];
    }
    return [
      `${file} run ${index}: ${finding?.ruleId ?? 'unknown rule'} [${finding?.level ?? 'unspecified severity'}] ${finding?.message?.text ?? 'CodeQL finding'}`,
    ];
  });
}

function checkReport(file, accepted, state) {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  if (
    report?.version !== '2.1.0' ||
    !Array.isArray(report.runs) ||
    !report.runs.length
  ) {
    throw new Error('Invalid SARIF version or missing runs');
  }
  return report.runs.flatMap((run, index) => {
    try {
      return checkRun(run, index, file, accepted, state);
    } catch (error) {
      return [`${file}: ${error.message}`];
    }
  });
}

export function checkCodeqlResults(
  directory,
  log = console.error,
  acceptedFile = DEFAULT_ACCEPTED_FILE,
  notice = console.log
) {
  const files = reportsIn(directory);
  if (!files.length) {
    throw new Error(`Missing CodeQL SARIF reports: ${directory}`);
  }
  const accepted = loadAcceptedFindings(acceptedFile);
  const state = { checked: new Set(), matched: new Set(), notes: [] };
  const failures = [];
  for (const file of files) {
    try {
      failures.push(...checkReport(file, accepted, state));
    } catch (error) {
      failures.push(`${file}: ${error.message}`);
    }
  }
  // An entry whose rule ran but found nothing is stale: the code changed, so
  // the old review no longer applies to whatever CodeQL reports there next.
  for (const entry of accepted) {
    if (state.checked.has(entry.key) && !state.matched.has(entry.key)) {
      failures.push(
        `${acceptedFile}: stale accepted finding ${entry.ruleId} in ${entry.path} (${entry.alert}); remove the entry`
      );
    }
  }
  for (const note of state.notes) {
    notice(`::notice title=Accepted CodeQL finding::${quote(note)}`);
  }
  for (const failure of failures) {
    log(quote(failure));
  }
  if (failures.length) {
    throw new Error(
      `CodeQL result gate rejected ${failures.length} finding(s) or report error(s)`
    );
  }
  return files.length;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(
      `CodeQL result gate: ${checkCodeqlResults(
        process.argv[2] || 'codeql-results',
        console.error,
        process.argv[3] || DEFAULT_ACCEPTED_FILE
      )} clean report(s)`
    );
  } catch (error) {
    console.error(quote(error.message));
    process.exitCode = 1;
  }
}
