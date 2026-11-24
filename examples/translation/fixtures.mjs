import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import {
  linkFields,
  namedLinks,
  parseLinks,
  reference,
  references,
} from '../../js/src/translation/links.js';

export function fixture(name) {
  return readFileSync(new URL(name, import.meta.url), 'utf8');
}

export function translationData(name) {
  const directory = new URL('../../data/translation/', import.meta.url);
  return readFileSync(new URL(name, directory), 'utf8');
}

function observation(values) {
  if (values === undefined) {
    return undefined;
  }
  const fields = linkFields(values);
  return {
    count: Number(reference(fields.get('count'))),
    total: Number(reference(fields.get('total'))),
  };
}

export function referentInput() {
  const [link] = namedLinks(
    parseLinks(translationData('referent-input.lino')),
    'referents'
  );
  const fields = linkFields(link);
  return {
    source: reference(fields.get('source')),
    candidates: namedLinks(fields.get('candidates'), 'candidate').map(
      (values) => {
        const candidate = linkFields(values);
        return {
          id: reference(candidate.get('id')),
          target: reference(candidate.get('target')),
          type: references(candidate.get('type')),
          back: references(candidate.get('back')),
          sourceEvidence: observation(candidate.get('sourceEvidence')),
          targetEvidence: observation(candidate.get('targetEvidence')),
          context: candidate.has('context')
            ? Number(reference(candidate.get('context')))
            : undefined,
        };
      }
    ),
  };
}
