import registries from './bundled/index.js';
import {
  linkFields,
  namedLinks,
  parseLinks,
  reference,
  references,
} from './links.js';

export function effectFields(values) {
  return Object.fromEntries(
    [...linkFields(values)].map(([name, children]) => {
      const value = reference(children);
      if (name === 'message') {
        return [name, value];
      }
      if (!/^(?:0|[1-9][0-9]*)$/.test(value)) {
        throw new Error(`Expected a decimal integer for ${name}`);
      }
      return [name, Number(value)];
    })
  );
}

function form(values, kind) {
  const fields = linkFields(values);
  return {
    task: reference(fields.get('task')),
    name: reference(fields.get('name')),
    source:
      kind === 'meta-language'
        ? []
        : namedLinks(fields.get('source'), 'line').map(reference),
    fixed: fields.has('fixed') ? effectFields(fields.get('fixed')) : undefined,
    requires: fields.has('requires')
      ? references(fields.get('requires'))
      : undefined,
    output: fields.has('output') ? reference(fields.get('output')) : undefined,
  };
}

function profile(values) {
  const fields = linkFields(values);
  const kind = fields.has('kind')
    ? reference(fields.get('kind'))
    : 'programming';
  return {
    id: reference(fields.get('id')),
    label: reference(fields.get('label')),
    kind,
    comment: reference(fields.get('comment')),
    commentEnd: fields.has('commentEnd')
      ? reference(fields.get('commentEnd'))
      : undefined,
    header: fields.has('header') ? Number(reference(fields.get('header'))) : 0,
    call: reference(fields.get('call')),
    output: reference(fields.get('output')),
    forms: namedLinks(fields.get('forms'), 'form').map((values) =>
      form(values, kind)
    ),
  };
}

let profiles;
export default function loadProfiles() {
  profiles ??= registries.flatMap((source) =>
    namedLinks(parseLinks(source), 'profile').map(profile)
  );
  return globalThis.structuredClone(profiles);
}
