// Identifier language of a program: translate the names it declares
// (functions, parameters, variables) to another natural language, with or
// without its code. Names the program does not declare (library procedures
// such as print) never change.
//
// A meta program stores each declared name as neutral words joined by "-"
// ("sum-of-squares"), so a name is translated as the phrase its words make
// ("sum of squares" -> "сумма квадратов") and spelled again in the naming
// convention of the target ("суммаКвадратов", "сумма_квадратов").

import { tokenize } from '../formal/lexer.js';
import { languageSyntax } from '../formal/languages.js';
import {
  asciiName,
  avoidReserved,
  declaredNames,
  nameWords,
  renameDeclared,
  spellName,
} from '../formal/names.js';
import {
  detectCommentLanguage,
  translateCommentText,
} from '../natural/comments.js';

const phraseOf = (neutral) => neutral.split('-').join(' ');
const nameStart = /^[\p{Alphabetic}_]/u;

// The neutral name a translated phrase makes: its words, lower case, without
// punctuation. A phrase that makes no name gives undefined.
function neutralOf(phrase) {
  const words = nameWords(phrase.replace(/[^\p{Alphabetic}\p{N}_\s]+/gu, ' '));
  const name = words.join('-');
  return nameStart.test(name) ? name : undefined;
}

// Neutral name -> its translation, for the names that change. Two names never
// become one: a translation already taken keeps the name as it was (the names
// are taken in sorted order, so the Rust twin keeps the same ones).
export function identifierDictionary(
  names,
  { from, to, translateComment = translateCommentText }
) {
  const list = [...names].sort();
  const source = from ?? detectCommentLanguage(list.map(phraseOf));
  const taken = new Set(list);
  const dictionary = new Map();
  for (const name of list) {
    const translated = neutralOf(
      translateComment(phraseOf(name), { from: source, to })
    );
    if (translated && translated !== name && !taken.has(translated)) {
      taken.add(translated);
      dictionary.set(name, translated);
    }
  }
  return dictionary;
}

// Translate the declared names of a meta program (before the context rules
// spell them for the target).
export function translateProgramIdentifiers(program, options) {
  const dictionary = identifierDictionary(declaredNames(program), options);
  return dictionary.size
    ? renameDeclared(program, (name) => dictionary.get(name) ?? name)
    : program;
}

// The naming convention a name is written in, read from the name itself.
function conventionOf(identifier) {
  const words = identifier.split('_').filter(Boolean);
  const capital = (word) => /^\p{Lu}/u.test(word);
  if (words.length > 1) {
    return words.every(capital) ? 'ada' : 'snake';
  }
  return capital(identifier) ? 'pascal' : 'camel';
}

// The same name in the same convention, with other words.
function respell(identifier, translated, language, syntax) {
  const upper =
    identifier === identifier.toUpperCase() && /\p{Lu}/u.test(identifier);
  const spelled = spellName(translated, conventionOf(identifier));
  const cased = upper ? spelled.toUpperCase() : spelled;
  return avoidReserved(asciiName(cased, language, syntax), language);
}

const interpolating = (token) =>
  token.type === 'text' && token.style && token.style !== 'plain';

// Translate the declared names of a source text in place: every other
// character stays. `declared` are the neutral names the program declares
// (its meta program knows them). Returns undefined when a name also appears
// inside an interpolated text, which only the meta program can rename.
export function translateIdentifiers(source, language, declared, options) {
  const syntax = languageSyntax(language);
  const dictionary = identifierDictionary(declared, options);
  const tokens = tokenize(source, syntax);
  const renamed = (token) =>
    token.type === 'name' &&
    token.span &&
    dictionary.has(nameWords(token.value).join('-'));
  const values = [...dictionary.keys()].map(phraseOf);
  const quoted = tokens.some(
    (token) =>
      interpolating(token) &&
      values.some((phrase) => nameWords(token.value).join(' ').includes(phrase))
  );
  if (quoted) {
    return undefined;
  }
  let output = '';
  let at = 0;
  for (const token of tokens.filter(renamed)) {
    const [start, end] = token.span;
    const translated = dictionary.get(nameWords(token.value).join('-'));
    output += source.slice(at, start);
    output += respell(token.value, translated, language, syntax);
    at = end;
  }
  return output + source.slice(at);
}
