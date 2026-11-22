import { createRequire } from 'node:module';

// Use the JSON loader provided by Node 20.0.
const require = createRequire(import.meta.url);
export default () =>
  ['systems', 'managed', 'scripts', 'machine'].flatMap((name) =>
    require(`./${name}.json`)
  );
