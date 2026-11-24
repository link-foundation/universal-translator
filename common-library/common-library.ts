// Standard-output operations of the common library for TypeScript.
import process from 'node:process';

export function printLine(text: string): void {
  process.stdout.write(`${text}\n`);
}

export function writeText(text: string): void {
  process.stdout.write(text);
}

export function writeInteger(integer: number): void {
  process.stdout.write(String(integer));
}

export function endLine(): void {
  process.stdout.write('\n');
}
