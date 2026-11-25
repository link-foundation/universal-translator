// The command line in shell pipes (found while checking earlier issues in
// issue 12): standard input that is not ready yet (EAGAIN) is waited for,
// and a reader that closes the pipe early does not crash the translator.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'test-anywhere';
import { readStandardInput } from '../../bin/universal-translator.js';
import { itUnless, noPosixShell, sandboxed } from './helpers/skip.js';

const cli = fileURLToPath(
  new URL('../../bin/universal-translator.js', import.meta.url)
);

// The shell runs the command line with the runtime of this test; Bun and Deno
// run the file in their own runtimes, which take other arguments.
const notNode =
  globalThis.Bun || globalThis.Deno
    ? 'the pipeline runs the command line with Node'
    : null;
const itInShell = itUnless(sandboxed, noPosixShell, notNode);

const again = () =>
  Object.assign(new Error('EAGAIN: resource temporarily unavailable, read'), {
    code: 'EAGAIN',
  });

// A read that answers with the given steps: an error to throw or a text.
function readsOf(steps) {
  return (fd, buffer) => {
    const step = steps.shift();
    if (step instanceof Error) {
      throw step;
    }
    return buffer.write(step ?? '');
  };
}

// Runs a shell pipeline that feeds the command line through a real pipe
// (Node's own child streams are sockets, which never answer EAGAIN).
function shell(pipeline) {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', pipeline], {
      env: { ...process.env, NODE: process.execPath, CLI: cli },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

describe('the command line in pipes', () => {
  it('waits for standard input that is not ready yet', () => {
    const read = readsOf([again(), 'print(', again(), again(), '1)\n']);
    expect(readStandardInput(read).toString()).toBe('print(1)\n');
  });

  it('stops at the end of standard input', () => {
    const end = Object.assign(new Error('end of file'), { code: 'EOF' });
    expect(readStandardInput(readsOf(['x = 1\n', end])).toString()).toBe(
      'x = 1\n'
    );
  });

  it('passes other read errors on', () => {
    const denied = Object.assign(new Error('denied'), { code: 'EACCES' });
    expect(() => readStandardInput(readsOf([denied]))).toThrow('denied');
  });

  itInShell('translates text that arrives later through a pipe', async () => {
    const result = await shell(
      `(sleep 1; echo 'print(1)') | "$NODE" "$CLI" translate python javascript -`
    );
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe('console.log(1);\n');
    expect(result.status).toBe(0);
  });

  itInShell('stops quietly when the reader closes the pipe', async () => {
    // "true" exits before the translator writes, so the write meets a
    // closed pipe (EPIPE).
    const result = await shell(
      `echo 'print(1)' | "$NODE" "$CLI" translate python javascript - | true`
    );
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
