// Languages whose statements and program layout follow a grammar of their
// own. Each dialect extends the shared parser and emitter classes and keeps
// their expressions, names and token helpers.

import { ada } from './ada.js';
import { bash } from './bash.js';
import { fortran } from './fortran.js';
import { pascal } from './pascal.js';
import { vb } from './vb.js';

export const dialects = { pascal, fortran, ada, vb, bash };
