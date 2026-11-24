import { LinkType } from 'meta-language';
import { bindSource, sourceNetwork, targetNetwork } from './network.js';
import { metaAdapter } from './effect-links.js';
import { translateSyntax } from './program.js';
import { createSourceSyntaxCodec } from './source-document.js';
import {
  dependencies,
  languageProfiles,
  profileAdapter,
  sameEffect,
  validateEffect,
} from './profile.js';

const modes = ['context-dependent', 'literal', 'same-effect'];

function adaptComment(comment, source, target) {
  const titles = ['Hello World in ', 'Hello world in ', 'Hello, World! in '];
  for (const prefix of titles) {
    if (comment.text === prefix + source.label) {
      return { ...comment, text: prefix + target.label };
    }
  }
  const name = source.call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${name}\\b`, 'g');
  return {
    ...comment,
    text: comment.text.replaceAll(pattern, () => target.call),
  };
}

function parseDocument(source, { adapter, profile }, grammarEngine, syntax) {
  if (typeof source !== 'string' || /\p{Surrogate}/u.test(source)) {
    throw new Error('Source must be Unicode text');
  }
  const language = profile.id;
  const grammarId = language === 'sqlite' ? 'sql-sqlite' : language;
  const grammar =
    grammarEngine &&
    (profile.kind ?? 'programming') === 'programming' &&
    [grammarId, profile.label].find(
      (name) => grammarEngine.grammarProvenance(name).length
    );
  if (grammar) {
    const network = syntax.parse(grammar, source);
    const interpretation = adapter.parse(network.reconstructText());
    if (interpretation) {
      // The JavaScript engine inserts CST links in postorder.
      const root = network.links().findLast((link) => {
        const metadata = link.metadata();
        return (
          metadata.linkType === LinkType.Syntax &&
          metadata.language === grammar &&
          metadata.span !== undefined
        );
      });
      bindSource(network, language, interpretation, root.id());
    }
    return { language, network, interpretation };
  }
  const interpretation = adapter.parse(source);
  return {
    language,
    network: sourceNetwork(source, language, interpretation),
    interpretation,
  };
}

function bind(profile, projection) {
  const form = profile.forms.find(
    ({ task, name }) =>
      task === projection.effect.task && name === projection.form
  );
  return {
    ...projection,
    ...targetNetwork(profile.id, projection, dependencies(profile, form)),
    language: profile.id,
  };
}

export function createTranslator({
  profiles = languageProfiles(),
  decorateAdapter = (_, adapter) => adapter,
  layers = [],
  verify = sameEffect,
  grammarEngine,
} = {}) {
  const syntax =
    grammarEngine && createSourceSyntaxCodec(grammarEngine.LinkNetwork);
  const registry = new Map(
    profiles.map((profile) => [
      profile.id,
      {
        profile,
        adapter: decorateAdapter(
          profile.id,
          profile.kind === 'meta-language'
            ? metaAdapter
            : profileAdapter(profile)
        ),
      },
    ])
  );

  function language(identifier) {
    const entry = registry.get(identifier);
    if (!entry) {
      throw new Error(`Unsupported language "${identifier}"`);
    }
    return entry;
  }

  function parse(source, identifier) {
    return parseDocument(source, language(identifier), grammarEngine, syntax);
  }

  function transform(
    document,
    target,
    { mode = 'context-dependent', form } = {}
  ) {
    const sourceProfile = language(document.language).profile;
    const targetProfile = language(target).profile;
    if (!modes.includes(mode)) {
      throw new Error(`Unsupported mode "${mode}"`);
    }
    if (!document.interpretation) {
      throw new Error(`Unsupported program for ${document.language}`);
    }

    const original = validateEffect(document.interpretation.effect);
    const preserveForm = document.language === target && mode !== 'same-effect';
    let comments =
      mode === 'same-effect'
        ? []
        : document.interpretation.comments.map((comment) => ({ ...comment }));
    if (mode === 'context-dependent' && document.language !== target) {
      comments = comments.map((comment) =>
        adaptComment(comment, sourceProfile, targetProfile)
      );
    }
    const context = { from: document.language, to: target, mode, document };
    let transformed = {
      effect: { ...original },
      comments,
      form: form ?? (preserveForm ? document.interpretation.form : 'standard'),
    };
    for (const layer of layers) {
      for (const rule of layer) {
        transformed = rule(transformed, context);
      }
    }
    const effect = validateEffect(transformed.effect);
    if (mode === 'same-effect' && !sameEffect(original, effect)) {
      throw new Error(
        'A translation rule changed the source effect in same-effect mode'
      );
    }
    return bind(targetProfile, { ...transformed, effect });
  }

  function materialize(expression) {
    const { adapter } = language(expression.language);
    const effect = validateEffect(expression.effect);
    const code = adapter.emit({ ...expression, effect });
    const actual = adapter.parse(code)?.effect;
    if (!verify(effect, actual, expression)) {
      throw new Error(
        `Emitted program failed the effect round trip for ${expression.language}`
      );
    }
    return code;
  }

  function expression(
    languageId,
    input,
    { comments = [], form = 'standard' } = {}
  ) {
    const { profile } = language(languageId);
    const effect = validateEffect(input);
    return bind(profile, { effect, comments, form });
  }

  function translateDocument(document, to, options = {}) {
    const expression = transform(document, to, options);
    const restoreOriginal =
      document.language === to &&
      options.mode !== 'same-effect' &&
      options.form === undefined &&
      layers.length === 0;
    const code = restoreOriginal
      ? document.network.reconstructText()
      : materialize(expression);
    return { code, document, expression };
  }

  function translate(source, from, to, options = {}) {
    const document = parse(source, from);
    if (
      !document.interpretation &&
      options.mode === 'same-effect' &&
      options.form === undefined &&
      layers.length === 0 &&
      verify === sameEffect &&
      typeof grammarEngine?.translateProgram === 'function' &&
      document.network instanceof grammarEngine.LinkNetwork &&
      ((from === 'javascript' && to === 'rust') ||
        (from === 'rust' && to === 'javascript'))
    ) {
      language(to);
      return translateSyntax(grammarEngine, document.network, from, to);
    }
    return translateDocument(document, to, options).code;
  }

  return {
    parse,
    restore: (document) => document.network.reconstructText(),
    transform,
    expression,
    materialize,
    translateDetailed: (source, from, to, options) =>
      translateDocument(parse(source, from), to, options),
    translate,
    listLanguages: () =>
      profiles.map(({ id, label, kind = 'programming', forms }) => ({
        id,
        label,
        kind,
        forms: forms.map(({ task, name }) => ({ task, name })),
      })),
  };
}

let defaultTranslator;

export function translate(...parameters) {
  defaultTranslator ??= createTranslator();
  return defaultTranslator.translate(...parameters);
}
