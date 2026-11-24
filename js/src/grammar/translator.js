// Grammar-based translation pipeline:
//
//   source text --parse--> source tree --understanding rules--> meta program
//     --type inference--> typed meta program --meaning rules-->
//     --custom meta layers--> --context rules--> --emit--> target text
//
// Every stage is a replaceable function, and every rule list is ordinary
// data, so callers can add, remove, reorder or decorate rules.

import { grammarLanguageIds, languageSyntax } from './languages.js';
import { parseProgram } from './parser.js';
import { contextRules, meaningRules, understandingRules } from './rules.js';
import { inferTypes } from './types.js';
import { emitProgram } from './emitter.js';
import { emitMachine, machineTargetIds } from './machine.js';

const modes = ['context-dependent', 'literal', 'same-effect'];

const applyRules = (tree, rules, context) =>
  rules.reduce((current, rule) => rule(current, context), tree);

export function createGrammarTranslator({
  parse = parseProgram,
  understanding = understandingRules,
  infer = inferTypes,
  meaning = meaningRules,
  context = contextRules,
  layers = [],
  emit = emitProgram,
  emitMachineCode = emitMachine,
  trace = () => {},
} = {}) {
  function toMeta(source, from) {
    const syntax = languageSyntax(from);
    if (syntax.machine) {
      throw new Error(
        `${syntax.label} is a lowering target; translate into it, not from it`
      );
    }
    const sourceTree = parse(source, syntax);
    trace('parsed', sourceTree);
    const meta = applyRules(sourceTree, understanding, { from });
    trace('understood', meta);
    const typed = applyRules(infer(meta), meaning, { from });
    trace('typed', typed);
    return typed;
  }

  function fromMeta(meta, to, { from = to, mode = 'context-dependent' } = {}) {
    if (!modes.includes(mode)) {
      throw new Error(`Unsupported mode "${mode}"`);
    }
    languageSyntax(to);
    const settings = { from, to, mode };
    // Custom layers are meta -> meta transformations, so they see the target
    // independent program; context rules then adapt it to the target.
    const transformed = layers.reduce(
      (current, layer) => applyRules(current, layer, settings),
      meta
    );
    trace('transformed', transformed);
    const adapted = applyRules(transformed, context, settings);
    trace('adapted', adapted);
    return machineTargetIds.includes(to)
      ? emitMachineCode(adapted, to)
      : emit(adapted, to);
  }

  return {
    languages: () =>
      grammarLanguageIds.map((id) => ({ id, label: languageSyntax(id).label })),
    toMeta,
    fromMeta,
    translate: (source, from, to, options = {}) =>
      fromMeta(toMeta(source, from), to, { ...options, from }),
  };
}

let defaultTranslator;

// Translate with the default rule layers.
export function translate(source, from, to, options) {
  defaultTranslator ??= createGrammarTranslator();
  return defaultTranslator.translate(source, from, to, options);
}
