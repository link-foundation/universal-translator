// HTTP adapter around the translator: a thin boundary that validates
// JSON input and hands it to the pure translation core.
import { createServer } from 'node:http';
import { URL } from 'node:url';

import { createGrammarTranslator } from './translator.js';
import { readRules } from './translation/rules-notation.js';

const MODES = ['context-dependent', 'literal', 'same-effect'];
const LIMIT = 1024 * 1024;

function reply(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > LIMIT) {
        reject(new Error('The request body is larger than 1 MiB'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

// Regular expressions from a client could take exponential time (ReDoS),
// so a server accepts only plain text rules unless it is told otherwise.
const hasRegexRule = (rules) =>
  ['source', 'output'].some(
    (stage) =>
      Array.isArray(rules[stage]) && rules[stage].some((rule) => rule?.regex)
  );

const isObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Rules are Links Notation text or an object; regular expressions in them
// only when allowed.
function checkRules(given, allowRegexRules) {
  if (given === undefined) {
    return undefined;
  }
  const rules = typeof given === 'string' ? readRules(given) : given;
  if (!isObject(rules)) {
    throw new Error('"rules" must be Links Notation text or an object');
  }
  if (!allowRegexRules && hasRegexRule(rules)) {
    throw new Error(
      'This server accepts only plain text rules (start it with allowRegexRules to accept regular expressions)'
    );
  }
  return rules;
}

function checkRequest(body, { allowRegexRules = false } = {}) {
  if (!isObject(body)) {
    throw new Error('Send a JSON object');
  }
  for (const key of ['source', 'from', 'to']) {
    if (typeof body[key] !== 'string' || (key !== 'source' && !body[key])) {
      throw new Error(`"${key}" must be a string`);
    }
  }
  if (body.mode !== undefined && !MODES.includes(body.mode)) {
    throw new Error(`"mode" must be one of ${MODES.join(', ')}`);
  }
  for (const key of [
    'commentLanguage',
    'commentFrom',
    'identifierLanguage',
    'identifierFrom',
  ]) {
    if (body[key] !== undefined && typeof body[key] !== 'string') {
      throw new Error(`"${key}" must be a string`);
    }
  }
  if (
    body.layout !== undefined &&
    !['source', 'target'].includes(body.layout)
  ) {
    throw new Error('"layout" must be one of source, target');
  }
  const rules = checkRules(body.rules, allowRegexRules);
  return {
    source: body.source,
    from: body.from,
    to: body.to,
    fragment: body.fragment === true,
    allOrNothing: body.allOrNothing === true,
    rules,
    options: {
      mode: body.mode,
      commonLibrary: body.commonLibrary === true,
      commentLanguage: body.commentLanguage,
      commentFrom: body.commentFrom,
      identifierLanguage: body.identifierLanguage,
      identifierFrom: body.identifierFrom,
      layout: body.layout,
    },
  };
}

// Partial by default: the answer holds the translation and the parts that
// could not be translated. "allOrNothing" fails at the first such part.
// The source language "auto" is detected first.
function runTranslation(
  base,
  { source, from, to, fragment, allOrNothing, rules, options }
) {
  const translator =
    rules && typeof base.withRules === 'function'
      ? base.withRules(rules)
      : base;
  let language = from;
  let detected;
  if (from === 'auto') {
    detected = translator.detectLanguage?.(source)[0]?.id;
    if (!detected) {
      throw new Error('The language of the text could not be detected');
    }
    language = detected;
  }
  const extra = detected ? { detected } : {};
  if (allOrNothing || typeof translator.translatePartial !== 'function') {
    const output =
      fragment && typeof translator.translateFragment === 'function'
        ? translator.translateFragment(source, language, to, options)
        : translator.translate(source, language, to, options);
    return { output, complete: true, errors: [], ...extra };
  }
  const result = translator.translatePartial(source, language, to, {
    ...options,
    fragment,
  });
  return {
    output: result.text,
    complete: result.complete,
    errors: result.errors.map(({ line, endLine, message }) => ({
      line,
      endLine,
      message,
    })),
    coverage: result.coverage,
    ...(result.lineMap ? { lineMap: result.lineMap } : {}),
    ...extra,
  };
}

/**
 * Create an HTTP server with two routes:
 * GET /languages lists the programming and natural languages;
 * POST /translate takes {source, from (or "auto"), to, fragment?, mode?,
 * commonLibrary?, commentLanguage?, commentFrom?, identifierLanguage?,
 * identifierFrom?, layout?, allOrNothing?, rules?} and answers {output, complete, errors, coverage?, lineMap?,
 * detected?} or {error}. lineMap pairs 0-based source and target lines. The
 * rules are Links Notation text (or an object). Rules with regular
 * expressions are refused unless `allowRegexRules` is true.
 */
export function createTranslationServer({
  translator = createGrammarTranslator(),
  allowRegexRules = false,
} = {}) {
  const languages = () => ({
    languages: translator.languages(),
    naturalLanguages: translator.naturalLanguages(),
  });
  return createServer(async (request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    try {
      if (request.method === 'OPTIONS') {
        reply(response, 200, {});
      } else if (request.method === 'GET' && pathname === '/languages') {
        reply(response, 200, languages());
      } else if (request.method === 'POST' && pathname === '/translate') {
        let body;
        try {
          body = JSON.parse(await readBody(request));
        } catch (error) {
          throw new Error(`The body is not JSON: ${error.message}`, {
            cause: error,
          });
        }
        reply(
          response,
          200,
          runTranslation(translator, checkRequest(body, { allowRegexRules }))
        );
      } else {
        reply(response, 404, {
          error: `No route for ${request.method} ${pathname}`,
        });
      }
    } catch (error) {
      reply(response, 400, { error: error.message });
    }
  });
}
