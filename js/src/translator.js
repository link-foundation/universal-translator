// Grammar-based translation pipeline:
//
//   source text --parse--> source tree --understanding rules--> meta program
//     --type inference--> typed meta program --meaning rules-->
//     --custom meta layers--> --context rules--> --emit--> target text
//
// Every stage is a replaceable function that can also be decorated (see
// translation/decorators.js), and every rule list is ordinary data, so
// callers can add, remove, reorder or decorate rules.

import {
  grammarLanguageIds,
  queryLanguageIds,
  languageSyntax,
} from './formal/languages.js';
import { parseProgram } from './formal/parser.js';
import {
  contextRules,
  inferMutability,
  meaningRules,
  understandingRules,
} from './formal/rules.js';
import { inferTypes } from './meta/types.js';
import {
  lowerIntegerArithmetic,
  normalizeMachineIntegerZero,
} from './meta/integer-arithmetic.js';
import {
  lowerEvaluationOrder,
  raiseEvaluationOrder,
} from './meta/evaluation-order.js';
import { emitProgram } from './formal/emitter.js';
import { requireRecordSupport } from './formal/record-model.js';
import {
  emitMachine,
  machineTargetIds,
  machineTargets,
} from './formal/machine.js';
import { machineReaders } from './formal/machine-reader.js';
import { readJvmClass } from './formal/machine-reader-jvm-class.js';
import { readWasmBinary } from './formal/machine-reader-wasm-binary.js';
import { liftProgram } from './formal/lifting.js';
import { raiseForEach } from './meta/for-each.js';
import { useCommonLibrary } from './formal/common-library.js';
import { adaptCppProgram } from './formal/cpp-library.js';
import { splitVersion, versionsOf } from './formal/versions.js';
import {
  isNaturalLanguage,
  naturalLanguage,
  naturalLanguageIds,
} from './natural/catalog.js';
import { readNatural } from './natural/reader.js';
import { writeNatural } from './natural/writer.js';
import { translateCommentText } from './natural/comments.js';
import {
  translateComments,
  translateProgramComments,
} from './translation/comment-language.js';
import {
  translateIdentifiers,
  translateProgramIdentifiers,
} from './translation/identifier-language.js';
import { declaredNames } from './formal/names.js';
import { createFragmentTranslator } from './translation/fragments.js';
import { createPartialTranslator } from './translation/partial.js';
import { createRegionMapper } from './translation/region-map.js';
import { createCandidateTranslator } from './translation/candidates.js';
import { createLanguageDetector } from './translation/detect.js';
import { compileCustomRules } from './translation/custom-rules.js';
import { transferLayout } from './translation/layout.js';
import { applyStyle, checkStyle, hasStyle } from './translation/style.js';
import { specialize } from './meta/library.js';
import {
  captureEmission,
  emittedMap,
  mergeLineMaps,
} from './translation/emission-map.js';
import { markImprecision } from './meta/imprecision.js';
import { sourceTree as concreteSourceTree } from './translation/source-syntax.js';
import { unnest } from './translation/nesting.js';
import { decorateStages, mergeDecorators } from './translation/decorators.js';

const readMachine = (source, from) => machineReaders[from](source);

// The replaceable stages, in the form decorators wrap.
const defaultStages = {
  parse: parseProgram,
  infer: inferTypes,
  lift: liftProgram,
  readMachine,
  readNatural,
  emit: emitProgram,
  emitMachineCode: emitMachine,
  writeNatural,
};

// The stages a translator runs: the ones given in the settings or the
// defaults, wrapped by the decorators of the settings.
const buildStages = (settings) =>
  decorateStages(
    Object.fromEntries(
      Object.entries(defaultStages).map(([stage, standard]) => [
        stage,
        settings[stage] ?? standard,
      ])
    ),
    settings.decorate
  );

// Keep layout rereads private while preserving the public stage trace.
function scopedTrace(reportTrace) {
  let tracing = true;
  const trace = (...args) => {
    if (tracing) {
      reportTrace(...args);
    }
  };
  const withoutTrace = (read) => {
    const previous = tracing;
    tracing = false;
    try {
      return read();
    } finally {
      tracing = previous;
    }
  };
  return { trace, withoutTrace };
}

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

// The declared names can be words of a natural language of their own too.
function inIdentifierLanguage(
  program,
  { identifierLanguage, identifierFrom, translateComment }
) {
  return identifierLanguage
    ? translateProgramIdentifiers(program, {
        from: identifierFrom,
        to: identifierLanguage,
        translateComment,
      })
    : program;
}

// A mode, a target and the common library must go together.
// A comment or identifier language that does not exist is a wrong option,
// not a part of the text that could not be read. A translator of one's own
// may know more.
function checkCommentLanguages({
  commentLanguage,
  commentFrom,
  identifierLanguage,
  identifierFrom,
  translateComment,
}) {
  if (translateComment) {
    return;
  }
  for (const id of [
    commentLanguage,
    commentFrom,
    identifierLanguage,
    identifierFrom,
  ]) {
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
  if (commonLibrary && queryLanguageIds.includes(to)) {
    throw new Error(`Query languages have no common library (${to})`);
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
    prose: [],
  };
}

// Two programming languages share a layout: the target keeps the spaces and
// the blank lines around the code of the source (layout 'source', the
// default) or is written as its emitter lays it out (layout 'target'). Both
// map the lines of the target to the lines of the source.
const layouts = ['source', 'target'];

const programming = (id) =>
  !isNaturalLanguage(id) && !languageSyntax(id).machine;

// All-or-nothing translation writes the target in the style asked for.
function styledText(translateWhole) {
  return (source, from, to, options = {}) => {
    checkStyle(options);
    const text = translateWhole(source, from, to, options);
    return hasStyle(options) && programming(to)
      ? applyStyle(text, languageSyntax(to), options).text
      : text;
  };
}

function withLayout(result, source, from, to, options) {
  if (!programming(from) || !programming(to)) {
    return result;
  }
  const { text, lines } = transferLayout(
    source,
    result.text,
    languageSyntax(from),
    languageSyntax(to),
    {
      respace:
        options.layout !== 'target' &&
        !hasStyle(options) &&
        !(
          from === to &&
          options.commentLanguage &&
          !options.identifierLanguage
        ),
      language: splitVersion(to).id,
    }
  );
  if (!hasStyle(options)) {
    return { ...result, text, lineMap: lines };
  }
  // A style lays the target out anew: each line of the map (from 0) moves
  // to the line it starts at (from 1).
  const styled = applyStyle(text, languageSyntax(to), options);
  return {
    ...result,
    text: styled.text,
    lineMap: lines.map(([line, target]) => [line, styled.starts[target] - 1]),
  };
}

// Between two natural languages a sentence no controlled template reads is
// prose, translated freely with the vocabulary (or the caller's
// translateComment).
function translateProse(text, from, to, options = {}) {
  if (!isNaturalLanguage(from) || !isNaturalLanguage(to)) {
    return undefined;
  }
  const translateText = options.translateComment ?? translateCommentText;
  return translateText(text, { from, to });
}

// Same code, other comment or identifier language: change only the
// comments and the declared names, in place, so every other character of
// the code stays (`toMeta` reads the names it declares). Undefined when
// only the meta program can rename.
function inPlace(source, language, options, toMeta) {
  const { commentLanguage, commentFrom, translateComment } = options;
  const { identifierLanguage, identifierFrom } = options;
  let text = source;
  if (identifierLanguage) {
    const declared = declaredNames(toMeta(source, language));
    text = translateIdentifiers(text, language, declared, {
      from: identifierFrom,
      to: identifierLanguage,
      translateComment,
    });
    if (text === undefined) {
      return undefined;
    }
  }
  return commentLanguage
    ? translateComments(text, language, {
        from: commentFrom,
        to: commentLanguage,
        translateComment,
      })
    : text;
}

function canTranslateInPlace(
  from,
  to,
  { commentLanguage, identifierLanguage }
) {
  return (
    from === to &&
    ((commentLanguage && !identifierLanguage) ||
      (identifierLanguage &&
        !isNaturalLanguage(from) &&
        !languageSyntax(from).machine))
  );
}

// Partial translation (the default of the command line, the server and the
// web demo) keeps every part it can translate and marks the rest;
// all-or-nothing translation throws at the first part it cannot read.
function partialTranslator(translate, fragments, partial, withoutTrace) {
  const mapRegions = createRegionMapper({ ...fragments, ...partial });
  function readAll(source, from, to, options) {
    const whole = options.fragment ? fragments.translateFragment : translate;
    try {
      return completeResult(whole(source, from, to, options), source);
    } catch (error) {
      if (involvesMachineCode(from, to)) {
        throw error;
      }
      return partial.translatePartial(source, from, to, options);
    }
  }
  return (source, from, to, options = {}) => {
    checkCommentLanguages(options);
    if (options.layout !== undefined && !layouts.includes(options.layout)) {
      throw new Error(`Unsupported layout "${options.layout}"`);
    }
    checkStyle(options);
    const { result, emissions } = captureEmission(() =>
      readAll(source, from, to, options)
    );
    const placed = withLayout(result, source, from, to, options);
    const syntax = isNaturalLanguage(to) ? {} : languageSyntax(to);
    const semantic = emittedMap(
      emissions,
      source,
      placed.text,
      splitVersion(to).id,
      syntax
    );
    const lineMap = mergeLineMaps(semantic, placed.lineMap ?? []);
    return {
      ...placed,
      lineMap,
      regionMap: withoutTrace(() =>
        mapRegions(source, placed.text, from, to, lineMap)
      ),
    };
  };
}

// A meta program in its special form, without the readings of its nested
// texts, with the empty lists of a program that a hand-written one may
// leave out.
function completed(meta) {
  const special = specialize(unnest(meta));
  return special.kind === 'Program'
    ? {
        ...special,
        comments: special.comments ?? [],
        imports: special.imports ?? [],
        functions: special.functions ?? [],
      }
    : special;
}

// The grammar languages with their versions, then the machine targets.
function listLanguages() {
  return [
    ...[...grammarLanguageIds, ...queryLanguageIds].map((id) => {
      const versions = versionsOf(id);
      return {
        id,
        label: languageSyntax(id).label,
        ...(queryLanguageIds.includes(id) ? { query: true } : {}),
        ...(versions.length ? { versions } : {}),
      };
    }),
    ...machineTargetIds.map((id) => ({
      id,
      label: machineTargets[id].label,
      machine: true,
    })),
  ];
}

const listNaturalLanguages = () =>
  naturalLanguageIds().map((id) => {
    const { label, base } = naturalLanguage(id);
    return { id, label, ...(base ? { base } : {}) };
  });

function createMachineTyper({ lift, infer }, meaning, trace) {
  return (machine, from, source) => {
    const lifted = inferMutability(raiseForEach(lift(machine)));
    if (source !== undefined) {
      trace('parsed', concreteSourceTree(source, from, lifted));
    }
    trace('lifted', lifted);
    const typed = applyRules(infer(lifted), meaning, { from });
    trace('typed', typed);
    return typed;
  };
}

function createBinaryTranslator(toMeta, from, writeMeta) {
  const styled = styledText((bytes, from, to, options) => {
    const meta = toMeta(bytes);
    const id = splitVersion(to).id;
    const adjusted = ['javascript', 'typescript'].includes(id)
      ? normalizeMachineIntegerZero(meta)
      : meta;
    return writeMeta(adjusted, to, { ...options, from });
  });
  return (bytes, to, options) => styled(bytes, from, to, options);
}

function binaryMethods(typeMachine, writeMeta) {
  const toMetaWasm = (bytes) =>
    markImprecision(typeMachine(readWasmBinary(bytes), 'wat'));
  const toMetaJvmClass = (bytes) =>
    markImprecision(typeMachine(readJvmClass(bytes), 'jvm'));
  return {
    toMetaWasm,
    toMetaJvmClass,
    translateWasm: createBinaryTranslator(toMetaWasm, 'wat', writeMeta),
    translateJvmClass: createBinaryTranslator(toMetaJvmClass, 'jvm', writeMeta),
  };
}

export function createGrammarTranslator(settings = {}) {
  const {
    understanding = understandingRules,
    meaning = meaningRules,
    context = contextRules,
    layers = [],
    trace: reportTrace = () => {},
    rules = {},
  } = settings;
  const { trace, withoutTrace } = scopedTrace(reportTrace);
  const stages = buildStages(settings);
  const { parse, infer, emit, emitMachineCode } = stages;
  const typeMachine = createMachineTyper(stages, meaning, trace);
  // Rules given as data (see translation/custom-rules.js).
  const custom = compileCustomRules(rules);
  const metaLayers = [...layers, ...custom.layers];

  // The typed meta program of a text, with what its reading lost marked.
  const toMeta = (text, from) => markImprecision(readMeta(text, from));

  function readMeta(text, from) {
    const source = custom.source(text, from);
    if (isNaturalLanguage(from)) {
      // Sentence reading supplies semantic nodes alongside the concrete record.
      const read = inferMutability(
        stages.readNatural(source, from, custom.naturalLanguage(from))
      );
      trace('parsed', concreteSourceTree(source, from, read));
      trace('read', read);
      const typed = applyRules(infer(read), meaning, {});
      trace('typed', typed);
      return typed;
    }
    const syntax = languageSyntax(from);
    if (syntax.machine) {
      // Instruction reading and lifting retain their concrete source record.
      return typeMachine(stages.readMachine(source, from), from, source);
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
      // The target with its version, for the rules that depend on it.
      target: to,
      mode,
    };
    // Custom layers are meta -> meta transformations, so they see the target
    // independent program; context rules then adapt it to the target.
    // The common library route is one more meta layer, run last.
    const allLayers = commonLibrary
      ? [...metaLayers, [useCommonLibrary]]
      : metaLayers;
    const transformed = inIdentifierLanguage(
      allLayers.reduce(
        (current, layer) => applyRules(current, layer, settings),
        meta
      ),
      options
    );
    trace('transformed', transformed);
    const ordered = ['python', 'javascript', 'typescript'].includes(settings.to)
      ? raiseEvaluationOrder(transformed)
      : transformed;
    const rounded = lowerIntegerArithmetic(ordered, settings);
    if (natural) {
      return inCommentLanguage(rounded, options);
    }
    const sequenced = lowerEvaluationOrder(rounded, settings);
    const adapted = adaptCppProgram(
      applyRules(sequenced, context, settings),
      settings
    );
    trace('adapted', adapted);
    return inCommentLanguage(adapted, options);
  }

  function translate(source, from, to, options = {}) {
    const kept = canTranslateInPlace(from, to, options)
      ? inPlace(source, from, options, toMeta)
      : undefined;
    return kept ?? writeMeta(toMeta(source, from), to, { ...options, from });
  }

  // Write an adapted program in a language, a machine target or words.
  const write = (adapted, to) => custom.output(writeTarget(adapted, to), to);
  const emitText = (adapted, to) => custom.output(emit(adapted, to), to);

  function writeTarget(adapted, to) {
    const natural = isNaturalLanguage(to);
    const machine = machineTargetIds.includes(to);
    requireRecordSupport(adapted, to, !natural && !machine);
    if (natural) {
      return stages.writeNatural(adapted, to);
    }
    return machine ? emitMachineCode(adapted, to) : emit(adapted, to);
  }

  function writeMeta(meta, to, options = {}) {
    return write(adapt(meta, to, options), to);
  }

  // A meta program given from outside may be written in its general form
  // (calls to the standard library) and leave out empty lists and types.
  function fromMeta(meta, to, options = {}) {
    const typed = applyRules(infer(completed(meta)), meaning, {
      from: options.from ?? to,
    });
    return writeMeta(typed, to, options);
  }

  const fragments = createFragmentTranslator({
    toMeta,
    adapt,
    write,
    emit: emitText,
  });
  const partial = createPartialTranslator({ ...fragments, translateProse });

  const translatePartial = partialTranslator(
    translate,
    fragments,
    partial,
    withoutTrace
  );
  const translateCandidates = createCandidateTranslator(translatePartial);

  return {
    languages: listLanguages,
    naturalLanguages: listNaturalLanguages,
    toMeta,
    ...binaryMethods(typeMachine, writeMeta),
    fromMeta,
    translate: styledText(translate),
    translatePartial,
    translateCandidates,
    parsePartial: partial.parsePartial,
    // The same translator with other data rules.
    withRules: (other) =>
      createGrammarTranslator({ ...settings, rules: other }),
    // The same translator with decorators around some stages: one stage and
    // its decorator, or an object of stages and decorators (or lists of
    // them). They wrap the decorators the translator already has.
    decorate: (stage, decorator) =>
      createGrammarTranslator({
        ...settings,
        decorate: mergeDecorators(
          settings.decorate,
          typeof stage === 'string' ? { [stage]: decorator } : stage
        ),
      }),
    detectLanguage: createLanguageDetector({
      parseFragment: fragments.parseFragment,
      parsePartial: partial.parsePartial,
    }),
    parseFragment: fragments.parseFragment,
    translateFragment: styledText(fragments.translateFragment),
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

// The candidate translations of a text, the most probable first, with the
// default rule layers.
export function translateCandidates(source, from, to, options) {
  defaultTranslator ??= createGrammarTranslator();
  return defaultTranslator.translateCandidates(source, from, to, options);
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
