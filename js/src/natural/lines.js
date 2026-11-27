// Quoted values can span physical lines. Keep their contents and original
// first line number while grouping the surrounding text into sentences.
export function sentenceLines(source, language) {
  const lines = [];
  const [opening, closing] = language.quotes;
  const note = language.note.split('{text}')[0].trim();
  let raw = '';
  let quoted = false;
  let line = 0;
  let first = 0;
  let comment = false;
  for (let at = 0; at < source.length; ) {
    if (!raw && !quoted) {
      comment = Boolean(note) && source.slice(at).trimStart().startsWith(note);
    }
    if (!comment && source.startsWith(quoted ? closing : opening, at)) {
      const mark = quoted ? closing : opening;
      const doubled = quoted && source.startsWith(closing, at + mark.length);
      raw += source.slice(at, at + mark.length * (doubled ? 2 : 1));
      at += mark.length * (doubled ? 2 : 1);
      if (!doubled) {
        quoted = !quoted;
      }
    } else {
      const character = source[at++];
      if (character === '\n') {
        line += 1;
        if (!quoted) {
          lines.push({ raw: raw.replace(/\r$/u, ''), index: first });
          raw = '';
          first = line;
          continue;
        }
      }
      raw += character;
    }
  }
  lines.push({ raw, index: first });
  return lines;
}
