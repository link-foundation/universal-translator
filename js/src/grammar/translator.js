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
import {
  contextRules,
  inferMutability,
  meaningRules,
  understandingRules,
} from './rules.js';
import { inferTypes } from './types.js';
import { emitProgram } from './emitter.js';
import { emitMachine, machineTargetIds } from './machine.js';
import { machineReaders } from './machine-reader.js';
import { liftProgram } from './lifting.js';
import { useCommonLibrary } from './common-library.js';
import {
  isNaturalLanguage,
  naturalLanguage,
  naturalLanguageIds,
} from '../natural/catalog.js';
import { readNatural } from '../natural/reader.js';
import { writeNatural } from '../natural/writer.js';

const readMachine = (source, from) => machineReaders[from](source);

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
  lift = liftProgram,
  trace = () => {},
} = {}) {
  function toMeta(source, from) {
    if (isNaturalLanguage(from)) {
      // A controlled natural language is read sentence by sentence straight
      // into the meta language; it has no source details to understand.
      const read = inferMutability(readNatural(source, from));
      trace('read', read);
      const typed = applyRules(infer(read), meaning, {});
      trace('typed', typed);
      return typed;
    }
    const syntax = languageSyntax(from);
    if (syntax.machine) {
      // Machine code has no grammar to parse: read its instructions, lift
      // them to the meta language and continue like any other source.
      const lifted = inferMutability(lift(readMachine(source, from)));
      trace('lifted', lifted);
      const typed = applyRules(infer(lifted), meaning, { from });
      trace('typed', typed);
      return typed;
    }
    const sourceTree = parse(source, syntax);
    trace('parsed', sourceTree);
    const meta = applyRules(sourceTree, understanding, { from });
    trace('understood', meta);
    const typed = applyRules(infer(meta), meaning, { from });
    trace('typed', typed);
    return typed;
  }

  function fromMeta(
    meta,
    to,
    { from = to, mode = 'context-dependent', commonLibrary = false } = {}
  ) {
    if (!modes.includes(mode)) {
      throw new Error(`Unsupported mode "${mode}"`);
    }
    if (commonLibrary && machineTargetIds.includes(to)) {
      throw new Error(`Machine targets have no common library (${to})`);
    }
    const natural = isNaturalLanguage(to);
    if (natural && commonLibrary) {
      throw new Error(`Natural languages have no common library (${to})`);
    }
    if (!natural) {
      languageSyntax(to);
    }
    // Words carry no syntax of their own, so a program read from words is
    // adapted as if it had been written in the target language.
    const settings = { from: isNaturalLanguage(from) ? to : from, to, mode };
    // Custom layers are meta -> meta transformations, so they see the target
    // independent program; context rules then adapt it to the target.
    // The common library route is one more meta layer, run last.
    const allLayers = commonLibrary ? [...layers, [useCommonLibrary]] : layers;
    const transformed = allLayers.reduce(
      (current, layer) => applyRules(current, layer, settings),
      meta
    );
    trace('transformed', transformed);
    if (natural) {
      return writeNatural(transformed, to);
    }
    const adapted = applyRules(transformed, context, settings);
    trace('adapted', adapted);
    return machineTargetIds.includes(to)
      ? emitMachineCode(adapted, to)
      : emit(adapted, to);
  }

  return {
    languages: () =>
      grammarLanguageIds.map((id) => ({ id, label: languageSyntax(id).label })),
    naturalLanguages: () =>
      naturalLanguageIds().map((id) => {
        const { label, base } = naturalLanguage(id);
        return { id, label, ...(base ? { base } : {}) };
      }),
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
