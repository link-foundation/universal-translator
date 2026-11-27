// Expected bytes include whitespace emitted outside PHP tags.
export const phpOutputCases = [
  ['<?phpecho "ok";', '<?phpecho "ok";'],
  ['<?php\f' + 'echo "ok";', '<?php\f' + 'echo "ok";'],
  ['<?php\u00a0' + 'echo "ok";', '<?php\u00a0' + 'echo "ok";'],
  ['\r\n<?php\r\necho "ok\\n";\r\n', '\r\nok\n'],
  [' \t<?PHP echo "ok"; ?>\r\n\r\n', ' \tok\r\n'],
  ['<?php echo "ok"; ?> \n', 'ok \n'],
  ['<?php echo "ok"; ?>\n', 'ok'],
  ['<?php echo "ok"; ?>\r', 'ok'],
  ['\r\n<?php\r\n// number\r\necho "😀";\r\n?>\r\n\t', '\r\n😀\t'],
];
