// HTTP adapter around the translator: a thin boundary that validates
// JSON input and hands it to the pure translation core.
import { createServer } from 'node:http';
import { URL } from 'node:url';

import { createGrammarTranslator } from './translator.js';

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

function checkRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
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
  for (const key of ['commentLanguage', 'commentFrom']) {
    if (body[key] !== undefined && typeof body[key] !== 'string') {
      throw new Error(`"${key}" must be a string`);
    }
  }
  return {
    source: body.source,
    from: body.from,
    to: body.to,
    fragment: body.fragment === true,
    options: {
      mode: body.mode,
      commonLibrary: body.commonLibrary === true,
      commentLanguage: body.commentLanguage,
      commentFrom: body.commentFrom,
    },
  };
}

function runTranslation(translator, { source, from, to, fragment, options }) {
  if (fragment && typeof translator.translateFragment === 'function') {
    return translator.translateFragment(source, from, to, options);
  }
  return translator.translate(source, from, to, options);
}

/**
 * Create an HTTP server with two routes:
 * GET /languages lists the programming and natural languages;
 * POST /translate takes {source, from, to, fragment?, mode?, commonLibrary?,
 * commentLanguage?, commentFrom?} and answers {output} or {error}.
 */
export function createTranslationServer({
  translator = createGrammarTranslator(),
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
          throw new Error(`The body is not JSON: ${error.message}`);
        }
        const output = runTranslation(translator, checkRequest(body));
        reply(response, 200, { output });
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
