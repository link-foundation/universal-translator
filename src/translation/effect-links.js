import { formatRecord, parseLinks } from './links.js';
import { validateEffect } from './profile.js';
import { effectFields } from './profile-data.js';

export function readEffects(source) {
  const links = parseLinks(source);
  if (!links.length) {
    throw new Error('Expected a Links Notation effect');
  }
  return links.map(({ id: task, values }) => {
    const fields = effectFields(values);
    const effect = validateEffect({ ...fields, task });
    if (values.length + 1 !== Object.keys(effect).length) {
      throw new Error(`Invalid ${task} effect`);
    }
    return effect;
  });
}

export function writeEffect(input) {
  const { task, ...fields } = validateEffect(input);
  return formatRecord(task, fields);
}

export const metaAdapter = {
  parse(source) {
    let effects;
    try {
      effects = readEffects(source);
    } catch {
      return undefined;
    }
    if (effects.length !== 1) {
      return undefined;
    }
    const comments = [];
    let placement = 'leading';
    for (const [line, sourceLine] of source.split('\n').entries()) {
      const text = sourceLine.trim();
      if (text.startsWith('#')) {
        comments.push({ text: text.slice(1).trim(), placement, line });
      } else if (text) {
        placement = 'body';
      }
    }
    return {
      effect: effects[0],
      form: 'standard',
      comments,
      output: 'effect',
      requires: [],
    };
  },
  emit({ effect, comments, form }) {
    if (form !== 'standard') {
      throw new Error(`Unsupported form "${form}" for meta`);
    }
    const lines = { leading: [], body: [] };
    for (const { text, placement } of comments) {
      if (text !== text.trim() || /[\r\n]/.test(text)) {
        throw new Error(
          'Comment cannot be represented safely in Links Notation'
        );
      }
      lines[placement].push(text ? `# ${text}` : '#');
    }
    return [...lines.leading, writeEffect(effect), ...lines.body, ''].join(
      '\n'
    );
  },
};
