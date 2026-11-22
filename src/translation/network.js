import {
  ByteRange,
  LinkMetadata,
  LinkNetwork,
  LinkType,
  Point,
  SourceSpan,
} from 'meta-language';

const encoder = new globalThis.TextEncoder();

function syntax(network, language, type, term, children) {
  return network.insertLink(
    children,
    LinkMetadata.new().withLinkType(type).withLanguage(language).withTerm(term)
  );
}

function point(network, name) {
  return network.insertPoint(name);
}

function ordered(network, language, children) {
  return children.reduceRight(
    (rest, child) =>
      syntax(network, language, LinkType.Relation, 'next', [child, rest]),
    point(network, 'end')
  );
}

export function sourceNetwork(source, language, interpretation) {
  const network = new LinkNetwork();
  const tokens = source.match(/[^\n]*\n|[^\n]+/g) ?? [];
  const commentLines = new Set(
    interpretation?.comments.map(({ line }) => line)
  );
  let offset = 0;
  const lines = tokens.map((text, line) => {
    const length = encoder.encode(text).length;
    const end = text.endsWith('\n')
      ? new Point(line + 1, 0)
      : new Point(line, [...text].length);
    const span = new SourceSpan(
      new ByteRange(offset, offset + length),
      new Point(line, 0),
      end
    );
    offset += length;
    const token = network.insertSourceToken(language, text, span);
    const kind = commentLines.has(line)
      ? 'comment'
      : text.trim()
        ? 'code'
        : 'trivia';
    return network.insertSyntaxNode(language, kind, [token]);
  });
  const root = network.insertSyntaxNode(
    language,
    interpretation?.form ?? 'unclassified',
    [ordered(network, language, lines)]
  );
  if (interpretation) {
    const meaning = effectNetwork(interpretation.effect, network);
    bindOperation(network, language, interpretation, root, meaning.id);
  }
  return network;
}

function bindOperation(network, language, { output, requires }, root, meaning) {
  const prerequisites = requires.map((requirement) =>
    point(network, requirement)
  );
  const operation = syntax(network, language, LinkType.Semantic, output, [
    root,
    ordered(network, language, prerequisites),
  ]);
  syntax(network, language, LinkType.Semantic, 'realizes', [
    operation,
    meaning,
  ]);
}

export function targetNetwork(language, projection, binding) {
  const { network, id } = effectNetwork(projection.effect);
  const comments = projection.comments.map(({ placement, text }) =>
    syntax(network, language, LinkType.Syntax, placement, [
      point(network, text),
    ])
  );
  const root = syntax(network, language, LinkType.Syntax, projection.form, [
    ordered(network, language, comments),
  ]);
  bindOperation(network, language, binding, root, id);
  return { network, id };
}

export function effectNetwork(effect, network = new LinkNetwork()) {
  const { task, ...values } = effect;
  const fields = Object.entries(values).map(([key, value]) =>
    syntax(network, 'meta', LinkType.Relation, key, [
      point(network, String(value)),
    ])
  );
  const id = syntax(network, 'meta', LinkType.Semantic, task, [
    ordered(network, 'meta', fields),
  ]);
  return { network, id };
}
