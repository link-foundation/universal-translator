import {
  Grammar,
  GrammarParseError,
  createGrammarParser,
  grammarEmitter,
  grammarImporter,
  mergeGrammars,
} from './engine.js';
import { grammarConcrete, sourceNode } from './concrete.js';

const stages = [
  'beforeImport',
  'afterImport',
  'beforeCompile',
  'afterParse',
  'beforeExport',
  'afterExport',
];
const asList = (value) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const limits = {
  maxDepth: 256,
  stepLimit: 1_000_000,
  memoLimit: 100_000,
  memoryLimit: 200_000,
};

function text(value, role) {
  if (typeof value !== 'string' || /\p{Surrogate}/u.test(value)) {
    throw new TypeError(`Expected ${role} as Unicode text`);
  }
  return value;
}

function checkedGrammar(value) {
  if (!(value instanceof Grammar)) {
    throw new TypeError('A grammar transform must return a Grammar');
  }
  return value;
}

function validateHooks(hooks) {
  for (const [stage, callbacks] of Object.entries(hooks)) {
    if (stage !== 'trace' && !stages.includes(stage)) {
      throw new Error(`Unknown grammar stage ${stage}`);
    }
    if (asList(callbacks).some((callback) => typeof callback !== 'function')) {
      throw new TypeError(`Grammar stage ${stage} needs functions`);
    }
  }
}

function readGrammar(workspace, source, options, lower) {
  const result = workspace.parse(source, options);
  if (!result.ok) {
    throw new GrammarParseError(result.rejection);
  }
  const tree = lower(result.tree, {
    source,
    syntax: result.syntax,
    node: (kind, fields, range) => sourceNode(source, kind, fields, range),
  });
  if (!tree || tree.kind !== 'SourceProgram' || !Array.isArray(tree.items)) {
    throw new TypeError(
      'A grammar reader must return a SourceProgram with items'
    );
  }
  return { ...tree, language: result.syntax.language, syntax: result.syntax };
}

function parserDecorator(workspace, readers, options = {}) {
  return (next) => (source, syntax) => {
    const lower = readers[syntax.id];
    return lower
      ? workspace.read(source, { ...options, language: syntax.id }, lower)
      : next(source, syntax);
  };
}

function provenance(ids, get) {
  return ids.map((id) => {
    const { revision, url } = get(id);
    return { id, revision, url };
  });
}

/** Import, update and execute grammars without discarding their provenance. */
export function createGrammarWorkspace(hooks = {}) {
  validateHooks(hooks);
  const sources = new Map();
  let previous;
  const run = (stage, value, context) => {
    hooks.trace?.(stage, context);
    return asList(hooks[stage]).reduce(
      (current, hook) => hook(current, context),
      value
    );
  };
  const get = (id) => {
    const entry = sources.get(id);
    if (!entry) {
      throw new Error(`Unknown grammar source ${id}`);
    }
    return entry;
  };
  const merge = (options = {}) => {
    previous = mergeGrammars([...sources.values()], { ...options, previous });
    return previous;
  };
  const select = ({ language, edition = '', sourceId } = {}) => {
    if (sourceId) {
      const entry = get(sourceId);
      return {
        grammar: entry.grammar,
        language: entry.language,
        sources: [entry.id],
      };
    }
    const group = merge().groups.find(
      (entry) => entry.language === language && entry.edition === edition
    );
    if (!group) {
      throw new Error(`No imported grammar for ${language}@${edition}`);
    }
    return group;
  };
  const workspace = {
    import(descriptor) {
      const { id, language, format } = descriptor;
      if (!id || !language || id.includes(':')) {
        throw new Error(
          'A grammar source needs an id without colon and a language'
        );
      }
      const importer = grammarImporter(format);
      if (!importer) {
        throw new Error(`Unsupported grammar format ${format}`);
      }
      const context = {
        ...descriptor,
        edition: descriptor.edition ?? '',
        precedence: descriptor.precedence ?? 0,
      };
      const source = text(
        run('beforeImport', text(descriptor.source, 'grammar source'), context),
        'transformed grammar source'
      );
      const grammar = checkedGrammar(
        run('afterImport', importer(source), context)
      );
      const entry = Object.freeze({
        ...context,
        importedSource: source,
        grammar,
      });
      // An invalid update never replaces the last successfully imported value.
      sources.set(id, entry);
      return entry;
    },
    update(id, patch) {
      return workspace.import({ ...get(id), ...patch, id });
    },
    async refresh(id, load) {
      const entry = get(id);
      const patch = await load({ ...entry });
      return workspace.update(
        id,
        typeof patch === 'string' ? { source: patch } : patch
      );
    },
    remove(id) {
      get(id);
      sources.delete(id);
    },
    sources: () => [...sources.values()],
    merge,
    grammar: (options) => select(options).grammar,
    parse(source, options) {
      text(source, 'source');
      const group = select(options);
      const context = {
        ...options,
        language: group.language,
        provenance: provenance(group.sources, get),
      };
      const grammar = checkedGrammar(
        run('beforeCompile', group.grammar, context)
      );
      const parser = createGrammarParser(grammar, {
        ...limits,
        ...options?.limits,
        resolveGrammar: (id) => get(id).grammar,
      });
      const outcome = run('afterParse', parser.parseTree(source), {
        ...context,
        source,
      });
      return {
        ...outcome,
        syntax: grammarConcrete(
          source,
          group.language,
          outcome,
          context.provenance
        ),
      };
    },
    export(format, options) {
      const emitter = grammarEmitter(format);
      if (!emitter) {
        throw new Error(`Unsupported grammar format ${format}`);
      }
      const context = { ...options, format };
      const grammar = checkedGrammar(
        run('beforeExport', select(options).grammar, context)
      );
      const result = emitter(grammar);
      if (result.report.lossy.length) {
        throw new Error(
          `Grammar conversion would lose: ${result.report.lossy.join('; ')}`
        );
      }
      return text(
        run('afterExport', result.source, context),
        'exported grammar'
      );
    },
    read(source, options, lower) {
      return readGrammar(workspace, source, options, lower);
    },
    decorateParser(readers, options = {}) {
      return parserDecorator(workspace, readers, options);
    },
  };
  return workspace;
}
