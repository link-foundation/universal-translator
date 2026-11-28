import { createSourceSyntaxCodec } from './source-document.js';

function programLanguage(language) {
  switch (language) {
    case 'javascript':
    case 'JavaScript':
      return 'JavaScript';
    case 'rust':
    case 'Rust':
      return 'Rust';
    case 'lean':
    case 'Lean':
      return 'Lean';
    case 'coq':
    case 'Coq':
    case 'rocq':
    case 'Rocq':
      return 'Rocq';
    default:
      throw new Error(`No portable program translator for ${language}`);
  }
}

function checkSyntax(network, language) {
  if (!network.verifyFullMatch().isClean()) {
    throw new Error(`${language} CST contains syntax errors`);
  }
}

export function translateSyntax(grammarEngine, syntax, language, target) {
  if (typeof grammarEngine.translateProgram !== 'function') {
    throw new Error(
      'Expected the Meta Language 1.0 portable program translator'
    );
  }
  const from = programLanguage(language);
  const to = programLanguage(target);
  checkSyntax(syntax, from);
  const result = grammarEngine.translateProgram(
    syntax.reconstructText(),
    from,
    to
  );
  if (result.diagnostic) {
    throw new Error(
      `Unsupported ${from} program: ${result.diagnostic.message}`
    );
  }
  if (!result.semantics) {
    throw new Error(`Expected a semantic translation from ${from} to ${to}`);
  }
  const codec = createSourceSyntaxCodec(grammarEngine.LinkNetwork);
  const targetSyntax = codec.parse(to, result.code);
  checkSyntax(targetSyntax, to);
  return targetSyntax.reconstructText();
}

export function createProgramTranslator(grammarEngine) {
  const codec = createSourceSyntaxCodec(grammarEngine?.LinkNetwork);
  return {
    translate({ language, source }, target) {
      const from = programLanguage(language);
      const syntax = codec.parse(from, source);
      return translateSyntax(grammarEngine, syntax, from, target);
    },
  };
}
