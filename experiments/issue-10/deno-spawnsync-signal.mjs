// Shows what node:child_process spawnSync reports for a child killed by a
// signal and for a child that times out, under Node, Bun and Deno.
import { spawnSync } from 'node:child_process';

const killed = spawnSync('bash', ['-c', 'kill -TERM $$'], { encoding: 'utf8' });
console.log('killed by SIGTERM:', {
  status: killed.status,
  signal: killed.signal,
});

const timedOut = spawnSync('bash', ['-c', 'sleep 5'], {
  encoding: 'utf8',
  timeout: 200,
});
console.log('timed out:', {
  status: timedOut.status,
  signal: timedOut.signal,
  error: timedOut.error?.code,
});

const exit1 = spawnSync('bash', ['-c', 'exit 1'], { encoding: 'utf8' });
console.log('exit 1:', { status: exit1.status, signal: exit1.signal });
