// GameMaker Language: a script with JavaScript's statements and functions,
// whose output is show_debug_message and whose template strings are
// $"text {value}". Arrays are spelled in array-spellings.js.

const emitter = (Base) =>
  class GameMakerEmitter extends Base {
    // show_debug_message ends every line it writes.
    print({ value, newline }) {
      if (!newline) {
        throw new Error(
          `${this.syntax.label} writes whole lines only (show_debug_message)`
        );
      }
      return this.ownSpelling(
        'print.line',
        `show_debug_message(${this.expression(value)});`
      );
    }

    // A template string has no way to write a literal brace, so text with
    // braces is joined with string() conversions.
    interpolation(parts) {
      const braced = parts.some(
        (part) => part.kind === 'Text' && /[{}]/.test(part.value)
      );
      return braced
        ? this.concatenation(parts)
        : this.embedded(parts, { prefix: '$', open: '{', close: '}' });
    }
  };

export const gml = { emitter };
