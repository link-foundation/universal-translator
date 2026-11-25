// Grammar-based translation pipeline:
//
//   source text --parse--> source tree --understanding rules--> meta program
//     --type inference--> typed meta program --meaning rules-->
//     --custom meta layers--> --context rules--> --emit--> target text
//
// Every stage is a replaceable function, and every rule list is ordinary
// data, so callers can add, remove, reorder or decorate rules.

import { grammarLanguageIds, languageSyntax } from './formal/languages.js';
import { parseProgram } from './formal/parser.js';
import {
  contextRules,
  inferMutability,
  meaningRules,
  understandingRules,
} from './formal/rules.js';
import { inferTypes } from './meta/types.js';
import { emitProgram } from './formal/emitter.js';
import { emitMachine, machineTargetIds } from './formal/machine.js';
import { machineReaders } from './formal/machine-reader.js';
import { liftProgram } from './formal/lifting.js';
import { useCommonLibrary } from './formal/common-library.js';
import { splitVersion, versionsOf } from './formal/versions.js';
import {
  isNaturalLanguage,
  naturalLanguage,
  naturalLanguageIds,
} from './natural/catalog.js';
import { readNatural } from './natural/reader.js';
import { writeNatural } from './natural/writer.js';
import {
  translateComments,
  translateProgramComments,
} from './translation/comment-language.js';
import { createFragmentTranslator } from './translation/fragments.js';
import { createPartialTranslator } from './translation/partial.js';
import { createLanguageDetector } from './translation/detect.js';
import { compileCustomRules } from './translation/custom-rules.js';

const readMachine = (source, from) => machineReaders[from](source);

const modes = ['context-dependent', 'literal', 'same-effect'];

const applyRules = (tree, rules, context) =>
  rules.reduce((current, rule) => rule(current, context), tree);

// The comments can be in a natural language of their own.
function inCommentLanguage(
  program,
  { commentLanguage, commentFrom, translateComment }
) {
  return commentLanguage
    ? translateProgramComments(program, {
        from: commentFrom,
        to: commentLanguage,
        translateComment,
      })
    : program;
}

// A mode, a target and the common library must go together.
// A comment language that does not exist is a wrong option, not a part of
// the text that could not be read. A translator of one's own may know more.
function checkCommentLanguages({
  commentLanguage,
  commentFrom,
  translateComment,
}) {
  if (translateComment) {
    return;
  }
  for (const id of [commentLanguage, commentFrom]) {
    if (id) {
      naturalLanguage(id);
    }
  }
}

function checkTarget(to, mode, commonLibrary) {
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
}

// Machine code is read and written as whole programs only.
const involvesMachineCode = (from, to) =>
  machineTargetIds.includes(to) ||
  (!isNaturalLanguage(from) && languageSyntax(from).machine);

// The result of partial translation for a text translated as a whole.
function completeResult(text, source) {
  const lines = source.split('\n').filter((line) => line.trim()).length;
  return {
    text,
    complete: true,
    errors: [],
    lines,
    readLines: lines,
    coverage: 1,
  };
}

export function createGrammarTranslator(settings = {}) {
  const {
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
    rules = {},
  } = settings;
  // Rules given as data (see translation/custom-rules.js).
  const custom = compileCustomRules(rules);
  const metaLayers = [...layers, ...custom.layers];

  function toMeta(text, from) {
    const source = custom.source(text, from);
    if (isNaturalLanguage(from)) {
      // A controlled natural language is read sentence by sentence straight
      // into the meta language; it has no source details to understand.
      const read = inferMutability(
        readNatural(source, from, custom.naturalLanguage(from))
      );
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

  // Run the custom layers and the context rules for a target. A natural
  // target receives the transformed program, since it has no syntax to
  // adapt to.
  function adapt(meta, to, options = {}) {
    const {
      from = to,
      mode = 'context-dependent',
      commonLibrary = false,
    } = options;
    checkTarget(to, mode, commonLibrary);
    const natural = isNaturalLanguage(to);
    // Words carry no syntax of their own, so a program read from words is
    // adapted as if it had been written in the target language.
    // The rules adapt to the language; only writing depends on its version.
    const settings = {
      from: splitVersion(isNaturalLanguage(from) ? to : from).id,
      to: splitVersion(to).id,
      mode,
    };
    // Custom layers are meta -> meta transformations, so they see the target
    // independent program; context rules then adapt it to the target.
    // The common library route is one more meta layer, run last.
    const allLayers = commonLibrary
      ? [...metaLayers, [useCommonLibrary]]
      : metaLayers;
    const transformed = allLayers.reduce(
      (current, layer) => applyRules(current, layer, settings),
      meta
    );
    trace('transformed', transformed);
    if (natural) {
      return inCommentLanguage(transformed, options);
    }
    const adapted = applyRules(transformed, context, settings);
    trace('adapted', adapted);
    return inCommentLanguage(adapted, options);
  }

  function translate(source, from, to, options = {}) {
    const { commentLanguage, commentFrom, translateComment } = options;
    // Same code, other comment language: change only the comments, in place,
    // so every character of the code stays.
    if (
      commentLanguage &&
      from === to &&
      !isNaturalLanguage(from) &&
      !languageSyntax(from).machine
    ) {
      return translateComments(source, from, {
        from: commentFrom,
        to: commentLanguage,
        translateComment,
      });
    }
    return fromMeta(toMeta(source, from), to, { ...options, from });
  }

  // Write an adapted program in a language, a machine target or words.
  const write = (adapted, to) => custom.output(writeTarget(adapted, to), to);
  const emitText = (adapted, to) => custom.output(emit(adapted, to), to);

  function writeTarget(adapted, to) {
    if (isNaturalLanguage(to)) {
      return writeNatural(adapted, to);
    }
    return machineTargetIds.includes(to)
      ? emitMachineCode(adapted, to)
      : emit(adapted, to);
  }

  function fromMeta(meta, to, options = {}) {
    return write(adapt(meta, to, options), to);
  }

  const fragments = createFragmentTranslator({
    toMeta,
    adapt,
    write,
    emit: emitText,
  });
  const partial = createPartialTranslator(fragments);

  // Partial translation (the default of the command line, the server and
  // the web demo) keeps every part it can translate and marks the rest;
  // all-or-nothing translation throws at the first part it cannot read.
  function translatePartial(source, from, to, options = {}) {
    const whole = options.fragment ? fragments.translateFragment : translate;
    checkCommentLanguages(options);
    try {
      return completeResult(whole(source, from, to, options), source);
    } catch (error) {
      if (involvesMachineCode(from, to)) {
        throw error;
      }
      return partial.translatePartial(source, from, to, options);
    }
  }

  return {
    languages: () =>
      grammarLanguageIds.map((id) => {
        const versions = versionsOf(id);
        return {
          id,
          label: languageSyntax(id).label,
          ...(versions.length ? { versions } : {}),
        };
      }),
    naturalLanguages: () =>
      naturalLanguageIds().map((id) => {
        const { label, base } = naturalLanguage(id);
        return { id, label, ...(base ? { base } : {}) };
      }),
    toMeta,
    fromMeta,
    translate,
    translatePartial,
    parsePartial: partial.parsePartial,
    // The same translator with other data rules.
    withRules: (other) =>
      createGrammarTranslator({ ...settings, rules: other }),
    detectLanguage: createLanguageDetector({
      parseFragment: fragments.parseFragment,
      parsePartial: partial.parsePartial,
    }),
    parseFragment: fragments.parseFragment,
    translateFragment: fragments.translateFragment,
  };
}

let defaultTranslator;

// Translate with the default rule layers.
export function translate(source, from, to, options) {
  defaultTranslator ??= createGrammarTranslator();
  return defaultTranslator.translate(source, from, to, options);
}

// Read a fragment (a whole program, function definitions or statements)
// with the default rule layers.
export function parseFragment(source, from) {
  defaultTranslator ??= createGrammarTranslator();
  return defaultTranslator.parseFragment(source, from);
}

// Translate what can be translated and mark the rest, with the default rule
// layers.
export function translatePartial(source, from, to, options) {
  defaultTranslator ??= createGrammarTranslator();
  return defaultTranslator.translatePartial(source, from, to, options);
}

// Read what can be read, with the default rule layers.
export function parsePartial(source, from) {
  defaultTranslator ??= createGrammarTranslator();
  return defaultTranslator.parsePartial(source, from);
}

// Rank the languages a text may be written in, likeliest first.
export function detectLanguage(source, options) {
  defaultTranslator ??= createGrammarTranslator();
  return defaultTranslator.detectLanguage(source, options);
}

// Translate a fragment with the default rule layers.
export function translateFragment(source, from, to, options) {
  defaultTranslator ??= createGrammarTranslator();
  return defaultTranslator.translateFragment(source, from, to, options);
}
