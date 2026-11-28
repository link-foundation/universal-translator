// Languages whose statements and program layout follow a grammar of their
// own. Each dialect extends the shared parser and emitter classes and keeps
// their expressions, names and token helpers.

import { ada } from './ada.js';
import { bash } from './bash.js';
import { fortran } from './fortran.js';
import { gml } from './gml.js';
import { lean } from './lean.js';
import { matlab } from './matlab.js';
import { pascal } from './pascal.js';
import { rocq } from './rocq.js';
import { vb } from './vb.js';
import { zig } from './zig.js';
import { sql } from './sql.js';
import { objc } from './objc.js';
import { withCppLibrary } from '../cpp-library.js';

export const dialects = {
  sql,
  objc,
  cpp: { emitter: withCppLibrary },
  pascal,
  fortran,
  ada,
  vb,
  bash,
  matlab,
  zig,
  lean,
  rocq,
  gml,
};
