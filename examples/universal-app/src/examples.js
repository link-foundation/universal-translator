// Random examples for the buttons on top: a random algorithm of the
// Rosetta Code tasks in examples/programs, cut to the kind of fragment the
// button names (a program, a function or a statement) and written in a
// random language; the target is another random language that can say it.

export const exampleKinds = ['Program', 'Function', 'Statement'];

const pick = (items, random) => items[Math.floor(random() * items.length)];

const isTrivia = (node) => node.kind === 'Comment' || node.kind === 'Blank';

// A function of the program called from a statement cut out of it keeps
// its JavaScript spelling: move-disks -> moveDisks.
const camel = (name) =>
  name.replace(/-(\p{L})/gu, (_, letter) => letter.toUpperCase());

function spellCalls(node, own) {
  if (Array.isArray(node)) {
    return node.map((item) => spellCalls(item, own));
  }
  if (!node || typeof node !== 'object') {
    return node;
  }
  const spelled = Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, spellCalls(value, own)])
  );
  return node.kind === 'Call' && own.has(node.callee)
    ? { ...spelled, callee: camel(node.callee) }
    : spelled;
}

// The JavaScript text of one fragment of a program, or undefined when the
// program has no such fragment.
function cut(translator, task, source, kind, random) {
  if (kind === 'Program') {
    return source;
  }
  const meta = translator.toMeta(source, 'javascript');
  const own = new Set(meta.functions.map((it) => it.name));
  const empty = { kind: 'Block', statements: [] };
  if (kind === 'Function') {
    if (meta.functions.length === 0) {
      return undefined;
    }
    const chosen = { ...pick(meta.functions, random), comments: [] };
    return translator.fromMeta(
      {
        ...meta,
        comments: [],
        functions: [spellCalls(chosen, own)],
        main: empty,
      },
      'javascript'
    );
  }
  const statements = meta.main.statements.filter(
    (it) => !isTrivia(it) && it.kind !== 'Declaration'
  );
  if (statements.length === 0) {
    return undefined;
  }
  return translator.fromMeta(
    {
      ...meta,
      comments: [],
      functions: [],
      main: {
        kind: 'Block',
        statements: [spellCalls(pick(statements, random), own)],
      },
    },
    'javascript'
  );
}

// { task, kind, from, to, source } or undefined after `attempts` tries.
// `programs` maps task names to JavaScript sources; `languages` lists the
// ids to choose from.
export function randomExample(
  translator,
  { programs, languages, kind, random = Math.random, attempts = 40 }
) {
  const tasks = Object.keys(programs);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const task = pick(tasks, random);
    const from = pick(languages, random);
    const to = pick(
      languages.filter((id) => id !== from),
      random
    );
    try {
      const javascript = cut(translator, task, programs[task], kind, random);
      if (javascript === undefined) {
        continue;
      }
      const source = translator.translateFragment(
        javascript,
        'javascript',
        from
      );
      translator.translateFragment(source, from, to);
      return { task, kind, from, to, source };
    } catch {
      // This pair cannot say this fragment: try another one.
    }
  }
  return undefined;
}
