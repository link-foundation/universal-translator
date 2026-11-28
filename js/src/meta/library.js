// The standard library of the meta language.
//
// Writing a line of text or asking for the length of an array is no part
// of the meta language itself: it is a call to a procedure that every
// target provides under its own name (console.log, print, puts, printf,
// System.out.println, len, .length, ...). The general form of such a
// statement is a call:
//
//   Evaluate { expression: Call { callee: 'print-line', library: 'standard',
//                                 arguments: [value] } }
//
// The translator works on the specialised concepts (Print, Length), whose
// fields the emitters and the context rules know; `generalize` writes a
// tree in the general form and `specialize` reads it back, so a meta
// program written with plain calls to the standard library translates to
// every language. The Rust twin is rust/src/meta/library.rs.

import { node } from './tree.js';
import { inheritOrigin } from '../translation/source-origins.js';

export const standardLibrary = 'standard';

// Procedure name -> the concept it stands for.
export const standardProcedures = {
  'print-line': {
    concept: 'Print',
    parameters: ['value'],
    fields: { newline: true },
    statement: true,
  },
  print: {
    concept: 'Print',
    parameters: ['value'],
    fields: { newline: false },
    statement: true,
  },
  length: { concept: 'Length', parameters: ['array'], returns: 'integer' },
};

const isNode = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function mapTree(value, visit) {
  if (Array.isArray(value)) {
    return value.map((item) => mapTree(item, visit));
  }
  if (!isNode(value)) {
    return value;
  }
  const mapped = Object.fromEntries(
    Object.entries(value).map(([field, item]) => [field, mapTree(item, visit)])
  );
  inheritOrigin(mapped, value);
  return value.kind ? inheritOrigin(visit(mapped), value) : mapped;
}

// The fields of a node but its kind and the given ones.
const without = (tree, fields) =>
  Object.fromEntries(
    Object.entries(tree).filter(
      ([field]) => field !== 'kind' && !fields.includes(field)
    )
  );

const libraryCall = (callee, args, rest) =>
  node('Call', { ...rest, callee, library: standardLibrary, arguments: args });

function generalNode(tree) {
  if (tree.kind === 'Print') {
    const callee = tree.newline ? 'print-line' : 'print';
    return node('Evaluate', {
      ...without(tree, ['value', 'newline']),
      expression: libraryCall(callee, [tree.value], {}),
    });
  }
  if (tree.kind === 'Length') {
    return libraryCall('length', [tree.array], without(tree, ['array']));
  }
  return tree;
}

// The procedure of the standard library a call names, when it takes the
// arguments the procedure needs.
function procedureOf(call) {
  if (call?.kind !== 'Call' || call.library !== standardLibrary) {
    return undefined;
  }
  const procedure = standardProcedures[call.callee];
  return procedure?.parameters.length === (call.arguments ?? []).length
    ? procedure
    : undefined;
}

function concept(procedure, call, rest) {
  const fields = Object.fromEntries(
    procedure.parameters.map((parameter, at) => [parameter, call.arguments[at]])
  );
  return node(procedure.concept, { ...rest, ...fields, ...procedure.fields });
}

function specialNode(tree) {
  if (tree.kind === 'Evaluate') {
    const procedure = procedureOf(tree.expression);
    if (procedure?.statement) {
      return concept(procedure, tree.expression, without(tree, ['expression']));
    }
  }
  const procedure = procedureOf(tree);
  if (procedure && !procedure.statement) {
    const rest = without(tree, ['callee', 'library', 'arguments']);
    return concept(procedure, tree, rest);
  }
  return tree;
}

// Concepts -> calls to the standard library.
export const generalize = (tree) => mapTree(tree, generalNode);

// Calls to the standard library -> concepts.
export const specialize = (tree) => mapTree(tree, specialNode);
