import { Link, formatBinaryDocument } from 'links-notation';
import { namedLinks, parseLinks, reference } from './links.js';

export function splitSourceLines(source) {
  return source.match(/[^\n]*\n|[^\n]+/g) ?? [];
}

function isUnicodeText(value) {
  return typeof value === 'string' && !/\p{Surrogate}/u.test(value);
}

export function writeSourceDocument(language, source) {
  if (!language || !isUnicodeText(language) || !isUnicodeText(source)) {
    throw new Error('Expected a language name and Unicode source text');
  }
  return formatBinaryDocument([
    new Link('source-document', [
      new Link('language', [new Link(language)]),
      ...splitSourceLines(source).map(
        (line) => new Link('line', [new Link(line)])
      ),
    ]),
  ]);
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
