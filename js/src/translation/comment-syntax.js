// Scan one block comment. Only grammars such as Rocq interpret quoted text
// inside comments; in other grammars quote marks are ordinary comment text.
// A counter permits nesting without consuming call-stack space.
export function blockCommentEnd(
  chars,
  index,
  [open, close],
  nested = false,
  commentStrings = false
) {
  const matches = (at, mark) => {
    for (let offset = 0; offset < mark.length; offset += 1) {
      if (chars[at + offset] !== mark[offset]) {
        return false;
      }
    }
    return true;
  };
  let end = index + open.length;
  let depth = 1;
  let quoted = false;
  while (end < chars.length && depth) {
    if (commentStrings && chars[end] === '"') {
      quoted = !quoted;
      end += 1;
    } else if (quoted) {
      end += 1;
    } else if (nested && matches(end, open)) {
      depth += 1;
      end += open.length;
    } else if (matches(end, close)) {
      depth -= 1;
      end += close.length;
    } else {
      end += 1;
    }
  }
  return { end, closed: depth === 0 };
}
