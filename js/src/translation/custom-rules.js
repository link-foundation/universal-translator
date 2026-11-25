// Rules a user adds to the translation without writing code: plain data
// that the command line, the server and the web demo's rule editor all
// accept, written as indented Links Notation (see rules-notation.js) or
// given as an object. Each list belongs to one stage of the pipeline:
//
//   source     text -> text before the source is read
//   templates  more wordings a natural language reads, per template key
//   names      meta -> meta: renames of variables and functions
//   output     text -> text after the target is written
//
// A text rule is { find, replace, regex?, language? }: `find` is plain
// text unless `regex` is true, and `language` limits the rule to one
// source (source rules) or target (output rules) language. A name rule is
// { find, replace }. Templates map a language to { key: [templates] }.
//
// Code-level rules remain available too: `layers` of meta -> meta
// functions and replaced `understanding`, `meaning` and `context` lists.

import { withTemplates } from '../natural/catalog.js';
import { rewrite } from '../meta/tree.js';
import { readRules } from './rules-notation.js';

const stages = ['source', 'templates', 'names', 'output'];

function textRule(rule, stage, index) {
  const where = `${stage} rule ${index + 1}`;
  if (!rule || typeof rule !== 'object' || typeof rule.find !== 'string') {
    throw new Error(`The ${where} needs a "find" text`);
  }
  if (!rule.find) {
    throw new Error(`The ${where} has an empty "find" text`);
  }
  if (typeof (rule.replace ?? '') !== 'string') {
    throw new Error(`The ${where} needs a "replace" text`);
  }
  const replace = rule.replace ?? '';
  if (!rule.regex) {
    // A plain rule replaces literally, without "$1" substitutions.
    return {
      language: rule.language || undefined,
      apply: (text) => text.split(rule.find).join(replace),
    };
  }
  let pattern;
  try {
    // The pattern is the rule author's own: regular expressions are what
    // a regex rule asks for. The server refuses them by default.
    pattern = new RegExp(rule.find, 'gu');
  } catch (error) {
    throw new Error(
      `The ${where} is not a regular expression: ${error.message}`
    );
  }
  return {
    language: rule.language || undefined,
    apply: (text) => text.replace(pattern, replace),
  };
}

const applyText = (rules, text, language) =>
  rules
    .filter((rule) => !rule.language || rule.language === language)
    .reduce((current, rule) => rule.apply(current), text);

function renameLayer(names) {
  if (!names.length) {
    return [];
  }
  const renames = new Map();
  names.forEach((rule, index) => {
    if (!rule?.find || typeof rule.find !== 'string' || !rule.replace) {
      throw new Error(`The names rule ${index + 1} needs "find" and "replace"`);
    }
    renames.set(rule.find, rule.replace);
  });
  const renamed = (value) => renames.get(value) ?? value;
  const renameNode = (node) => {
    const copy = { ...node };
    if (typeof copy.name === 'string') {
      copy.name = renamed(copy.name);
    }
    if (typeof copy.variable === 'string') {
      copy.variable = renamed(copy.variable);
    }
    if (typeof copy.callee === 'string') {
      copy.callee = renamed(copy.callee);
    }
    if (Array.isArray(copy.parameters)) {
      copy.parameters = copy.parameters.map((parameter) => ({
        ...parameter,
        name: renamed(parameter.name),
      }));
    }
    return copy;
  };
  return [[(program) => rewrite(program, renameNode)]];
}

// Check a rule set (an object, or Links Notation text) and turn it into
// the hooks the translator calls.
export function compileCustomRules(given = {}) {
  const rules = typeof given === 'string' ? readRules(given) : given;
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    throw new Error('Rules must be an object');
  }
  for (const key of Object.keys(rules)) {
    if (!stages.includes(key)) {
      throw new Error(`Unknown rule stage "${key}"; use ${stages.join(', ')}`);
    }
  }
  const list = (stage) => {
    const value = rules[stage] ?? [];
    if (!Array.isArray(value)) {
      throw new Error(`"${stage}" rules must be a list`);
    }
    return value;
  };
  const source = list('source').map((rule, index) =>
    textRule(rule, 'source', index)
  );
  const output = list('output').map((rule, index) =>
    textRule(rule, 'output', index)
  );
  const templates = rules.templates ?? {};
  const languages = new Map(
    Object.entries(templates).map(([id, variants]) => [
      id,
      withTemplates(id, variants),
    ])
  );
  return {
    empty:
      !source.length &&
      !output.length &&
      !languages.size &&
      !list('names').length,
    source: (text, from) => applyText(source, text, from),
    output: (text, to) => applyText(output, text, to),
    naturalLanguage: (id) => languages.get(id),
    layers: renameLayer(list('names')),
  };
}
