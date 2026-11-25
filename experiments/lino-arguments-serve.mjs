// Read the serve configuration with lino-arguments: CLI > env > .lenv > default.
import { makeConfig } from 'lino-arguments';

const read = (args, env) =>
  makeConfig({
    argv: ['node', 'universal-translator', ...args],
    env: { values: env, autoMap: true },
    cwd: '/nonexistent',
    yargs: ({ yargs }) =>
      yargs
        .exitProcess(false)
        .help(false)
        .version(false)
        .strict()
        .option('port', { type: 'number', default: 8080 })
        .option('host', { type: 'string', default: '0.0.0.0' }),
  });
console.log(read([], {}));
console.log(read([], { PORT: '9000' }));
console.log(read(['--port', '7000'], { PORT: '9000' }));
try {
  console.log(read(['--port', 'x'], {}));
} catch (e) {
  console.log('ERR', e.message);
}
try {
  console.log(read(['--bogus'], {}));
} catch (e) {
  console.log('ERR', e.message);
}
