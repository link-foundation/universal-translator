// Token-equivalent runtime layouts, including a comment with Unicode text.
export function rocqLayouts(canonical) {
  return [
    canonical,
    `\r\n${canonical}`,
    canonical.replaceAll('\n', '\r\n'),
    canonical.replaceAll('\n', '\n\n'),
    canonical.replace('From Stdlib', 'From\tStdlib'),
    canonical.replace(
      'Import ListNotations.',
      '(* number 😀 *)\nImport ListNotations.'
    ),
  ];
}
