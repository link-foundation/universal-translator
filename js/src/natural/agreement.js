// Grammatical cases belong to template slots, while names and constants keep
// their neutral identity. The same inflection tables serve reading and writing.
import { grammarOf } from './vocabulary.js';

const grammar = (language) => grammarOf(language.base ?? language.id);

export const slotCase = (language, template, slot) =>
  grammar(language).slotCases.get(`${template}.${slot}`);

export function inflect(word, language, grammaticalCase) {
  const rules = grammar(language);
  const form = rules.caseForms.get(grammaticalCase)?.get(word);
  if (form) {
    return form;
  }
  const endings = [...(rules.caseEndings.get(grammaticalCase) ?? [])].sort(
    ([a], [b]) => b.length - a.length
  );
  for (const [from, to] of endings) {
    if (word.endsWith(from)) {
      return word.slice(0, -from.length) + to;
    }
  }
  return word;
}

export function lemma(word, language, grammaticalCase) {
  const candidates = [
    language.true,
    language.false,
    ...Object.values(language.lexicon),
  ];
  return (
    candidates.find(
      (candidate) =>
        candidate !== word &&
        inflect(candidate, language, grammaticalCase) === word
    ) ?? word
  );
}

export function agree(tokens, language, grammaticalCase) {
  grammaticalCase ??= 'nominative';
  return tokens.map((token) =>
    token.reference && !token.grammaticalCase
      ? {
          ...token,
          grammaticalCase,
          value: String(token.value)
            .split(language.nameJoiner)
            .map((part) => inflect(part, language, grammaticalCase))
            .join(language.nameJoiner),
        }
      : token
  );
}

export function normalize(tokens, language, grammaticalCase) {
  return tokens.map((token) => {
    if (token.type !== 'word') {
      return token;
    }
    const value = token.value
      .split(language.nameJoiner)
      .map((part) => lemma(part.toLowerCase(), language, grammaticalCase))
      .join(language.nameJoiner);
    return { ...token, value, folded: value.toLowerCase() };
  });
}
