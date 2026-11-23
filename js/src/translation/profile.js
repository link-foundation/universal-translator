import loadProfiles from './profile-data.js';

const slots = /\{\{([a-z]+)\}\}/g;
const messageEncoder = new globalThis.TextEncoder();
const extendedMessage = /[^ A-Za-z0-9,.!?;:_+/()=<>-]/;
const invalidMessage =
  /[^ \p{L}\p{M}\p{N},.!?;:_+/()=<>'¡՛։、！-]|\?\?[=/()!<>-]/u;
// Comments must stay on one source line, including in lexers that recognize Unicode line separators.
// eslint-disable-next-line no-control-regex
const commentControl = /[\u0000-\u001f\u007f\u0085\u2028\u2029]/;
const blockComments = new Set([
  'c',
  'cpp',
  'csharp',
  'go',
  'java',
  'javascript',
  'kotlin',
  'php',
  'rust',
  'swift',
  'typescript',
]);
const message = (value) =>
  typeof value === 'string' &&
  value.length <= 96 &&
  !invalidMessage.test(value) &&
  messageEncoder.encode(value).length <= 96;
const limit = (value) => Number.isInteger(value) && value >= 1 && value <= 1000;
const taskFields = {
  hello: { message },
  'write-text': { message },
  'empty-program': { status: (value) => value === 0 },
  'gcd-function': { max: (value) => value === 2147483647 },
  'greatest-common-divisor': {
    left: (value) =>
      Number.isInteger(value) && value >= 0 && value <= 2147483647,
    right: (value) =>
      Number.isInteger(value) && value >= 0 && value <= 2147483647,
  },
  'fizz-buzz': { limit },
  'fizz-buzz-lowercase': { limit },
  'fizz-buzz-quoted': { limit },
  'fizz-buzz-lowercase-blank-line': { limit },
};

export function languageProfiles() {
  return loadProfiles();
}

export function validateEffect(effect) {
  const fields =
    effect && Object.hasOwn(taskFields, effect.task) && taskFields[effect.task];
  if (
    !fields ||
    !Object.entries(fields).every(([field, validate]) =>
      validate(effect[field])
    )
  ) {
    throw new Error('Effect is outside the supported task domain');
  }
  return Object.fromEntries([
    ['task', effect.task],
    ...Object.keys(fields).map((field) => [field, effect[field]]),
  ]);
}

export function sameEffect(left, right) {
  if (!left || !right || left.task !== right.task) {
    return false;
  }
  return Object.keys(taskFields[left.task]).every(
    (field) => left[field] === right[field]
  );
}

function readForm(form, source) {
  if (!source.startsWith(form.parts[0])) {
    return undefined;
  }
  const effect = { task: form.task, ...form.fixed };
  let offset = form.parts[0].length;
  for (let index = 0; index < form.fields.length; index++) {
    const field = form.fields[index];
    const nextPart = form.parts[index + 1];
    const end = nextPart ? source.indexOf(nextPart, offset) : source.length;
    if (end < offset) {
      return undefined;
    }
    const raw = source.slice(offset, end);
    if (
      field !== 'message' &&
      (!raw || /[^0-9]/.test(raw) || (raw.length > 1 && raw.startsWith('0')))
    ) {
      return undefined;
    }
    const value = field === 'message' ? raw : Number(raw);
    if (Object.hasOwn(effect, field) && effect[field] !== value) {
      return undefined;
    }
    effect[field] = value;
    offset = end + nextPart.length;
  }
  if (offset !== source.length) {
    return undefined;
  }
  try {
    return validateEffect(effect);
  } catch {
    return undefined;
  }
}

function commentText(profile, line) {
  const trimmed = line.replace(/^[ \t]+/, '');
  if (
    blockComments.has(profile.id) &&
    trimmed.startsWith('/*') &&
    trimmed.endsWith('*/')
  ) {
    const text = trimmed.slice(2, -2);
    return /\/\*|\*\//.test(text) ? undefined : text.trim();
  }
  if (!trimmed.startsWith(profile.comment) || trimmed.startsWith('#!')) {
    return undefined;
  }
  const text = trimmed.slice(profile.comment.length);
  if (profile.commentEnd && !text.endsWith(profile.commentEnd)) {
    return undefined;
  }
  return (
    profile.commentEnd ? text.slice(0, -profile.commentEnd.length) : text
  ).trim();
}

function compileForm(form) {
  const pattern = form.source
    .filter((line) => line.trim())
    .map((line) => line.trimEnd())
    .join('\n');
  const parts = pattern.split(slots);
  return {
    ...form,
    fields: parts.filter((_, index) => index % 2 === 1),
    parts: parts.filter((_, index) => index % 2 === 0),
    singleQuotedMessage: pattern.includes("'{{message}}"),
  };
}

function supportsEffect(profile, form, effect) {
  if (effect.message === undefined || !extendedMessage.test(effect.message)) {
    return true;
  }
  return (
    (profile.kind === 'natural-language' || profile.unicodeGreeting) &&
    !(form.singleQuotedMessage && effect.message.includes("'"))
  );
}

function safeComment(profile, text) {
  return (
    typeof text === 'string' &&
    !commentControl.test(text) &&
    !text.endsWith('\\') &&
    !text.endsWith('??/') &&
    !(
      profile.commentEnd &&
      (text.includes(profile.comment) || text.includes(profile.commentEnd))
    ) &&
    !(profile.id === 'ocaml' && text.includes('"')) &&
    !(profile.id === 'xslt' && text.includes('--')) &&
    !(profile.id === 'php' && text.includes('?>')) &&
    !(profile.id === 'python' && /coding[=:]/.test(text))
  );
}

function commentDirective(profile, line) {
  const content = line.replace(/^[ \t]+/, '');
  switch (profile.id) {
    case 'java':
      return /\\u/.test(content);
    case 'go':
      return /^(?:\/\/go:|\/\/[ \t]*\+build\b|\/\/line\b|\/\*line\b)/.test(
        content
      );
    case 'lua':
      return /^--\[=*\[/.test(content);
    case 'julia':
      return content.startsWith('#=');
    case 'nim':
      return /^##?\[/.test(content);
    case 'raku':
      return content.startsWith('#`');
    case 'powershell':
      return /^#requires\b/i.test(content);
    case 'ruby':
      return /(?:coding|frozen_string_literal|warn_indent|shareable_constant_value)\s*:/.test(
        content
      );
    default:
      return false;
  }
}

function makeComments(profile, comments, placement) {
  return comments
    .filter((comment) => comment.placement === placement)
    .map(({ text }) => {
      if (!safeComment(profile, text) || text !== text.trim()) {
        throw new Error(
          'Comment cannot be represented safely in the target language'
        );
      }
      const line = [profile.comment, text, profile.commentEnd]
        .filter(Boolean)
        .join(' ');
      if (commentDirective(profile, line)) {
        throw new Error(
          'Comment cannot be represented safely in the target language'
        );
      }
      return line;
    });
}

export function dependencies(profile, form) {
  return {
    output: form?.output ?? profile.output,
    requires:
      form?.requires ??
      profile.forms.find(
        ({ task, name }) => task === 'hello' && name === 'standard'
      )?.requires ??
      [],
  };
}

export function profileAdapter(profile) {
  const forms = profile.forms.map(compileForm);
  return {
    parse(source) {
      if (profile.id === 'php' && !/^<\?php\r?\n/.test(source)) {
        return undefined;
      }
      const code = [];
      const comments = [];
      let leading = true;
      for (const [index, line] of source
        .replaceAll('\r\n', '\n')
        .split('\n')
        .entries()) {
        const trimmed = line.replace(/[ \t]+$/, '');
        const text = commentText(profile, trimmed);
        if (text !== undefined) {
          if (
            !safeComment(profile, text) ||
            commentDirective(profile, trimmed) ||
            commentControl.test(trimmed.replace(/^[ \t]+/, ''))
          ) {
            return undefined;
          }
          comments.push({
            text,
            placement: leading ? 'leading' : 'body',
            line: index,
          });
        } else if (trimmed) {
          code.push(trimmed);
          if (code.length > (profile.header ?? 0)) {
            leading = false;
          }
        }
      }
      const normalized = code.join('\n');
      for (const form of forms) {
        const effect = readForm(form, normalized);
        if (effect && supportsEffect(profile, form, effect)) {
          return {
            effect,
            form: form.name,
            comments,
            ...dependencies(profile, form),
          };
        }
      }
      return undefined;
    },
    emit({ effect, comments, form: name }) {
      const form = forms.find(
        (candidate) => candidate.task === effect.task && candidate.name === name
      );
      if (
        !form ||
        !supportsEffect(profile, form, effect) ||
        (form.fixed && !sameEffect(effect, { task: form.task, ...form.fixed }))
      ) {
        throw new Error(
          `Unsupported ${effect.task} effect or form "${name}" for ${profile.id}`
        );
      }
      const lines = form.source.map((line) =>
        line.replaceAll(slots, (_, field) => String(effect[field]))
      );
      const body = makeComments(profile, comments, 'body');
      const leading = makeComments(profile, comments, 'leading');
      const placeholderLine = form.source.findIndex((line) =>
        line.includes('{{message}}')
      );
      const bodyLine = lines.findIndex((line) =>
        line.includes(form.output ?? profile.output)
      );
      const position = Math.max(
        profile.header ?? 0,
        placeholderLine >= 0 ? placeholderLine : bodyLine
      );
      const indentation = lines[position]?.match(/^\s*/)[0] ?? '';
      lines.splice(position, 0, ...body.map((line) => indentation + line));
      lines.splice(profile.header ?? 0, 0, ...leading);
      return lines.length ? `${lines.join('\n')}\n` : '';
    },
  };
}
