// Translation rules as indented Links Notation, the form the command line
// (--rules), the server and the web demo read and write:
//
//   source:
//     (find colour) (replace color) (language english)
//     (find '\bvar\b') (replace let) (regex true)
//   templates:
//     english:
//       print: 'Say {value}.'
//   names:
//     (find x) (replace count)
//   output:
//     (find 'console.log(') (replace 'print(')
//
// A stage, a natural language and a template key are unique, so each is
// written as "name:"; the rules of a stage are a list, one rule per line,
// each a few (field value) links. The Rust twin is
// rust/src/custom_rules.rs (read_rules and format_rules).
//
// Rules written as JSON (text that starts with "{") are still read, so
// older rule files keep working.

import { parseLinks } from '../meta/links.js';

export const ruleStages = ['source', 'templates', 'names', 'output'];

const ruleFields = {
  source: ['find', 'replace', 'regex', 'language'],
  output: ['find', 'replace', 'regex', 'language'],
  names: ['find', 'replace'],
};

const plainWord = /^[\p{L}\p{N}_.+*/<>=!?-]+$/u;

// A value as Links Notation: plain words stay plain, anything else is
// quoted with ' (a ' inside is doubled).
export function linoValue(value) {
  const text = String(value);
  return plainWord.test(text) ? text : `'${text.split("'").join("''")}'`;
}

const words = (values) =>
  values.map((link) => {
    if (link.values?.length) {
      throw new Error('Expected a word or a quoted text');
    }
    return link.id ?? '';
  });

// One rule line: (find x) (replace y) ... A line of one link is read by
// links-notation as that link itself.
function readRule(line, stage, index) {
  const where = `${stage} rule ${index + 1}`;
  const links = line.values.every((link) => !link.values?.length)
    ? [line]
    : line.values;
  const rule = {};
  for (const link of links) {
    const [field, ...rest] = link.id
      ? [link.id, ...words(link.values)]
      : words(link.values);
    if (!ruleFields[stage].includes(field)) {
      throw new Error(
        `The ${where} has no field "${field}"; use ${ruleFields[stage].join(', ')}`
      );
    }
    if (field in rule) {
      throw new Error(`The ${where} has "${field}" twice`);
    }
    if (rest.length !== 1) {
      throw new Error(`The ${where} needs one value for "${field}"`);
    }
    const [value] = rest;
    if (field === 'regex') {
      if (value !== 'true' && value !== 'false') {
        throw new Error(`The ${where} has "regex" ${value}; use true or false`);
      }
      rule.regex = value === 'true';
    } else {
      rule[field] = value;
    }
  }
  return rule;
}

function readTemplates(values) {
  const templates = {};
  for (const { id: language, values: keys } of values) {
    if (!language || language in templates) {
      throw new Error(
        'Templates are given once per natural language: "english:"'
      );
    }
    templates[language] = {};
    for (const { id: key, values: texts } of keys) {
      if (!key || key in templates[language]) {
        throw new Error(
          `Templates of ${language} are given once per key: "print:"`
        );
      }
      templates[language][key] = words(texts);
    }
  }
  return templates;
}

// Links Notation (or JSON) text -> the rules object of createTranslator.
export function readRules(text = '') {
  const source = String(text).trim();
  if (!source) {
    return {};
  }
  if (source.startsWith('{')) {
    return JSON.parse(source);
  }
  const rules = {};
  for (const { id, values } of parseLinks(source)) {
    if (!ruleStages.includes(id)) {
      throw new Error(
        `Unknown rule stage "${id ?? '(…)'}"; use ${ruleStages.map((stage) => `${stage}:`).join(', ')}`
      );
    }
    if (id in rules) {
      throw new Error(`The stage "${id}" is given twice`);
    }
    rules[id] =
      id === 'templates'
        ? readTemplates(values)
        : values.map((line, index) => readRule(line, id, index));
  }
  return rules;
}

function ruleLine(rule, stage) {
  const fields = [['find', rule.find]];
  if (rule.replace !== undefined && rule.replace !== null) {
    fields.push(['replace', rule.replace]);
  }
  if (stage !== 'names' && rule.regex) {
    fields.push(['regex', 'true']);
  }
  if (stage !== 'names' && rule.language) {
    fields.push(['language', rule.language]);
  }
  return `  ${fields.map(([field, value]) => `(${field} ${linoValue(value)})`).join(' ')}`;
}

// The rules object -> Links Notation text ('' when there are no rules).
export function formatRules(rules = {}) {
  const lines = [];
  for (const stage of ruleStages) {
    if (stage === 'templates') {
      const languages = Object.entries(rules.templates ?? {}).filter(
        ([, keys]) => Object.keys(keys ?? {}).length
      );
      if (languages.length) {
        lines.push('templates:');
        for (const [language, keys] of languages) {
          lines.push(`  ${language}:`);
          for (const [key, texts] of Object.entries(keys)) {
            lines.push(
              `    ${key}: ${[texts].flat().map(linoValue).join(' ')}`
            );
          }
        }
      }
    } else if (rules[stage]?.length) {
      lines.push(`${stage}:`);
      lines.push(...rules[stage].map((rule) => ruleLine(rule, stage)));
    }
  }
  return lines.length ? `${lines.join('\n')}\n` : '';
}
