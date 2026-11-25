// Prints the comment lines of the given files that the no-changelog-comments
// lint rule reports, with the matched words.
import { readFileSync } from 'node:fs';

const rule = readFileSync('eslint-rules/no-changelog-comments.js', 'utf8');
const patterns = [...rule.matchAll(/^ {4}(\/.+\/[iu]+),$/gmu)].map(
  ([, literal]) => new Function(`return ${literal}`)()
);
patterns.push(/\b(?:PR|issue|pull request)\s*#\d+/iu, /\b\d{4}-\d{2}-\d{2}\b/u);
for (const file of process.argv.slice(2)) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          console.log(`${file}:${index + 1}: ${JSON.stringify(match[0])}`);
        }
      }
    });
}
