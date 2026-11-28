// Query clauses retain ordinary expressions and a scoped range variable.
import { name, node, text, walk, rewrite } from '../meta/tree.js';
import { rewriteFree } from '../meta/queries.js';

export const query = (source, variable, projection, condition, eager = true) =>
  node('Query', {
    source,
    variable,
    projection,
    condition: condition ?? node('Boolean', { value: true }),
    eager,
  });

// A row member is represented by an indexed record field.
function rowMembers(expression, variable) {
  return rewriteFree(expression, variable, (current) => {
    const prefix = `${variable}.`;
    return current.kind === 'Name' && current.name.startsWith(prefix)
      ? node('Index', {
          array: name(variable),
          index: text(current.name.slice(prefix.length)),
        })
      : current;
  });
}

const memberCall = (expression) => {
  if (expression.kind !== 'Call') {
    return undefined;
  }
  const { callee, arguments: args } = expression;
  const dot = callee.lastIndexOf('.');
  return dot < 0
    ? undefined
    : {
        method: callee.slice(dot + 1),
        source: dot === 0 ? args[0] : name(callee.slice(0, dot)),
        arguments: dot === 0 ? args.slice(1) : args,
      };
};

function pure(expression) {
  let result = true;
  walk(expression, (current) => {
    if (
      ![
        'Number',
        'Text',
        'Boolean',
        'Name',
        'Index',
        'Binary',
        'Unary',
        'Null',
        'SqlBinary',
        'SqlUnary',
        'SqlTruth',
      ].includes(current.kind)
    ) {
      result = false;
    }
  });
  return result;
}

// Verified value-library calls become pure operations after understanding.
export function mergePureQueries(program) {
  return rewrite(program, (current) => {
    const inner = current.source;
    if (
      current.kind !== 'Query' ||
      inner?.kind !== 'Query' ||
      !inner.eager ||
      !current.eager ||
      current.condition.kind !== 'Boolean' ||
      !current.condition.value ||
      inner.projection.kind !== 'Name' ||
      inner.projection.name !== inner.variable ||
      !pure(inner.condition) ||
      !pure(current.projection)
    ) {
      return current;
    }
    return {
      ...current,
      source: inner.source,
      variable: inner.variable,
      condition: inner.condition,
      projection: rewriteFree(current.projection, current.variable, (part) =>
        part.kind === 'Name' && part.name === current.variable
          ? name(inner.variable)
          : part
      ),
    };
  });
}

function queryCall(expression) {
  const call = memberCall(expression);
  if (!call) {
    return expression;
  }
  call.source = queryCall(call.source);
  if (
    ['ToArray', 'AsEnumerable'].includes(call.method) &&
    !call.arguments.length &&
    call.source.kind === 'Query'
  ) {
    return { ...call.source, eager: call.method === 'ToArray' };
  }
  const [lambda] = call.arguments;
  if (
    !['filter', 'map'].includes(call.method) ||
    call.arguments.length !== 1 ||
    lambda.kind !== 'Lambda' ||
    lambda.parameters.length !== 1
  ) {
    return expression;
  }
  const [variable] = lambda.parameters;
  const body = rowMembers(lambda.body, variable);
  if (call.method === 'filter') {
    return query(call.source, variable, name(variable), body);
  }
  if (
    call.source.kind !== 'Query' ||
    call.source.projection.kind !== 'Name' ||
    call.source.projection.name !== call.source.variable ||
    !pure(call.source.condition) ||
    !pure(body)
  ) {
    return query(call.source, variable, body);
  }
  const projection = rewriteFree(body, variable, (current) =>
    current.kind === 'Name' && current.name === variable
      ? name(call.source.variable)
      : current
  );
  return { ...call.source, projection };
}

function comprehension(parser, closing, eager) {
  const projection = parser.expression();
  parser.expect('for');
  const variable = parser.expectName();
  parser.expect('in');
  const source = parser.expression();
  const condition = parser.accept('if') ? parser.expression() : undefined;
  parser.expect(closing);
  return query(
    source,
    variable,
    rowMembers(projection, variable),
    condition && rowMembers(condition, variable),
    eager
  );
}

function containsFor(parser, closing) {
  let depth = 0;
  for (let offset = 1; ; offset++) {
    const token = parser.peek(offset);
    if (token.type === 'end' || (!depth && token.value === closing)) {
      return false;
    }
    if (!depth && token.value === 'for') {
      return true;
    }
    if (['(', '[', '{'].includes(token.value)) {
      depth++;
    } else if ([')', ']', '}'].includes(token.value)) {
      depth--;
    }
  }
}

export const withQueryParser = (Base) =>
  class QueryParser extends Base {
    primary() {
      if (this.syntax.id === 'csharp' && this.is('from') && this.is('in', 2)) {
        this.next();
        const variable = this.expectName();
        this.expect('in');
        const source = this.expression();
        const condition = this.accept('where') ? this.expression() : undefined;
        this.expect('select');
        const projection = this.expression();
        return query(
          source,
          variable,
          rowMembers(projection, variable),
          condition && rowMembers(condition, variable),
          false
        );
      }
      if (
        this.syntax.id === 'python' &&
        this.is('(') &&
        containsFor(this, ')')
      ) {
        this.next();
        return comprehension(this, ')', false);
      }
      return super.primary();
    }

    bracketPrimary() {
      if (this.syntax.id !== 'python' || !containsFor(this, ']')) {
        return super.bracketPrimary();
      }
      this.next();
      return comprehension(this, ']', true);
    }

    expression() {
      if (['javascript', 'typescript'].includes(this.syntax.id)) {
        if (this.peek().type === 'name' && this.is('=>', 1)) {
          const parameter = this.next().value;
          this.next();
          return node('Lambda', {
            parameters: [parameter],
            body: this.expression(),
          });
        }
        if (
          this.is('(') &&
          this.peek(1).type === 'name' &&
          this.is(')', 2) &&
          this.is('=>', 3)
        ) {
          this.next();
          const parameter = this.next().value;
          this.position += 2;
          return node('Lambda', {
            parameters: [parameter],
            body: this.expression(),
          });
        }
      }
      return super.expression();
    }

    postfix() {
      return queryCall(super.postfix());
    }
  };
