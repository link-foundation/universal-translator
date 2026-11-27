import { LinkType } from '../../../vendor/meta-language-grammar/src/primitives.js';
import { namedLinks, parseLinks, reference } from '../meta/links.js';

export function splitSourceLines(source) {
  return source.match(/[^\n]*\n|[^\n]+/g) ?? [];
}

function isUnicodeText(value) {
  return typeof value === 'string' && !/\p{Surrogate}/u.test(value);
}

function quoteReference(text) {
  let delimiter;
  for (const quote of ["'", '"', '`']) {
    if (text.startsWith(quote)) {
      continue;
    }
    let longest = 0;
    let run = 0;
    for (const character of text) {
      run = character === quote ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    // Odd delimiter lengths cannot be confused with an empty reference.
    const length = longest + 1 + (longest % 2);
    if (!delimiter || length < delimiter.length) {
      delimiter = quote.repeat(length);
    }
    if (length === 1) {
      break;
    }
  }
  return delimiter + text + delimiter;
}

export function writeSourceDocument(language, source) {
  if (!language || !isUnicodeText(language) || !isUnicodeText(source)) {
    throw new Error('Expected a language name and Unicode source text');
  }
  return `source-document:\n  language: ${quoteReference(language)}\n  source: ${quoteReference(source)}`;
}

export function readSourceDocument(notation) {
  if (!isUnicodeText(notation)) {
    throw new Error('Expected Links Notation as Unicode text');
  }
  const [document, extra] = namedLinks(parseLinks(notation), 'source-document');
  if (!document || !document.length || extra) {
    throw new Error('Expected one Links Notation source document');
  }
  const [{ id, values }, ...body] = document;
  const language = reference(values);
  if (id !== 'language' || !language) {
    throw new Error('Expected a source language');
  }
  if (body.length === 1 && body[0].id === 'source') {
    return { language, source: reference(body[0].values) };
  }

  // Earlier documents stored a separate reference for each source line.
  const lines = namedLinks(body, 'line').map(reference);
  for (const [index, line] of lines.entries()) {
    const newline = line.indexOf('\n');
    if (
      !line ||
      (newline !== -1 && newline !== line.length - 1) ||
      (newline === -1 && index !== lines.length - 1)
    ) {
      throw new Error('Invalid source line boundaries');
    }
  }
  return { language, source: lines.join('') };
}

function syntaxLanguage(network) {
  const grammar = network.parseGrammars()[0];
  if (!grammar) {
    throw new Error('Expected parser provenance in CST');
  }
  const { language } = grammar;
  const hasSyntax = network.links().some((link) => {
    const metadata = link.metadata();
    return (
      metadata.linkType === LinkType.Syntax &&
      metadata.language === language &&
      metadata.span !== undefined
    );
  });
  if (!hasSyntax) {
    throw new Error(`Expected a grammar tree for ${language}`);
  }
  return language;
}

export function createSourceSyntaxCodec(LinkNetwork) {
  if (typeof LinkNetwork?.prototype?.parseGrammars !== 'function') {
    throw new Error('Expected Meta Language 1.0 with grammar provenance');
  }
  function parse(language, source) {
    if (!language || !isUnicodeText(language) || !isUnicodeText(source)) {
      throw new Error('Expected a language name and Unicode source text');
    }
    const network = LinkNetwork.parse(source, language);
    if (syntaxLanguage(network) !== language) {
      throw new Error(`Expected a grammar tree for ${language}`);
    }
    if (network.reconstructText() !== source) {
      throw new Error(`${language} grammar did not preserve source bytes`);
    }
    return network;
  }
  return {
    parse,
    write: (language, source) => parse(language, source).toLino(),
    read(notation) {
      if (!isUnicodeText(notation)) {
        throw new Error('Expected Links Notation as Unicode text');
      }
      const network = LinkNetwork.fromLino(notation);
      return {
        language: syntaxLanguage(network),
        source: network.reconstructText(),
      };
    },
  };
}
