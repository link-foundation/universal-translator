// Comment language of a program: translate its comments to another
// natural language, with or without its code.

import { tokenize } from '../formal/lexer.js';
import { languageSyntax } from '../formal/languages.js';
import { mapComments } from '../formal/rules.js';
import {
  detectCommentLanguage,
  translateCommentText,
} from '../natural/comments.js';

// Translate the comments of a source text in place: the code, every space
// and every comment marker stay byte for byte, only the words inside the
// comments change.
export function translateComments(
  source,
  language,
  { from, to, translateComment = translateCommentText } = {}
) {
  if (!to) {
    throw new Error('Name the comment language to translate to');
  }
  const syntax = languageSyntax(language);
  const spans = tokenize(source, syntax)
    .filter((token) => token.type === 'comment' && token.span)
    .map((token) => token.span);
  from ??= detectCommentLanguage(
    spans.map(([start, end]) => source.slice(start, end))
  );
  let output = '';
  let at = 0;
  for (const [start, end] of spans) {
    output += source.slice(at, start);
    output += translateComment(source.slice(start, end), { from, to });
    at = end;
  }
  return output + source.slice(at);
}

// Translate the comments of a meta program (a layer that changes no code).
export function translateProgramComments(
  program,
  { from, to, translateComment = translateCommentText }
) {
  const texts = [];
  mapComments(program, (text) => texts.push(text) && text);
  const source = from ?? detectCommentLanguage(texts);
  return mapComments(program, (text) =>
    translateComment(text, { from: source, to })
  );
}
