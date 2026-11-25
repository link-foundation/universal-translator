// Standard-output operations of the common library for JavaScript.
import process from 'node:process';

export function printLine(text) {
  process.stdout.write(`${text}\n`);
}

export function writeText(text) {
  process.stdout.write(text);
}

export function writeInteger(integer) {
  process.stdout.write(String(integer));
}

export function endLine() {
  process.stdout.write('\n');
}
